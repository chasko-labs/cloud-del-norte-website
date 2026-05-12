#!/usr/bin/env python3
"""Dune scene verification — confirms BabylonJS wallpaper renders on both domains.

Root cause of prior FAIL: Playwright Chromium uses SwiftShader (software
rasteriser). isSoftwareRendering() in background-viz/index.ts detects it and
calls shouldSkipDune() → true, so the dune scene never mounts. The escape hatch
?__cdn_force_wallpaper=1 bypasses the SwiftShader check; real users on hardware
WebGL never need it.

This script appends ?__cdn_force_wallpaper=1 to every dune-check URL so the
BabylonJS engine mounts regardless of the Playwright GPU backend.

Pass criteria (per domain):
  1. [data-cdn-dune-canvas="1"] is present in the DOM (scene mounted).
  2. The canvas element is visible (not display:none, not visibility:hidden,
     opacity > 0).
  3. No [bg-viz] console errors logged during the 8s warmup window.
  4. Screenshot uploaded to s3://clouddelnorte.org/screenshots/nova-act/.

Auth: heraldstack@clouddelnorte.org via Secrets Manager (same creds as
fp014-016 PASS at 2026-05-12T16:23Z).
"""
import json, os, signal, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
# Force-wallpaper param bypasses SwiftShader detection in Playwright.
DOMAINS = [
    "https://clouddelnorte.org/?__cdn_force_wallpaper=1",
    "https://awsug.clouddelnorte.org/?__cdn_force_wallpaper=1",
]
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
S3_BUCKET = "clouddelnorte.org"
S3_PREFIX = "screenshots/nova-act/"
TIMEOUT = 300
# Warmup: BabylonJS shader compile + first 60 frames before perf gate fires.
WARMUP_S = 8

_session = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2")
sm_client = _session.client("secretsmanager")
MOD_EMAIL = "heraldstack@clouddelnorte.org"
MOD_PASSWORD = sm_client.get_secret_value(
    SecretId="cloud-del-norte/heraldstack-cognito-pw"
)["SecretString"]

results: dict[str, str] = {}
artifacts: list[str] = []


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)


def upload_s3(local_path: str, content_type: str) -> str:
    s3 = boto3.Session(profile_name="aerospaceug-admin").client("s3")
    key = S3_PREFIX + Path(local_path).name
    s3.upload_file(local_path, S3_BUCKET, key, ExtraArgs={"ContentType": content_type})
    url = f"https://{S3_BUCKET}/{key}"
    artifacts.append(url)
    log(f"  Uploaded: {url}")
    return url


def check_dune_canvas(page) -> dict:
    """Return presence, visibility, and any bg-viz console errors."""
    return page.evaluate("""() => {
        const canvas = document.querySelector('[data-cdn-dune-canvas="1"]');
        if (!canvas) {
            return { present: false, visible: false, errors: window.__duneErrors || [] };
        }
        const style = window.getComputedStyle(canvas);
        const visible = (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            parseFloat(style.opacity) > 0
        );
        return {
            present: true,
            visible: visible,
            opacity: style.opacity,
            display: style.display,
            visibility: style.visibility,
            errors: window.__duneErrors || []
        };
    }""")


