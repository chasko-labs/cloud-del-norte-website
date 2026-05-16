#!/usr/bin/env python3
"""Probe: admin member management empty-state bug (2026-05-12).

Logs in as bryanj+clouddelnorte moderator, navigates to /admin/index.html,
captures each tab's state, network responses, and console errors.
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
ADMIN_URL = "https://awsug.clouddelnorte.org/admin/index.html"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
TIMEOUT = 300

_ssm = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("ssm")
# bryanj+clouddelnorte is a moderator — reuse smoketest creds or discover path
try:
    EMAIL = _ssm.get_parameter(Name="/cloud-del-norte/test/smoketest-user-email", WithDecryption=True)["Parameter"]["Value"]
    PASSWORD = _ssm.get_parameter(Name="/cloud-del-norte/test/smoketest-user-password", WithDecryption=True)["Parameter"]["Value"]
except Exception:
    EMAIL = "bryanj+clouddelnorte@abstractspacecraft.com"
    PASSWORD = _ssm.get_parameter(Name="/cloud-del-norte/test/smoketest-user-password", WithDecryption=True)["Parameter"]["Value"]

findings = {"timestamp": TS, "user": EMAIL, "tabs": {}, "console_errors": [], "network": [], "root_cause": None}
_log_path = OUTPUT_DIR / f"probe-members-empty-{TS}.log"
_log = open(_log_path, "w")


def log(msg):
    line = f"[{datetime.now(timezone.utc).strftime('%H:%M:%S.%f')[:-3]}] {msg}"
    print(line, flush=True)
    _log.write(line + "\n")
    _log.flush()


def _timeout(signum, frame):
    raise TimeoutError("probe exceeded timeout")


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-probe-members-empty",
)
def run():
    signal.signal(signal.SIGALRM, _timeout)
    signal.alarm(TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-probe-members") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
                record_video=True, logs_directory='/tmp/nova-act-logs', go_to_url_timeout=30,
            ) as nova:
                # Capture network
                api_responses = []
                nova.page.on("response", lambda r: api_responses.append({
                    "url": r.url, "status": r.status,
                    "body": r.text() if "admin/users" in r.url and r.status == 200 else None,
                }) if "admin/users" in r.url else None)

                # Capture console
                console_msgs = []
                nova.page.on("console", lambda m: console_msgs.append({"type": m.type, "text": m.text}))

                # Login
                log(f"Logging in as {EMAIL}")
                nova.act(f"Enter '{EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', PASSWORD)
                try:
                    nova.act("Click the sign in button.")
                except ActActuationError:
                    pass
                time.sleep(6)
                log(f"Post-login URL: {nova.page.url}")

                # Navigate to admin
                nova.go_to_url(ADMIN_URL)
                time.sleep(4)
                log(f"Admin URL: {nova.page.url}")

                # Screenshot each tab
                for tab_id in ["pending", "members", "banned"]:
                    # Click tab
                    try:
                        nova.act(f"Click the '{tab_id}' tab.")
                    except ActActuationError:
                        log(f"Could not click tab {tab_id}")
                    time.sleep(3)
                    scr = str(OUTPUT_DIR / f"members-empty-{tab_id}-{TS}.png")
                    nova.page.screenshot(path=scr)
                    log(f"Screenshot {tab_id}: {scr}")

                    # DOM inventory
                    table_text = nova.page.inner_text("body")[:1000]
                    findings["tabs"][tab_id] = {"body_snippet": table_text[:500], "screenshot": scr}

                findings["console_errors"] = [m for m in console_msgs if m["type"] in ("error", "warning")]
                findings["network"] = api_responses
                log(f"API responses captured: {len(api_responses)}")
                log(f"Console errors: {len(findings['console_errors'])}")

                # Classify root cause
                if not api_responses:
                    findings["root_cause"] = "B-no-api-call"
                else:
                    for r in api_responses:
                        if r["status"] in (401, 403):
                            findings["root_cause"] = "B-auth-error"
                            break
                        if r["status"] == 200 and r.get("body"):
                            body = json.loads(r["body"]) if isinstance(r["body"], str) else r["body"]
                            if not body.get("users"):
                                findings["root_cause"] = "C-empty-response"
                            else:
                                findings["root_cause"] = "D-frontend-filter"
                            break
                    else:
                        findings["root_cause"] = "unknown"

    except TimeoutError as e:
        log(f"TIMEOUT: {e}")
        findings["root_cause"] = "timeout"
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        log(traceback.format_exc())
        findings["root_cause"] = f"error: {e}"
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    log(f"Probe: members-empty — {TS}")
    run()

    # Write evidence
    evidence_path = OUTPUT_DIR / f"probe-members-empty-evidence-{TS}.json"
    with open(evidence_path, "w") as f:
        json.dump(findings, f, indent=2, default=str)
    log(f"Evidence: {evidence_path}")
    log(f"Root cause classification: {findings['root_cause']}")
    _log.close()
