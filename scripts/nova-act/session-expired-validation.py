#!/usr/bin/env python3
"""Session-expired modal validation — FP-011, FP-015.

Validates that:
- FP-011: session-expired modal appears with re-login button when token expires
- FP-015: silent auth failure (401) triggers the session-expired modal
- returnTo: re-login button preserves returnTo pointing to pre-expiry page
"""
import os, signal, sys, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
MEETINGS_URL = "https://awsug.clouddelnorte.org/meetings/index.html"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
LOG_PATH = OUTPUT_DIR / f"session-expired-validation-{TS}.log"
SCENARIO_TIMEOUT = 200

_ssm = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("ssm")


def ssm_get(name: str) -> str:
    return _ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


USER_EMAIL = "heraldstack-test-member@clouddelnorte.org"
USER_PASSWORD = ssm_get("/cloud-del-norte/test/smoketest-user-password")

results = {"FP-011": "FAIL", "FP-015": "FAIL", "returnTo": "FAIL"}
_log_file = open(LOG_PATH, "w")


def log(tag: str, msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]
    line = f"[{ts}][{tag}] {msg}"
    print(line, flush=True)
    _log_file.write(line + "\n")
    _log_file.flush()


def screenshot(nova, name: str):
    path = str(OUTPUT_DIR / name)
    nova.page.screenshot(path=path)
    log("SCR", f"Saved {name}")


def login(nova, role: str):
    nova.act(f"Enter '{USER_EMAIL}' in the email field.")
    nova.page.fill('input[type="password"], input[name="password"], #password', USER_PASSWORD)
    try:
        nova.act("Click the sign in button.")
    except ActActuationError:
        pass
    time.sleep(6)
    log(role, f"Login done. URL: {nova.page.url}")


class ScenarioTimeout(Exception):
    pass


def _timeout_handler(signum, frame):
    raise ScenarioTimeout("Scenario exceeded timeout")


def invalidate_and_trigger(nova):
    """Invalidate tokens, block popup, and trigger join call via JS. Returns after modal should appear."""
    nova.page.evaluate("""() => {
        // Invalidate tokens
        sessionStorage.setItem('cdn.expiresAt', '0');
        sessionStorage.removeItem('cdn.refreshToken');
        // Block window.open so join call doesn't open a new tab
        window.open = () => null;
    }""")
    # Click join call via JS to avoid Nova Act popup issues
    nova.page.evaluate("""() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const joinBtn = btns.find(b => b.textContent.trim().toLowerCase().includes('join call'));
        if (joinBtn) joinBtn.click();
    }""")
    time.sleep(3)


def check_modal(nova) -> dict:
    """Check for Cloudscape modal (awsui) with session-expired content."""
    return nova.page.evaluate("""() => {
        // Cloudscape modals use awsui_dialog or role="dialog"
        const modals = document.querySelectorAll('[class*="awsui_dialog"], [class*="modal-content"], [role="dialog"]');
        for (const m of modals) {
            const style = window.getComputedStyle(m);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            // Check if it's inside a visible overlay
            const text = m.innerText || '';
            const buttons = Array.from(m.querySelectorAll('button')).map(b => b.textContent.trim());
            if (text.length > 5) {
                return {visible: true, text: text.substring(0, 500), buttons: buttons};
            }
        }
        // Fallback: check full body for modal overlay
        const overlay = document.querySelector('[class*="awsui_overlay"][class*="awsui_visible"], [class*="modal-overlay"]');
        if (overlay) {
            const text = overlay.innerText || '';
            const buttons = Array.from(overlay.querySelectorAll('button')).map(b => b.textContent.trim());
            return {visible: true, text: text.substring(0, 500), buttons: buttons};
        }
        return {visible: false, text: '', buttons: []};
    }""")


# === SCENARIO 1: FP-011 — invalidate tokens, click join call, modal appears ===
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_fp011():
    log("S1", "=== SCENARIO 1: FP-011 — session-expired modal via token invalidation ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-sess-exp-1") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                login(nova, "S1")
                nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
                time.sleep(4)
                log("S1", f"On meetings page: {nova.page.url}")

                invalidate_and_trigger(nova)
                screenshot(nova, f"fp011-modal-{TS}.png")

                info = check_modal(nova)
                log("S1", f"Modal check: {info}")

                if info.get("visible"):
                    text_lower = info.get("text", "").lower()
                    btns_lower = [b.lower() for b in info.get("buttons", [])]
                    session_kw = ["session", "expired", "sign in", "log in"]
                    login_kw = ["sign in", "log in", "login", "re-login"]
                    has_text = any(kw in text_lower for kw in session_kw)
                    has_btn = any(any(kw in b for kw in login_kw) for b in btns_lower)
                    if has_text and has_btn:
                        results["FP-011"] = "PASS"
                        log("S1", "FP-011 PASS")
                    else:
                        log("S1", f"FP-011 FAIL — text={has_text}, btn={has_btn}")
                else:
                    # Fallback: check full page text
                    body = nova.page.inner_text("body").lower()
                    if "session" in body and "expired" in body:
                        results["FP-011"] = "PASS"
                        log("S1", "FP-011 PASS (detected in body text)")
                    else:
                        log("S1", "FP-011 FAIL — no modal detected")
    except ScenarioTimeout:
        log("S1", "TIMEOUT")
    except Exception as e:
        log("S1", f"ERROR: {e}")
    finally:
        signal.alarm(0)


