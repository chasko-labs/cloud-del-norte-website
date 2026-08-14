# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Nova Act join-call smoketest for clouddelnorte.org

Acceptance proof for the login-flow repair (issues #455, #456, #457, #458).

Full 4-step flow:
  1. Sign in via Cognito Hosted UI (OIDC PKCE redirect)
  2. Navigate to meetings page
  3. Click Join on a live meeting
  4. ASSERT Jitsi iframe src contains meet.clouddelnorte.org (FP-021)

CRITICAL (FP-021): navigation-only assertions are FALSE POSITIVES.
The iframe src must contain meet.clouddelnorte.org — this is the only
valid proof that the join-call flow produced a real Jitsi embed.

Infrastructure: Jitsi runs on ECS (jitsi-cluster). Must be WARM before running.

Environment variables:
  CDN_TEST_EMAIL     — test account email
  CDN_TEST_PASSWORD  — test account password
  CDN_ADMIN_EMAIL    — admin/moderator email (for meeting creation)
  CDN_ADMIN_PASSWORD — admin/moderator password
  NOVA_ACT_SCREENSHOT_DIR — screenshot output dir (default: ./artifacts)
  AWS_PROFILE        — AWS profile for Nova Act (default: bryanchasko-kiro)

SSM parameters (account 170473530355, profile jitsi-video-hosting):
  /cloud-del-norte/test/member-only-user-email
  /cloud-del-norte/test/smoketest-user-password
  /cloud-del-norte/test/admin-user-email
  /cloud-del-norte/test/admin-user-password
"""

import os
import sys
import time
from pathlib import Path

import requests
from nova_act import BOOL_SCHEMA, NovaAct, ActError, workflow

# ---- Pre-flight ----

JITSI_API_URL = "https://meet.clouddelnorte.org/external_api.js"


def preflight_jitsi():
    """verify Jitsi external_api.js returns 200 — exit 75 if not"""
    try:
        resp = requests.get(JITSI_API_URL, timeout=10)
        if resp.status_code != 200:
            print(f"PREFLIGHT FAIL: Jitsi external_api.js returned {resp.status_code}")
            sys.exit(75)
        print(f"PREFLIGHT PASS: Jitsi external_api.js → {resp.status_code}")
    except requests.RequestException as e:
        print(f"PREFLIGHT FAIL: cannot reach Jitsi — {e}")
        sys.exit(75)


# ---- Configuration ----

BASE_URL = "https://awsug.clouddelnorte.org"
AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
COGNITO_HOSTED_UI = "https://cloud-del-norte.auth.us-west-2.amazoncognito.com"
MEETINGS_URL = f"{BASE_URL}/meetings/index.html"

TEST_EMAIL = os.environ.get("CDN_TEST_EMAIL", "")
TEST_PASSWORD = os.environ.get("CDN_TEST_PASSWORD", "")
ADMIN_EMAIL = os.environ.get("CDN_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("CDN_ADMIN_PASSWORD", "")
AWS_PROFILE = os.environ.get("AWS_PROFILE", "bryanchasko-kiro")

WORKFLOW_NAME = "cdn-join-call-smoketest"
MODEL_ID = "nova-act-latest"
BOTO_KWARGS = {"profile_name": AWS_PROFILE, "region_name": "us-east-1"}

SCREENSHOT_DIR = Path(
    os.environ.get("NOVA_ACT_SCREENSHOT_DIR", "./artifacts")
)
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)


def screenshot(nova: NovaAct, name: str) -> Path:
    """capture a screenshot and return the path"""
    path = SCREENSHOT_DIR / f"{name}.png"
    nova.page.screenshot(path=str(path))
    return path


def cognito_sign_in(nova: NovaAct, email: str, password: str) -> bool:
    """
    Handle CDN's custom auth flow:
    CDN has its own React login form at auth.clouddelnorte.org that calls
    Cognito directly (not via hosted UI redirect). The form has email + password
    fields rendered by Cloudscape components.

    After successful auth, the form redirects through /auth/callback/ with tokens.

    Returns True if sign-in succeeded (no longer on auth page).
    """
    current_url = nova.page.url

    # wait for React SPA to render the form
    time.sleep(5)

    # The CDN login form uses Cloudscape Input components
    # which render as <input> elements inside Cloudscape wrapper divs.
    # Fill email field
    email_filled = False
    for selector in [
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[name="email"]',
        'input[autocomplete="email"]',
        'input[autocomplete="username"]',
    ]:
        try:
            el = nova.page.locator(selector)
            if el.count() > 0:
                el.first.fill(email)
                email_filled = True
                print(f"  filled email via selector: {selector}")
                break
        except Exception:
            continue

    if not email_filled:
        # Cloudscape inputs might not have standard attributes; use nova.act
        try:
            nova.act(f"type '{email}' into the email or username input field")
            email_filled = True
        except ActError as e:
            print(f"  nova.act email fill failed: {e}")

    # Fill password field (Playwright, not nova.act — security)
    password_filled = False
    for selector in [
        'input[type="password"]',
        'input[name="password"]',
        'input[autocomplete="current-password"]',
    ]:
        try:
            el = nova.page.locator(selector)
            if el.count() > 0:
                el.first.fill(password)
                password_filled = True
                print(f"  filled password via selector: {selector}")
                break
        except Exception:
            continue

    if not password_filled:
        nova.page.fill('input[type="password"]', password)

    # Submit the form
    try:
        nova.act("click the 'Sign in' button")
    except ActError:
        # try direct submit button click
        for sel in [
            'button:has-text("Sign in")',
            'button:has-text("Sign In")',
            'button[type="submit"]',
        ]:
            try:
                btn = nova.page.locator(sel)
                if btn.count() > 0:
                    btn.first.click()
                    break
            except Exception:
                continue

    # wait for auth flow to complete (MFA check → token exchange → redirect)
    # CDN may show MFA step or redirect directly
    time.sleep(10)

    current_url = nova.page.url
    print(f"  after sign-in attempt, URL: {current_url}")

    # success = no longer on auth page
    return "auth.clouddelnorte.org" not in current_url and "amazoncognito.com" not in current_url


# ---- Test: Full 4-step join-call flow ----


@workflow(
    model_id=MODEL_ID,
    workflow_definition_name=WORKFLOW_NAME,
    boto_session_kwargs=BOTO_KWARGS,
)
def _run_join_call_smoketest():
    """
    Full 4-step join-call acceptance test:

    Step 1: Sign in via Cognito Hosted UI
    Step 2: Navigate to meetings page (verify authenticated access)
    Step 3: Click Join on a live meeting
    Step 4: ASSERT Jitsi iframe src contains meet.clouddelnorte.org (FP-021)

    This is the acceptance gate for the login-flow repair (#455-#458).
    """
    if not TEST_EMAIL or not TEST_PASSWORD:
        print("SKIP: CDN_TEST_EMAIL or CDN_TEST_PASSWORD not set")
        return

    with NovaAct(starting_page=MEETINGS_URL, headless=True, tty=False) as nova:
        # ============================================================
        # STEP 1: Sign in via Cognito Hosted UI
        # ============================================================
        nova.page.wait_for_load_state("networkidle")
        time.sleep(3)
        screenshot(nova, "step1_01_initial_load")

        current_url = nova.page.url
        print(f"step 1: initial URL = {current_url}")

        # if redirected to Cognito, sign in
        if "amazoncognito.com" in current_url or "auth.clouddelnorte.org" in current_url:
            print("step 1: redirected to auth — signing in")
            screenshot(nova, "step1_02_cognito_ui")

            signed_in = cognito_sign_in(nova, TEST_EMAIL, TEST_PASSWORD)
            screenshot(nova, "step1_03_after_signin")
            current_url = nova.page.url
            print(f"step 1: after sign-in, URL = {current_url}")

            assert signed_in, (
                f"step 1 FAIL: still on auth after sign-in attempt: {current_url}"
            )
        else:
            # may already be authenticated (session cookie)
            print(f"step 1: not redirected to auth — may already be authenticated")

        print("STEP 1 PASS: signed in successfully")
        screenshot(nova, "step1_04_signed_in")

        # ============================================================
        # STEP 2: Navigate to meetings page (verify authenticated access)
        # ============================================================
        nova.page.goto(MEETINGS_URL, wait_until="networkidle")
        time.sleep(3)
        screenshot(nova, "step2_01_meetings_page")

        current_url = nova.page.url
        print(f"step 2: meetings page URL = {current_url}")

        # verify we are on the meetings page, not redirected away
        assert "amazoncognito.com" not in current_url and "auth.clouddelnorte.org" not in current_url, (
            f"step 2 FAIL: meetings page redirected to auth: {current_url}"
        )

        # verify meetings table/content is present
        result = nova.act_get(
            "Is there a meetings table, meeting list, or meeting content on this page?",
            schema=BOOL_SCHEMA,
        )
        screenshot(nova, "step2_02_meetings_content")

        if result.parsed_response:
            print("STEP 2 PASS: meetings page loaded with content")
        else:
            # page may be empty if no meetings scheduled — that is OK
            # the critical assertion is step 3 (Join button exists)
            print("STEP 2 PASS: meetings page loaded (no meetings currently listed — this is OK)")

        # ============================================================
        # STEP 3: Click Join on a live meeting
        # ============================================================
        result = nova.act_get(
            "Is there a 'Join' button or a button to join a meeting on this page?",
            schema=BOOL_SCHEMA,
        )
        screenshot(nova, "step3_01_join_button_check")

        assert result.parsed_response is True, (
            "step 3 FAIL: no 'Join' button visible on meetings page — "
            "is a meeting actually running? Jitsi is WARM but no active meeting "
            "was found. Ensure a meeting is scheduled/live before running this test."
        )

        print("step 3: Join button found — clicking")
        nova.act("click the 'Join' button or 'Join Meeting' button")
        time.sleep(5)
        screenshot(nova, "step3_02_join_clicked")
        print(f"step 3: after clicking Join, URL = {nova.page.url}")

        # ============================================================
        # STEP 4: ASSERT Jitsi iframe src contains meet.clouddelnorte.org
        # ============================================================
        # FP-021: this is THE critical assertion. Navigation success alone
        # is a documented false positive.

        jitsi_iframe_src = None
        max_wait = 30  # seconds
        poll_interval = 3
        elapsed = 0

        while elapsed < max_wait:
            # check for iframe with meet.clouddelnorte.org
            iframe_src = nova.page.evaluate("""() => {
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    if (iframe.src && iframe.src.includes('meet.clouddelnorte.org')) {
                        return iframe.src;
                    }
                }
                // check inside jitsi-iframe-host container
                const host = document.querySelector('[data-testid="jitsi-iframe-host"]');
                if (host) {
                    const inner = host.querySelector('iframe');
                    if (inner && inner.src && inner.src.includes('meet.clouddelnorte.org')) {
                        return inner.src;
                    }
                }
                return null;
            }""")

            if iframe_src:
                jitsi_iframe_src = iframe_src
                break

            time.sleep(poll_interval)
            elapsed += poll_interval

        screenshot(
            nova,
            "step4_01_jitsi_VERIFIED" if jitsi_iframe_src else "step4_01_jitsi_MISSING"
        )

        if jitsi_iframe_src:
            print(f"step 4: Jitsi iframe src = {jitsi_iframe_src}")
        else:
            # capture diagnostic info
            page_state = nova.page.evaluate("""() => {
                return {
                    url: window.location.href,
                    iframeCount: document.querySelectorAll('iframe').length,
                    jitsiHost: document.querySelector('[data-testid="jitsi-iframe-host"]') !== null,
                    jitsiHostContent: document.querySelector('[data-testid="jitsi-iframe-host"]')?.innerHTML?.substring(0, 200) || 'empty',
                    bodySnippet: document.body.innerHTML.substring(0, 500),
                };
            }""")
            screenshot(nova, "step4_02_diagnostic")
            print(f"step 4 DIAGNOSTIC: {page_state}")

        # ---- FP-021 CRITICAL ASSERTION ----
        assert jitsi_iframe_src is not None, (
            "FP-021 FAIL: no iframe with src containing 'meet.clouddelnorte.org' found "
            f"after {max_wait}s. Navigation-only success is a documented false positive. "
            "The join-call flow did NOT produce a real Jitsi embed."
        )

        assert "meet.clouddelnorte.org" in jitsi_iframe_src, (
            f"FP-021 FAIL: iframe src '{jitsi_iframe_src}' does not contain "
            "'meet.clouddelnorte.org'"
        )

        print(f"STEP 4 PASS (FP-021): Jitsi iframe verified — src={jitsi_iframe_src}")
        screenshot(nova, "step4_03_complete")

        print("\n" + "=" * 60)
        print("JOIN-CALL SMOKETEST: ALL 4 STEPS PASSED")
        print("  Step 1: Sign-in via Cognito Hosted UI ✓")
        print("  Step 2: Meetings page authenticated access ✓")
        print("  Step 3: Join button click ✓")
        print("  Step 4: Jitsi iframe src contains meet.clouddelnorte.org ✓")
        print("=" * 60)


def test_join_call_smoketest():
    preflight_jitsi()
    _run_join_call_smoketest()


# ---- Runner ----


def main():
    """run the join-call smoketest"""
    print("=" * 60)
    print("CLOUD DEL NORTE — Join-Call Smoketest (Issue #460)")
    print("Acceptance gate for login-flow repair (#455-#458)")
    print("=" * 60)
    print(f"target: {BASE_URL}")
    print(f"meetings: {MEETINGS_URL}")
    print(f"test user: {TEST_EMAIL or '(not set)'}")
    print(f"admin user: {ADMIN_EMAIL or '(not set)'}")
    print(f"password set: {'yes' if TEST_PASSWORD else 'NO'}")
    print(f"screenshots: {SCREENSHOT_DIR.resolve()}")
    print(f"jitsi api: {JITSI_API_URL}")
    print("=" * 60)
    print()

    preflight_jitsi()

    print("\n--- join-call smoketest (4-step flow) ---")
    try:
        test_join_call_smoketest()
        print("\nRESULT: PASS")
    except AssertionError as e:
        print(f"\nRESULT: FAIL — {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\nRESULT: ERROR — {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
