#!/usr/bin/env python3
"""Full-site UX critique — Nova Act v3.1.

~54-cell matrix: clouddelnorte.org public + gated, auth.clouddelnorte.org,
awsug.clouddelnorte.org. Four auth states × rotating locale/theme combos.
Per cell: structured JSON with visual/usefulness/accessibility/copy scores,
named elements, top-3 improvements. S3Writer auto-uploads artifacts per cell.

Authored only — do NOT execute without budget approval (Bedrock + Nova costs).

TODO future: if AsyncNovaAct stabilises in the SDK, replace sequential loop with
asyncio.gather on _run_cell coroutines with bounded concurrency=4.
"""
import json, os, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError
from nova_act.util.s3_writer import S3Writer

TIMESTAMP = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
LOCAL_DIR = Path(f"/tmp/cdn-site-critique-{TIMESTAMP}")
LOCAL_DIR.mkdir(parents=True, exist_ok=True)
LOGIN_URL = "https://auth.clouddelnorte.org/login/index.html"

LOCALE_THEME_ROTATION = [
    {"locale": "en",    "theme": "light"},
    {"locale": "en",    "theme": "dark"},
    {"locale": "es-MX", "theme": "light"},
    {"locale": "es-MX", "theme": "dark"},
]

PUBLIC_PAGES = [
    "https://clouddelnorte.org/feed/index.html",
    "https://clouddelnorte.org/home/index.html",
    "https://clouddelnorte.org/roadmap/index.html",
    "https://clouddelnorte.org/learning/api/index.html",
    "https://clouddelnorte.org/maintenance-calendar/index.html",
    "https://clouddelnorte.org/theme/index.html",
]

AUTH_PAGES = [
    "https://auth.clouddelnorte.org/login/index.html",
    "https://auth.clouddelnorte.org/signup/index.html",
    "https://auth.clouddelnorte.org/verify/index.html",
    "https://auth.clouddelnorte.org/forgot-password/index.html",
]

# Each entry: (url, [states])
GATED_PAGES = [
    ("https://clouddelnorte.org/meetings/index.html",             ["pending", "member", "moderator"]),
    ("https://clouddelnorte.org/admin/index.html",                ["pending", "member", "moderator"]),
    ("https://awsug.clouddelnorte.org/index.html",                ["member", "moderator"]),
    ("https://awsug.clouddelnorte.org/meetings/index.html",       ["member", "moderator"]),
    ("https://awsug.clouddelnorte.org/admin/index.html",          ["moderator"]),
    ("https://awsug.clouddelnorte.org/create-meeting/index.html", ["moderator"]),
]


def _build_cells():
    cells = []
    for url in PUBLIC_PAGES:
        for lt in LOCALE_THEME_ROTATION:
            cells.append({"url": url, "auth_state": "guest", **lt})
    for url in AUTH_PAGES:
        for lt in LOCALE_THEME_ROTATION:
            cells.append({"url": url, "auth_state": "guest", **lt})
    for page_idx, (url, states) in enumerate(GATED_PAGES):
        for state_idx, state in enumerate(states):
            lt = LOCALE_THEME_ROTATION[(page_idx + state_idx) % 4]
            cells.append({"url": url, "auth_state": state, **lt})
    return cells


CELLS = _build_cells()


def _cell_id(cell):
    slug = cell["url"].split("//", 1)[1].replace("/", "_").replace(".", "-")
    return f"{slug}-{cell['auth_state']}-{cell['locale']}-{cell['theme']}"[:50]


# ── Credentials — read from SSM / Secrets Manager at module load ───────────────
_ssm = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("ssm")
_sm  = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("secretsmanager")

CREDS = {
    "pending": {
        "email":    _ssm.get_parameter(Name="/cloud-del-norte/test/pending-user-email",        WithDecryption=True)["Parameter"]["Value"],
        "password": _ssm.get_parameter(Name="/cloud-del-norte/test/pending-user-password",     WithDecryption=True)["Parameter"]["Value"],
    },
    "member": {
        "email":    _ssm.get_parameter(Name="/cloud-del-norte/test/member-only-user-email",    WithDecryption=True)["Parameter"]["Value"],
        "password": _ssm.get_parameter(Name="/cloud-del-norte/test/member-only-user-password", WithDecryption=True)["Parameter"]["Value"],
    },
    "moderator": {
        "email":    "heraldstack@clouddelnorte.org",
        "password": _sm.get_secret_value(SecretId="cloud-del-norte/heraldstack-cognito-pw-nuPFyW")["SecretString"],
    },
}

results = {}


