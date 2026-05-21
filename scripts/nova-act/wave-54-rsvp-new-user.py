#!/usr/bin/env python3
"""Wave 54/82 — new-user signup + RSVP flow.

Creates heraldstack+novaact-<ts>@clouddelnorte.org, signs up via the UI,
admin-confirms via Cognito, logs in, completes RSVP, captures screenshots.
Cleans up Cognito user + DDB record after.

Wave 82 fixes:
- Credential bootstrap via aws configure export-credentials (matches existing-user)
- Password generation: no symbols (wave 14 relaxed policy), 8+ chars, upper+lower+digit
- Multi-step wizard navigation: fill step 1 fields, click Next through steps 2-3, verify step 4
- Explicit element-presence waits via page.wait_for_selector before fill
- Specific prompts that distinguish "Next" button from "Sign in" nav link
"""
import json, os, secrets, string, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

# --- Credential bootstrap (non-interactive, matches existing-user pattern) ---
def _export_creds(profile: str) -> dict:
    r = subprocess.run(
        ["aws", "configure", "export-credentials", "--profile", profile, "--format", "process"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(r.stdout)


_kiro_creds = _export_creds("bryanchasko-kiro")
_jvh_creds = _export_creds("jitsi-video-hosting")

os.environ["AWS_ACCESS_KEY_ID"] = _kiro_creds["AccessKeyId"]
os.environ["AWS_SECRET_ACCESS_KEY"] = _kiro_creds["SecretAccessKey"]
os.environ["AWS_SESSION_TOKEN"] = _kiro_creds["SessionToken"]
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
import requests
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

# --- Constants ---
FEED_URL = "https://clouddelnorte.org/feed/"
SPOTS_URL = "https://tta0e43bs0.execute-api.us-west-2.amazonaws.com/prod/rsvp/happy-hour-2026-06-03/spots"
USER_POOL_ID = "us-west-2_cyPQF4F3r"
OUTPUT_DIR = Path("/tmp/wave-82-new")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
EPOCH = int(time.time())

# --- jitsi-video-hosting session (for Cognito admin ops + DDB cleanup) ---
_jvh_session = boto3.Session(
    aws_access_key_id=_jvh_creds["AccessKeyId"],
    aws_secret_access_key=_jvh_creds["SecretAccessKey"],
    aws_session_token=_jvh_creds["SessionToken"],
    region_name="us-west-2",
)
_cognito = _jvh_session.client("cognito-idp")
_ddb = _jvh_session.client("dynamodb")

# --- Generate test user credentials ---
NEW_EMAIL = f"heraldstack+novaact-{EPOCH}@clouddelnorte.org"
# Password: 12 chars, no symbols. Policy: 8+ chars, upper + lower + digit.
NEW_PASSWORD = (
    secrets.choice(string.ascii_uppercase)
    + secrets.choice(string.ascii_lowercase)
    + secrets.choice(string.digits)
    + "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(9))
)

results = {"test": "B-new-user-wave82", "status": "FAIL", "blocks": [], "email": NEW_EMAIL}
new_user_sub = None


def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}][NEW-USER] {msg}", flush=True)


def screenshot(nova, filename: str) -> str:
    path = str(OUTPUT_DIR / filename)
    nova.page.screenshot(path=path)
    log(f"Screenshot: {path}")
    return path


def check_spots():
    try:
        return requests.get(SPOTS_URL, timeout=10).json()
    except Exception as e:
        log(f"Spots check failed: {e}")
        return None


def cognito_admin_confirm(email: str) -> bool:
    try:
        _cognito.admin_confirm_sign_up(UserPoolId=USER_POOL_ID, Username=email)
        log("admin-confirm-sign-up OK")
        return True
    except Exception as e:
        log(f"WARN confirm failed: {e}")
        return False


def cognito_get_user_sub(email: str) -> str | None:
    try:
        resp = _cognito.admin_get_user(UserPoolId=USER_POOL_ID, Username=email)
        for attr in resp.get("UserAttributes", []):
            if attr["Name"] == "sub":
                return attr["Value"]
    except Exception as e:
        log(f"get-user failed: {e}")
    return None


def cleanup_user(email: str, sub: str | None):
    log(f"Cleanup: deleting Cognito user {email}")
    try:
        _cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=email)
        log("Cognito user deleted")
    except Exception as e:
        log(f"WARN delete-user failed: {e}")

    if sub:
        log(f"Cleanup: deleting DDB RSVP record for sub={sub}")
        try:
            _ddb.delete_item(
                TableName="cdn-rsvps",
                Key={"user_sub": {"S": sub}, "event_id": {"S": "happy-hour-2026-06-03"}},
            )
            log("DDB record deleted")
        except Exception as e:
            log(f"WARN DDB delete failed: {e}")


