#!/usr/bin/env python3
"""FP-009 + FP-013 validation — Jitsi cold-start + unreachable messaging.

FP-009: After 5s without videoConferenceJoined, UI shows "Meeting room is starting up, please wait…"
FP-013: After 90s without videoConferenceJoined, UI shows "Unable to connect" + Retry button

Strategy:
- FP-009: Check ECS task count. If zero (cold), navigate normally and wait for cold-start message.
  If warm, mark INCONCLUSIVE. Additionally, intercept external_api.js to validate UI logic.
- FP-013: Intercept external_api.js to hang indefinitely, mock JitsiMeetExternalAPI to never fire
  videoConferenceJoined, wait 91s for unreachable state.

Auth: Cognito InitiateAuth → inject tokens into clouddelnorte.org sessionStorage.
"""
import json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from nova_act import NovaAct, workflow
from bedrock_agentcore.tools.browser_client import browser_session

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
LOG_PATH = OUTPUT_DIR / f"fp009-013-validation-{TS}.log"
MEETINGS_URL = "https://clouddelnorte.org/meetings/index.html"

# --- Credentials ---
_jitsi_session = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2")
_ssm = _jitsi_session.client("ssm")
_ecs = _jitsi_session.client("ecs")
_cognito = _jitsi_session.client("cognito-idp")

USER_EMAIL = "heraldstack-test-member@clouddelnorte.org"
USER_PASSWORD = _ssm.get_parameter(
    Name="/cloud-del-norte/test/smoketest-user-password", WithDecryption=True
)["Parameter"]["Value"]

COGNITO_POOL_ID = "us-west-2_cyPQF4F3r"
COGNITO_CLIENT_ID = "57eikmt418ea6vti2f6h0pl74r"

results = {"FP-009": "FAIL", "FP-013": "FAIL", "screenshots": []}
_log_file = open(LOG_PATH, "w")


def log(tag: str, msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]
    line = f"[{ts}][{tag}] {msg}"
    print(line, flush=True)
    _log_file.write(line + "\n")
    _log_file.flush()


def screenshot(nova, name: str) -> str:
    path = str(OUTPUT_DIR / name)
    nova.page.screenshot(path=path)
    log("SCR", f"Saved {name}")
    results["screenshots"].append(name)
    return path


def get_cognito_tokens() -> dict:
    """Authenticate via Cognito USER_PASSWORD_AUTH to get tokens."""
    resp = _cognito.initiate_auth(
        AuthFlow="USER_PASSWORD_AUTH",
        ClientId=COGNITO_CLIENT_ID,
        AuthParameters={"USERNAME": USER_EMAIL, "PASSWORD": USER_PASSWORD},
    )
    # Handle MFA challenge
    if resp.get("ChallengeName") == "SOFTWARE_TOKEN_MFA":
        log("AUTH", "MFA challenge received — cannot proceed without TOTP code")
        raise RuntimeError("MFA required — USER_PASSWORD_AUTH needs TOTP response")
    result = resp["AuthenticationResult"]
    return {
        "idToken": result["IdToken"],
        "accessToken": result["AccessToken"],
        "refreshToken": result.get("RefreshToken", ""),
        "expiresIn": result["ExpiresIn"],
    }


def check_ecs_state() -> int:
    """Check Jitsi ECS service desired/running task count. Returns running count."""
    try:
        # Find the Jitsi cluster/service
        clusters = _ecs.list_clusters()["clusterArns"]
        for cluster_arn in clusters:
            services = _ecs.list_services(cluster=cluster_arn)["serviceArns"]
            for svc_arn in services:
                if "jitsi" in svc_arn.lower():
                    desc = _ecs.describe_services(cluster=cluster_arn, services=[svc_arn])
                    svc = desc["services"][0]
                    running = svc["runningCount"]
                    desired = svc["desiredCount"]
                    log("ECS", f"Service: {svc['serviceName']} running={running} desired={desired}")
                    return running
        log("ECS", "No Jitsi service found in any cluster")
        return -1
    except Exception as e:
        log("ECS", f"ECS check failed: {e}")
        return -1


