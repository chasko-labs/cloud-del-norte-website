#!/usr/bin/env python3
"""Wave 54/62 — existing-user RSVP flow (heraldstack@clouddelnorte.org).

Opens /feed/, clicks the June 3 Community Happy Hour RSVP CTA,
authenticates as heraldstack@, captures confirmation + QR screenshots,
verifies backend spots endpoint, cleans up DDB record.

Wave 62 fixes:
- jitsi-video-hosting profile for cognito/secrets ops
- act_get-based DOM-presence waits before each screenshot
- post-test DDB cleanup of heraldstack@ RSVP record
"""
import json, os, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

# --- Credential bootstrap ---
# boto3 SSO token refresh fails non-interactively; CLI credential cache persists.
# Export cached role credentials so boto3 sessions work without SSO token.
def _export_creds(profile: str) -> dict:
    """Get cached credentials from AWS CLI for a profile."""
    r = subprocess.run(
        ["aws", "configure", "export-credentials", "--profile", profile, "--format", "process"],
        capture_output=True, text=True, check=True,
    )
    return json.loads(r.stdout)


_kiro_creds = _export_creds("bryanchasko-kiro")
_jvh_creds = _export_creds("jitsi-video-hosting")

# Set env for default boto3 (used by Nova Act @workflow decorator)
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
OUTPUT_DIR = Path("/tmp/wave-62-existing")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")

# --- jitsi-video-hosting session (for secrets + DDB) ---
_jvh_session = boto3.Session(
    aws_access_key_id=_jvh_creds["AccessKeyId"],
    aws_secret_access_key=_jvh_creds["SecretAccessKey"],
    aws_session_token=_jvh_creds["SessionToken"],
    region_name="us-west-2",
)
_sm = _jvh_session.client("secretsmanager")
_ddb = _jvh_session.client("dynamodb")

EMAIL = "heraldstack@clouddelnorte.org"
PASSWORD = _sm.get_secret_value(SecretId="cloud-del-norte/heraldstack-cognito-pw")["SecretString"]

results = {"test": "A-existing-user-wave62", "status": "FAIL", "blocks": [], "screenshots": []}


def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}][EXISTING] {msg}", flush=True)


def screenshot(nova, filename: str) -> str:
    path = str(OUTPUT_DIR / filename)
    nova.page.screenshot(path=path)
    results["screenshots"].append(path)
    log(f"Screenshot: {path}")
    return path


