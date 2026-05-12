#!/usr/bin/env python3
"""2-user join-call E2E — moderator + member via in-app JWT flow.

Both users log in at auth.clouddelnorte.org, land on awsug.clouddelnorte.org,
navigate to /meetings/, and click the 'join call' button which triggers
fetchJitsiToken → renders JitsiEmbed iframe inline (or opens meet.clouddelnorte.org
in a new tab for external-tab flows).

Moderator creates a meeting first, then joins via the meetings page 'join call'
button (NOT the direct link on the create-success page, which lacks JWT).
Member then logs in and joins the same room via the same button.

Sequential execution required: Nova Act AWS Service auth context does not
propagate to child threads.
"""
import json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

# --- Constants ---
AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
MEETINGS_URL = "https://awsug.clouddelnorte.org/meetings/index.html"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
MEETING_TITLE = f"nova-act-test-{TS}"

# --- Credential fetch (in-memory only) ---
_session = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2")
sm_client = _session.client("secretsmanager")
ssm_client = _session.client("ssm")
MOD_PASSWORD = sm_client.get_secret_value(SecretId="cloud-del-norte/heraldstack-cognito-pw")["SecretString"]
MEM_PASSWORD = ssm_client.get_parameter(Name="/cloud-del-norte/test/smoketest-user-password", WithDecryption=True)["Parameter"]["Value"]
MOD_EMAIL = "heraldstack@clouddelnorte.org"
MEM_EMAIL = "heraldstack-test-member@clouddelnorte.org"

results = {"moderator": {}, "member": {}, "verdict": "FAIL"}


def log(role: str, msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}][{role}] {msg}", flush=True)


def screenshot(nova, role: str, label: str) -> str:
    fname = f"{role}-{label}-{TS}.png"
    path = str(OUTPUT_DIR / fname)
    nova.page.screenshot(path=path)
    log(role, f"Screenshot: {fname}")
    return path


def login(nova, email: str, password: str, role: str):
    nova.act(f"Enter '{email}' in the email field.")
    nova.page.fill('input[type="password"], input[name="password"], #password', password)
    try:
        nova.act("Click the sign in button.")
    except ActActuationError:
        # Redirect causes screenshot timeout — that's expected success
        pass
    time.sleep(6)
    log(role, f"Login done. URL: {nova.page.url}")


def wait_for_jitsi_tab(nova, role: str):
    """After clicking join call, wait for the new tab (Jitsi) to load.
    Nova Act auto-tracks the latest page via context.pages[-1]."""
    time.sleep(8)
    pages = nova.pages
    log(role, f"Pages open: {len(pages)}")
    for i, p in enumerate(pages):
        log(role, f"  page[{i}]: {p.url}")
    # nova.page already points to pages[-1] (the newest tab)
    log(role, f"Active page: {nova.page.url}")
    time.sleep(15)


