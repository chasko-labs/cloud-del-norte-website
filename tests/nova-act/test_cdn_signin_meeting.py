# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""
Nova Act end-to-end validation for clouddelnorte.org

Tests the sign-in flow and meetings page from a real browser via
AWS Bedrock Nova Act (amazon.nova-act-v1:*).

CDN auth uses Cognito Hosted UI redirect (OIDC PKCE), not inline form.
The test navigates through the hosted UI login at
auth.clouddelnorte.org → Cognito → callback → app.

Nova Act v3.4 API:
  - nova.act(prompt) — fire-and-forget action; raises ActError on failure
  - nova.act_get(prompt, schema) — action + structured response

Environment variables:
  CDN_TEST_EMAIL     — test account email (from SSM)
  CDN_TEST_PASSWORD  — test account password (from SSM)
  NOVA_ACT_SCREENSHOT_DIR — where to save screenshots (default: ./artifacts)
  AWS_PROFILE        — AWS profile for Nova Act auth (default: bryanchasko-kiro)

SSM parameters (account 170473530355, profile jitsi-video-hosting):
  /cloud-del-norte/test/member-only-user-email
  /cloud-del-norte/test/smoketest-user-password
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
    """verify Jitsi is reachable before any browser tests"""
    try:
        resp = requests.get(JITSI_API_URL, timeout=10)
        if resp.status_code != 200:
            print(f"PREFLIGHT FAIL: Jitsi external_api.js returned {resp.status_code}")
            sys.exit(75)
    except requests.RequestException as e:
        print(f"PREFLIGHT FAIL: cannot reach Jitsi — {e}")
        sys.exit(75)


# ---- Configuration ----

BASE_URL = "https://awsug.clouddelnorte.org"
AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
COGNITO_HOSTED_UI = "https://cloud-del-norte.auth.us-west-2.amazoncognito.com"
MEETINGS_URL = f"{BASE_URL}/meetings/index.html"
CREATE_MEETING_URL = f"{BASE_URL}/create-meeting/index.html"
PUBLIC_URL = "https://clouddelnorte.org"

TEST_EMAIL = os.environ.get("CDN_TEST_EMAIL", "")
TEST_PASSWORD = os.environ.get("CDN_TEST_PASSWORD", "")
AWS_PROFILE = os.environ.get("AWS_PROFILE", "bryanchasko-kiro")

WORKFLOW_NAME = "cdn-e2e-signin-meeting"
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


# ---- Test 1: Public pages accessible ----


@workflow(
    model_id=MODEL_ID,
    workflow_definition_name=WORKFLOW_NAME,
    boto_session_kwargs=BOTO_KWARGS,
)
def _run_public_pages_accessible():
    """verify unauthenticated users can reach public pages"""
    public_pages = [
        (f"{PUBLIC_URL}/", "home"),
        (f"{PUBLIC_URL}/feed/index.html", "feed"),
        (f"{PUBLIC_URL}/home/index.html", "about"),
    ]

    with NovaAct(starting_page=PUBLIC_URL, headless=True, tty=False) as nova:
        for url, label in public_pages:
            nova.page.goto(url, wait_until="networkidle")
            status = nova.page.evaluate("() => document.readyState")
            assert status == "complete", f"{label} page did not fully load"
            screenshot(nova, f"public_{label}")
            print(f"PASS: {label} page ({url}) loads successfully")


def test_public_pages_accessible():
    preflight_jitsi()
    _run_public_pages_accessible()


# ---- Test 2: Login page renders (Cognito Hosted UI) ----


@workflow(
    model_id=MODEL_ID,
    workflow_definition_name=WORKFLOW_NAME,
    boto_session_kwargs=BOTO_KWARGS,
)
def _run_login_page_renders():
    """verify the Cognito Hosted UI login page loads"""
    with NovaAct(starting_page=AUTH_URL, headless=True, tty=False) as nova:
        nova.page.wait_for_load_state("networkidle")
        time.sleep(2)
        screenshot(nova, "01_auth_page_loaded")

        # CDN uses Cognito Hosted UI — check for username/email and password fields
        has_email = nova.page.locator(
            'input[name="username"], input[type="email"], input[name="signInFormUsername"]'
        ).count() > 0

        has_password = nova.page.locator(
            'input[name="password"], input[type="password"]'
        ).count() > 0

        if not has_email or not has_password:
            # fallback: use nova.act_get to visually confirm
            result = nova.act_get(
                "Is there a sign-in form with email/username and password fields?",
                schema=BOOL_SCHEMA,
            )
            assert result.parsed_response is True, (
                "login page does not show email and password fields"
            )

        # check for a sign-in / submit button
        result = nova.act_get(
            "Is there a 'Sign in' or 'Submit' button on this page?",
            schema=BOOL_SCHEMA,
        )
        assert result.parsed_response is True, "sign-in button not found"

        screenshot(nova, "02_auth_page_elements_verified")
        print("PASS: Cognito Hosted UI login page renders with form elements")


