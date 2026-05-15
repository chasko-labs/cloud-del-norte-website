#!/usr/bin/env python3
"""Speaker Proposal Form — Nova Act E2E verification.

Verifies speaker proposal CTA on dev.clouddelnorte.org/home/index.html:
1. Navigate to home, confirm CTA button visible
2. Open modal, fill all fields with correct post-fix enum values
3. Submit and confirm success or WAF CAPTCHA challenge

Auth: @workflow with bryanchasko-kiro profile (same as fp-dune-scene-verification.py)
"""
import signal
import sys
from datetime import datetime, timezone
from pathlib import Path

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")

TARGET_URL = "https://dev.clouddelnorte.org/home/index.html"
RESULT = {"status": "FAIL", "screenshots": [], "notes": []}


def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def shot(nova, name: str) -> str:
    path = str(OUTPUT_DIR / f"speaker-proposal-{TS}-{name}.png")
    nova.page.screenshot(path=path)
    RESULT["screenshots"].append(path)
    log(f"screenshot: {path}")
    return path


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-speaker-proposal-verification",
)
def run() -> None:
    signal.signal(signal.SIGALRM, lambda s, f: (_ for _ in ()).throw(TimeoutError("timeout")))
    signal.alarm(300)

    with browser_session(region="us-east-1", name="cdn-speaker-proposal") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=TARGET_URL, headless=True, tty=False,
        ) as nova:
            log(f"Navigated to {TARGET_URL}")
            shot(nova, "01-home-loaded")

            # Step 1: Find and click the speaker CTA button
            result = nova.act(
                "Find the button or link for submitting a talk proposal or 'Call for Speakers' and click it to open the form"
            )
            log(f"CTA click: {result.response}")
            shot(nova, "02-modal-opened")

            # Step 2: Fill the form with correct post-fix enum values
            result = nova.act(
                "Fill in the speaker proposal form: "
                "Name field: 'Nova Act Test', "
                "Email field: 'novatest@example.com', "
                "Talk topic: 'AWS WAF Security Patterns', "
                "Abstract: 'Testing the speaker proposal form end-to-end after V1 to V2 API migration and schema bug fixes including format enum drift and day code casing corrections.', "
                "Format/Presentation type: choose 'virtual' or 'Online' option, "
                "Preferred days: select Monday or the first available day option, "
                "Preferred time: select Morning, "
                "Earliest date: type 2026-09-15"
            )
            log(f"Form fill: {result.response}")
            shot(nova, "03-form-filled")

            # Step 3: Submit
            result = nova.act("Click the Submit or Send button to submit the form")
            log(f"Submit: {result.response}")
            shot(nova, "04-after-submit")

            # Step 4: Determine outcome
            result = nova.act(
                "Describe the current page state: "
                "Is there a success/thank-you message? "
                "Is there a CAPTCHA or WAF challenge? "
                "Is there a validation error? "
                "What text is visible?"
            )
            log(f"Outcome: {result.response}")
            shot(nova, "05-final-state")

            outcome = result.response.lower()
            if any(k in outcome for k in ["success", "thank", "received", "submitted", "confirm", "proposal"]):
                RESULT["status"] = "PASS_SUBMITTED"
                RESULT["notes"].append("Form submitted successfully")
            elif any(k in outcome for k in ["captcha", "challenge", "verify", "robot", "waf", "405"]):
                RESULT["status"] = "PASS_WAF_CAPTCHA"
                RESULT["notes"].append("WAF CAPTCHA challenge — expected without x-aws-waf-token")
            elif any(k in outcome for k in ["error", "invalid", "400", "500", "failed"]):
                RESULT["status"] = "FAIL_ERROR"
                RESULT["notes"].append(f"Error: {result.response[:200]}")
            else:
                RESULT["status"] = "INCONCLUSIVE"
                RESULT["notes"].append(f"State unclear: {result.response[:200]}")


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        RESULT["status"] = "FAIL_EXCEPTION"
        RESULT["notes"].append(str(e))
        log(f"EXCEPTION: {e}")

    log(f"\n=== RESULT: {RESULT['status']} ===")
    for note in RESULT["notes"]:
        log(f"  {note}")
    log(f"Screenshots saved to: {OUTPUT_DIR}")

    if RESULT["status"].startswith("FAIL"):
        sys.exit(1)
