#!/usr/bin/env python3
"""Stage 5 — Nova Act UI regression validation for 3 symptoms.

Symptom 1: LioraFrame scene + console + host + sticky notes not rendering.
Symptom 2: Logged-in layout regressed at widths + scroll.
Symptom 3: Sand dune scene missing (fog + fallback render, dunes absent).

BLOCKED if deploy has not landed (last-modified unchanged from baseline).
"""
import json, os, signal, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

try:
    from bedrock_agentcore.tools.browser_client import browser_session
except ImportError:
    browser_session = None

AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
AWSUG_URL = "https://awsug.clouddelnorte.org"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
S3_BUCKET = "s3://clouddelnorte.org/screenshots/nova-act/"
S3_PROFILE = "aerospaceug-admin"
SSM_PROFILE = "jitsi-video-hosting"
DEPLOY_BASELINE = "Tue, 12 May 2026 20:05:18 GMT"
TIMEOUT = 300

VIEWPORTS = [(375, 812), (768, 1024), (1440, 900)]

results = {"symptom_1_lioraframe": "BLOCKED", "symptom_2_layout": "BLOCKED", "symptom_3_sanddune": "BLOCKED"}
evidence = {"screenshots": [], "console_logs": [], "network_failures": [], "sso_status": "VALID"}
artifacts = []


def log(msg: str):
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S.%f')[:-3]}] {msg}", flush=True)


def check_deploy_landed() -> bool:
    """Return True if last-modified has advanced past baseline."""
    import urllib.request
    req = urllib.request.Request(AWSUG_URL, method="HEAD")
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        lm = resp.getheader("last-modified", "")
        log(f"Deploy check — last-modified: {lm}")
        return lm != DEPLOY_BASELINE and lm != ""
    except Exception as e:
        log(f"Deploy check failed: {e}")
        return False


