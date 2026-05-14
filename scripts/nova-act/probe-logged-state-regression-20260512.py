#!/usr/bin/env python3
"""Stage 1a — Visual diff: logged-in vs logged-out across widths.

Captures 24 screenshots (2 domains × 2 auth states × 3 widths × 2 scroll positions)
plus console logs and network failure data for logged-in sessions.
"""
import json, os, signal, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

os.environ["AWS_PROFILE"] = "bryanchasko-kiro"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

import boto3
from bedrock_agentcore.tools.browser_client import browser_session
from nova_act import NovaAct, workflow
from nova_act.types.act_errors import ActActuationError

AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
DOMAINS = ["clouddelnorte.org", "awsug.clouddelnorte.org"]
WIDTHS = [375, 768, 1440]
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
S3_BUCKET = "clouddelnorte.org"
S3_PREFIX = "screenshots/nova-act/"
TIMEOUT = 600

# --- Credentials ---
_session = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2")
sm_client = _session.client("secretsmanager")
MOD_EMAIL = "heraldstack@clouddelnorte.org"
MOD_PASSWORD = sm_client.get_secret_value(SecretId="cloud-del-norte/heraldstack-cognito-pw")["SecretString"]

artifacts = []


def log(msg: str):
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)


def upload_s3(local_path: str, content_type: str):
    s3 = boto3.Session(profile_name="aerospaceug-admin").client("s3")
    key = S3_PREFIX + Path(local_path).name
    s3.upload_file(local_path, S3_BUCKET, key, ExtraArgs={"ContentType": content_type})
    url = f"https://{S3_BUCKET}/{key}"
    artifacts.append(url)
    log(f"  Uploaded: {url}")
    return url


def capture_screenshots(nova, domain: str, auth_state: str):
    """Capture 6 screenshots for one domain+auth combo."""
    base_url = f"https://{domain}"
    for width in WIDTHS:
        nova.page.set_viewport_size({"width": width, "height": 900})
        nova.page.goto(base_url, wait_until="networkidle", timeout=30000)
        time.sleep(3)

        # Scroll top
        nova.page.evaluate("window.scrollTo(0, 0)")
        time.sleep(1)
        fname = f"logged-{auth_state}-{domain}-w{width}-scrolltop-{TS}.png"
        path = str(OUTPUT_DIR / fname)
        nova.page.screenshot(path=path, full_page=False)
        upload_s3(path, "image/png")
        log(f"  {fname}")

        # Scroll bottom
        nova.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)
        fname = f"logged-{auth_state}-{domain}-w{width}-scrollbot-{TS}.png"
        path = str(OUTPUT_DIR / fname)
        nova.page.screenshot(path=path, full_page=False)
        upload_s3(path, "image/png")
        log(f"  {fname}")


def capture_diagnostics(nova, domain: str):
    """Capture console logs and network failures for logged-in state."""
    # Console log
    console_entries = nova.page.evaluate("""() => {
        return window.__capturedConsole || [];
    }""")
    fname = f"logged-IN-console-{domain}-{TS}.log"
    path = str(OUTPUT_DIR / fname)
    with open(path, "w") as f:
        for entry in console_entries:
            f.write(f"{entry}\\n")
    upload_s3(path, "text/plain")

    # Network failures
    net_fails = nova.page.evaluate("""() => {
        return window.__networkFailures || [];
    }""")
    fname = f"logged-IN-network-fail-{domain}-{TS}.json"
    path = str(OUTPUT_DIR / fname)
    with open(path, "w") as f:
        json.dump(net_fails, f, indent=2)
    upload_s3(path, "application/json")


