#!/usr/bin/env python3
"""Wave 54 — new-user signup + RSVP flow.

Creates heraldstack+novaact-<ts>@clouddelnorte.org, signs up via the UI,
admin-confirms via Cognito, logs in, completes RSVP, captures screenshots.
Cleans up Cognito user + DDB record after.
"""
import json, os, secrets, string, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
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
OUTPUT_DIR = Path("/tmp/wave-54-new")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
EPOCH = int(time.time())

# --- Generate test user credentials ---
NEW_EMAIL = f"heraldstack+novaact-{EPOCH}@clouddelnorte.org"
# Password: 14 chars, guaranteed upper+lower+digit+symbol
_alpha = string.ascii_letters + string.digits + "!@#$%"
NEW_PASSWORD = (
    secrets.choice(string.ascii_uppercase)
    + secrets.choice(string.ascii_lowercase)
    + secrets.choice(string.digits)
    + secrets.choice("!@#$%")
    + "".join(secrets.choice(_alpha) for _ in range(10))
)

results = {"test": "B-new-user", "status": "FAIL", "blocks": [], "email": NEW_EMAIL}
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
        r = requests.get(SPOTS_URL, timeout=10)
        return r.json()
    except Exception as e:
        log(f"Spots check failed: {e}")
        return None


def cognito_admin_confirm(email: str):
    cmd = [
        "aws", "cognito-idp", "admin-confirm-sign-up",
        "--user-pool-id", USER_POOL_ID,
        "--username", email,
        "--profile", "jitsi-video-hosting",
        "--region", "us-west-2",
    ]
    log(f"admin-confirm-sign-up {email}")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        log(f"WARN confirm failed: {r.stderr.strip()}")
        return False
    log("confirmed OK")
    return True


def cognito_get_user_sub(email: str) -> str | None:
    cmd = [
        "aws", "cognito-idp", "admin-get-user",
        "--user-pool-id", USER_POOL_ID,
        "--username", email,
        "--profile", "jitsi-video-hosting",
        "--region", "us-west-2",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        log(f"get-user failed: {r.stderr.strip()}")
        return None
    data = json.loads(r.stdout)
    for attr in data.get("UserAttributes", []):
        if attr["Name"] == "sub":
            return attr["Value"]
    return None


def cleanup_user(email: str, sub: str | None):
    log(f"Cleanup: deleting Cognito user {email}")
    cmd = [
        "aws", "cognito-idp", "admin-delete-user",
        "--user-pool-id", USER_POOL_ID,
        "--username", email,
        "--profile", "jitsi-video-hosting",
        "--region", "us-west-2",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        log(f"WARN delete-user failed: {r.stderr.strip()}")
    else:
        log("Cognito user deleted")

    if sub:
        log(f"Cleanup: deleting DDB RSVP record for sub={sub}")
        key = json.dumps({"user_sub": {"S": sub}, "event_id": {"S": "happy-hour-2026-06-03"}})
        cmd = [
            "aws", "dynamodb", "delete-item",
            "--table-name", "cdn-rsvps",
            "--key", key,
            "--profile", "jitsi-video-hosting",
            "--region", "us-west-2",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            log(f"WARN DDB delete failed: {r.stderr.strip()}")
        else:
            log("DDB record deleted")


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
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

    with browser_session(region="us-east-1", name="wave54-rsvp-new") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=FEED_URL, headless=True, tty=False,
            logs_directory="/tmp/nova-act-logs",
            go_to_url_timeout=30,
        ) as nova:
            time.sleep(3)

            # Step 1: Click RSVP CTA
            try:
                nova.act(
                    "Find the Featured Event card for the June 3 Community Happy Hour. "
                    "Click the RSVP button or 'Limited space — RSVP now' link on that card."
                )
                time.sleep(4)
                log(f"URL after RSVP click: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"RSVP CTA click failed: {e}")
                log(f"BLOCK: {e}")
                screenshot(nova, "block-rsvp-cta.png")
                return

            # Step 2: Switch to signup tab/link if on login page
            try:
                nova.act(
                    "If this is a login page, click the 'Sign up' or 'Create account' link to go to the signup form."
                )
                time.sleep(2)
            except ActActuationError:
                pass

            # Step 3: Fill signup form
            try:
                nova.act(f"Enter '{NEW_EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', NEW_PASSWORD)
                nova.act("Enter 'Nova' in the first name field and 'Act-Test' in the last name field.")
                nova.act("Click the sign up or create account button.")
                time.sleep(4)
                log(f"URL after signup submit: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"Signup form failed: {e}")
                log(f"BLOCK: {e}")
                screenshot(nova, "block-signup.png")
                return

            # Step 4: Screenshot pending state
            screenshot(nova, "01-signup-pending.png")

    # Step 5: Admin-confirm the user (bypasses email verification)
    if not cognito_admin_confirm(NEW_EMAIL):
        results["blocks"].append("admin-confirm-sign-up failed")
        log("BLOCK: cannot confirm user")
        return

    # Get user sub for cleanup
    new_user_sub = cognito_get_user_sub(NEW_EMAIL)
    results["user_sub"] = new_user_sub
    log(f"User sub: {new_user_sub}")

    # Step 6: Log in as new user and complete RSVP
    with browser_session(region="us-east-1", name="wave54-rsvp-new-login") as browser:
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
                    "Click the RSVP button or 'Limited space — RSVP now' link."
                )
                time.sleep(4)
            except ActActuationError as e:
                results["blocks"].append(f"Second RSVP click failed: {e}")
                return

            # Login as new user
            try:
                nova.act(f"Enter '{NEW_EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', NEW_PASSWORD)
                nova.act("Click the sign in button and wait for redirect.")
                time.sleep(6)
                log(f"URL after new-user login: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"New-user login failed: {e}")
                screenshot(nova, "block-login.png")
                return

            # Confirmation
            time.sleep(3)
            screenshot(nova, "02-rsvp-confirm.png")

            # QR check
            try:
                qr_check = nova.act_get("Is there a QR code visible on this page? Reply yes or no only.")
                if "yes" in qr_check.response.lower():
                    screenshot(nova, "03-qr.png")
                    results["qr_found"] = True
                    log("QR code captured")
                else:
                    results["qr_found"] = False
                    results["blocks"].append("No QR code on confirmation")
                    log("No QR code visible")
            except ActActuationError:
                results["qr_found"] = False

    # Step 7: Verify spots
    spots_after = check_spots()
    results["spots_after"] = spots_after
    log(f"Spots after: {json.dumps(spots_after)}")
    results["status"] = "PASS" if not results["blocks"] else "BLOCKED"


if __name__ == "__main__":
    try:
        run_new_user_rsvp()
    finally:
        # Always cleanup
        if new_user_sub or NEW_EMAIL:
            cleanup_user(NEW_EMAIL, new_user_sub)

    print(f"\n{'='*60}")
    print(f"RESULT: {results['status']}")
    print(f"Email: {NEW_EMAIL}")
    print(f"Password: {NEW_PASSWORD}")
    print(f"Sub: {results.get('user_sub', 'N/A')}")
    print(f"Blocks: {results['blocks'] or 'none'}")
    print(f"QR found: {results.get('qr_found', 'N/A')}")
    print(f"Spots before: {results.get('spots_before')}")
    print(f"Spots after: {results.get('spots_after')}")
    print(f"{'='*60}")
    print(json.dumps(results, indent=2, default=str))