def assert_jitsi_reached(nova, role: str, result: dict) -> bool:
    """Assert that the current page is actually a Jitsi conference.

    Checks (in order):
      a) URL starts with https://meet.clouddelnorte.org  (external-tab flow)
      b) DOM contains Jitsi embed iframe                 (inline embed flow)

    Additionally asserts at least one Jitsi toolbar marker is present.

    Sets result['status'] to 'joined' or 'misrouted' and logs debug info.
    Returns True if Jitsi was reached.
    """
    page = nova.page
    current_url = page.url

    # --- Check A: external tab landed on meet subdomain ---
    url_ok = current_url.startswith("https://meet.clouddelnorte.org")

    # --- Check B: inline embed iframe present on current page ---
    embed_ok = False
    if not url_ok:
        embed_ok = bool(
            page.query_selector("#jitsi-embed")
            or page.query_selector("iframe[src*='meet.clouddelnorte.org']")
            or page.query_selector("[data-testid='jitsi-iframe-host'] iframe")
        )

    jitsi_present = url_ok or embed_ok

    # --- Toolbar marker check (only if we think we're in Jitsi) ---
    toolbar_ok = False
    if jitsi_present:
        toolbar_ok = bool(
            page.query_selector("[aria-label='Mute / Unmute']")
            or page.query_selector("[aria-label='Hang up']")
            or page.query_selector("button[aria-label*='mute']")
            or page.query_selector("button[aria-label*='hangup']")
            or page.query_selector("button[aria-label*='hang up']")
            # Jitsi prejoin page
            or page.query_selector("button[data-testid='prejoin.joinMeeting']")
            or page.query_selector("div.prejoin-input-area-container")
        )

    if jitsi_present and toolbar_ok:
        result["status"] = "joined"
        log(role, f"Jitsi confirmed — url_ok={url_ok}, embed_ok={embed_ok}, toolbar_ok={toolbar_ok}")
        return True

    # --- Misrouted: log debug info ---
    result["status"] = "misrouted"
    try:
        body_text = page.inner_text("body") or ""
        body_snippet = body_text[:300]
    except Exception:
        body_snippet = "<could not read body>"
    log(role, f"MISROUTED — url={current_url}")
    log(role, f"  url_ok={url_ok}, embed_ok={embed_ok}, toolbar_ok={toolbar_ok}")
    log(role, f"  body[:300]: {body_snippet!r}")
    result["misroute_url"] = current_url
    result["misroute_body"] = body_snippet
    return False


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-join-call-2user",
)
def run_2user_test():
    # === MODERATOR ===
    r = results["moderator"]
    r["start_time"] = datetime.now(timezone.utc).isoformat()
    t0 = time.time()
    log("MOD", "Starting moderator session")

    with browser_session(region="us-east-1", name="cdn-2user-mod") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=AUTH_URL, headless=True, tty=False,
        ) as nova:
            try:
                login(nova, MOD_EMAIL, MOD_PASSWORD, "MOD")
                r["login"] = "success"

                # Navigate to meetings
                nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
                time.sleep(2)
                log("MOD", f"At meetings. URL: {nova.page.url}")

                # Create meeting
                nova.act("Click the 'create meeting' button.")
                time.sleep(3)
                log("MOD", f"Create form. URL: {nova.page.url}")

                nova.act(f"Enter '{MEETING_TITLE}' in the 'Speaker names' field.")
                nova.act("Click the 'Create meeting' submit button. Wait for success message.")
                time.sleep(3)
                log("MOD", "Meeting created")

                # Return to meetings page (NOT the direct join-call link which lacks JWT)
                nova.act("Click the 'Back to meetings' button.")
                time.sleep(3)
                log("MOD", f"Back at meetings. URL: {nova.page.url}")

                # Join call via in-app JWT flow
                nova.act("Click the 'join call' button.")
                wait_for_jitsi_tab(nova, "MOD")
                r["jitsi_url"] = nova.page.url
                screenshot(nova, "MOD", "jitsi-joined")

                assert_jitsi_reached(nova, "MOD", r)
                log("MOD", f"Status: {r['status']}")

                if r["status"] == "joined":
                    check = nova.act_get(
                        "Describe what you see. Is this a video call interface? "
                        "Any error messages or 'session expired' text?"
                    )
                    r["jitsi_state"] = check.response
                    log("MOD", f"State: {check.response[:150]}")
                    r["time_to_join_s"] = round(time.time() - t0, 1)

            except Exception as e:
                log("MOD", f"ERROR: {e}")
                try:
                    log("MOD", f"URL: {nova.page.url}")
                    screenshot(nova, "MOD", "error")
                except Exception:
                    pass
                r["error"] = str(e)

    # === MEMBER ===
    rm = results["member"]
    rm["start_time"] = datetime.now(timezone.utc).isoformat()
    t1 = time.time()
    log("MEM", "Starting member session")

    with browser_session(region="us-east-1", name="cdn-2user-mem") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=AUTH_URL, headless=True, tty=False,
        ) as nova:
            try:
                login(nova, MEM_EMAIL, MEM_PASSWORD, "MEM")
                rm["login"] = "success"

                # Navigate to meetings
                nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
                time.sleep(2)
                log("MEM", f"At meetings. URL: {nova.page.url}")

                # Join call via in-app JWT flow
                nova.act("Click the 'join call' button.")
                wait_for_jitsi_tab(nova, "MEM")
                rm["jitsi_url"] = nova.page.url
                screenshot(nova, "MEM", "jitsi-joined")

                assert_jitsi_reached(nova, "MEM", rm)
                log("MEM", f"Status: {rm['status']}")

                if rm["status"] == "joined":
                    # Wait for both participants to appear
                    time.sleep(10)
                    screenshot(nova, "MEM", "jitsi-settled")

                    check = nova.act_get(
                        "Describe what you see. Is this a video call interface? "
                        "How many participants are visible? Any error messages?"
                    )
                    rm["jitsi_state"] = check.response
                    log("MEM", f"State: {check.response[:150]}")
                    rm["time_to_join_s"] = round(time.time() - t1, 1)

            except Exception as e:
                log("MEM", f"ERROR: {e}")
                try:
                    log("MEM", f"URL: {nova.page.url}")
                    screenshot(nova, "MEM", "error")
                except Exception:
                    pass
                rm["error"] = str(e)

    # === VERDICT ===
    mod_ok = results["moderator"].get("status") == "joined"
    mem_ok = results["member"].get("status") == "joined"
    if mod_ok and mem_ok:
        results["verdict"] = "PASS"
    elif mod_ok or mem_ok:
        results["verdict"] = "DEGRADED"
    else:
        results["verdict"] = "FAIL"
    results["timestamp"] = datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    log("MAIN", f"2-user join-call validation — {TS}")
    run_2user_test()
    print(f"\n{'='*60}")
    print(f"VERDICT: {results['verdict']}")
    print(f"Moderator: {results['moderator'].get('status', 'unknown')} "
          f"(TTJ: {results['moderator'].get('time_to_join_s', 'N/A')}s)")
    print(f"Member: {results['member'].get('status', 'unknown')} "
          f"(TTJ: {results['member'].get('time_to_join_s', 'N/A')}s)")
    print(f"{'='*60}")
    print(json.dumps(results, indent=2, default=str))