def _critique_prompt(auth_state, locale):
    return (
        "Describe everything visible on this page. Then evaluate:\n\n"
        f"VISUAL APPEAL (1-10): Layout pleasing? Colors harmonious? Whitespace balanced? Anything broken or amateurish?\n"
        f"USEFULNESS (1-10): For a {auth_state} user in {locale}, does this page serve their goal? Is the primary action obvious?\n"
        "ACCESSIBILITY (1-10): Text readable? Interactive elements clearly clickable? Sufficient contrast?\n"
        "COPY CLARITY (1-10): Wording clear and grammatically correct? Spanish copy reads naturally for regional Mexican audience?"
        " English matches lowercase brand voice? Error/empty states confusing?\n\n"
        "NAMED ELEMENTS: Up to 5 specific elements (e.g., 'next meetup card', 'propose a talk button')."
        " For each, one short sentence on whether it serves its purpose.\n\n"
        "TOP 3 IMPROVEMENTS: Three specific actionable changes ranked by impact."
        " Each must name what to change and why. Cite specific elements visible.\n\n"
        "Return as a SINGLE JSON object with keys: visual (int), usefulness (int), accessibility (int), copy (int),"
        ' elements (array of {name, verdict}), improvements (array of 3 strings). No prose outside the JSON.'
    )


def _run_cell(cell):
    cid = _cell_id(cell)
    s3w = S3Writer(
        boto_session=boto3.Session(profile_name="aerospaceug-admin"),
        s3_bucket_name="clouddelnorte.org",
        s3_prefix=f"screenshots/critique/{TIMESTAMP}/{cid}/",
    )
    session_name = ("cdnCritique-" + cid)[:63]
    starting = LOGIN_URL if cell["auth_state"] != "guest" else cell["url"]

    with browser_session(region="us-east-1", name=session_name) as browser:
        ws_url, headers = browser.generate_ws_headers()
        with NovaAct(
            cdp_endpoint_url=ws_url,
            cdp_headers=headers,
            starting_page=starting,
            headless=True,
            tty=False,
            record_video=True,
            logs_directory="/tmp/nova-act-logs",
            go_to_url_timeout=30,
            stop_hooks=[s3w],
        ) as nova:
            # ── Authentication ────────────────────────────────────────────────
            if cell["auth_state"] != "guest":
                cred = CREDS[cell["auth_state"]]
                try:
                    nova.act(f"Enter '{cred['email']}' in the email field.")
                    nova.page.fill(
                        'input[type="password"], input[name="password"], #password',
                        cred["password"],
                    )
                    nova.act("Click the sign in button and wait for redirect.")
                    time.sleep(5)
                except ActActuationError as e:
                    if cell["auth_state"] == "moderator":
                        return {"cell_id": cid, **cell, "verdict": "auth-blocked-mfa"}
                    return {"cell_id": cid, **cell, "verdict": "auth-error", "error": str(e)}

                if cell["auth_state"] == "moderator":
                    # SOFTWARE_TOKEN TOTP cannot be automated — best-effort only.
                    try:
                        nova.act("If a one-time-code or MFA input is visible, type '000000' and click verify.")
                        time.sleep(3)
                    except ActActuationError:
                        pass
                    check = nova.act_get("Is an MFA or authenticator challenge currently blocking the page? Reply yes or no only.")
                    if "yes" in check.response.lower():
                        return {"cell_id": cid, **cell, "verdict": "auth-blocked-mfa"}

            # ── Locale toggle ─────────────────────────────────────────────────
            if cell["locale"] == "es-MX":
                try:
                    nova.act("Click the locale or language toggle (flag icon) in the top-right to switch to Spanish/es-MX.")
                    time.sleep(1)
                except ActActuationError:
                    pass

            # ── Theme toggle ──────────────────────────────────────────────────
            if cell["theme"] == "dark":
                try:
                    nova.act("Click the theme toggle (sun or moon icon) to switch to dark mode.")
                    time.sleep(1)
                except ActActuationError:
                    pass

            # ── Navigate to target page ───────────────────────────────────────
            nova.go_to_url(cell["url"])
            time.sleep(3)

            # ── Critique ──────────────────────────────────────────────────────
            try:
                r = nova.act_get(_critique_prompt(cell["auth_state"], cell["locale"]))
                return {"cell_id": cid, **cell, "response": r.response}
            except ActActuationError as e:
                return {"cell_id": cid, **cell, "verdict": "timeout", "error": str(e)}


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-site-critique",
)
def run_critique():
    print(f"cdn-site-critique — {TIMESTAMP} — {len(CELLS)} cells", flush=True)
    for i, cell in enumerate(CELLS):
        cid = _cell_id(cell)
        print(f"[{i + 1}/{len(CELLS)}] {cid}", flush=True)
        result = _run_cell(cell)
        results[cid] = result
        print(f"  → {result.get('verdict', 'ok')}", flush=True)

    # ── Local summary ─────────────────────────────────────────────────────────
    summary = {"timestamp": TIMESTAMP, "total": len(CELLS), "results": results}
    local_path = LOCAL_DIR / "summary.json"
    with open(local_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    print(f"Summary → {local_path}", flush=True)

    # ── Upload summary to S3 ──────────────────────────────────────────────────
    s3 = boto3.Session(profile_name="aerospaceug-admin", region_name="us-west-2").client("s3")
    key = f"screenshots/critique/{TIMESTAMP}/summary.json"
    s3.upload_file(
        str(local_path),
        "clouddelnorte.org",
        key,
        ExtraArgs={"ContentType": "application/json", "CacheControl": "no-cache"},
    )
    print(f"Summary uploaded → s3://clouddelnorte.org/{key}", flush=True)


if __name__ == "__main__":
    run_critique()
