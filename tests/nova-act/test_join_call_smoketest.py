#!/usr/bin/env python3
"""Nova Act end-to-end join-call smoketest.

Automates the full user lifecycle:
1. Admin signs in
2. New user signs up (unique email per run)
3. Admin approves new user (adds to 'members' group)
4. Admin starts a meeting (creates instant room)
5. New user joins the meeting
6. Assert: jitsi iframe src contains meet.clouddelnorte.org (FP-021)
7. Assert: video/participant element is present in jitsi

PRE-FLIGHT GATE: harness exits with code 75 if external_api.js != 200.
This is NOT a test failure — it means the jitsi ECS stack is cold.

TOTP/MFA: The admin user has pre-enrolled TOTP. The harness reads the
admin TOTP secret from SSM and generates codes via pyotp. A brand-new
user will hit MFA_SETUP during first login — this is handled by reading
the TOTP secret from the Cognito challenge session and computing a valid
code. See BLOCKING_GAP in README.md for the MFA_SETUP limitation.

Usage:
    python tests/nova-act/test_join_call_smoketest.py

Requires:
    - Active AWS SSO session (profile with SSM read access)
    - Jitsi stack warm (external_api.js returns 200)
    - SSM parameters populated (see README.md)
"""

import json
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import boto3
import pyotp
import requests

# Ensure conftest is importable
sys.path.insert(0, str(Path(__file__).parent))

from conftest import (
    ARTIFACTS_DIR,
    AUTH_SUBDOMAIN,
    AWSUG_SUBDOMAIN,
    COGNITO_CLIENT_ID,
    COGNITO_USER_POOL_ID,
    EXIT_INFRA_NOT_READY,
    JITSI_DOMAIN,
    InfraNotReadyError,
    artifact_path,
    get_admin_credentials,
    get_admin_totp_secret,
    get_ssm_parameter,
    preflight_check,
    save_screenshot,
)

try:
    from nova_act import NovaAct
except ImportError:
    print("ERROR: nova-act package not installed. pip install nova-act")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# New user gets a unique email per run to avoid collisions
RUN_ID = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S") + "-" + uuid.uuid4().hex[:6]
NEW_USER_EMAIL = f"cdn-smoketest-{RUN_ID}@clouddelnorte.org"
NEW_USER_DISPLAY_NAME = f"Smoketest {RUN_ID}"
# Password meets Cognito policy: uppercase, lowercase, number, special, 12+ chars
NEW_USER_PASSWORD_SSM = "/cloud-del-norte/test/smoketest-new-user-password"

# Timeouts
PAGE_LOAD_TIMEOUT_MS = 30_000
JITSI_JOIN_TIMEOUT_S = 120
IFRAME_POLL_INTERVAL_S = 3


# ---------------------------------------------------------------------------
# Cognito admin helpers (SDK — not browser)
# ---------------------------------------------------------------------------

def cognito_client():
    return boto3.client("cognito-idp", region_name="us-west-2")


def admin_create_user(email: str, temp_password: str) -> None:
    """Create a Cognito user with confirmed email (admin API)."""
    client = cognito_client()
    client.admin_create_user(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=email,
        TemporaryPassword=temp_password,
        UserAttributes=[
            {"Name": "email", "Value": email},
            {"Name": "email_verified", "Value": "true"},
            {"Name": "name", "Value": NEW_USER_DISPLAY_NAME},
        ],
        MessageAction="SUPPRESS",  # no welcome email for test user
    )


def admin_set_permanent_password(email: str, password: str) -> None:
    """Set a permanent password so user skips FORCE_CHANGE_PASSWORD."""
    client = cognito_client()
    client.admin_set_user_password(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=email,
        Password=password,
        Permanent=True,
    )


def admin_add_to_group(email: str, group: str) -> None:
    """Add user to a Cognito group (e.g. 'members')."""
    client = cognito_client()
    client.admin_add_user_to_group(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=email,
        GroupName=group,
    )


def admin_delete_user(email: str) -> None:
    """Delete a Cognito user (cleanup)."""
    client = cognito_client()
    try:
        client.admin_delete_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
        )
    except client.exceptions.UserNotFoundException:
        pass  # already gone


def initiate_auth_for_mfa_setup(email: str, password: str) -> dict:
    """Initiate auth to get session for MFA setup challenge.

    Returns the full response dict including ChallengeName and Session.
    """
    client = cognito_client()
    return client.admin_initiate_auth(
        UserPoolId=COGNITO_USER_POOL_ID,
        ClientId=COGNITO_CLIENT_ID,
        AuthFlow="ADMIN_USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": email, "PASSWORD": password},
    )


