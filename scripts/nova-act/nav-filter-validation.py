#!/usr/bin/env python3
"""Three-tier nav-filter validation — FP-003, FP-010, FP-014, FP-016.

Runs three sequential scenarios (moderator, member-only, pending) to validate
that sidebar navigation filtering works correctly per user group membership.
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

# --- Constants ---
AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
AWSUG_URL = "https://awsug.clouddelnorte.org"
MEETINGS_URL = "https://awsug.clouddelnorte.org/meetings/index.html"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
LOG_PATH = OUTPUT_DIR / f"nav-filter-validation-{TS}.log"
SCENARIO_TIMEOUT = 240  # 4 min per scenario

# --- Credential fetch (read-only from SSM) ---
_ssm = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("ssm")


def ssm_get(name: str) -> str:
    return _ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


MOD_EMAIL = "heraldstack-test-member@clouddelnorte.org"
MOD_PASSWORD = ssm_get("/cloud-del-norte/test/smoketest-user-password")
MEMBER_EMAIL = ssm_get("/cloud-del-norte/test/member-only-user-email")
MEMBER_PASSWORD = ssm_get("/cloud-del-norte/test/member-only-user-password")
PENDING_EMAIL = ssm_get("/cloud-del-norte/test/pending-user-email")
PENDING_PASSWORD = ssm_get("/cloud-del-norte/test/pending-user-password")

# --- Results ---
results = {
    "FP-014": "FAIL",
    "FP-016": "FAIL",
    "FP-003": "FAIL",
    "FP-010": "FAIL",
}

_log_file = open(LOG_PATH, "w")


def log(role: str, msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]
    line = f"[{ts}][{role}] {msg}"
    print(line, flush=True)
    _log_file.write(line + "\n")
    _log_file.flush()


def screenshot(nova, name: str) -> str:
    path = str(OUTPUT_DIR / name)
    nova.page.screenshot(path=path)
    log("SCR", f"Saved {name}")
    return path


def login(nova, email: str, password: str, role: str):
    nova.act(f"Enter '{email}' in the email field.")
    nova.page.fill('input[type="password"], input[name="password"], #password', password)
    try:
        nova.act("Click the sign in button.")
    except ActActuationError:
        pass  # redirect causes timeout — expected
    time.sleep(6)
    log(role, f"Login done. URL: {nova.page.url}")


class ScenarioTimeout(Exception):
    pass


def _timeout_handler(signum, frame):
    raise ScenarioTimeout("Scenario exceeded 240s timeout")


# === SCENARIO 1: MODERATOR ===
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_moderator():
    log("MOD", "=== SCENARIO 1: MODERATOR ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-nav-mod") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                login(nova, MOD_EMAIL, MOD_PASSWORD, "MOD")
                nova.act(f"Navigate to {AWSUG_URL} and wait for the page to fully load.")
                time.sleep(3)
                log("MOD", f"URL: {nova.page.url}")

                screenshot(nova, "awsug-nav-moderator.png")

                # Extract all link texts for reliable nav check
                link_texts = nova.page.eval_on_selector_all("a", "els => els.map(e => e.textContent.trim().toLowerCase()).filter(t => t)")
                log("MOD", f"All link texts: {link_texts[:30]}")

                expected = ["meetings", "admin", "plans", "roadmap", "tech debt countdowns"]
                found = [item for item in expected if item in link_texts]
                log("MOD", f"Found items: {found}")
                if len(found) >= 5:
                    log("MOD", "PASS — all 5 nav items visible")
                else:
                    log("MOD", f"WARN — only {len(found)}/5 items confirmed: {found}")
    except ScenarioTimeout:
        log("MOD", "TIMEOUT — scenario exceeded 240s")
    except Exception as e:
        log("MOD", f"ERROR: {e}")
    finally:
        signal.alarm(0)


# === SCENARIO 2: MEMBER-ONLY ===
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_member():
    log("MEM", "=== SCENARIO 2: MEMBER-ONLY ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-nav-mem") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                login(nova, MEMBER_EMAIL, MEMBER_PASSWORD, "MEM")
                nova.act(f"Navigate to {AWSUG_URL} and wait for the page to fully load.")
                time.sleep(3)
                log("MEM", f"URL: {nova.page.url}")

                screenshot(nova, "awsug-nav-member-only.png")

                # Extract all link texts — reliable way to check what nav items are rendered
                link_texts = nova.page.eval_on_selector_all("a", "els => els.map(e => e.textContent.trim().toLowerCase()).filter(t => t)")
                log("MEM", f"All link texts: {link_texts[:30]}")

                meetings_present = "meetings" in link_texts
                admin_absent = "admin" not in link_texts

                if meetings_present and admin_absent:
                    results["FP-014"] = "PASS"
                    log("MEM", "FP-014 PASS — admin hidden, meetings visible")
                else:
                    log("MEM", f"FP-014 FAIL — meetings_present={meetings_present}, admin_absent={admin_absent}")
    except ScenarioTimeout:
        log("MEM", "TIMEOUT — scenario exceeded 240s")
    except Exception as e:
        log("MEM", f"ERROR: {e}")
    finally:
        signal.alarm(0)


# === SCENARIO 3: PENDING USER ===
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_pending():
    log("PEND", "=== SCENARIO 3: PENDING USER ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-nav-pend") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                login(nova, PENDING_EMAIL, PENDING_PASSWORD, "PEND")
                nova.act(f"Navigate to {AWSUG_URL} and wait for the page to fully load.")
                time.sleep(3)
                log("PEND", f"URL: {nova.page.url}")

                # Check sidebar via DOM
                screenshot(nova, "awsug-nav-pending.png")
                link_texts = nova.page.eval_on_selector_all("a", "els => els.map(e => e.textContent.trim().toLowerCase()).filter(t => t)")
                log("PEND", f"All link texts: {link_texts[:30]}")

                meetings_absent = "meetings" not in link_texts
                admin_absent = "admin" not in link_texts

                if meetings_absent and admin_absent:
                    results["FP-016"] = "PASS"
                    log("PEND", "FP-016 PASS — both meetings and admin hidden")
                else:
                    log("PEND", f"FP-016 FAIL — meetings_absent={meetings_absent}, admin_absent={admin_absent}")

                # FP-003: pending-approval banner — check page body text
                body_text = nova.page.inner_text("body")
                body_lower = body_text.lower()
                log("PEND", f"Body text (first 500): {body_text[:500]}")
                banner_keywords = ["pending", "approval", "review", "awaiting", "not yet approved"]
                if any(kw in body_lower for kw in banner_keywords):
                    results["FP-003"] = "PASS"
                    log("PEND", "FP-003 PASS — pending-approval banner detected")
                else:
                    log("PEND", "FP-003 FAIL — no pending-approval banner found")

                # FP-010: navigate to /meetings/ directly — expect denial message
                nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
                time.sleep(3)
                log("PEND", f"Meetings URL: {nova.page.url}")

                body_text2 = nova.page.inner_text("main") if nova.page.query_selector("main") else nova.page.inner_text("body")
                log("PEND", f"Meetings page text (first 500): {body_text2[:500]}")
                screenshot(nova, "awsug-meetings-denied-pending.png")

                r2_lower = body_text2.lower()
                denial_keywords = ["denied", "access", "permission", "not authorized", "403",
                                   "cannot access", "not allowed", "restricted", "approval",
                                   "contact", "pending", "available once approved"]
                if any(kw in r2_lower for kw in denial_keywords):
                    results["FP-010"] = "PASS"
                    log("PEND", "FP-010 PASS — denial/explanation message found")
                else:
                    log("PEND", "FP-010 FAIL — no clear denial message")
    except ScenarioTimeout:
        log("PEND", "TIMEOUT — scenario exceeded 240s")
    except Exception as e:
        log("PEND", f"ERROR: {e}")
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    log("MAIN", f"Nav-filter validation — {TS}")
    log("MAIN", "Running 3 scenarios sequentially")

    scenario_moderator()
    scenario_member()
    scenario_pending()

    # --- Report ---
    report = f"""
{'='*60}
NAV-FILTER VALIDATION REPORT — {TS}
{'='*60}
FP-014 (admin nav hidden from members):    {results['FP-014']}
FP-016 (pending-user nav filtering):       {results['FP-016']}
FP-003 (pending-approval banner visible):  {results['FP-003']}
FP-010 (pending /meetings/ denial clarity): {results['FP-010']}
{'='*60}
"""
    print(report)
    _log_file.write(report)
    _log_file.close()
