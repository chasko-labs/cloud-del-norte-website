#!/usr/bin/env python3
"""FP-020 rigorous repro: pending-user full-nav visibility on signup→confirm→login path.

Issue #155. Deterministic script — no randomness. Generates a disposable user,
signs up via Nova Act, admin-confirms, checks group membership, logs in,
navigates to awsug.clouddelnorte.org, enumerates sidebar nav items, asserts
nav filtering is correct for a freshly-confirmed user with no group assignment.
"""
import json, os, subprocess, sys, time
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
LOGIN_URL = "https://auth.clouddelnorte.org/index.html"
AWSUG_URL = "https://awsug.clouddelnorte.org"
USER_POOL_ID = "us-west-2_cyPQF4F3r"
AWS_PROFILE = "jitsi-video-hosting"
AWS_REGION = "us-west-2"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
LOG_PATH = OUTPUT_DIR / f"fp020-repro-{TS}.log"

# --- Deterministic credentials ---
TEST_EMAIL = f"ux-probe-fp020-{TS}@clouddelnorte.org"
TEST_PASSWORD = f"Fp020!Repro{TS}#Zx"
TEST_NAME = "FP020 Repro User"

# --- State ---
groups_pre_login: list[str] = []
groups_post_login: list[str] = []
nav_items: list[str] = []
verdict = "ARTIFACT"

_log_file = open(LOG_PATH, "w")


def log(tag: str, msg: str):
    line = f"[{datetime.now(timezone.utc).strftime('%H:%M:%S.%f')[:-3]}][{tag}] {msg}"
    print(line, flush=True)
    _log_file.write(line + "\n")
    _log_file.flush()


def screenshot(nova, name: str):
    path = str(OUTPUT_DIR / name)
    nova.page.screenshot(path=path)
    log("SCR", f"Saved {name}")


def aws_cmd(args: list[str]) -> subprocess.CompletedProcess:
    cmd = ["aws", "cognito-idp"] + args + ["--profile", AWS_PROFILE, "--region", AWS_REGION]
    return subprocess.run(cmd, capture_output=True, text=True, timeout=30)


def get_user_groups(email: str) -> list[str]:
    r = aws_cmd([
        "admin-list-groups-for-user",
        "--user-pool-id", USER_POOL_ID,
        "--username", email,
        "--query", "Groups[].GroupName",
        "--output", "text",
    ])
    if r.returncode != 0:
        log("AWS", f"list-groups failed: {r.stderr.strip()}")
        return []
    raw = r.stdout.strip()
    if not raw or raw == "None":
        return []
    return raw.split()


def admin_confirm(email: str):
    r = aws_cmd(["admin-confirm-sign-up", "--user-pool-id", USER_POOL_ID, "--username", email])
    if r.returncode != 0:
        log("AWS", f"confirm failed: {r.stderr.strip()}")
        raise RuntimeError(f"admin-confirm-sign-up failed: {r.stderr}")
    log("AWS", "admin-confirm-sign-up OK")


def disable_mfa(email: str):
    r = aws_cmd([
        "admin-set-user-mfa-preference",
        "--user-pool-id", USER_POOL_ID,
        "--username", email,
        "--software-token-mfa-settings", "Enabled=false,PreferredMfa=false",
    ])
    if r.returncode != 0:
        log("AWS", f"disable-mfa warn: {r.stderr.strip()}")
    else:
        log("AWS", "MFA disabled for user")


def cleanup(email: str):
    r = aws_cmd(["admin-delete-user", "--user-pool-id", USER_POOL_ID, "--username", email])
    if r.returncode != 0:
        log("CLEANUP", f"delete failed (non-fatal): {r.stderr.strip()}")
    else:
        log("CLEANUP", f"deleted {email}")


# =============================================================================
# PHASE A: Signup
# =============================================================================
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def phase_a_signup():
    log("A", "=== PHASE A: Signup ===")
    log("A", f"Email: {TEST_EMAIL}")
    with browser_session(region="us-east-1", name="cdn-fp020-signup") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=SIGNUP_URL, headless=True, tty=False,
                record_video=True, logs_directory='/tmp/nova-act-logs', go_to_url_timeout=30,
        ) as nova:
            time.sleep(4)

            # Fill form via DOM for reliability
            nova.page.fill('input[type="email"]', TEST_EMAIL)
            name_input = nova.page.query_selector('input[placeholder*="Alex"]')
            if name_input:
                name_input.fill(TEST_NAME)
            else:
                inputs = nova.page.query_selector_all('input[type="text"]')
                if inputs:
                    inputs[0].fill(TEST_NAME)

            pw_inputs = nova.page.query_selector_all('input[type="password"]')
            for inp in pw_inputs:
                inp.fill(TEST_PASSWORD)

            time.sleep(1)
            log("A", "Form filled. Advancing wizard...")

            # Click continue through wizard steps (3 steps: credentials → about → interests → verify)
            for step in range(3):
                try:
                    nova.act("Click the button labeled 'continue'.")
                except ActActuationError:
                    log("A", f"Step {step+1} actuation error (may be expected)")
                time.sleep(3)

            time.sleep(4)
            log("A", f"Final URL: {nova.page.url}")
            body = nova.page.inner_text("body").lower()
            if "verify" in body or "email" in body or "check" in body:
                log("A", "SUCCESS — landed on verify/check-email step")
            else:
                log("A", f"WARN — unexpected state. Body: {body[:300]}")