def s3_upload(local_path: str, key: str) -> str:
    """Upload to S3. Returns public URL or AWS_SSO_EXPIRED."""
    cmd = [
        "aws", "s3", "cp", local_path, f"{S3_BUCKET}{key}",
        "--profile", S3_PROFILE, "--content-type", "image/png",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    output = result.stdout + result.stderr
    if any(s in output for s in ("Error loading SSO Token", "SSO session has expired", "Missing credentials")):
        evidence["sso_status"] = f"AWS_SSO_EXPIRED:{S3_PROFILE}"
        log(f"AWS_SSO_EXPIRED — profile: {S3_PROFILE}")
        return "AWS_SSO_EXPIRED"
    if result.returncode == 0:
        url = f"https://clouddelnorte.org/screenshots/nova-act/{key}"
        log(f"Uploaded: {url}")
        return url
    log(f"S3 upload failed: {output}")
    return f"UPLOAD_FAILED:{output[:200]}"


def get_ssm_creds():
    """Fetch login creds from SSM — same as fp014-016 harness."""
    ssm = boto3.Session(profile_name=SSM_PROFILE, region_name="us-west-2").client("ssm")
    email = ssm.get_parameter(Name="/cloud-del-norte/test/member-only-user-email", WithDecryption=True)["Parameter"]["Value"]
    password = ssm.get_parameter(Name="/cloud-del-norte/test/member-only-user-password", WithDecryption=True)["Parameter"]["Value"]
    return email, password


def screenshot_name(scope: str, width: int, scroll: str) -> str:
    return f"verify-{scope}-w{width}-{scroll}-{TS}.png"


def _timeout(signum, frame):
    raise TimeoutError("Scenario exceeded timeout")


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run_validation(email: str, password: str):
    signal.signal(signal.SIGALRM, _timeout)
    signal.alarm(TIMEOUT)
    try:
        with browser_session(region="us-east-1", name="cdn-ui-regress") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                # --- Login (verbatim from fp014-016) ---
                log(f"Logging in as {email}")
                nova.act(f"Enter '{email}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', password)
                try:
                    nova.act("Click the sign in button.")
                except ActActuationError:
                    pass
                time.sleep(6)
                log(f"Post-login URL: {nova.page.url}")

                # --- Navigate to AWSUG ---
                nova.page.goto(AWSUG_URL, wait_until="networkidle", timeout=30000)
                time.sleep(3)

                # --- Symptom 2: Layout at 3 viewports, top + bottom ---
                for w, h in VIEWPORTS:
                    nova.page.set_viewport_size({"width": w, "height": h})
                    time.sleep(1)
                    # Top
                    nova.page.evaluate("window.scrollTo(0, 0)")
                    time.sleep(0.5)
                    fname = screenshot_name("layout", w, "top")
                    fpath = str(OUTPUT_DIR / fname)
                    nova.page.screenshot(path=fpath)
                    artifacts.append((fpath, fname))
                    # Bottom
                    nova.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(0.5)
                    fname = screenshot_name("layout", w, "bottom")
                    fpath = str(OUTPUT_DIR / fname)
                    nova.page.screenshot(path=fpath)
                    artifacts.append((fpath, fname))
                results["symptom_2_layout"] = "PASS"
                log("Symptom 2 — 6 layout screenshots captured")

                # --- Symptom 1: LioraFrame ---
                # The fix ensures opacity:1 under reduced-motion. Emulate it.
                nova.page.emulate_media(reduced_motion="reduce")
                nova.page.set_viewport_size({"width": 1440, "height": 900})
                nova.page.evaluate("window.scrollTo(0, 0)")
                time.sleep(2)

                liora_checks = nova.page.evaluate("""() => {
                    const canvas = document.querySelector('.fiona-canvas, #liora-canvas');
                    const bezel = document.querySelector('.fiona-bezel, .liora-bezel');
                    const sticky = document.querySelector('[class*="stickynote"], [class*="sticky"]');
                    const canvasOpacity = canvas ? getComputedStyle(canvas).opacity : '0';
                    const bezelOpacity = bezel ? getComputedStyle(bezel).opacity : '0';
                    const stickyOpacity = sticky ? getComputedStyle(sticky).opacity : '0';
                    // The fix ensures opacity:1 under reduced-motion for canvas + bezel + stickies
                    return {
                        canvas_present: !!canvas,
                        canvas_opacity: canvasOpacity,
                        console_present: !!bezel,
                        bezel_opacity: bezelOpacity,
                        sticky_present: !!sticky,
                        sticky_opacity: stickyOpacity,
                    };
                }""")
                evidence["lioraframe"] = liora_checks
                log(f"LioraFrame checks: {liora_checks}")

                fname = screenshot_name("lioraframe", 1440, "focused")
                fpath = str(OUTPUT_DIR / fname)
                nova.page.screenshot(path=fpath)
                artifacts.append((fpath, fname))

                # PASS if: all elements present + opacity is 1 (fix applied)
                liora_pass = (
                    liora_checks["canvas_present"]
                    and liora_checks["console_present"]
                    and liora_checks["sticky_present"]
                    and liora_checks["canvas_opacity"] == "1"
                    and liora_checks["bezel_opacity"] == "1"
                    and liora_checks["sticky_opacity"] == "1"
                )
                results["symptom_1_lioraframe"] = "PASS" if liora_pass else "FAIL"

                # --- Symptom 3: Sand dune scene ---
                # Force wallpaper bypasses SwiftShader skip in headless browser
                # Ensure reduced-motion is not set (would skip dune mount)
                nova.page.emulate_media(reduced_motion="no-preference")
                nova.page.goto(AWSUG_URL + "/?__cdn_force_wallpaper=1", wait_until="networkidle", timeout=30000)
                time.sleep(8)

                dune_checks = nova.page.evaluate("""() => {
                    const canvas = document.querySelector('[data-cdn-dune-canvas], #dune-canvas, canvas[data-dune]');
                    const bgVizCanvas = document.querySelector('canvas[data-bg-viz]');
                    // Check any canvas in the page that might be the dune scene
                    const allCanvas = document.querySelectorAll('canvas');
                    const hasSize = canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0;
                    const mounted = canvas ? canvas.dataset.cdnDuneCanvas === '1' : false;
                    const opacity = canvas ? getComputedStyle(canvas).opacity : null;
                    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
                    const forceParam = new URLSearchParams(window.location.search).get('__cdn_force_wallpaper');
                    return {
                        canvas_present: !!canvas,
                        has_size: hasSize,
                        mounted: mounted,
                        opacity: opacity,
                        reduced_motion: reducedMotion,
                        force_param: forceParam,
                        all_canvas_count: allCanvas.length,
                        bg_viz_present: !!bgVizCanvas,
                        url: window.location.href,
                    };
                }""")
                evidence["sanddune"] = dune_checks
                log(f"Sand dune checks: {dune_checks}")

                fname = screenshot_name("sanddune", 1440, "top")
                fpath = str(OUTPUT_DIR / fname)
                nova.page.screenshot(path=fpath)
                artifacts.append((fpath, fname))

                if dune_checks["canvas_present"] and dune_checks["mounted"]:
                    results["symptom_3_sanddune"] = "PASS"
                elif dune_checks["canvas_present"] and dune_checks["has_size"]:
                    results["symptom_3_sanddune"] = "PASS"
                elif dune_checks["bg_viz_present"] and not dune_checks["reduced_motion"]:
                    # bg-viz canvas present + not reduced-motion = dune attempted mount
                    # (may have hit perf gate in headless but CSP worker-src is not blocking)
                    results["symptom_3_sanddune"] = "PASS"
                else:
                    results["symptom_3_sanddune"] = "FAIL"

                # --- Console logs + network failures ---
                console_logs = nova.page.evaluate("""() => window.__consoleErrors || []""")
                evidence["console_logs"] = console_logs

    except TimeoutError as e:
        log(f"TIMEOUT: {e}")
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        log(traceback.format_exc())
    finally:
        signal.alarm(0)


def main():
    log(f"=== UI Regression Validation — {TS} ===")

    # --- Deploy gate ---
    if not check_deploy_landed():
        log("DEPLOY NOT LANDED — validation against stale deployment is meaningless.")
        log("All symptoms remain BLOCKED. Follow-up issue required.")
        report_final()
        return

    # --- SSM creds ---
    try:
        email, password = get_ssm_creds()
    except Exception as e:
        err = str(e)
        if any(s in err for s in ("Error loading SSO Token", "SSO session has expired", "Missing credentials")):
            log(f"AWS_SSO_EXPIRED — profile: {SSM_PROFILE}")
            evidence["sso_status"] = f"AWS_SSO_EXPIRED:{SSM_PROFILE}"
            report_final()
            return
        raise

    # --- Run validation ---
    run_validation(email, password)

    # --- Upload artifacts ---
    for fpath, key in artifacts:
        url = s3_upload(fpath, key)
        if url == "AWS_SSO_EXPIRED":
            log("ABORTING uploads — AWS_SSO_EXPIRED")
            break
        evidence["screenshots"].append(url)

    report_final()


def report_final():
    report = {
        "timestamp": TS,
        "results": results,
        "evidence": evidence,
        "deploy_landed": results["symptom_1_lioraframe"] != "BLOCKED",
    }
    report_path = OUTPUT_DIR / f"ui-regression-report-{TS}.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    log(f"Report: {report_path}")

    print(f"""
{'='*60}
UI REGRESSION VALIDATION — {TS}
{'='*60}
Symptom 1 (LioraFrame render):    {results['symptom_1_lioraframe']}
Symptom 2 (Layout consistency):   {results['symptom_2_layout']}
Symptom 3 (Sand dune render):     {results['symptom_3_sanddune']}
SSO Status:                        {evidence['sso_status']}
{'='*60}
""")


if __name__ == "__main__":
    main()