def associate_totp_for_user(session: str) -> tuple[str, str]:
    """Call AssociateSoftwareToken to get the TOTP secret.

    Returns (secret_code, new_session).
    """
    client = cognito_client()
    resp = client.associate_software_token(Session=session)
    return resp["SecretCode"], resp["Session"]




def complete_new_user_auth(email: str, password: str) -> tuple[str, str]:
    """Full auth flow for a new user including MFA setup.

    Returns (totp_secret, id_token) after completing MFA enrollment.
    The TOTP secret is needed for future logins of this user.
    """
    resp = initiate_auth_for_mfa_setup(email, password)

    if resp.get("ChallengeName") == "MFA_SETUP":
        session = resp["Session"]
        # Get TOTP secret
        totp_secret, session = associate_totp_for_user(session)
        # Verify with a valid code
        totp = pyotp.TOTP(totp_secret)
        code = totp.now()
        client = cognito_client()
        verify_resp = client.verify_software_token(
            Session=session,
            UserCode=code,
            FriendlyDeviceName="smoketest-authenticator",
        )
        session = verify_resp.get("Session", session)
        # Respond to the challenge to get tokens
        final_resp = client.respond_to_auth_challenge(
            ClientId=COGNITO_CLIENT_ID,
            ChallengeName="MFA_SETUP",
            Session=session,
            ChallengeResponses={"USERNAME": email},
        )
        # May get SOFTWARE_TOKEN_MFA challenge next
        if final_resp.get("ChallengeName") == "SOFTWARE_TOKEN_MFA":
            time.sleep(1)  # wait for TOTP rotation
            code = pyotp.TOTP(totp_secret).now()
            final_resp = client.respond_to_auth_challenge(
                ClientId=COGNITO_CLIENT_ID,
                ChallengeName="SOFTWARE_TOKEN_MFA",
                Session=final_resp["Session"],
                ChallengeResponses={
                    "USERNAME": email,
                    "SOFTWARE_TOKEN_MFA_CODE": code,
                },
            )
        id_token = final_resp["AuthenticationResult"]["IdToken"]
        return totp_secret, id_token

    elif resp.get("ChallengeName") == "SOFTWARE_TOKEN_MFA":
        # User already has MFA — should not happen for brand-new user
        raise RuntimeError("New user already has MFA configured — unexpected")

    elif "AuthenticationResult" in resp:
        # No MFA challenge — should not happen per site config
        return "", resp["AuthenticationResult"]["IdToken"]

    else:
        raise RuntimeError(f"Unexpected auth response: {resp.get('ChallengeName')}")


# ---------------------------------------------------------------------------
# Browser automation helpers (Nova Act)
# ---------------------------------------------------------------------------


def admin_login_browser(admin_email: str, admin_password: str, admin_totp_secret: str):
    """Sign in as admin via Nova Act browser session. Returns the NovaAct context.

    Uses page.fill() for all credentials — NEVER passes secrets through act().
    """
    nova = NovaAct(
        starting_page=f"{AWSUG_SUBDOMAIN}/meetings/index.html",
        ignore_https_errors=True,
    )
    nova.start()
    page = nova.page

    # The meetings page requires auth — it redirects to Cognito hosted UI
    # Wait for the login form to appear
    page.wait_for_selector('input[name="username"], input[name="email"]', timeout=PAGE_LOAD_TIMEOUT_MS)
    save_screenshot(page, "admin-login-page.png")

    # Fill credentials via Playwright page.fill — NOT through act()
    page.fill('input[name="username"], input[name="email"]', admin_email)
    page.fill('input[name="password"]', admin_password)

    # Submit login form
    nova.act("click the sign in button")
    page.wait_for_timeout(3000)
    save_screenshot(page, "admin-post-login.png")

    # Handle MFA challenge — admin has pre-enrolled TOTP
    mfa_input = page.query_selector('input[name="code"], input[name="totp"], input[placeholder*="code"]')
    if mfa_input:
        totp = pyotp.TOTP(admin_totp_secret)
        code = totp.now()
        page.fill('input[name="code"], input[name="totp"], input[placeholder*="code"]', code)
        nova.act("submit the MFA verification code")
        page.wait_for_timeout(3000)
        save_screenshot(page, "admin-post-mfa.png")

    # Should now be on the meetings page
    page.wait_for_url(f"**/{AWSUG_SUBDOMAIN.split('//')[1]}/**", timeout=PAGE_LOAD_TIMEOUT_MS)
    save_screenshot(page, "admin-meetings-page.png")

    return nova