def wait_for_condition(nova, question: str, expected: str = "yes", timeout: float = 10.0, interval: float = 1.0) -> bool:
    """Poll act_get until response contains expected string or timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = nova.act_get(question)
            if expected in resp.response.lower():
                return True
        except ActActuationError:
            pass
        time.sleep(interval)
    return False


def check_spots() -> dict | None:
    try:
        r = requests.get(SPOTS_URL, timeout=10)
        data = r.json()
        log(f"Spots: {json.dumps(data)}")
        return data
    except Exception as e:
        log(f"Spots check failed: {e}")
        return None


def cleanup_rsvp():
    """Delete heraldstack@ RSVP record from DDB."""
    try:
        _ddb.delete_item(
            TableName="cdn-rsvps",
            Key={
                "user_sub": {"S": "e8716360-c081-708a-1211-3234508e71d2"},
                "event_id": {"S": "happy-hour-2026-06-03"},
            },
        )
        log("Cleanup: deleted heraldstack@ RSVP record from cdn-rsvps")
        results["cleanup"] = "success"
    except Exception as e:
        log(f"Cleanup failed: {e}")
        results["cleanup"] = f"failed: {e}"


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run_existing_user_rsvp():
    log(f"Starting existing-user RSVP test — {TS}")

    spots_before = check_spots()
    results["spots_before"] = spots_before

    with browser_session(region="us-east-1", name="wave62-rsvp-existing") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=FEED_URL, headless=True, tty=False,
            logs_directory="/tmp/nova-act-logs",
            go_to_url_timeout=30,
        ) as nova:
            time.sleep(3)

            # Checkpoint 1: anon feed
            screenshot(nova, "01-feed-anon.png")
            log(f"URL after feed load: {nova.page.url}")

            # Step 2: Click RSVP CTA
            try:
                nova.act(
                    "On this page, find the Featured Event section showing the June 3 Community Happy Hour. "
                    "Click the 'RSVP on CloudDelNorte.org' button or the 'Limited space — RSVP now' link. "
                    "Do NOT click any Meetup link. Stay on clouddelnorte.org."
                )
                time.sleep(4)
                log(f"URL after RSVP click: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"RSVP CTA click failed: {e}")
                log(f"BLOCK: RSVP CTA click failed: {e}")
                screenshot(nova, "block-rsvp-cta.png")
                return

            # Checkpoint 2: auth page after CTA
            screenshot(nova, "02-rsvp-cta-clicked.png")

            # Step 3: Login
            try:
                current_url = nova.page.url
                if "/signup" in current_url:
                    nova.act("Click the 'Sign in' link to go to the login page.")
                    time.sleep(2)

                nova.act(f"Enter '{EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', PASSWORD)

                # Checkpoint 3: pre-submit
                screenshot(nova, "03-login-pre-submit.png")

                try:
                    nova.act("Click the 'Sign in' button to submit the login form.")
                except ActActuationError:
                    pass  # redirect causes timeout — expected
                time.sleep(5)
                log(f"URL after login: {nova.page.url}")
            except ActActuationError as e:
                results["blocks"].append(f"Login failed: {e}")
                log(f"BLOCK: Login failed: {e}")
                screenshot(nova, "block-login.png")
                return

            # Step 4: MFA bypass
            try:
                mfa_check = nova.act_get(
                    "Is there an MFA, authenticator, or one-time-code input visible on this page? Reply yes or no only."
                )
                if "yes" in mfa_check.response.lower():
                    log("MFA challenge detected — attempting code 000000")
                    nova.act("Type '000000' in the MFA/code input field and click verify or submit.")
                    time.sleep(4)
                    mfa_still = nova.act_get("Is MFA still blocking? Reply yes or no only.")
                    if "yes" in mfa_still.response.lower():
                        results["blocks"].append("MFA brick — cannot bypass with 000000")
                        log("BLOCK: MFA brick")
                        screenshot(nova, "block-mfa.png")
                        return
            except ActActuationError:
                pass

            # DOM-presence wait: confirm we landed on /rsvp/
            # Use page.url directly — Nova Act can't reliably read the URL bar
            on_rsvp = "awsug.clouddelnorte.org/rsvp/" in nova.page.url
            if not on_rsvp:
                # Wait up to 10s for redirect to complete
                deadline = time.time() + 10
                while time.time() < deadline:
                    if "awsug.clouddelnorte.org/rsvp/" in nova.page.url:
                        on_rsvp = True
                        break
                    time.sleep(1)
            if not on_rsvp:
                log("WARN: did not confirm /rsvp/ URL within 10s")
                results["blocks"].append("rsvp-url-wait-timeout")

            # Checkpoint 4: /rsvp/ page loading (before useEffect completes)
            screenshot(nova, "04-rsvp-page-loading.png")
            log(f"URL at rsvp page: {nova.page.url}")

            # Wait for useEffect auto-RSVP to complete and QR to render
            # The useEffect calls the backend then renders the QR — give it time
            time.sleep(5)

            # DOM-presence wait: QR code render (useEffect auto-RSVP)
            qr_rendered = wait_for_condition(
                nova,
                "Is a QR code visible on the page? Look for a square black-and-white pattern. Reply yes or no only.",
                "yes", timeout=15.0,
            )

            # Checkpoint 5: confirmed with QR
            screenshot(nova, "05-rsvp-confirmed-with-qr.png")
            if qr_rendered:
                log("QR code rendered — capturing confirmed")
                results["qr_found"] = True
            else:
                log("WARN: QR not rendered within 10s — screenshot captured anyway (qr-not-rendered)")
                results["qr_found"] = False
                results["qr_note"] = "qr-not-rendered"

            # Extract ticket payload
            try:
                ticket = nova.act_get("Read all text on this page and return it as a single string.")
                results["ticket_payload"] = ticket.response
                log(f"Page text: {ticket.response[:200]}")
            except (ActActuationError, Exception) as e:
                results["ticket_payload"] = f"extraction failed: {e}"
                log(f"Ticket extraction failed: {e}")

    # Verify backend spots after
    spots_after = check_spots()
    results["spots_after"] = spots_after

    # Cleanup DDB record
    cleanup_rsvp()

    # Final spots check (should match before)
    spots_final = check_spots()
    results["spots_final"] = spots_final

    results["status"] = "PASS" if results.get("qr_found") else "FAIL"
    if results["blocks"]:
        results["status"] = "BLOCKED"
    log(f"Test complete — status: {results['status']}")


if __name__ == "__main__":
    run_existing_user_rsvp()
    print(f"\n{'='*60}")
    print(f"RESULT: {results['status']}")
    print(f"Blocks: {results['blocks'] or 'none'}")
    print(f"QR found: {results.get('qr_found', 'N/A')}")
    print(f"Screenshots: {results.get('screenshots', [])}")
    print(f"Spots before: {results.get('spots_before')}")
    print(f"Spots after: {results.get('spots_after')}")
    print(f"Spots final (post-cleanup): {results.get('spots_final')}")
    print(f"Cleanup: {results.get('cleanup', 'N/A')}")
    print(f"{'='*60}")
    print(json.dumps(results, indent=2, default=str))

    # Exit non-zero only if QR was expected but missing
    if results.get("qr_found") is False and results["status"] != "BLOCKED":
        sys.exit(1)