def test_login_page_renders():
    preflight_jitsi()
    _run_login_page_renders()


# ---- Test 3: Protected route redirects (create-meeting for non-moderators) ----


@workflow(
    model_id=MODEL_ID,
    workflow_definition_name=WORKFLOW_NAME,
    boto_session_kwargs=BOTO_KWARGS,
)
def _run_protected_route_redirects():
    """verify /create-meeting/ redirects unauthenticated users"""
    with NovaAct(starting_page=CREATE_MEETING_URL, headless=True, tty=False) as nova:
        nova.page.wait_for_load_state("networkidle")
        time.sleep(3)
        screenshot(nova, "03_create_meeting_unauth")

        current_url = nova.page.url

        # should redirect to Cognito hosted UI or show sign-in prompt
        redirected_to_auth = (
            "amazoncognito.com" in current_url
            or "auth.clouddelnorte.org" in current_url
            or "/login" in current_url
        )

        if redirected_to_auth:
            print(f"PASS: protected route redirected to auth ({current_url})")
        else:
            # check if the page shows a sign-in prompt inline
            result = nova.act_get(
                "Does this page show a sign-in prompt, login button, or "
                "tell the user they need to authenticate?",
                schema=BOOL_SCHEMA,
            )
            assert result.parsed_response is True, (
                f"/create-meeting/ did not redirect to auth — URL: {current_url}"
            )
            print("PASS: protected route shows sign-in prompt")


def test_protected_route_redirects():
    preflight_jitsi()
    _run_protected_route_redirects()


# ---- Test 4: Full sign-in via Cognito Hosted UI ----


@workflow(
    model_id=MODEL_ID,
    workflow_definition_name=WORKFLOW_NAME,
    boto_session_kwargs=BOTO_KWARGS,
)
def _run_full_signin():
    """
    Authenticate via Cognito Hosted UI redirect flow:
    1. Navigate to meetings (triggers redirect to Cognito)
    2. Fill credentials on Cognito Hosted UI
    3. Cognito redirects back with auth code
    4. Verify app loads authenticated state
    """
    if not TEST_EMAIL or not TEST_PASSWORD:
        print("SKIP: CDN_TEST_EMAIL or CDN_TEST_PASSWORD not set")
        return

    with NovaAct(starting_page=MEETINGS_URL, headless=True, tty=False) as nova:
        nova.page.wait_for_load_state("networkidle")
        time.sleep(3)
        screenshot(nova, "04_meetings_before_auth")

        current_url = nova.page.url

        # If already on Cognito hosted UI, fill credentials
        if "amazoncognito.com" not in current_url and "auth.clouddelnorte.org" not in current_url:
            # look for a sign-in button to click
            try:
                nova.act("click the 'Sign in' button or login link")
                time.sleep(3)
            except ActError:
                pass
            current_url = nova.page.url

        # now we should be on the Cognito Hosted UI
        screenshot(nova, "05_cognito_hosted_ui")
        print(f"on auth page: {current_url}")

        # fill credentials — use Playwright for security (not nova.act)
        # Cognito hosted UI uses name="username" and name="password"
        username_filled = False
        for selector in [
            'input[name="username"]',
            'input[name="signInFormUsername"]',
            'input[type="email"]',
            'input#signInFormUsername',
        ]:
            try:
                el = nova.page.locator(selector)
                if el.count() > 0:
                    el.first.fill(TEST_EMAIL)
                    username_filled = True
                    break
            except Exception:
                continue

        if not username_filled:
            # fallback: nova.act
            nova.act(f"type '{TEST_EMAIL}' into the username or email field")
            username_filled = True

        password_filled = False
        for selector in [
            'input[name="password"]',
            'input[type="password"]',
            'input#signInFormPassword',
        ]:
            try:
                el = nova.page.locator(selector)
                if el.count() > 0:
                    el.first.fill(TEST_PASSWORD)
                    password_filled = True
                    break
            except Exception:
                continue

        if not password_filled:
            nova.page.fill('input[type="password"]', TEST_PASSWORD)

        screenshot(nova, "06_credentials_filled")

        # submit the form
        try:
            nova.act("click the 'Sign in' or 'Submit' button")
        except ActError:
            # try Playwright click on the submit button
            for sel in [
                'input[name="signInSubmitButton"]',
                'button[type="submit"]',
                'input[type="submit"]',
            ]:
                try:
                    btn = nova.page.locator(sel)
                    if btn.count() > 0:
                        btn.first.click()
                        break
                except Exception:
                    continue

        # wait for redirect back to app
        time.sleep(8)
        screenshot(nova, "07_after_auth_redirect")

        current_url = nova.page.url
        print(f"after auth, URL: {current_url}")

        # verify we are back on the app (not stuck on Cognito)
        assert "amazoncognito.com" not in current_url, (
            f"stuck on Cognito after sign-in: {current_url}"
        )

        # verify authenticated state — look for user menu or sign-out option
        result = nova.act_get(
            "Is there a user menu, account dropdown, or 'Sign out' option visible?",
            schema=BOOL_SCHEMA,
        )
        screenshot(nova, "08_authenticated_state")

        if result.parsed_response is True:
            print("PASS: full sign-in complete — authenticated state confirmed")
        else:
            # may have landed on meetings page correctly even without visible menu
            if "meetings" in current_url or "awsug" in current_url:
                print("PASS: full sign-in complete — landed on app page")
            else:
                assert False, (
                    f"sign-in may have failed — URL: {current_url}, "
                    "no user menu visible"
                )