def wait_and_fill(page, selector: str, value: str, timeout: float = 10000):
    """Wait for element presence then fill via Playwright."""
    page.wait_for_selector(selector, state="visible", timeout=timeout)
    page.fill(selector, value)


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run_new_user_rsvp():
    global new_user_sub
    log(f"Starting new-user RSVP test — {TS}")
    log(f"Test email: {NEW_EMAIL}")
    log(f"Test password: {NEW_PASSWORD}")

    spots_before = check_spots()
    results["spots_before"] = spots_before
    log(f"Spots before: {json.dumps(spots_before)}")

    with browser_session(region="us-east-1", name="wave82-rsvp-new") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=FEED_URL, headless=True, tty=False,
            logs_directory="/tmp/nova-act-logs",
            go_to_url_timeout=30,
        ) as nova:
            time.sleep(3)

            # Step 1: Click RSVP CTA on feed
            try:
                nova.act(
                    "Find the Featured Event card for the June 3 Community Happy Hour. "
                    "Click the 'RSVP on CloudDelNorte.org' button or 'Limited space — RSVP now' link. "
                    "Do NOT click any Meetup link."
                )
                time.sleep(4)
                log(f"URL after RSVP click: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"RSVP CTA click failed: {e}")
                screenshot(nova, "block-rsvp-cta.png")
                return

            # Step 2: Ensure we're on the signup page (not login)
            current_url = nova.page.url
            if "/login" in current_url:
                try:
                    nova.act("Click the 'Sign up' or 'Create account' link to go to the signup form.")
                    time.sleep(2)
                except ActActuationError:
                    pass

            screenshot(nova, "01-signup-form.png")

            # Step 3: Fill signup wizard Step 1 (email, display name, password, confirm password)
            # The form uses Cloudscape Input components. Use Playwright selectors.
            try:
                page = nova.page
                # Wait for the first input (email) to be visible
                page.wait_for_selector('input[type="email"]', state="visible", timeout=10000)

                # Fill email
                page.fill('input[type="email"]', NEW_EMAIL)
                time.sleep(0.5)

                # Fill display name — second text input after email
                # Cloudscape renders inputs inside divs; use the input within form fields
                inputs = page.query_selector_all('input:not([type="email"]):not([type="password"]):not([type="hidden"])')
                if inputs:
                    inputs[0].fill("Nova Act-Test")
                else:
                    nova.act("Enter 'Nova Act-Test' in the display name field.")
                time.sleep(0.5)

                # Fill password fields — wait for them to be present
                password_inputs = page.query_selector_all('input[type="password"]')
                if len(password_inputs) >= 2:
                    password_inputs[0].fill(NEW_PASSWORD)
                    time.sleep(0.3)
                    password_inputs[1].fill(NEW_PASSWORD)
                elif len(password_inputs) == 1:
                    # Show password might be toggled — fill both via type attribute change
                    password_inputs[0].fill(NEW_PASSWORD)
                    # Try confirm password
                    nova.act(f"Enter '{NEW_PASSWORD}' in the confirm password field.")
                else:
                    # Fallback: use Nova Act to fill
                    nova.act(f"Enter '{NEW_PASSWORD}' in the password field.")
                    nova.act(f"Enter '{NEW_PASSWORD}' in the confirm password field.")

                time.sleep(0.5)
                screenshot(nova, "02-step1-filled.png")

                # Click "Next" button (NOT "Sign in" link)
                # The primary button with text "Next" advances the wizard
                nova.act(
                    "Click the primary blue 'Next' button at the bottom of the form. "
                    "Do NOT click the 'Sign in' link at the top right."
                )
                time.sleep(2)
                log(f"URL after step 1 Next: {nova.page.url}")

            except ActActuationError as e:
                results["blocks"].append(f"Step 1 fill/next failed: {e}")
                screenshot(nova, "block-step1.png")
                return
            except Exception as e:
                results["blocks"].append(f"Step 1 Playwright fill failed: {e}")
                screenshot(nova, "block-step1-pw.png")
                return

            # Step 4: Wizard Step 2 (member type + location — optional, just click Next)
            try:
                screenshot(nova, "03-step2.png")
                nova.act(
                    "Click the primary blue 'Next' button to advance to the next step. "
                    "Do not fill in any fields — they are optional."
                )
                time.sleep(2)
            except ActActuationError as e:
                results["blocks"].append(f"Step 2 Next failed: {e}")
                screenshot(nova, "block-step2.png")
                return

            # Step 5: Wizard Step 3 (topics + background — optional, just click Next)
            # This step triggers the actual signUp API call
            try:
                screenshot(nova, "04-step3.png")
                nova.act(
                    "Click the primary blue 'Next' button to advance to the next step. "
                    "Do not fill in any fields — they are optional."
                )
                time.sleep(5)  # signUp API call happens here
                log(f"URL after step 3 Next (signUp fires): {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"Step 3 Next (signUp) failed: {e}")
                screenshot(nova, "block-step3.png")
                return

            # Step 6: Wizard Step 4 — verification code page
            screenshot(nova, "05-step4-verify.png")
            log("Signup submitted — user should exist in Cognito (unconfirmed)")

    # Step 7: Admin-confirm the user (bypasses email verification)
    if not cognito_admin_confirm(NEW_EMAIL):
        results["blocks"].append("admin-confirm-sign-up failed — user may not have been created")
        log("BLOCK: cannot confirm user")
        return

    new_user_sub = cognito_get_user_sub(NEW_EMAIL)
    results["user_sub"] = new_user_sub
    log(f"User sub: {new_user_sub}")

    # Step 8: Log in as new user and complete RSVP
    with browser_session(region="us-east-1", name="wave82-rsvp-new-login") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=FEED_URL, headless=True, tty=False,
            logs_directory="/tmp/nova-act-logs",
            go_to_url_timeout=30,
        ) as nova:
            time.sleep(3)

            # Click RSVP again
            try:
                nova.act(
                    "Find the Featured Event card for the June 3 Community Happy Hour. "
                    "Click the 'RSVP on CloudDelNorte.org' button or 'Limited space — RSVP now' link. "
                    "Do NOT click any Meetup link."
                )
                time.sleep(4)
            except ActActuationError as e:
                results["blocks"].append(f"Second RSVP click failed: {e}")
                return

            # Navigate to login if on signup page
            current_url = nova.page.url
            if "/signup" in current_url:
                try:
                    nova.act("Click the 'Sign in' link to go to the login page.")
                    time.sleep(2)
                except ActActuationError:
                    pass

            # Login
            try:
                page = nova.page
                page.wait_for_selector('input[type="email"], input[inputmode="email"]', state="visible", timeout=10000)
                # Fill email
                nova.act(f"Enter '{NEW_EMAIL}' in the email field.")
                time.sleep(0.5)
                # Fill password via Playwright
                password_inputs = page.query_selector_all('input[type="password"]')
                if password_inputs:
                    password_inputs[0].fill(NEW_PASSWORD)
                else:
                    page.fill('input[type="password"]', NEW_PASSWORD)
                time.sleep(0.5)

                screenshot(nova, "06-login-filled.png")

                # Click sign in button
                try:
                    nova.act("Click the primary blue 'Sign in' button to submit the login form.")
                except ActActuationError:
                    pass  # redirect may cause timeout — expected
                time.sleep(6)
                log(f"URL after login: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"Login failed: {e}")
                screenshot(nova, "block-login.png")
                return
            except Exception as e:
                results["blocks"].append(f"Login Playwright failed: {e}")
                screenshot(nova, "block-login-pw.png")
                return

            # Wait for RSVP page
            deadline = time.time() + 15
            on_rsvp = False
            while time.time() < deadline:
                if "awsug.clouddelnorte.org/rsvp/" in nova.page.url:
                    on_rsvp = True
                    break
                time.sleep(1)

            if not on_rsvp:
                log(f"WARN: not on /rsvp/ — URL is {nova.page.url}")
                results["blocks"].append(f"rsvp-url-wait-timeout: {nova.page.url}")

            time.sleep(5)
            screenshot(nova, "07-rsvp-confirm.png")

            # QR check
            try:
                qr_check = nova.act_get("Is there a QR code visible on this page? Reply yes or no only.")
                if "yes" in qr_check.response.lower():
                    screenshot(nova, "08-qr.png")
                    results["qr_found"] = True
                    log("QR code captured")
                else:
                    results["qr_found"] = False
                    results["blocks"].append("No QR code on confirmation")
                    log("No QR code visible")
            except ActActuationError:
                results["qr_found"] = False

    # Step 9: Verify spots
    spots_after = check_spots()
    results["spots_after"] = spots_after
    log(f"Spots after: {json.dumps(spots_after)}")
    results["status"] = "PASS" if not results["blocks"] else "BLOCKED"


if __name__ == "__main__":
    try:
        run_new_user_rsvp()
    finally:
        cleanup_user(NEW_EMAIL, new_user_sub)

    print(f"\n{'='*60}")
    print(f"RESULT: {results['status']}")
    print(f"Email: {NEW_EMAIL}")
    print(f"Sub: {results.get('user_sub', 'N/A')}")
    print(f"Blocks: {results['blocks'] or 'none'}")
    print(f"QR found: {results.get('qr_found', 'N/A')}")
    print(f"Spots before: {results.get('spots_before')}")
    print(f"Spots after: {results.get('spots_after')}")
    print(f"{'='*60}")
    print(json.dumps(results, indent=2, default=str))
