#!/usr/bin/env python3
"""Signup-flow friction-point validation — FP-001, FP-002, FP-004, FP-007.

Validates four Sprint 3 signup-UX fixes via Nova Act with fresh disposable emails.
"""
import json, os, signal, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

# --- Constants ---
SIGNUP_URL = "https://auth.clouddelnorte.org/signup/index.html"
LOGIN_URL = "https://auth.clouddelnorte.org/login/index.html"
HOME_URL = "https://clouddelnorte.org/"
USER_POOL_ID = "us-west-2_cyPQF4F3r"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
LOG_PATH = OUTPUT_DIR / f"signup-flow-validation-{TS}.log"
SCENARIO_TIMEOUT = 180

# --- Generate disposable credentials ---
ts_epoch = int(time.time())
TEST_EMAIL = f"ux-probe-{ts_epoch}@clouddelnorte.org"
TEST_PASSWORD = f"Pr0be!{ts_epoch}Xz#q"  # meets 12+ upper+lower+digit+symbol
TEST_NAME = "UX Probe Bot"

# --- Results ---
results = {
    "FP-004": "FAIL",
    "FP-007": "FAIL",
    "FP-001": "FAIL",
    "FP-002": "FAIL",
}
created_users: list[str] = []

_log_file = open(LOG_PATH, "w")


def log(tag: str, msg: str):
    line = f"[{datetime.now(timezone.utc).strftime('%H:%M:%S.%f')[:-3]}][{tag}] {msg}"
    print(line, flush=True)
    _log_file.write(line + "\n")
    _log_file.flush()


def screenshot(nova, name: str) -> str:
    path = str(OUTPUT_DIR / name)
    nova.page.screenshot(path=path)
    log("SCR", f"Saved {name}")
    return path


def cognito_admin_confirm(email: str):
    """Admin-confirm a user via CLI (jitsi-video-hosting profile)."""
    cmd = [
        "aws", "cognito-idp", "admin-confirm-sign-up",
        "--user-pool-id", USER_POOL_ID,
        "--username", email,
        "--profile", "jitsi-video-hosting",
        "--region", "us-west-2",
    ]
    log("AWS", f"admin-confirm-sign-up {email}")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        log("AWS", f"WARN confirm failed: {r.stderr.strip()}")
    else:
        log("AWS", "confirmed OK")


def cognito_delete_user(email: str):
    """Delete test user (best-effort cleanup)."""
    cmd = [
        "aws", "cognito-idp", "admin-delete-user",
        "--user-pool-id", USER_POOL_ID,
        "--username", email,
        "--profile", "jitsi-video-hosting",
        "--region", "us-west-2",
    ]
    log("CLEANUP", f"deleting {email}")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        log("CLEANUP", f"WARN delete failed: {r.stderr.strip()}")
    else:
        log("CLEANUP", f"deleted {email}")


class ScenarioTimeout(Exception):
    pass


def _timeout_handler(signum, frame):
    raise ScenarioTimeout("Scenario exceeded timeout")


# =============================================================================
# SCENARIO 1 — FP-004: Password policy visible before first attempt
# =============================================================================
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_fp004():
    log("FP004", "=== SCENARIO 1: Password policy visibility ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-signup-fp004") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=SIGNUP_URL, headless=True, tty=False,
            ) as nova:
                time.sleep(4)
                screenshot(nova, f"fp004-signup-page-{TS}.png")

                # Extract visible text from the page — specifically near password field
                body_text = nova.page.inner_text("body")
                log("FP004", f"Page text (first 1000): {body_text[:1000]}")

                # Check for password policy keywords BEFORE any interaction
                body_lower = body_text.lower()
                checks = {
                    "length": any(k in body_lower for k in ["12+", "12 char", "at least 12"]),
                    "uppercase": any(k in body_lower for k in ["upper", "uppercase"]),
                    "lowercase": any(k in body_lower for k in ["lower", "lowercase"]),
                    "numbers": any(k in body_lower for k in ["number", "digit", "nums"]),
                    "symbols": any(k in body_lower for k in ["symbol", "special"]),
                }
                passed = sum(1 for v in checks.values() if v)
                log("FP004", f"Policy checks: {checks} — {passed}/5 matched")

                if passed >= 3:
                    results["FP-004"] = "PASS"
                    log("FP004", "PASS — password policy visible before interaction")
                else:
                    log("FP004", f"FAIL — only {passed}/5 policy requirements visible")
    except ScenarioTimeout:
        log("FP004", "TIMEOUT")
    except Exception as e:
        log("FP004", f"ERROR: {e}")
    finally:
        signal.alarm(0)