def inject_error_capture(page) -> None:
    """Capture [bg-viz] console errors before navigation."""
    page.evaluate("""() => {
        window.__duneErrors = [];
        const origWarn = console.warn;
        const origError = console.error;
        const capture = (level, args) => {
            const msg = Array.from(args).map(a => {
                try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
                catch(e) { return String(a); }
            }).join(' ');
            if (msg.includes('[bg-viz]') || msg.includes('[dune]')) {
                window.__duneErrors.push(`[${level}] ${msg}`);
            }
        };
        console.warn = function() { capture('WARN', arguments); origWarn.apply(console, arguments); };
        console.error = function() { capture('ERROR', arguments); origError.apply(console, arguments); };
    }""")


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-dune-verification",
)
def run() -> None:
    signal.signal(signal.SIGALRM, lambda s, f: (_ for _ in ()).throw(TimeoutError("timeout")))
    signal.alarm(TIMEOUT)
    try:
        # --- Logged-out: main domain only (no auth needed) ---
        log("=== Logged-out dune check (clouddelnorte.org) ===")
        with browser_session(region="us-east-1", name="cdn-dune-out") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=DOMAINS[0], headless=True, tty=False,
            ) as nova:
                inject_error_capture(nova.page)
                nova.page.goto(DOMAINS[0], wait_until="networkidle", timeout=30000)
                log(f"  Waiting {WARMUP_S}s for BabylonJS warmup…")
                time.sleep(WARMUP_S)

                state = check_dune_canvas(nova.page)
                domain_key = "clouddelnorte.org-logged-out"
                log(f"  Canvas state: {state}")

                fname = f"dune-{domain_key}-{TS}.png"
                path = str(OUTPUT_DIR / fname)
                nova.page.screenshot(path=path, full_page=False)
                upload_s3(path, "image/png")

                if state["present"] and state["visible"] and not state["errors"]:
                    results[domain_key] = "PASS"
                    log(f"  PASS: dune canvas present + visible, no errors")
                else:
                    results[domain_key] = "FAIL"
                    log(f"  FAIL: present={state.get('present')}, visible={state.get('visible')}, errors={state.get('errors')}")

        # --- Logged-in: both domains ---
        log("=== Logged-in dune check (both domains) ===")
        with browser_session(region="us-east-1", name="cdn-dune-in") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                log(f"  Logging in as {MOD_EMAIL}")
                nova.act(f"Enter '{MOD_EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', MOD_PASSWORD)
                try:
                    nova.act("Click the sign in button.")
                except ActActuationError:
                    pass
                time.sleep(6)
                log(f"  Post-login URL: {nova.page.url}")

                for url in DOMAINS:
                    domain = url.split("//")[1].split("/")[0]
                    domain_key = f"{domain}-logged-in"
                    log(f"  Checking {domain}…")

                    inject_error_capture(nova.page)
                    nova.page.goto(url, wait_until="networkidle", timeout=30000)
                    log(f"  Waiting {WARMUP_S}s for BabylonJS warmup…")
                    time.sleep(WARMUP_S)

                    state = check_dune_canvas(nova.page)
                    log(f"  Canvas state: {state}")

                    fname = f"dune-{domain_key}-{TS}.png"
                    path = str(OUTPUT_DIR / fname)
                    nova.page.screenshot(path=path, full_page=False)
                    upload_s3(path, "image/png")

                    if state["present"] and state["visible"] and not state["errors"]:
                        results[domain_key] = "PASS"
                        log(f"  PASS: dune canvas present + visible, no errors")
                    else:
                        results[domain_key] = "FAIL"
                        log(f"  FAIL: present={state.get('present')}, visible={state.get('visible')}, errors={state.get('errors')}")

    except TimeoutError:
        log("TIMEOUT reached")
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        log(traceback.format_exc())
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    log(f"Dune scene verification — {TS}")
    log(f"URLs: {DOMAINS}")
    run()

    log(f"\n{'='*60}")
    passes = sum(1 for v in results.values() if v == "PASS")
    fails = sum(1 for v in results.values() if v == "FAIL")
    for k, v in results.items():
        log(f"  {v}: {k}")
    log(f"{'='*60}")
    log(f"TOTAL: {passes} PASS, {fails} FAIL")

    manifest_path = OUTPUT_DIR / f"dune-verification-manifest-{TS}.json"
    with open(manifest_path, "w") as f:
        json.dump({"timestamp": TS, "results": results, "artifacts": artifacts}, f, indent=2)
    log(f"Manifest: {manifest_path}")

    if fails > 0:
        raise SystemExit(1)
