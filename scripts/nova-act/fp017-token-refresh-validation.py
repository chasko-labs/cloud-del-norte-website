#!/usr/bin/env python3
"""FP-017 — Silent 60s token refresh picks up group approval mid-session.

Orchestration:
1. Ensure pending user has ZERO groups (reset if needed)
2. Nova Act: log in as pending user, observe filtered nav, screenshot
3. AWS CLI: admin-add-user-to-group (simulates approval)
4. Wait 65s (60s poll + 5s buffer)
5. Observe nav again — should show full member nav WITHOUT re-login
6. Cleanup: remove user from group, verify zero groups
"""
import os, signal, subprocess, sys, time
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
AWSUG_URL = "https://awsug.clouddelnorte.org"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
LOG_PATH = OUTPUT_DIR / f"fp017-token-refresh-{TS}.log"
SCENARIO_TIMEOUT = 300

POOL_ID = "us-west-2_cyPQF4F3r"
GROUP_NAME = "members"
AWS_PROFILE = "jitsi-video-hosting"
AWS_REGION = "us-west-2"

# --- AWS clients ---
_session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
_ssm = _session.client("ssm")
_cognito = _session.client("cognito-idp")


def ssm_get(name: str) -> str:
    return _ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


PENDING_EMAIL = ssm_get("/cloud-del-norte/test/pending-user-email")
PENDING_PASSWORD = ssm_get("/cloud-del-norte/test/pending-user-password")

# --- Logging ---
_log_file = open(LOG_PATH, "w")


def log(tag: str, msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]
    line = f"[{ts}][{tag}] {msg}"
    print(line, flush=True)
    _log_file.write(line + "\n")
    _log_file.flush()


# --- Cognito helpers ---
def list_groups() -> list:
    resp = _cognito.admin_list_groups_for_user(
        UserPoolId=POOL_ID, Username=PENDING_EMAIL
    )
    return [g["GroupName"] for g in resp.get("Groups", [])]


def remove_from_group():
    _cognito.admin_remove_user_from_group(
        UserPoolId=POOL_ID, Username=PENDING_EMAIL, GroupName=GROUP_NAME
    )


def add_to_group():
    _cognito.admin_add_user_to_group(
        UserPoolId=POOL_ID, Username=PENDING_EMAIL, GroupName=GROUP_NAME
    )


# --- Nav detection ---
# "meetings" is the only nav item gated behind group membership (isPending check)
# Cloudscape SideNavigation renders links inside elements with class containing "awsui"
# Use broad "a" selector but filter to short texts (nav items are single words/phrases)


def get_nav_links(nova) -> list:
    return nova.page.eval_on_selector_all(
        "a",
        "els => els.map(e => e.textContent.trim().toLowerCase()).filter(t => t.length > 0 && t.length < 40)"
    )


def is_member_nav(links: list) -> bool:
    return "meetings" in links


def is_pending_nav(links: list) -> bool:
    return "meetings" not in links


# --- Main test ---
class ScenarioTimeout(Exception):
    pass


def _timeout_handler(signum, frame):
    raise ScenarioTimeout("Scenario exceeded timeout")