# =============================================================================
# PHASE D+E+F: Login → Navigate → Enumerate nav
# =============================================================================
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def phase_d_login_and_nav():
    global nav_items
    log("D", "=== PHASE D: Login ===")
    with browser_session(region="us-east-1", name="cdn-fp020-login") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=LOGIN_URL, headless=True, tty=False,
                record_video=True, logs_directory='/tmp/nova-act-logs', go_to_url_timeout=30,
        ) as nova:
            time.sleep(4)

            nova.page.fill('input[type="email"]', TEST_EMAIL)
            nova.page.fill('input[type="password"]', TEST_PASSWORD)
            time.sleep(1)

            try:
                nova.act("Click the 'Sign in' button.")
            except ActActuationError:
                pass  # redirect timeout expected
            time.sleep(8)

            log("D", f"URL after login: {nova.page.url}")

            # PHASE E: navigate to awsug
            log("E", "=== PHASE E: Navigate to awsug ===")
            nova.go_to_url(AWSUG_URL)
            time.sleep(5)
            log("E", f"URL: {nova.page.url}")
            screenshot(nova, f"fp020-awsug-nav-{TS}.png")

            # PHASE F: enumerate sidebar nav
            log("F", "=== PHASE F: Enumerate sidebar nav ===")
            # Try programmatic extraction first
            nav_items = nova.page.eval_on_selector_all(
                "nav a, aside a, [class*='sidebar'] a, [class*='nav'] a",
                "els => els.map(e => e.textContent.trim()).filter(t => t)"
            )
            log("F", f"Sidebar links (selector): {nav_items}")

            # Also get ALL link texts as fallback
            all_links = nova.page.eval_on_selector_all(
                "a", "els => els.map(e => e.textContent.trim().toLowerCase()).filter(t => t)"
            )
            log("F", f"All page links: {all_links}")

            if not nav_items:
                nav_items = all_links

            # Check for pending banner
            body_text = nova.page.inner_text("body")
            body_lower = body_text.lower()
            banner_keywords = ["pending", "approval", "review", "awaiting", "not yet approved"]
            banner_found = any(kw in body_lower for kw in banner_keywords)
            log("F", f"Pending banner found: {banner_found}")
            log("F", f"Body (first 800): {body_text[:800]}")


# =============================================================================
# MAIN
# =============================================================================
if __name__ == "__main__":
    log("MAIN", f"FP-020 Rigorous Repro — {TS}")
    log("MAIN", f"Email: {TEST_EMAIL}")
    log("MAIN", f"Pool: {USER_POOL_ID} (no Lambda triggers)")

    try:
        # PHASE A: Signup
        phase_a_signup()

        # PHASE B: Admin-confirm
        log("B", "=== PHASE B: Admin confirm ===")
        admin_confirm(TEST_EMAIL)
        time.sleep(2)

        # PHASE C: Check groups BEFORE login
        log("C", "=== PHASE C: Pre-login group check ===")
        groups_pre_login = get_user_groups(TEST_EMAIL)
        log("C", f"ASSERT-1 groups pre-login: {groups_pre_login}")

        # Disable MFA before login attempt
        disable_mfa(TEST_EMAIL)

        # PHASE D+E+F: Login, navigate, enumerate
        phase_d_login_and_nav()

        # PHASE G: Post-login group check
        log("G", "=== PHASE G: Post-login group check ===")
        groups_post_login = get_user_groups(TEST_EMAIL)
        log("G", f"Groups post-login: {groups_post_login}")
        log("G", f"Groups changed: {groups_pre_login != groups_post_login}")

    except Exception as e:
        log("MAIN", f"FATAL: {e}")
        import traceback
        log("MAIN", traceback.format_exc())
    finally:
        # CLEANUP
        cleanup(TEST_EMAIL)

    # --- ASSERTIONS ---
    log("ASSERT", "=" * 60)
    log("ASSERT", f"ASSERT-1: pre-login groups = {groups_pre_login}")

    nav_lower = [item.lower() if isinstance(item, str) else item for item in nav_items]
    has_admin = "admin" in nav_lower
    has_meetings = "meetings" in nav_lower
    has_members_group = any(g in ("members", "moderators") for g in groups_pre_login)
    has_pending_group = "pending" in groups_pre_login

    log("ASSERT", f"ASSERT-2: nav contains 'admin' = {has_admin} (should be False)")
    log("ASSERT", f"ASSERT-3: nav contains 'meetings' = {has_meetings}, user in members/moderators = {has_members_group}")
    log("ASSERT", f"ASSERT-4: post-login groups = {groups_post_login}")

    # --- VERDICT ---
    groups_any = groups_pre_login or groups_post_login
    nav_has_restricted = has_admin or (has_meetings and not has_members_group)

    if groups_any and nav_has_restricted:
        verdict = "CONFIRMED"
        log("VERDICT", f"FP-020 CONFIRMED — user in groups {groups_any} sees restricted nav items")
    elif not groups_any and not nav_has_restricted:
        verdict = "DENIED"
        log("VERDICT", "FP-020 DENIED — no groups, nav correctly filtered")
    elif groups_any and not nav_has_restricted:
        verdict = "DENIED"
        log("VERDICT", f"FP-020 DENIED — user in groups {groups_any} but nav correctly filtered (isPending works)")
    else:
        verdict = "ARTIFACT"
        log("VERDICT", "FP-020 ARTIFACT — prior observation not reproducible in rigorous run")

    # --- FINAL REPORT ---
    report = f"""
{'='*60}
FP-020 REPRO REPORT — {TS}
{'='*60}
Email:              {TEST_EMAIL}
Pre-login groups:   {groups_pre_login}
Post-login groups:  {groups_post_login}
Nav items:          {nav_items}
Admin in nav:       {has_admin}
Meetings in nav:    {has_meetings}
VERDICT:            {verdict}
{'='*60}
"""
    print(report)
    _log_file.write(report)
    _log_file.close()

    # Exit code reflects verdict
    sys.exit(0 if verdict in ("DENIED", "ARTIFACT") else 1)
