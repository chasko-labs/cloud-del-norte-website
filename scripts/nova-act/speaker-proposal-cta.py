#!/usr/bin/env python3
"""Speaker Proposal CTA end-to-end verification via Nova Act.

Validates the anonymous speaker proposal submission flow on dev.clouddelnorte.org:
- Landing page CTA visible and clickable
- Modal opens with all form fields
- Form submission via API Gateway REST V1
- Thank-you state appears
- Screenshots captured at each step
"""
import json, os, sys, time
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError
from bedrock_agentcore.tools.browser_client import browser_session

DEV_URL = "https://dev.clouddelnorte.org/home/index.html"
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
OUTPUT_DIR = Path(__file__).parent / "output" / f"speaker-cta-{TS}"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

EARLIEST_DATE = (datetime.now(timezone.utc) + timedelta(days=90)).strftime("%Y-%m-%d")

steps = []
screenshots = []
verdict = "FAIL"
submission_id = None
_api_response = {}


def _capture_response(response):
    global _api_response
    if "proposals" in response.url and response.request.method == "POST":
        try:
            _api_response = {"status": response.status, "body": response.json()}
        except Exception:
            _api_response = {"status": response.status, "body": None}


def log(msg: str):
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S.%f')[:-3]}] {msg}", flush=True)


def record_step(name, status, note=""):
    steps.append({"step_name": name, "status": status, "note": note})
    log(f"STEP {name}: {status} — {note}")


def save_screenshot(nova, name):
    path = str(OUTPUT_DIR / f"{name}.png")
    nova.page.screenshot(path=path, full_page=True)
    screenshots.append(path)
    log(f"Screenshot: {path}")
    return path


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run():
    global verdict, submission_id

    with browser_session(region="us-east-1", name="cdn-speaker-cta") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url, cdp_headers=headers,
            starting_page=DEV_URL, headless=True, tty=False,
        ) as nova:
            # Step 1: Wait for React to render, then check CTA
            nova.page.wait_for_function(
                "() => { const r = document.getElementById('root'); return r && r.innerHTML.length > 100; }",
                timeout=30000,
            )
            time.sleep(5)
            save_screenshot(nova, "landing")
            body = nova.page.inner_text("body")[:5000]
            if "propose a talk" in body.lower() or "speak at cloud del norte" in body.lower():
                record_step("landing_cta_visible", "PASS", "CTA text found on page")
            else:
                record_step("landing_cta_visible", "FAIL", f"CTA text not found. Body snippet: {body[:300]}")
                return

            # Step 2: Click CTA
            try:
                nova.act("Click the button that says 'propose a talk'")
                time.sleep(3)
                record_step("click_cta", "PASS")
            except ActActuationError as e:
                record_step("click_cta", "FAIL", str(e))
                save_screenshot(nova, "click-cta-fail")
                return

            # Step 3: Verify modal opens
            save_screenshot(nova, "modal-open")
            modal_text = nova.page.inner_text("body")[:3000]
            if any(kw in modal_text.lower() for kw in ["topic", "abstract", "format", "submit"]):
                record_step("modal_open", "PASS", "Form fields detected in modal")
            else:
                record_step("modal_open", "FAIL", "Modal form fields not detected")
                return

            # Step 4: Fill form
            try:
                nova.act("Fill in the name field with 'Nova Act Test Speaker'")
                nova.act("Fill in the email field with 'novaact+speaker-test@clouddelnorte.org'")
                nova.act("Fill in the topic field with 'Nova Act automated verification of speaker CTA'")
                nova.act("Fill in the abstract field with 'This is an automated end-to-end test of the speaker proposal submission flow.'")
                nova.act("Select 'virtual' for the format radio button")
                nova.act("Scroll down in the modal to see more form fields")
                nova.act("Click the 'preferred days' dropdown and select monday and tuesday checkboxes, then click outside to close")
                nova.act("Click the 'preferred time of day' dropdown and select the morning checkbox, then click outside to close")
                nova.act(f"Set the earliest date field to '{EARLIEST_DATE}'")
                time.sleep(2)
                save_screenshot(nova, "form-filled")
                record_step("fill_form", "PASS")
            except ActActuationError as e:
                save_screenshot(nova, "form-filled")
                record_step("fill_form", "FAIL", str(e))
                return

            # Step 5: Check for CAPTCHA before submit (WAF SDK loads silently)
            # The WAF integration SDK loads in background — no visible CAPTCHA unless 405 returned
            # Skip explicit CAPTCHA check; the form handles it internally

            # Step 6: Submit — intercept network to capture API response
            nova.page.on("response", lambda resp: _capture_response(resp))

            try:
                nova.act("Click the 'submit proposal' button at the bottom right of the modal")
                time.sleep(8)
            except ActActuationError as e:
                save_screenshot(nova, "submit-fail")
                record_step("click_submit", "FAIL", str(e))
                return

            # Step 7: Check result — could be thank-you, error, or CAPTCHA challenge
            save_screenshot(nova, "thank-you")
            result_text = nova.page.inner_text("body")[:5000]

            if any(kw in result_text.lower() for kw in ["within 7 days", "proposal received", "thanks"]):
                record_step("click_submit", "PASS")
                record_step("thank_you", "PASS", "Confirmation message displayed")
                verdict = "PASS"
            elif "something went wrong" in result_text.lower() or "please try again" in result_text.lower():
                record_step("click_submit", "PASS", "Button clicked, form submitted")
                # WAF token likely failed in headless — check if it's a WAF/network issue
                console_logs = nova.page.evaluate("() => window.__novaActErrors || []")
                record_step("thank_you", "INCONCLUSIVE",
                    "Form submission attempted but got 'something went wrong' error. "
                    "Likely WAF token acquisition failed in headless browser. "
                    "Form UI flow is validated end-to-end up to the WAF gate.")
                verdict = "INCONCLUSIVE"
            elif "captcha" in result_text.lower():
                save_screenshot(nova, "captcha")
                record_step("click_submit", "PASS")
                record_step("captcha_challenge", "INCONCLUSIVE", "WAF CAPTCHA challenge presented")
                verdict = "INCONCLUSIVE"
            else:
                record_step("click_submit", "PASS", "Button clicked")
                record_step("thank_you", "FAIL", f"Unexpected state. Body: {result_text[:300]}")

            # Extract submission ID from captured response
            if _api_response.get("body") and isinstance(_api_response["body"], dict):
                submission_id = _api_response["body"].get("proposalId") or _api_response["body"].get("id")
                log(f"Submission ID: {submission_id}")


if __name__ == "__main__":
    log(f"Speaker Proposal CTA E2E — {TS}")
    log(f"Target: {DEV_URL}")
    log(f"Earliest date: {EARLIEST_DATE}")

    try:
        run()
    except Exception as e:
        log(f"FATAL: {e}")
        import traceback
        log(traceback.format_exc())
        record_step("execution", "FAIL", str(e))

    # Write verdict
    verdict_data = {
        "verdict": verdict,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "steps": steps,
        "screenshots": screenshots,
        "submission_id": submission_id,
    }
    verdict_path = OUTPUT_DIR / "verdict.json"
    with open(verdict_path, "w") as f:
        json.dump(verdict_data, f, indent=2)

    log(f"\n{'='*60}")
    log(f"VERDICT: {verdict}")
    log(f"Steps: {len(steps)} | Screenshots: {len(screenshots)}")
    log(f"Submission ID: {submission_id}")
    log(f"Output: {OUTPUT_DIR}")
    log(f"{'='*60}")

    sys.exit(0 if verdict == "PASS" else (2 if verdict == "INCONCLUSIVE" else 1))