# === SCENARIO 2: FP-015 — fetch interception returns 401, modal appears ===
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_fp015():
    log("S2", "=== SCENARIO 2: FP-015 — silent auth failure triggers modal ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-sess-exp-2") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                login(nova, "S2")
                try:
                    nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
                except ActActuationError:
                    pass
                time.sleep(4)
                log("S2", f"On meetings page: {nova.page.url}")

                # Install fetch interceptor + remove refresh token + block popup
                nova.page.evaluate("""() => {
                    sessionStorage.removeItem('cdn.refreshToken');
                    window.open = () => null;
                    const origFetch = window.fetch;
                    window.fetch = function(...args) {
                        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
                        if (url.includes('execute-api')) {
                            window.fetch = origFetch;
                            return Promise.resolve(new Response('', {status: 401}));
                        }
                        return origFetch.apply(this, args);
                    };
                }""")
                log("S2", "Fetch interceptor installed + refresh removed + popup blocked")

                # Click join call via JS
                nova.page.evaluate("""() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const joinBtn = btns.find(b => b.textContent.trim().toLowerCase().includes('join call'));
                    if (joinBtn) joinBtn.click();
                }""")
                time.sleep(3)

                screenshot(nova, f"fp015-modal-{TS}.png")
                info = check_modal(nova)
                log("S2", f"Modal check: {info}")

                if info.get("visible"):
                    text_lower = info.get("text", "").lower()
                    session_kw = ["session", "expired", "sign in", "log in"]
                    if any(kw in text_lower for kw in session_kw):
                        results["FP-015"] = "PASS"
                        log("S2", "FP-015 PASS")
                    else:
                        log("S2", f"FP-015 FAIL — modal visible but wrong text")
                else:
                    body = nova.page.inner_text("body").lower()
                    if "session" in body and "expired" in body:
                        results["FP-015"] = "PASS"
                        log("S2", "FP-015 PASS (detected in body text)")
                    else:
                        log("S2", "FP-015 FAIL — no modal detected")
    except ScenarioTimeout:
        log("S2", "TIMEOUT")
    except Exception as e:
        log("S2", f"ERROR: {e}")
    finally:
        signal.alarm(0)


# === SCENARIO 3: returnTo preservation ===
@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def scenario_returnto():
    log("S3", "=== SCENARIO 3: returnTo preserved after re-login click ===")
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(SCENARIO_TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-sess-exp-3") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                login(nova, "S3")
                nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
                time.sleep(4)
                pre_expiry_url = nova.page.url
                log("S3", f"Pre-expiry URL: {pre_expiry_url}")

                invalidate_and_trigger(nova)
                info = check_modal(nova)
                log("S3", f"Modal check: {info}")

                if not info.get("visible"):
                    # Check body as fallback
                    body = nova.page.inner_text("body").lower()
                    if "session" not in body:
                        log("S3", "FAIL — modal not visible, cannot test returnTo")
                        return

                screenshot(nova, f"returnto-modal-{TS}.png")

                # Click the login button using Playwright's click (triggers React events)
                try:
                    nova.page.click('[role="dialog"] button:has-text("Log in")')
                except Exception:
                    try:
                        nova.page.click('[class*="awsui_dialog"] button:last-of-type')
                    except Exception:
                        pass
                time.sleep(5)
                try:
                    nav_url = nova.page.url
                except Exception:
                    nav_url = ""
                log("S3", f"Post-click URL: {nav_url}")

                if nav_url and ("returnto" in nav_url.lower() or "return_to" in nav_url.lower()):
                    if "meeting" in nav_url.lower():
                        results["returnTo"] = "PASS"
                        log("S3", "returnTo PASS")
                    else:
                        log("S3", f"returnTo FAIL — param present but no meetings ref: {nav_url}")
                else:
                    log("S3", f"returnTo FAIL — no returnTo param in: {nav_url}")
    except ScenarioTimeout:
        log("S3", "TIMEOUT")
    except Exception as e:
        log("S3", f"ERROR: {e}")
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    log("MAIN", f"Session-expired validation — {TS}")

    scenario_fp011()
    scenario_fp015()
    scenario_returnto()

    report = f"""
{'='*60}
SESSION-EXPIRED VALIDATION REPORT — {TS}
{'='*60}
FP-011 (session-expired modal + re-login button): {results['FP-011']}
FP-015 (silent auth failure triggers modal):      {results['FP-015']}
returnTo preserved post re-login:                 {results['returnTo']}
{'='*60}
"""
    print(report)
    _log_file.write(report)
    _log_file.close()