result = "INCONCLUSIVE"
timing_s = None


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run_fp017():
    global result, timing_s
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)

    try:
        # Step 1: Reset state
        log("SETUP", f"Pending user: {PENDING_EMAIL}")
        groups = list_groups()
        log("SETUP", f"Current groups: {groups}")
        if GROUP_NAME in groups:
            remove_from_group()
            log("SETUP", f"Removed from '{GROUP_NAME}' to reset state")
            groups = list_groups()
        assert len(groups) == 0, f"Expected zero groups, got {groups}"
        log("SETUP", "Pre-check PASS — zero groups confirmed")

        # Step 2: Nova Act session as pending user
        with browser_session(region="us-east-1", name="cdn-fp017") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
                record_video=True, logs_directory='/tmp/nova-act-logs', go_to_url_timeout=30,
            ) as nova:
                # Login
                nova.act(f"Enter '{PENDING_EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', PENDING_PASSWORD)
                try:
                    nova.act("Click the sign in button.")
                except ActActuationError:
                    pass
                time.sleep(6)
                log("LOGIN", f"Done. URL: {nova.page.url}")

                # Navigate to awsug
                nova.act(f"Navigate to {AWSUG_URL} and wait for the page to fully load.")
                time.sleep(4)
                log("NAV", f"URL: {nova.page.url}")

                # Observe pending nav
                links_before = get_nav_links(nova)
                log("NAV", f"Before-approval links: {links_before[:20]}")
                assert is_pending_nav(links_before), f"Expected pending nav but got member nav: {links_before}"
                log("NAV", "Confirmed: pending/filtered nav visible")

                # Screenshot before
                before_path = str(OUTPUT_DIR / f"fp017-before-approval-{TS}.png")
                nova.page.screenshot(path=before_path)
                log("SCR", f"Before: {before_path}")

                # Step 3: Admin approval (while session is open)
                log("ADMIN", "Adding user to 'members' group...")
                t_start = time.time()
                t_approval = t_start
                add_to_group()
                elapsed_ms = int((time.time() - t_start) * 1000)
                log("ADMIN", f"admin-add-user-to-group done — {elapsed_ms}ms since scenario start marker")

                # Step 4: Poll for nav change (keeps session alive, detects reload)
                POLL_INTERVAL = 5
                POLL_TIMEOUT = 75
                log("POLL", f"Polling every {POLL_INTERVAL}s for up to {POLL_TIMEOUT}s...")
                baseline_url = nova.page.url
                detected_reload = False
                ever_saw_meetings = False
                links_after = []

                # Exception types/messages caused by window.location.reload()
                _RELOAD_MSGS = ("Execution context was destroyed", "Navigation was prevented", "Target closed", "target closed")

                def _is_reload_error(exc: Exception) -> bool:
                    msg = str(exc)
                    return any(m in msg for m in _RELOAD_MSGS)

                elapsed = 0
                while elapsed < POLL_TIMEOUT:
                    time.sleep(POLL_INTERVAL)
                    elapsed = round(time.time() - t_approval, 1)
                    try:
                        current_url = nova.page.url
                        links_after = get_nav_links(nova)
                    except Exception as poll_exc:
                        if not _is_reload_error(poll_exc):
                            raise
                        detected_reload = True
                        log("POLL", f"[POLL {elapsed}s] reload detected, re-attaching...")
                        time.sleep(3)
                        try:
                            nova.page.wait_for_load_state("domcontentloaded")
                        except Exception:
                            pass
                        try:
                            current_url = nova.page.url
                            links_after = get_nav_links(nova)
                        except Exception:
                            log("POLL", f"[POLL {elapsed}s] re-query failed, will retry next interval")
                            continue

                    has_meetings = "meetings" in links_after
                    if has_meetings:
                        ever_saw_meetings = True
                    url_changed = current_url != baseline_url
                    log("POLL", f"[POLL {elapsed}s] url={current_url}, has_meetings={has_meetings}")

                    if url_changed and not detected_reload:
                        detected_reload = True
                        log("POLL", f"Reload detected at {elapsed}s (url changed)")
                    if has_meetings:
                        log("POLL", f"'meetings' link appeared at {elapsed}s")
                        break

                # Final post-loop observation
                try:
                    links_after = get_nav_links(nova)
                except Exception as final_exc:
                    if _is_reload_error(final_exc):
                        log("POLL", "Final observation hit reload — waiting 3s...")
                        time.sleep(3)
                        try:
                            nova.page.wait_for_load_state("domcontentloaded")
                            links_after = get_nav_links(nova)
                        except Exception:
                            pass
                if "meetings" in links_after:
                    ever_saw_meetings = True

                # Screenshot after
                after_path = str(OUTPUT_DIR / f"fp017-after-approval-{TS}.png")
                try:
                    nova.page.screenshot(path=after_path)
                except Exception:
                    log("SCR", "Screenshot failed (page may have reloaded)")
                log("SCR", f"After: {after_path}")

                # Verdict
                timing_s = round(time.time() - t_approval, 1)
                if ever_saw_meetings:
                    result = "PASS"
                    log("VERDICT", f"FP-017 PASS — nav updated to member view in {timing_s}s (reload_detected={detected_reload})")
                elif not detected_reload:
                    result = "FAIL"
                    log("VERDICT", f"FP-017 FAIL — nav still pending after {timing_s}s, no reload observed. Links: {links_after[:15]}")
                else:
                    result = "FAIL"
                    log("VERDICT", f"FP-017 FAIL — reload observed but 'meetings' never appeared in {timing_s}s. Links: {links_after[:15]}")

    except ScenarioTimeout:
        log("ERR", "TIMEOUT")
    except Exception as e:
        log("ERR", f"Exception: {e}")
        result = "INCONCLUSIVE"
    finally:
        signal.alarm(0)

    # Step 5: Cleanup (always runs)
    log("CLEANUP", "Removing user from 'members' group...")
    try:
        remove_from_group()
    except Exception:
        pass  # may already be removed if test failed early
    final_groups = list_groups()
    log("CLEANUP", f"Final groups: {final_groups}")
    assert len(final_groups) == 0, f"Cleanup failed — groups: {final_groups}"
    log("CLEANUP", "Verified: zero groups restored")


if __name__ == "__main__":
    log("MAIN", f"FP-017 token refresh validation — {TS}")
    log("MAIN", f"Pending user: {PENDING_EMAIL}")

    run_fp017()

    report = f"""
{'='*60}
FP-017 TOKEN REFRESH VALIDATION — {TS}
{'='*60}
Result:  {result}
Timing:  {timing_s}s (approval → nav change observed)
Log:     {LOG_PATH}
{'='*60}
"""
    print(report)
    _log_file.write(report)
    _log_file.close()

    sys.exit(0 if result == "PASS" else 1)