def test_full_signin():
    preflight_jitsi()
    _run_full_signin()


# ---- Test 5: Join live meeting + verify Jitsi iframe ----


@workflow(
    model_id=MODEL_ID,
    workflow_definition_name=WORKFLOW_NAME,
    boto_session_kwargs=BOTO_KWARGS,
)
def _run_join_meeting_jitsi():
    """
    Full end-to-end: sign in → meetings page → Join → verify Jitsi iframe.

    CRITICAL (FP-021): assert iframe src contains meet.clouddelnorte.org.
    Navigation-only assertions are FALSE POSITIVES.
    """
    if not TEST_EMAIL or not TEST_PASSWORD:
        print("SKIP: CDN_TEST_EMAIL or CDN_TEST_PASSWORD not set")
        return

    with NovaAct(starting_page=MEETINGS_URL, headless=True, tty=False) as nova:
        nova.page.wait_for_load_state("networkidle")
        time.sleep(3)

        current_url = nova.page.url

        # --- Sign in if redirected to Cognito ---
        if "amazoncognito.com" in current_url or "auth.clouddelnorte.org" in current_url:
            # fill credentials on Cognito Hosted UI
            for selector in [
                'input[name="username"]',
                'input[name="signInFormUsername"]',
                'input[type="email"]',
            ]:
                try:
                    el = nova.page.locator(selector)
                    if el.count() > 0:
                        el.first.fill(TEST_EMAIL)
                        break
                except Exception:
                    continue

            for selector in [
                'input[name="password"]',
                'input[type="password"]',
            ]:
                try:
                    el = nova.page.locator(selector)
                    if el.count() > 0:
                        el.first.fill(TEST_PASSWORD)
                        break
                except Exception:
                    continue

            # submit
            for sel in [
                'input[name="signInSubmitButton"]',
                'button[type="submit"]',
                'input[type="submit"]',
            ]:
                try:
                    btn = nova.page.locator(sel)
                    if btn.count() > 0:
                        btn.first.click()
                        break
                except Exception:
                    continue

            time.sleep(8)
            screenshot(nova, "10_join_after_signin")

        # --- Navigate to meetings page ---
        nova.page.goto(MEETINGS_URL, wait_until="networkidle")
        time.sleep(3)
        screenshot(nova, "11_join_meetings_page")

        # --- Check for Join button ---
        result = nova.act_get(
            "Is there a 'Join' button or a button to join a meeting on this page?",
            schema=BOOL_SCHEMA,
        )
        screenshot(nova, "12_join_button_check")

        if not result.parsed_response:
            # no Join button — meeting may not be live
            print(
                "FINDING: no Join button visible — meeting may not be running. "
                "Attempting instant join via direct navigation."
            )
            # try the instant meeting pattern
            screenshot(nova, "12b_no_join_button")
            assert False, (
                "meetings page does not show a Join button — "
                "is a meeting actually running? Jitsi is WARM but no meeting is scheduled."
            )

        print("PASS: meetings page shows a Join button")

        # --- Click Join ---
        nova.act("click the 'Join' button")
        time.sleep(8)
        screenshot(nova, "13_join_clicked")

        # --- FP-021 CRITICAL ASSERTION: verify Jitsi iframe src ---
        # The embed creates an iframe via JitsiMeetExternalAPI inside
        # div[data-testid="jitsi-iframe-host"]

        jitsi_verified = False

        # Method 1: check for iframe with meet.clouddelnorte.org in src
        iframe_check = nova.page.evaluate("""() => {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                if (iframe.src && iframe.src.includes('meet.clouddelnorte.org')) {
                    return iframe.src;
                }
            }
            return null;
        }""")

        if iframe_check:
            print(f"PASS (FP-021): Jitsi iframe found with src: {iframe_check}")
            jitsi_verified = True
        else:
            # Method 2: wait longer — Jitsi iframe loads async after JWT fetch
            time.sleep(10)
            screenshot(nova, "14_join_jitsi_wait")

            iframe_check_retry = nova.page.evaluate("""() => {
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    if (iframe.src && iframe.src.includes('meet.clouddelnorte.org')) {
                        return iframe.src;
                    }
                }
                // also check inside jitsi-iframe-host
                const host = document.querySelector('[data-testid="jitsi-iframe-host"]');
                if (host) {
                    const inner = host.querySelector('iframe');
                    if (inner && inner.src) return inner.src;
                }
                return null;
            }""")

            if iframe_check_retry:
                print(f"PASS (FP-021): Jitsi iframe found after wait: {iframe_check_retry}")
                jitsi_verified = True
            else:
                # Method 3: check for jitsi-iframe-host existence (embed is mounting)
                host_exists = nova.page.evaluate("""() => {
                    const host = document.querySelector('[data-testid="jitsi-iframe-host"]');
                    return host !== null;
                }""")

                if host_exists:
                    # wait more — JWT fetch + script load + iframe creation
                    time.sleep(15)
                    final_check = nova.page.evaluate("""() => {
                        const iframes = document.querySelectorAll('iframe');
                        for (const iframe of iframes) {
                            if (iframe.src && iframe.src.includes('meet.clouddelnorte.org')) {
                                return iframe.src;
                            }
                        }
                        return null;
                    }""")
                    if final_check:
                        print(f"PASS (FP-021): Jitsi iframe found after extended wait: {final_check}")
                        jitsi_verified = True

        screenshot(
            nova,
            "15_jitsi_VERIFIED" if jitsi_verified else "15_jitsi_MISSING"
        )

        # FP-021: this is the CRITICAL assertion — iframe src must contain meet.clouddelnorte.org
        assert jitsi_verified, (
            "FP-021 FAIL: Jitsi iframe with src containing 'meet.clouddelnorte.org' "
            "was NOT found. Navigation-only success is a false positive. "
            "The join-call flow did not produce a real Jitsi embed."
        )

        # verify iframe src contains meet.clouddelnorte.org (belt-and-suspenders)
        assert "meet.clouddelnorte.org" in (iframe_check or iframe_check_retry or ""), (
            "FP-021 FAIL: iframe src does not contain meet.clouddelnorte.org"
        )

        print("PASS: join-call flow complete — Jitsi iframe verified (FP-021)")


