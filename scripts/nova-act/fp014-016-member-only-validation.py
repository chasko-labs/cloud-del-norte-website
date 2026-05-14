#!/usr/bin/env python3
"""FP-014 + FP-016 validation — cdn-member-only-test (non-moderator).

Validates:
  FP-014: admin nav links hidden from members-only (non-moderator) user.
  FP-016: nav filter for pending users (BLOCKED — user is already approved).
  Bonus:  direct /admin/index.html navigation → expect redirect/denial.
"""
import json, os, signal, sys, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
AWSUG_URL = "https://awsug.clouddelnorte.org"
ADMIN_URL = "https://awsug.clouddelnorte.org/admin/index.html"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
LOG_PATH = OUTPUT_DIR / f"fp014-016-member-only-{TS}.log"
TIMEOUT = 240

# --- SSM credentials ---
_ssm = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("ssm")
EMAIL = _ssm.get_parameter(Name="/cloud-del-norte/test/member-only-user-email", WithDecryption=True)["Parameter"]["Value"]
PASSWORD = _ssm.get_parameter(Name="/cloud-del-norte/test/member-only-user-password", WithDecryption=True)["Parameter"]["Value"]

results = {"FP-014": "FAIL", "FP-014-phantom": "FAIL", "FP-016": "BLOCKED"}
evidence = {}
_log = open(LOG_PATH, "w")


def log(msg: str):
    line = f"[{datetime.now(timezone.utc).strftime('%H:%M:%S.%f')[:-3]}] {msg}"
    print(line, flush=True)
    _log.write(line + "\n")
    _log.flush()


def _timeout(signum, frame):
    raise TimeoutError("Scenario exceeded timeout")


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run():
    signal.signal(signal.SIGALRM, _timeout)
    signal.alarm(TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-fp014-mem") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                # --- Login ---
                log(f"Logging in as {EMAIL}")
                nova.act(f"Enter '{EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', PASSWORD)
                try:
                    nova.act("Click the sign in button.")
                except ActActuationError:
                    pass  # redirect timeout expected
                time.sleep(6)
                log(f"Post-login URL: {nova.page.url}")

                # --- Navigate to AWSUG ---
                nova.page.goto(AWSUG_URL, wait_until="networkidle", timeout=30000)
                time.sleep(3)
                log(f"AWSUG URL: {nova.page.url}")

                # --- Screenshot nav state ---
                scr_nav = str(OUTPUT_DIR / f"fp014-nav-member-only-{TS}.png")
                nova.page.screenshot(path=scr_nav)
                log(f"Screenshot: {scr_nav}")

                # --- Extract nav links ---
                link_data = nova.page.eval_on_selector_all(
                    "a",
                    "els => els.map(e => ({text: e.textContent.trim().substring(0,80), href: e.href}))"
                )
                # Filter to meaningful nav items (skip huge CSS text nodes)
                nav_items = [d for d in link_data if len(d["text"]) < 60 and d["text"]]
                evidence["nav_items"] = nav_items
                log(f"Nav items ({len(nav_items)}): {[d['text'].lower() for d in nav_items]}")

                # --- FP-014: admin links must be absent ---
                nav_texts_lower = [d["text"].lower() for d in nav_items]
                admin_keywords = ["admin", "user list", "user admin", "meeting admin"]
                found_admin = [kw for kw in admin_keywords if any(kw in t for t in nav_texts_lower)]

                meetings_present = any("meetings" in t for t in nav_texts_lower)
                if not found_admin and meetings_present:
                    results["FP-014"] = "PASS"
                    log("FP-014 PASS — no admin links visible, meetings present")
                elif found_admin:
                    log(f"FP-014 FAIL — admin keywords found: {found_admin}")
                else:
                    log(f"FP-014 FAIL — meetings_present={meetings_present}, admin_found={found_admin}")

                # --- Phantom navigation: direct /admin/index.html ---
                log(f"Direct navigating to {ADMIN_URL}")
                resp = nova.page.goto(ADMIN_URL, wait_until="networkidle", timeout=30000)
                time.sleep(3)
                final_url = nova.page.url
                status = resp.status if resp else "no-response"
                log(f"Admin direct nav — status={status}, final_url={final_url}")

                scr_admin = str(OUTPUT_DIR / f"fp014-admin-direct-{TS}.png")
                nova.page.screenshot(path=scr_admin)

                body_text = nova.page.inner_text("body")[:500]
                log(f"Admin page body (first 500): {body_text}")
                evidence["admin_direct_nav"] = {
                    "status": str(status),
                    "final_url": final_url,
                    "body_snippet": body_text[:200],
                }

                # PASS if redirected away OR 403 OR access-denied text
                denial_signals = ["denied", "403", "not authorized", "access", "redirect",
                                  "permission", "restricted", "not allowed"]
                redirected = "admin" not in final_url.lower()
                denied_text = any(kw in body_text.lower() for kw in denial_signals)
                status_denied = str(status) in ("403", "401")

                if redirected or denied_text or status_denied:
                    results["FP-014-phantom"] = "PASS"
                    reason = "redirected" if redirected else ("denied_text" if denied_text else "status_code")
                    log(f"FP-014-phantom PASS — {reason}")
                else:
                    log("FP-014-phantom FAIL — admin page accessible without redirect/denial")

                # --- Console errors ---
                console_errors = nova.page.evaluate("""() => {
                    return window.__consoleErrors || [];
                }""")
                evidence["console_errors"] = console_errors
                log(f"Console errors captured: {len(console_errors)}")

    except TimeoutError as e:
        log(f"TIMEOUT: {e}")
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        log(traceback.format_exc())
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    log(f"FP-014/016 member-only validation — {TS}")
    log(f"User: {EMAIL} (groups: members ONLY)")
    run()

    # --- FP-016 note ---
    log("FP-016 BLOCKED — cdn-member-only-test is already in 'members' group (approved).")
    log("FP-016 requires a PENDING user (no group membership). cdn-pending-test covers this.")
    log("To validate FP-016 against a fresh pending user, create one without group assignment.")

    # --- Write evidence JSON ---
    evidence_path = OUTPUT_DIR / f"fp014-016-evidence-{TS}.json"
    with open(evidence_path, "w") as f:
        json.dump({"results": results, "evidence": evidence, "timestamp": TS, "user": EMAIL}, f, indent=2, default=str)
    log(f"Evidence: {evidence_path}")

    # --- Report ---
    report = f"""
{'='*60}
FP-014/016 MEMBER-ONLY VALIDATION — {TS}
{'='*60}
FP-014 (admin nav hidden):       {results['FP-014']}
FP-014-phantom (direct /admin):   {results['FP-014-phantom']}
FP-016 (pending nav filter):      {results['FP-016']}
{'='*60}
NOTE: FP-016 is BLOCKED because cdn-member-only-test is already
approved (members group). A pending-user variant is needed to
validate FP-016 from the non-moderator perspective. The existing
cdn-pending-test user covers this scenario in nav-filter-validation.py.
{'='*60}
"""
    print(report)
    _log.write(report)
    _log.close()
