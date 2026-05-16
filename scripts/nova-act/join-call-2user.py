#!/usr/bin/env python3
"""2-user join-call E2E — moderator + member via in-app JWT flow.

FP-021: Jitsi opens in a Cloudscape Modal on the SAME page (not a new tab).
Polls for [data-testid='jitsi-iframe-host'] iframe src containing meet.clouddelnorte.org.
Iframe attachment is sufficient proof — full conference join takes 30-90s (cold-start).
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
MEETINGS_URL = "https://awsug.clouddelnorte.org/meetings/index.html"
JITSI_DOMAIN = "meet.clouddelnorte.org"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
SCENARIO_TIMEOUT = 420  # 7 minutes

# --- Credential fetch (in-memory only) ---
_session = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2")
sm_client = _session.client("secretsmanager")
ssm_client = _session.client("ssm")
MOD_PASSWORD = sm_client.get_secret_value(SecretId="cloud-del-norte/heraldstack-cognito-pw")["SecretString"]
MEM_PASSWORD = ssm_client.get_parameter(Name="/cloud-del-norte/test/smoketest-user-password", WithDecryption=True)["Parameter"]["Value"]
MOD_EMAIL = "heraldstack@clouddelnorte.org"
MEM_EMAIL = "heraldstack-test-member@clouddelnorte.org"

results = {"moderator": {}, "member": {}, "verdict": "FAIL"}


def log(role: str, msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}][{role}] {msg}", flush=True)


def screenshot(nova, role: str, label: str) -> str:
    fname = f"{role}-{label}-{TS}.png"
    path = str(OUTPUT_DIR / fname)
    nova.page.screenshot(path=path)
    log(role, f"Screenshot: {fname}")
    return path


def login(nova, email: str, password: str, role: str):
    nova.act(f"Enter '{email}' in the email field.")
    nova.page.fill('input[type="password"], input[name="password"], #password', password)
    try:
        nova.act("Click the sign in button.")
    except ActActuationError:
        pass  # redirect causes screenshot timeout — expected success
    time.sleep(6)
    log(role, f"Login done. URL: {nova.page.url}")


def wait_for_jitsi_embed(nova, role: str, timeout_s: int = 45):
    """Poll for [data-testid='jitsi-iframe-host'] iframe with meet.clouddelnorte.org src.

    Returns (iframe_found: bool, iframe_src: str, poll_seconds: float).
    Never raises — caller decides on failure.
    """
    t0 = time.time()
    iframe_found = False
    iframe_src = ""

    while True:
        elapsed = round(time.time() - t0, 1)

        # Modal visible? role='dialog' is set by Cloudscape Modal.
        modal_el = nova.page.query_selector("[role='dialog']")
        modal_visible = bool(modal_el and modal_el.is_visible())

        # Iframe inside host div?
        iframe_el = nova.page.query_selector(f"[data-testid='jitsi-iframe-host'] iframe[src*='{JITSI_DOMAIN}']")
        if iframe_el:
            iframe_found = True
            iframe_src = iframe_el.get_attribute("src") or ""

        log(role, f"[POLL {elapsed}s] modal={modal_visible} iframe={iframe_found} src={iframe_src!r}")

        if iframe_found:
            return (True, iframe_src, elapsed)

        if elapsed >= timeout_s:
            return (False, "", elapsed)

        time.sleep(2)


def assert_jitsi_reached(nova, role: str, result: dict, poll_result: tuple) -> bool:
    """Classify outcome from wait_for_jitsi_embed poll result.

    Sets result['status'] to one of: joined | modal_no_iframe | modal_never_opened.
    Returns True only for 'joined'.
    """
    iframe_found, iframe_src, poll_seconds = poll_result

    if iframe_found and JITSI_DOMAIN in iframe_src:
        result["status"] = "joined"
        result["jitsi_url"] = iframe_src
        result["time_to_iframe"] = poll_seconds
        log(role, f"iframe attached in {poll_seconds}s — {iframe_src}")
        return True

    # Distinguish: modal open but no iframe vs modal never opened
    modal_el = nova.page.query_selector("[role='dialog']")
    modal_visible = bool(modal_el and modal_el.is_visible())

    if modal_visible:
        result["status"] = "modal_no_iframe"
        try:
            modal_text = (modal_el.inner_text() or "")[:300]
        except Exception:
            modal_text = "<unreadable>"
        result["modal_text"] = modal_text
        log(role, f"modal open but no iframe after {poll_seconds}s — modal text: {modal_text!r}")
    else:
        result["status"] = "modal_never_opened"
        try:
            body_snippet = (nova.page.inner_text("body") or "")[:300]
        except Exception:
            body_snippet = "<unreadable>"
        join_btn = nova.page.query_selector("button[data-testid='join-call-btn'], button")
        result["body_snippet"] = body_snippet
        result["join_btn_visible"] = bool(join_btn and join_btn.is_visible())
        log(role, f"modal never opened — body: {body_snippet!r}")

    return False


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-join-call-2user",
)
def run_2user_test():
    signal.alarm(SCENARIO_TIMEOUT)

    # === MODERATOR ===
    r = results["moderator"]
    r["start_time"] = datetime.now(timezone.utc).isoformat()
    log("MOD", "Starting moderator session")

    with browser_session(region="us-east-1", name="cdn-2user-mod") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=AUTH_URL, headless=True, tty=False,
                record_video=True, logs_directory='/tmp/nova-act-logs', go_to_url_timeout=30,
        ) as nova:
            try:
                login(nova, MOD_EMAIL, MOD_PASSWORD, "MOD")
                r["login"] = "success"

                nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
                time.sleep(2)
                log("MOD", f"At meetings. URL: {nova.page.url}")

                nova.act("Click the 'join call' button.")
                screenshot(nova, "MOD", "post-click")

                poll = wait_for_jitsi_embed(nova, "MOD")
                screenshot(nova, "MOD", "post-settle")

                assert_jitsi_reached(nova, "MOD", r, poll)
                log("MOD", f"Status: {r['status']}")

            except Exception as e:
                log("MOD", f"ERROR: {e}")
                try:
                    log("MOD", f"URL: {nova.page.url}")
                    screenshot(nova, "MOD", "error")
                except Exception:
                    pass
                r["error"] = str(e)

    # === MEMBER ===
    rm = results["member"]
    rm["start_time"] = datetime.now(timezone.utc).isoformat()
    log("MEM", "Starting member session")

    with browser_session(region="us-east-1", name="cdn-2user-mem") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=AUTH_URL, headless=True, tty=False,
                record_video=True, logs_directory='/tmp/nova-act-logs', go_to_url_timeout=30,
        ) as nova:
            try:
                login(nova, MEM_EMAIL, MEM_PASSWORD, "MEM")
                rm["login"] = "success"

                nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
                time.sleep(2)
                log("MEM", f"At meetings. URL: {nova.page.url}")

                nova.act("Click the 'join call' button.")
                screenshot(nova, "MEM", "post-click")

                poll = wait_for_jitsi_embed(nova, "MEM")
                screenshot(nova, "MEM", "post-settle")

                assert_jitsi_reached(nova, "MEM", rm, poll)
                log("MEM", f"Status: {rm['status']}")

            except Exception as e:
                log("MEM", f"ERROR: {e}")
                try:
                    log("MEM", f"URL: {nova.page.url}")
                    screenshot(nova, "MEM", "error")
                except Exception:
                    pass
                rm["error"] = str(e)

    # === VERDICT ===
    mod_ok = results["moderator"].get("status") == "joined"
    mem_ok = results["member"].get("status") == "joined"
    if mod_ok and mem_ok:
        results["verdict"] = "PASS"
    elif mod_ok or mem_ok:
        results["verdict"] = "DEGRADED"
    else:
        results["verdict"] = "FAIL"
    results["timestamp"] = datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    signal.signal(signal.SIGALRM, lambda *_: sys.exit("SCENARIO_TIMEOUT exceeded"))
    log("MAIN", f"2-user join-call validation — {TS}")
    run_2user_test()
    print(f"\n{'='*60}")
    print(f"VERDICT: {results['verdict']}")
    print(f"Moderator: {results['moderator'].get('status', 'unknown')} "
          f"(TTI: {results['moderator'].get('time_to_iframe', 'N/A')}s)")
    print(f"Member: {results['member'].get('status', 'unknown')} "
          f"(TTI: {results['member'].get('time_to_iframe', 'N/A')}s)")
    print(f"{'='*60}")
    print(json.dumps(results, indent=2, default=str))