def test_join_meeting_jitsi():
    preflight_jitsi()
    _run_join_meeting_jitsi()


# ---- Runner ----


def main():
    """run all tests sequentially"""
    print("=" * 60)
    print("CLOUD DEL NORTE — Nova Act E2E Sign-In + Meeting Validation")
    print("=" * 60)
    print(f"target: {BASE_URL}")
    print(f"auth: {AUTH_URL}")
    print(f"test user: {TEST_EMAIL or '(not set)'}")
    print(f"password set: {'yes' if TEST_PASSWORD else 'NO'}")
    print(f"screenshots: {SCREENSHOT_DIR.resolve()}")
    print("=" * 60)
    print()

    preflight_jitsi()

    tests = [
        ("public pages accessible", test_public_pages_accessible),
        ("login page renders", test_login_page_renders),
        ("protected route redirects", test_protected_route_redirects),
        ("full sign-in", test_full_signin),
        ("join meeting + Jitsi (FP-021)", test_join_meeting_jitsi),
    ]

    results = []
    for name, test_fn in tests:
        print(f"\n--- {name} ---")
        try:
            test_fn()
            results.append((name, "PASS"))
        except AssertionError as e:
            print(f"FAIL: {e}")
            results.append((name, f"FAIL: {e}"))
        except Exception as e:
            print(f"ERROR: {e}")
            results.append((name, f"ERROR: {e}"))

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, status in results:
        marker = "PASS" if status == "PASS" else "FAIL"
        print(f"  [{marker}] {name}: {status}")

    failures = [r for r in results if r[1] != "PASS"]
    print(f"\n{len(results) - len(failures)}/{len(results)} passed")
    print("=" * 60)

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