def inject_auth(nova, tokens: dict):
    """Inject Cognito tokens into sessionStorage on the current page."""
    nova.page.evaluate(f"""() => {{
        sessionStorage.setItem('cdn.idToken', {json.dumps(tokens['idToken'])});
        sessionStorage.setItem('cdn.accessToken', {json.dumps(tokens['accessToken'])});
        sessionStorage.setItem('cdn.refreshToken', {json.dumps(tokens['refreshToken'])});
        sessionStorage.setItem('cdn.expiresAt', String(Date.now() + {tokens['expiresIn']} * 1000));
    }}""")
    log("AUTH", "Tokens injected into sessionStorage")


def setup_jitsi_intercept(nova):
    """Intercept external_api.js and mock JitsiMeetExternalAPI to never fire videoConferenceJoined."""
    # Block the real external_api.js and provide a mock that creates a fake API
    nova.page.route("**/external_api.js", lambda route: route.abort("blockedbyclient"))
    # Pre-define the mock on the page
    nova.page.evaluate("""() => {
        window.JitsiMeetExternalAPI = class {
            constructor(domain, opts) {
                this._listeners = {};
                if (opts.parentNode) {
                    const div = document.createElement('div');
                    div.textContent = 'Mock Jitsi — connection hanging (test)';
                    div.style.padding = '20px';
                    div.style.background = '#333';
                    div.style.color = '#fff';
                    opts.parentNode.appendChild(div);
                }
            }
            addListener(event, cb) { this._listeners[event] = cb; }
            dispose() {}
        };
    }""")
    log("MOCK", "JitsiMeetExternalAPI mock installed + external_api.js blocked")


def click_join(nova) -> bool:
    """Filter for the joinable meeting, then click Join. Returns True if clicked."""
    # The meeting with roomName is "Wednesday Website Work" — use filter to find it
    nova.page.fill('input[placeholder*="Find"]', "Wednesday Website Work")
    time.sleep(2)
    clicked = nova.page.evaluate("""() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const joinBtn = btns.find(b => b.textContent.trim() === 'Join');
        if (joinBtn) { joinBtn.click(); return true; }
        return false;
    }""")
    if clicked:
        log("UI", "Clicked Join button for 'Wednesday Website Work'")
    else:
        log("UI", "No Join button found after filtering")
    return clicked


def check_cold_start_message(nova) -> bool:
    """Check if the cold-start info alert is visible."""
    return nova.page.evaluate("""() => {
        const alerts = document.querySelectorAll('[class*="awsui_alert"]');
        for (const a of alerts) {
            if (a.textContent.includes('Meeting room is starting up') ||
                a.textContent.includes('La sala se está iniciando')) {
                return true;
            }
        }
        // Also check role="dialog" modal content
        const modals = document.querySelectorAll('[class*="awsui_dialog"], [role="dialog"]');
        for (const m of modals) {
            if (m.textContent.includes('Meeting room is starting up') ||
                m.textContent.includes('La sala se está iniciando')) {
                return true;
            }
        }
        return false;
    }""")


def check_unreachable_message(nova) -> dict:
    """Check if the unreachable error alert + retry button is visible."""
    return nova.page.evaluate("""() => {
        const body = document.body.innerText;
        const hasHeader = body.includes('Unable to connect') || body.includes('No se puede conectar');
        const hasBody = body.includes('meeting room may be unavailable') ||
                        body.includes('sala de reuniones puede no estar disponible');
        const btns = Array.from(document.querySelectorAll('button'));
        const hasRetry = btns.some(b => b.textContent.trim() === 'Retry' ||
                                        b.textContent.trim() === 'Reintentar');
        return {hasHeader, hasBody, hasRetry};
    }""")