def inject_observers(page):
    """Inject console + network observers before navigation."""
    page.evaluate("""() => {
        window.__capturedConsole = [];
        window.__networkFailures = [];
        const origLog = console.log, origWarn = console.warn,
              origErr = console.error, origInfo = console.info;
        const capture = (level, args) => {
            window.__capturedConsole.push(`[${level}] ${Array.from(args).map(a => {
                try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
                catch(e) { return String(a); }
            }).join(' ')}`);
        };
        console.log = function() { capture('LOG', arguments); origLog.apply(console, arguments); };
        console.warn = function() { capture('WARN', arguments); origWarn.apply(console, arguments); };
        console.error = function() { capture('ERROR', arguments); origErr.apply(console, arguments); };
        console.info = function() { capture('INFO', arguments); origInfo.apply(console, arguments); };

        const origFetch = window.fetch;
        window.fetch = async function(...args) {
            try {
                const resp = await origFetch.apply(this, args);
                if (resp.status >= 400) {
                    window.__networkFailures.push({
                        url: typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown',
                        status: resp.status, type: 'fetch'
                    });
                }
                return resp;
            } catch(e) {
                window.__networkFailures.push({
                    url: typeof args[0] === 'string' ? args[0] : 'unknown',
                    error: e.message, type: 'fetch-abort'
                });
                throw e;
            }
        };
    }""")
    # Also listen for failed XHR/resource loads via performance observer
    page.evaluate("""() => {
        const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.responseStatus && entry.responseStatus >= 400) {
                    window.__networkFailures.push({
                        url: entry.name, status: entry.responseStatus,
                        type: entry.initiatorType
                    });
                }
            }
        });
        try { obs.observe({type: 'resource', buffered: true}); } catch(e) {}
    }""")


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-visual-regression",
)
def run():
    signal.signal(signal.SIGALRM, lambda s, f: (_ for _ in ()).throw(TimeoutError("timeout")))
    signal.alarm(TIMEOUT)
    try:
        # --- LOGGED-OUT captures ---
        log("=== LOGGED-OUT captures ===")
        with browser_session(region="us-east-1", name="cdn-vis-out") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=f"https://{DOMAINS[0]}", headless=True, tty=False,
            ) as nova:
                for domain in DOMAINS:
                    log(f"Capturing logged-OUT: {domain}")
                    capture_screenshots(nova, domain, "OUT")

        # --- LOGGED-IN captures ---
        log("=== LOGGED-IN captures ===")
        with browser_session(region="us-east-1", name="cdn-vis-in") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
            ) as nova:
                # Login
                log(f"Logging in as {MOD_EMAIL}")
                nova.act(f"Enter '{MOD_EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', MOD_PASSWORD)
                try:
                    nova.act("Click the sign in button.")
                except ActActuationError:
                    pass
                time.sleep(6)
                log(f"Post-login URL: {nova.page.url}")

                for domain in DOMAINS:
                    log(f"Capturing logged-IN: {domain}")
                    # Inject observers before navigating to target
                    nova.page.goto(f"https://{domain}", wait_until="domcontentloaded", timeout=30000)
                    inject_observers(nova.page)
                    # Re-navigate to get full capture with observers active
                    nova.page.goto(f"https://{domain}", wait_until="networkidle", timeout=30000)
                    time.sleep(5)
                    capture_screenshots(nova, domain, "IN")
                    capture_diagnostics(nova, domain)

    except TimeoutError:
        log("TIMEOUT reached")
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        log(traceback.format_exc())
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    log(f"Visual regression probe — {TS}")
    log(f"Domains: {DOMAINS}")
    log(f"Widths: {WIDTHS}")
    log(f"User: {MOD_EMAIL}")
    run()

    # --- Summary ---
    log(f"\n{'='*60}")
    log(f"ARTIFACTS ({len(artifacts)} total):")
    for url in artifacts:
        log(f"  {url}")
    log(f"{'='*60}")

    # Write manifest
    manifest_path = OUTPUT_DIR / f"visual-regression-manifest-{TS}.json"
    with open(manifest_path, "w") as f:
        json.dump({"timestamp": TS, "artifacts": artifacts, "user": MOD_EMAIL}, f, indent=2)
    log(f"Manifest: {manifest_path}")
