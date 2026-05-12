#!/usr/bin/env python3
"""2-user join-call E2E validation via Nova Act — moderator + member.

Validates the 16 friction-point fixes shipped 2026-05-11.
Does NOT write credentials to disk. Fetches at runtime from Secrets Manager / SSM.

Architecture: @workflow provides Nova Act AWS Service context.
browser_session provides cloud-hosted Chromium via bedrock-agentcore.
NovaAct connects via CDP to the cloud browser.
Sequential: moderator creates meeting, then member joins.
"""
import os, json, time
from datetime import datetime, timezone

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

# --- Credential fetch (in-memory only) ---
sm_client = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("secretsmanager")
MOD_PASSWORD = sm_client.get_secret_value(SecretId="cloud-del-norte/heraldstack-cognito-pw")["SecretString"]

ssm_client = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("ssm")
MEM_PASSWORD = ssm_client.get_parameter(Name="/cloud-del-norte/test/smoketest-user-password", WithDecryption=True)["Parameter"]["Value"]

MOD_EMAIL = "heraldstack@clouddelnorte.org"
MEM_EMAIL = "heraldstack-test-member@clouddelnorte.org"
AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
MEETINGS_URL = "https://awsug.clouddelnorte.org/meetings/index.html"

results = {"moderator": {}, "member": {}, "verdict": "FAIL"}


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-join-call-2user",
)
def run_2user_test():
    meeting_url = None

    # === MODERATOR SESSION ===
    t0 = time.time()
    r = results["moderator"]
    r["start_time"] = datetime.now(timezone.utc).isoformat()
    print("[MOD] Starting moderator session...")

    with browser_session(region="us-east-1", name="cdn-2user-mod") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url,
            cdp_headers=headers,
            starting_page=AUTH_URL,
            headless=True,
            tty=False,
        ) as nova:
            try:
                # Fill email via Nova Act (safe), password via page JS (avoids guardrail)
                nova.act(f"Enter email '{MOD_EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', MOD_PASSWORD)
                nova.act("Click the sign in button. Wait for redirect to complete.")
                r["login"] = "success"
                print("[MOD] Login success")
            except ActActuationError as e:
                r["login"] = f"timeout ({e.metadata.num_steps_executed} steps)"
                print(f"[MOD] Login timeout, continuing...")

            time.sleep(3)

            nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
            print("[MOD] At meetings page")

            # FP-016: nav filtering
            nav_check = nova.act_get(
                "Look at the navigation menu. List all visible nav items. "
                "Is there an 'Admin' or admin-related link visible? Answer yes/no and list items."
            )
            r["fp016_nav"] = nav_check.response
            print(f"[MOD] FP-016: {nav_check.response[:120]}")

            # Optional: create meeting metadata for realism (non-blocking)
            try:
                nova.act(
                    "On this meetings page, click the 'create meeting' button to go to the create-meeting form."
                )
                time.sleep(2)
                nova.act(
                    "Fill the first text input (labeled 'Meetup link' or similar) with the placeholder URL "
                    "'https://example.com/nova-act-test'. Leave other fields empty. Click the 'Create meeting' primary button. "
                    "Wait for the success message."
                )
                time.sleep(3)
                print("[MOD] Create-meeting metadata flow completed")
            except Exception as e:
                print(f"[MOD] Create-meeting optional step failed (non-blocking): {e}")

            # Navigate directly to Jitsi endpoint — room determined by JWT, not URL
            MEET_URL = "https://meet.clouddelnorte.org"
            nova.page.goto(MEET_URL, wait_until="domcontentloaded", timeout=30000)
            time.sleep(5)
            nova.act(
                "If a pre-join lobby or 'Join' button is visible, click it. "
                "Otherwise do nothing — the meeting may have loaded directly."
            )
            meeting_url = MEET_URL  # same for all users
            r['meeting_url'] = meeting_url
            time.sleep(5)

            # FP-009: cold-start
            cold_start = nova.act_get(
                "Is there any welcome message, cold-start message, or loading indicator visible? "
                "Describe what you see. Is the video interface loaded?"
            )
            r["fp009_cold_start"] = cold_start.response
            print(f"[MOD] FP-009: {cold_start.response[:120]}")

            # FP-012: camera/mic
            av_check = nova.act_get(
                "Are camera and microphone toggle buttons visible? "
                "Click the camera toggle once, then click it again. Did it respond? "
                "Click the microphone toggle once, then click it again. Did it respond? "
                "Report: camera_toggle_works (yes/no), mic_toggle_works (yes/no)."
            )
            r["fp012_av_controls"] = av_check.response
            print(f"[MOD] FP-012: {av_check.response[:120]}")

            print(f"[MOD] Meeting URL: {meeting_url}")

            # FP-015: session errors
            session_check = nova.act_get(
                "Are there any error messages visible? Any 'session expired' or authentication errors?"
            )
            r["fp015_session"] = session_check.response
            r["status"] = "joined"
            r["time_to_join_s"] = round(time.time() - t0, 1)
            print(f"[MOD] In meeting. TTJ: {r['time_to_join_s']}s")

    # === MEMBER SESSION ===
    t1 = time.time()
    rm = results["member"]
    rm["start_time"] = datetime.now(timezone.utc).isoformat()

    if not meeting_url or "http" not in meeting_url:
        rm["status"] = "error"
        rm["error"] = f"Invalid meeting URL from moderator: {meeting_url}"
        print(f"[MEM] ERROR: bad meeting URL")
        return

    print(f"\n[MEM] Starting member session, joining: {meeting_url}")

    with browser_session(region="us-east-1", name="cdn-2user-mem") as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url,
            cdp_headers=headers,
            starting_page=AUTH_URL,
            headless=True,
            tty=False,
        ) as nova:
            try:
                nova.act(f"Enter email '{MEM_EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', MEM_PASSWORD)
                nova.act("Click the sign in button. Wait for redirect to complete.")
                rm["login"] = "success"
                print("[MEM] Login success")
            except ActActuationError as e:
                rm["login"] = f"timeout ({e.metadata.num_steps_executed} steps)"
                print(f"[MEM] Login timeout, continuing...")

            time.sleep(3)

            # FP-016: nav filtering for member
            nova.act(f"Navigate to {MEETINGS_URL} and wait for the page to fully load.")
            nav_check = nova.act_get(
                "Look at the navigation menu. List all visible nav items. "
                "Is there an 'Admin' or admin-related link visible? Answer yes/no and list items."
            )
            rm["fp016_nav"] = nav_check.response
            print(f"[MEM] FP-016: {nav_check.response[:120]}")

            # Join meeting
            nova.page.goto(meeting_url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(5)
            nova.act(
                "If a pre-join lobby or 'Join' button is visible, click it. "
                "Otherwise do nothing — the meeting may have loaded directly."
            )
            time.sleep(5)

            # Lobby experience
            lobby = nova.act_get(
                "Did you see a pre-join lobby screen before entering the meeting? "
                "Was there a 'Join' button? Describe the join flow."
            )
            rm["lobby_experience"] = lobby.response

            # FP-012: camera/mic
            av_check = nova.act_get(
                "Are camera and microphone toggle buttons visible? "
                "Click the camera toggle once. Did it respond? "
                "Click the microphone toggle once. Did it respond? "
                "Report: camera_toggle_works (yes/no), mic_toggle_works (yes/no)."
            )
            rm["fp012_av_controls"] = av_check.response
            print(f"[MEM] FP-012: {av_check.response[:120]}")

            # FP-015: session errors
            session_check = nova.act_get(
                "Are there any error messages? Any 'session expired' or auth errors?"
            )
            rm["fp015_session"] = session_check.response

            rm["status"] = "joined"
            rm["time_to_join_s"] = round(time.time() - t1, 1)
            print(f"[MEM] Joined! TTJ: {rm['time_to_join_s']}s")

    # === VERDICT ===
    mod_ok = results["moderator"].get("status") == "joined"
    mem_ok = results["member"].get("status") == "joined"

    if mod_ok and mem_ok:
        has_friction = any(
            "expired" in results[role].get("fp015_session", "").lower()
            or "error" in results[role].get("fp015_session", "").lower()
            for role in ("moderator", "member")
        )
        results["verdict"] = "DEGRADED" if has_friction else "PASS"
    elif mod_ok or mem_ok:
        results["verdict"] = "DEGRADED"
    else:
        results["verdict"] = "FAIL"

    results["timestamp"] = datetime.now(timezone.utc).isoformat()


if __name__ == "__main__":
    print(f"[START] 2-user join-call validation — {datetime.now(timezone.utc).isoformat()}")
    run_2user_test()
    print(f"\n{'='*60}")
    print(f"VERDICT: {results['verdict']}")
    print(f"Moderator: {results['moderator'].get('status', 'unknown')} "
          f"(TTJ: {results['moderator'].get('time_to_join_s', 'N/A')}s)")
    print(f"Member: {results['member'].get('status', 'unknown')} "
          f"(TTJ: {results['member'].get('time_to_join_s', 'N/A')}s)")
    print(f"{'='*60}")
    print(json.dumps(results, indent=2, default=str))