# =============================================================================
# SCENARIO 2 — FP-007: Wizard state persistence across navigation
# =============================================================================
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_fp007():
    log("FP007", "=== SCENARIO 2: Wizard persistence ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-signup-fp007") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=SIGNUP_URL, headless=True, tty=False,
            ) as nova:
                time.sleep(3)

                # Fill email and display name via DOM (reliable)
                nova.act(
                    f"Type '{TEST_EMAIL}' into the Email field. "
                    f"Type '{TEST_NAME}' into the Display name field."
                )
                time.sleep(1)
                screenshot(nova, f"fp007-filled-{TS}.png")

                # Navigate away
                log("FP007", "Navigating away...")
                nova.page.goto(HOME_URL, wait_until="domcontentloaded")
                time.sleep(2)

                # Navigate back
                log("FP007", "Navigating back to signup...")
                nova.page.goto(SIGNUP_URL, wait_until="domcontentloaded")
                time.sleep(4)

                screenshot(nova, f"fp007-returned-{TS}.png")

                # Check if fields are still populated
                body_text = nova.page.inner_text("body")
                log("FP007", f"Body after return (first 500): {body_text[:500]}")

                # Check sessionStorage for wizard state
                storage = nova.page.evaluate("sessionStorage.getItem('cdn-signup-wizard-state')")
                log("FP007", f"sessionStorage wizard state: {storage}")

                if storage:
                    state = json.loads(storage)
                    email_persisted = state.get("email", "") == TEST_EMAIL
                    name_persisted = state.get("displayName", "") == TEST_NAME
                    log("FP007", f"email_persisted={email_persisted}, name_persisted={name_persisted}")
                    if email_persisted and name_persisted:
                        results["FP-007"] = "PASS"
                        log("FP007", "PASS — wizard state persisted across navigation")
                    else:
                        log("FP007", "FAIL — state exists but values don't match")
                else:
                    log("FP007", "FAIL — no wizard state in sessionStorage")
    except ScenarioTimeout:
        log("FP007", "TIMEOUT")
    except Exception as e:
        log("FP007", f"ERROR: {e}")
    finally:
        signal.alarm(0)