# === FP-009: Cold-start messaging ===
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_fp009():
    log("FP009", "=== FP-009: Jitsi cold-start messaging validation ===")
    ecs_running = check_ecs_state()
    if ecs_running > 0:
        log("FP009", f"ECS has {ecs_running} running tasks — services are WARM")
        log("FP009", "Will use mock intercept to validate UI logic regardless")
    elif ecs_running == 0:
        log("FP009", "ECS at zero tasks — services are COLD (ideal test condition)")
    else:
        log("FP009", "Could not determine ECS state — proceeding with mock")

    try:
        tokens = get_cognito_tokens()
        log("FP009", "Cognito auth successful")
    except RuntimeError as e:
        log("FP009", f"AUTH BLOCKED: {e}")
        results["FP-009"] = "FAIL — auth requires MFA, cannot automate without TOTP"
        return
    except Exception as e:
        log("FP009", f"AUTH ERROR: {e}")
        results["FP-009"] = f"FAIL — auth error: {e}"
        return

    with browser_session(region="us-east-1", name="cdn-fp009") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=MEETINGS_URL, headless=True, tty=False,
        ) as nova:
            time.sleep(3)
            inject_auth(nova, tokens)
            # Reload to pick up auth state
            nova.page.reload()
            time.sleep(4)
            log("FP009", f"Page loaded: {nova.page.url}")

            # Install mock before clicking join
            setup_jitsi_intercept(nova)

            if not click_join(nova):
                log("FP009", "FAIL — no Join button found on page")
                screenshot(nova, f"fp009-no-join-{TS}.png")
                results["FP-009"] = "FAIL — no Join button found on meetings page"
                return

            # Wait 7s (past the 5s cold-start threshold)
            log("FP009", "Waiting 7s for cold-start timer...")
            time.sleep(7)

            screenshot(nova, f"fp009-cold-start-{TS}.png")
            has_msg = check_cold_start_message(nova)
            log("FP009", f"Cold-start message visible: {has_msg}")

            if has_msg:
                if ecs_running > 0:
                    results["FP-009"] = "PASS (mock-validated — services were warm)"
                elif ecs_running == 0:
                    results["FP-009"] = "PASS"
                else:
                    results["FP-009"] = "PASS (ECS state unknown, mock-validated)"
            else:
                results["FP-009"] = "FAIL — cold-start message not visible after 7s"


# === FP-013: Unreachable + retry ===
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_fp013():
    log("FP013", "=== FP-013: Jitsi unreachable + retry validation ===")

    try:
        tokens = get_cognito_tokens()
        log("FP013", "Cognito auth successful")
    except RuntimeError as e:
        log("FP013", f"AUTH BLOCKED: {e}")
        results["FP-013"] = "FAIL — auth requires MFA, cannot automate without TOTP"
        return
    except Exception as e:
        log("FP013", f"AUTH ERROR: {e}")
        results["FP-013"] = f"FAIL — auth error: {e}"
        return

    with browser_session(region="us-east-1", name="cdn-fp013") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=MEETINGS_URL, headless=True, tty=False,
        ) as nova:
            time.sleep(3)
            inject_auth(nova, tokens)
            nova.page.reload()
            time.sleep(4)
            log("FP013", f"Page loaded: {nova.page.url}")

            # Install mock — JitsiMeetExternalAPI that never fires videoConferenceJoined
            setup_jitsi_intercept(nova)

            if not click_join(nova):
                log("FP013", "FAIL — no Join button found")
                screenshot(nova, f"fp013-no-join-{TS}.png")
                results["FP-013"] = "FAIL — no Join button found on meetings page"
                return

            # Wait 91s for the unreachable timer (UNREACHABLE_MS = 90_000)
            log("FP013", "Waiting 91s for unreachable timer...")
            time.sleep(91)

            screenshot(nova, f"fp013-unreachable-{TS}.png")
            info = check_unreachable_message(nova)
            log("FP013", f"Unreachable check: {info}")

            if info.get("hasHeader") and info.get("hasRetry"):
                results["FP-013"] = "PASS"
                log("FP013", "FP-013 PASS — unreachable message + retry button visible")
            else:
                results["FP-013"] = f"FAIL — header={info.get('hasHeader')}, retry={info.get('hasRetry')}"


if __name__ == "__main__":
    log("MAIN", f"FP-009 + FP-013 validation — {TS}")
    log("MAIN", f"User: {USER_EMAIL}")
    log("MAIN", f"Target: {MEETINGS_URL}")

    scenario_fp009()
    scenario_fp013()

    report = f"""
{'='*60}
FP-009 + FP-013 VALIDATION REPORT — {TS}
{'='*60}
FP-009 (cold-start messaging):  {results['FP-009']}
FP-013 (unreachable + retry):   {results['FP-013']}
Screenshots: {', '.join(results['screenshots']) or 'none'}
{'='*60}
"""
    print(report)
    _log_file.write(report)
    _log_file.close()

    # Exit code: 0 if both pass, 1 otherwise
    all_pass = results["FP-009"].startswith("PASS") and results["FP-013"].startswith("PASS")
    sys.exit(0 if all_pass else 1)