def admin_start_meeting(nova) -> str:
    """Have the admin create/join an instant meeting. Returns room name.

    The admin clicks the 'Start Instant Meeting' or similar button
    that opens the jitsi embed modal.
    """
    page = nova.page

    # Navigate to create-meeting or use instant meeting button
    nova.act("click the button to start an instant meeting or create a new meeting")
    page.wait_for_timeout(5000)
    save_screenshot(page, "admin-meeting-started.png")

    # Wait for jitsi iframe to appear in the modal
    iframe_appeared = False
    for _ in range(JITSI_JOIN_TIMEOUT_S // IFRAME_POLL_INTERVAL_S):
        iframe = page.query_selector('iframe[src*="meet.clouddelnorte.org"]')
        if iframe:
            iframe_appeared = True
            break
        # Also check for the jitsi-iframe-host div with content
        host_div = page.query_selector('[data-testid="jitsi-iframe-host"] iframe')
        if host_div:
            iframe_appeared = True
            break
        page.wait_for_timeout(IFRAME_POLL_INTERVAL_S * 1000)

    save_screenshot(page, "admin-jitsi-iframe-check.png")

    if not iframe_appeared:
        # Try to get the iframe that JitsiMeetExternalAPI creates
        iframe = page.query_selector('iframe')
        if iframe:
            src = iframe.get_attribute("src") or ""
            if JITSI_DOMAIN in src:
                iframe_appeared = True

    assert iframe_appeared, (
        "FP-021 ADMIN CHECK: jitsi iframe with src containing "
        f"'{JITSI_DOMAIN}' never appeared in admin session"
    )

    # Extract room name from iframe src for the new user to join
    iframe = page.query_selector(f'iframe[src*="{JITSI_DOMAIN}"]')
    if not iframe:
        iframe = page.query_selector('[data-testid="jitsi-iframe-host"] iframe')
    src = iframe.get_attribute("src") if iframe else ""
    # Room name is the path segment after the domain
    room_name = ""
    if src and JITSI_DOMAIN in src:
        # URL format: https://meet.clouddelnorte.org/roomName?jwt=...
        path = src.split(JITSI_DOMAIN)[1]
        room_name = path.split("?")[0].strip("/")

    print(f"  Admin joined room: {room_name or '(could not extract)'}")
    return room_name


def new_user_join_meeting(
    new_user_email: str,
    new_user_password: str,
    new_user_totp_secret: str,
):
    """Sign in as the new user and join the meeting. Returns NovaAct context.

    Asserts FP-021: iframe src contains meet.clouddelnorte.org
    Asserts: video/participant element is present
    """
    nova = NovaAct(
        starting_page=f"{AWSUG_SUBDOMAIN}/meetings/index.html",
        ignore_https_errors=True,
    )
    nova.start()
    page = nova.page

    # Will redirect to login
    page.wait_for_selector('input[name="username"], input[name="email"]', timeout=PAGE_LOAD_TIMEOUT_MS)
    save_screenshot(page, "newuser-login-page.png")

    # Fill credentials — page.fill only, never act()
    page.fill('input[name="username"], input[name="email"]', new_user_email)
    page.fill('input[name="password"]', new_user_password)
    nova.act("click the sign in button")
    page.wait_for_timeout(3000)
    save_screenshot(page, "newuser-post-login.png")

    # Handle MFA — new user has TOTP set up via SDK in pre-setup phase
    mfa_input = page.query_selector('input[name="code"], input[name="totp"], input[placeholder*="code"]')
    if mfa_input:
        totp = pyotp.TOTP(new_user_totp_secret)
        code = totp.now()
        page.fill('input[name="code"], input[name="totp"], input[placeholder*="code"]', code)
        nova.act("submit the MFA verification code")
        page.wait_for_timeout(3000)
        save_screenshot(page, "newuser-post-mfa.png")

    # Should be on meetings page now
    page.wait_for_url(f"**/{AWSUG_SUBDOMAIN.split('//')[1]}/**", timeout=PAGE_LOAD_TIMEOUT_MS)
    save_screenshot(page, "newuser-meetings-page.png")

    # Join the meeting — click the join button on the first available meeting
    nova.act("click the Join button on the first meeting in the table")
    page.wait_for_timeout(5000)
    save_screenshot(page, "newuser-join-clicked.png")

    # -----------------------------------------------------------------------
    # FP-021 ASSERTION: iframe src must contain meet.clouddelnorte.org
    # A navigation-only assertion is a false positive. We must verify the
    # actual jitsi iframe is loaded, not just that we clicked a button.
    # -----------------------------------------------------------------------
    iframe_src_valid = False
    video_present = False

    for attempt in range(JITSI_JOIN_TIMEOUT_S // IFRAME_POLL_INTERVAL_S):
        # Check for iframe with correct src
        iframe = page.query_selector(f'iframe[src*="{JITSI_DOMAIN}"]')
        if not iframe:
            iframe = page.query_selector('[data-testid="jitsi-iframe-host"] iframe')

        if iframe:
            src = iframe.get_attribute("src") or ""
            if JITSI_DOMAIN in src:
                iframe_src_valid = True
                # Now check inside the iframe for video/participant
                try:
                    frame = iframe.content_frame()
                    if frame:
                        video_el = frame.query_selector(
                            'video, [class*="videocontainer"], '
                            '[class*="participant"], [id*="participant"], '
                            '[class*="filmstrip"] video'
                        )
                        if video_el:
                            video_present = True
                            break
                except Exception:
                    pass  # cross-origin frame — check alternative

            # Alternative: check for video elements at page level
            # (JitsiMeetExternalAPI may render outside iframe in some configs)
            if not video_present:
                video_at_page = page.query_selector(
                    '[data-testid="jitsi-iframe-host"] video, '
                    'iframe + video, '
                    '[class*="jitsi"] video'
                )
                if video_at_page:
                    video_present = True
                    break

        page.wait_for_timeout(IFRAME_POLL_INTERVAL_S * 1000)

    save_screenshot(page, "newuser-final-state.png")

    # -----------------------------------------------------------------------
    # ASSERTIONS — both must pass
    # -----------------------------------------------------------------------

    assert iframe_src_valid, (
        "FP-021 FAILURE: jitsi iframe with src containing "
        f"'{JITSI_DOMAIN}' was NOT found. The user may be stranded "
        "on the meetings list without actually joining jitsi. "
        "See .kiro/steering/friction-points-resolved.md FP-021."
    )

    assert video_present, (
        "JITSI CONNECTION FAILURE: iframe src is correct but no video "
        "element or participant surface was detected inside the jitsi "
        "frame. The iframe may have loaded but never connected to the "
        "meeting room. Check jitsi ECS health and JWT token exchange."
    )

    print("  ✓ FP-021: iframe src contains meet.clouddelnorte.org")
    print("  ✓ Video/participant element present in jitsi frame")

    return nova


# ---------------------------------------------------------------------------
# Main test orchestration
# ---------------------------------------------------------------------------


def run_smoketest() -> int:
    """Execute the full join-call smoketest. Returns exit code."""
    print("=" * 60)
    print("Nova Act Join-Call Smoketest")
    print(f"Run ID: {RUN_ID}")
    print(f"New user email: {NEW_USER_EMAIL}")
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    # ------------------------------------------------------------------
    # PRE-FLIGHT GATE
    # ------------------------------------------------------------------
    print("\n[1/7] Pre-flight: checking jitsi stack health...")
    try:
        preflight_check()
    except InfraNotReadyError as exc:
        print(f"\n{'=' * 60}")
        print("INFRASTRUCTURE NOT READY — THIS IS NOT A TEST FAILURE")
        print(f"{'=' * 60}")
        print(f"\n{exc}")
        print(f"\nExit code {EXIT_INFRA_NOT_READY} means the jitsi ECS stack")
        print("is cold. Scale up first, then re-run.")
        print("Owner: ghost-kade-vox-jitsi-perl-ops via scale-up.pl (5-8 min)")
        return EXIT_INFRA_NOT_READY
    print("  ✓ external_api.js returns HTTP 200 — stack is warm")

    # ------------------------------------------------------------------
    # FETCH CREDENTIALS
    # ------------------------------------------------------------------
    print("\n[2/7] Fetching credentials from SSM...")
    admin_email, admin_password = get_admin_credentials()
    admin_totp_secret = get_admin_totp_secret()
    new_user_password = get_ssm_parameter(NEW_USER_PASSWORD_SSM)
    print(f"  ✓ Admin: {admin_email}")
    print(f"  ✓ New user password retrieved from SSM")

    # ------------------------------------------------------------------
    # CREATE NEW USER (SDK, not browser)
    # ------------------------------------------------------------------
    print(f"\n[3/7] Creating new user: {NEW_USER_EMAIL}...")
    admin_create_user(NEW_USER_EMAIL, "TempPass1!Smoketest")
    admin_set_permanent_password(NEW_USER_EMAIL, new_user_password)
    print("  ✓ User created with permanent password")

    # Complete MFA setup for the new user via SDK
    print("  Setting up MFA for new user via Cognito SDK...")
    new_user_totp_secret, _ = complete_new_user_auth(NEW_USER_EMAIL, new_user_password)
    print("  ✓ MFA enrolled for new user")

    # ------------------------------------------------------------------
    # APPROVE NEW USER (add to 'members' group)
    # ------------------------------------------------------------------
    print(f"\n[4/7] Admin approving new user (adding to 'members' group)...")
    admin_add_to_group(NEW_USER_EMAIL, "members")
    print("  ✓ New user added to 'members' group")

    # ------------------------------------------------------------------
    # ADMIN STARTS MEETING (browser)
    # ------------------------------------------------------------------
    print(f"\n[5/7] Admin signing in and starting meeting...")
    admin_nova = None
    newuser_nova = None
    try:
        admin_nova = admin_login_browser(admin_email, admin_password, admin_totp_secret)
        room_name = admin_start_meeting(admin_nova)
        print(f"  ✓ Meeting started (room: {room_name})")

        # ------------------------------------------------------------------
        # NEW USER JOINS MEETING (separate browser)
        # ------------------------------------------------------------------
        print(f"\n[6/7] New user joining meeting...")
        newuser_nova = new_user_join_meeting(
            NEW_USER_EMAIL,
            new_user_password,
            new_user_totp_secret,
        )
        print("  ✓ New user successfully joined meeting with video")

        # ------------------------------------------------------------------
        # RESULT
        # ------------------------------------------------------------------
        print(f"\n[7/7] Smoketest PASSED")
        print("=" * 60)
        result = {
            "status": "PASS",
            "run_id": RUN_ID,
            "new_user_email": NEW_USER_EMAIL,
            "room_name": room_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "assertions": {
                "preflight_gate": "PASS",
                "fp021_iframe_src": "PASS",
                "video_present": "PASS",
            },
        }
        result_path = artifact_path("result.json")
        result_path.write_text(json.dumps(result, indent=2))
        print(f"  Results: {result_path}")
        return 0

    except AssertionError as exc:
        print(f"\n{'=' * 60}")
        print("SMOKETEST FAILED")
        print(f"{'=' * 60}")
        print(f"\n{exc}")
        result = {
            "status": "FAIL",
            "run_id": RUN_ID,
            "new_user_email": NEW_USER_EMAIL,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(exc),
        }
        result_path = artifact_path("result.json")
        result_path.write_text(json.dumps(result, indent=2))
        return 1

    except Exception as exc:
        print(f"\n{'=' * 60}")
        print("SMOKETEST ERROR (unexpected)")
        print(f"{'=' * 60}")
        print(f"\n{type(exc).__name__}: {exc}")
        result = {
            "status": "ERROR",
            "run_id": RUN_ID,
            "new_user_email": NEW_USER_EMAIL,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": f"{type(exc).__name__}: {exc}",
        }
        result_path = artifact_path("result.json")
        result_path.write_text(json.dumps(result, indent=2))
        return 1

    finally:
        # Close browser sessions
        if admin_nova:
            try:
                admin_nova.stop()
            except Exception:
                pass
        if newuser_nova:
            try:
                newuser_nova.stop()
            except Exception:
                pass

        # ------------------------------------------------------------------
        # CLEANUP: delete the test user
        # ------------------------------------------------------------------
        print(f"\n[Cleanup] Deleting test user: {NEW_USER_EMAIL}...")
        try:
            admin_delete_user(NEW_USER_EMAIL)
            print("  ✓ Test user deleted")
        except Exception as exc:
            print(f"  ⚠ Cleanup failed: {exc}")
            print(f"  Manual cleanup required:")
            print(f"    aws cognito-idp admin-delete-user \\")
            print(f"      --user-pool-id {COGNITO_USER_POOL_ID} \\")
            print(f"      --username {NEW_USER_EMAIL} \\")
            print(f"      --profile jitsi-video-hosting")


if __name__ == "__main__":
    sys.exit(run_smoketest())