# =============================================================================
# SCENARIO 3 — FP-001: MFA help text + SCENARIO 4 — FP-002: MFA escape path
# Combined: signup → confirm → login → MFA_SETUP screen
# =============================================================================
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_fp001_fp002():
    log("MFA", "=== SCENARIO 3+4: MFA help text + escape path ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    mfa_email = f"ux-probe-mfa-{int(time.time())}@clouddelnorte.org"
    mfa_password = f"Pr0be!{int(time.time())}Xz#q"
    try:
        # --- Phase 1: Signup via form ---
        with browser_session(region="us-east-1", name="cdn-signup-mfa") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=SIGNUP_URL, headless=True, tty=False,
            ) as nova:
                time.sleep(4)
                log("MFA", f"Filling signup form with {mfa_email}")

                nova.page.fill('input[type="email"]', mfa_email)
                name_input = nova.page.query_selector('input[placeholder*="Alex"]')
                if name_input:
                    name_input.fill("MFA Test User")
                else:
                    inputs = nova.page.query_selector_all('input[type="text"]')
                    if len(inputs) >= 1:
                        inputs[0].fill("MFA Test User")

                pw_inputs = nova.page.query_selector_all('input[type="password"]')
                for inp in pw_inputs:
                    inp.fill(mfa_password)

                time.sleep(1)
                screenshot(nova, f"mfa-signup-filled-{TS}.png")

                log("MFA", "Advancing through wizard steps...")
                nova.act("Click the button labeled 'continue'.")
                time.sleep(2)
                nova.act("Click the button labeled 'continue'.")
                time.sleep(2)
                nova.act("Click the button labeled 'continue'.")
                time.sleep(6)

                log("MFA", f"URL after signup submit: {nova.page.url}")
                created_users.append(mfa_email)

        # --- Phase 2: Admin-confirm ---
        cognito_admin_confirm(mfa_email)
        time.sleep(2)

        # --- Phase 3: Fresh login attempt + MFA screen validation ---
        # Pool MFA is OPTIONAL (no Lambda triggers). MFA_SETUP challenge only
        # fires if user has TOTP preferred but no device — which requires prior
        # association. For a fresh user, Cognito returns tokens directly.
        # Strategy: attempt login, if MFA_SETUP renders validate it live;
        # otherwise validate via deployed JS bundle on the login page.
        with browser_session(region="us-east-1", name="cdn-login-mfa") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=LOGIN_URL, headless=True, tty=False,
            ) as nova:
                time.sleep(4)
                log("MFA", "Filling login credentials in fresh session...")
                nova.page.fill('input[type="email"]', mfa_email)
                nova.page.fill('input[type="password"]', mfa_password)
                time.sleep(1)

                try:
                    nova.act("Click the 'Sign in' button.")
                except ActActuationError:
                    pass
                time.sleep(8)

                current_url = nova.page.url
                log("MFA", f"URL after login: {current_url}")
                body_text = nova.page.inner_text("body")
                body_lower = body_text.lower()

                # Check if we landed on MFA_SETUP screen
                on_mfa_screen = any(k in body_lower for k in [
                    "authenticator app", "qr code", "scan this",
                    "6-digit code from your authenticator",
                ])

                if on_mfa_screen:
                    log("MFA", "MFA_SETUP screen detected — validating live")
                    screenshot(nova, f"mfa-setup-screen-{TS}.png")
                else:
                    log("MFA", "MFA_SETUP not triggered (pool is OPTIONAL, no device required)")
                    log("MFA", "Falling back to deployed JS bundle validation...")

                    # Navigate to login page and extract the JS bundle content
                    nova.page.goto(LOGIN_URL, wait_until="domcontentloaded")
                    time.sleep(3)

                    # Get all script sources AND modulepreload links
                    scripts = nova.page.evaluate("""
                        () => {
                            const srcs = Array.from(document.querySelectorAll('script[src]'))
                                .map(s => s.src);
                            const preloads = Array.from(document.querySelectorAll('link[rel="modulepreload"]'))
                                .map(l => l.href);
                            return [...srcs, ...preloads];
                        }
                    """)
                    log("MFA", f"Script bundles found: {len(scripts)} files")

                    # Fetch all bundle content
                    bundle_text = ""
                    for script_url in scripts:
                        try:
                            content = nova.page.evaluate("""
                                async (url) => {
                                    const r = await fetch(url);
                                    return await r.text();
                                }
                            """, script_url)
                            bundle_text += content
                        except Exception as e:
                            log("MFA", f"WARN: could not fetch {script_url}: {e}")

                    if not bundle_text:
                        bundle_text = nova.page.content()

                    log("MFA", f"Total content size: {len(bundle_text)} chars")
                    bundle_lower = bundle_text.lower()
                    body_lower = bundle_lower  # reuse for checks below

                # --- FP-001 validation ---
                has_app = any(k in body_lower for k in [
                    "google authenticator", "authy", "authenticator app",
                    "play.google.com", "apps.apple.com",
                ])
                has_contact = any(k in body_lower for k in [
                    "heraldstack@clouddelnorte.org", "support", "contact",
                    "help", "recovery",
                ])
                has_instructions = any(k in body_lower for k in [
                    "scan", "qr code", "6-digit", "authenticator",
                    "verify", "enter",
                ])
                log("MFA", f"FP-001 checks: app={has_app}, contact={has_contact}, instructions={has_instructions}")

                if has_app and has_contact and has_instructions:
                    results["FP-001"] = "PASS"
                    log("MFA", "FP-001 PASS — MFA help text present in deployed code")
                else:
                    log("MFA", "FP-001 FAIL — missing MFA help text elements")

                # --- FP-002 validation ---
                # Check if the deployed code contains a cancel/back escape on MFA screen
                # The source shows only "Verify & sign in" button — no cancel/back.
                # The hostageHeader alert says "Do not close this tab" with contact info.
                # FP-002 requires a cancel/back button that doesn't lock the account.
                has_escape_button = any(k in bundle_lower for k in [
                    "cancel mfa", "skip mfa", "back to login",
                    "cancel setup", "skip setup",
                ])
                # Also check for a button/link near the MFA form that navigates away
                # Looking at login/app.tsx: the mfa-setup step has NO cancel button
                # The hostageHeader says "Do not close this tab" — opposite of escape
                if not has_escape_button:
                    # Check if there's any navigation away from MFA setup
                    has_any_escape = any(k in body_lower for k in [
                        "cancel", "go back", "skip",
                    ])
                    if has_any_escape and on_mfa_screen:
                        log("MFA", "FP-002: escape text found — checking if clickable")
                    else:
                        log("MFA", "FP-002 FAIL — no cancel/back/skip escape path on MFA setup screen")
                        log("MFA", "NOTE: MFA setup screen has 'Do not close this tab' warning + contact email")
                        log("MFA", "NOTE: This is mitigation (FP-002 commit e110d311) but NOT a true escape path")
                else:
                    results["FP-002"] = "PASS"
                    log("MFA", "FP-002 PASS — escape path found in deployed code")

                screenshot(nova, f"mfa-final-state-{TS}.png")

    except ScenarioTimeout:
        log("MFA", "TIMEOUT")
        if mfa_email not in created_users:
            created_users.append(mfa_email)
    except Exception as e:
        log("MFA", f"ERROR: {e}")
        if mfa_email not in created_users:
            created_users.append(mfa_email)
    finally:
        signal.alarm(0)


# =============================================================================
# MAIN
# =============================================================================
if __name__ == "__main__":
    log("MAIN", f"Signup-flow validation — {TS}")
    log("MAIN", f"Test email: {TEST_EMAIL}")
    log("MAIN", f"MFA email will be generated at runtime")

    scenario_fp004()
    scenario_fp007()
    scenario_fp001_fp002()

    # --- Cleanup ---
    log("CLEANUP", f"Cleaning up {len(created_users)} test users")
    for email in set(created_users):
        try:
            cognito_delete_user(email)
        except Exception as e:
            log("CLEANUP", f"WARN: {e}")

    # --- Report ---
    report = f"""
{'='*60}
SIGNUP-FLOW VALIDATION REPORT — {TS}
{'='*60}
FP-004 (password policy visible before attempt): {results['FP-004']}
FP-007 (wizard persistence across tab close):    {results['FP-007']}
FP-001 (MFA setup help text):                    {results['FP-001']}
FP-002 (MFA abandonment escape):                 {results['FP-002']}
{'='*60}
"""
    print(report)
    _log_file.write(report)
    _log_file.close()
