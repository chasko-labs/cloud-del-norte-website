#!/usr/bin/env python3
"""Capture logged-in scrolled state on awsug.clouddelnorte.org/index.html.

Evidence-only run for Bryan's visual review. No pass/fail verdict.
Login: heraldstack@clouddelnorte.org via Secrets Manager.
Upload: s3://clouddelnorte.org/screenshots/bryan-review/
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
from nova_act.util.s3_writer import S3Writer

s3_writer = S3Writer(
    boto_session=boto3.Session(profile_name='aerospaceug-admin'),
    s3_bucket_name='clouddelnorte.org',
    s3_prefix='screenshots/nova-act/',
)

AUTH_URL = "https://auth.clouddelnorte.org/login/index.html"
TARGET_URL = "https://awsug.clouddelnorte.org/index.html"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
S3_BUCKET = "clouddelnorte.org"
S3_PREFIX = "screenshots/bryan-review/"
TIMEOUT = 480

_sm = boto3.Session(profile_name="jitsi-video-hosting", region_name="us-west-2").client("secretsmanager")
EMAIL = "heraldstack@clouddelnorte.org"
PASSWORD = _sm.get_secret_value(SecretId="cloud-del-norte/heraldstack-cognito-pw")["SecretString"]

VIEWPORTS = [(1440, 900), (375, 812)]
SCROLL_POSITIONS = [0, 400, 800, 1200, 2000]  # "bottom" handled separately
artifacts = {}  # grouped by viewport width


def log(msg: str):
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)


def upload(local_path: str, content_type: str = "image/png") -> str:
    s3 = boto3.Session(profile_name="aerospaceug-admin").client("s3")
    key = S3_PREFIX + Path(local_path).name
    s3.upload_file(local_path, S3_BUCKET, key, ExtraArgs={"ContentType": content_type})
    url = f"https://{S3_BUCKET}/{key}"
    log(f"  ↑ {url}")
    return url


def inject_observers(page):
    page.evaluate("""() => {
        window.__cLogs = []; window.__netFail = [];
        const levels = ['log','info','warn','error','debug'];
        levels.forEach(lvl => {
            const orig = console[lvl];
            console[lvl] = function() {
                const m = Array.from(arguments).map(a => {
                    try { return typeof a==='object'?JSON.stringify(a):String(a); } catch(e){return String(a);}
                }).join(' ');
                window.__cLogs.push('['+lvl.toUpperCase()+'] '+m);
                orig.apply(console, arguments);
            };
        });
        const origFetch = window.fetch;
        window.fetch = async function(...a) {
            try {
                const r = await origFetch.apply(this,a);
                if(r.status>=400) window.__netFail.push({url:typeof a[0]==='string'?a[0]:a[0]?.url||'?',status:r.status,ts:Date.now()});
                return r;
            } catch(e) { window.__netFail.push({url:typeof a[0]==='string'?a[0]:'?',error:e.message,ts:Date.now()}); throw e; }
        };
        const origXHR = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            this.__url = url;
            this.addEventListener('load', function() {
                if(this.status>=400) window.__netFail.push({url:this.__url,status:this.status,ts:Date.now()});
            });
            origXHR.apply(this, arguments);
        };
    }""")


def capture_viewport(page, width, height):
    vp_key = str(width)
    artifacts[vp_key] = []
    page.set_viewport_size({"width": width, "height": height})
    page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)
    inject_observers(page)
    page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)
    time.sleep(5)  # grace for LioraFrame + BabylonJS

    # Full page screenshot
    fname = f"awsug-logged-in-full-{width}-{TS}.png"
    fpath = str(OUTPUT_DIR / fname)
    page.screenshot(path=fpath, full_page=True)
    artifacts[vp_key].append(upload(fpath))

    # Scroll position screenshots
    for y in SCROLL_POSITIONS:
        page.evaluate(f"window.scrollTo(0, {y})")
        time.sleep(0.5)
        fname = f"awsug-logged-in-{width}-y{y}-{TS}.png"
        fpath = str(OUTPUT_DIR / fname)
        page.screenshot(path=fpath, full_page=False)
        artifacts[vp_key].append(upload(fpath))

    # Bottom
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(0.5)
    fname = f"awsug-logged-in-{width}-ybottom-{TS}.png"
    fpath = str(OUTPUT_DIR / fname)
    page.screenshot(path=fpath, full_page=False)
    artifacts[vp_key].append(upload(fpath))

    # Collect console + network failures
    console_log = page.evaluate("() => window.__cLogs || []")
    net_fails = page.evaluate("() => window.__netFail || []")

    # Save console log
    cname = f"awsug-logged-in-console-{width}-{TS}.log"
    cpath = str(OUTPUT_DIR / cname)
    with open(cpath, "w") as f:
        f.write("\n".join(console_log))
    artifacts[vp_key].append(upload(cpath, "text/plain"))

    # Save network failures
    nname = f"awsug-logged-in-netfails-{width}-{TS}.json"
    npath = str(OUTPUT_DIR / nname)
    with open(npath, "w") as f:
        json.dump(net_fails, f, indent=2)
    artifacts[vp_key].append(upload(npath, "application/json"))

    return console_log, net_fails


@workflow(
    model_id="nova-act-latest",
    boto_session_kwargs={"profile_name": "bryanchasko-kiro", "region_name": "us-east-1"},
    workflow_definition_name="cdn-ux-audit",
)
def run():
    signal.signal(signal.SIGALRM, lambda s, f: (_ for _ in ()).throw(TimeoutError("timeout")))
    signal.alarm(TIMEOUT)
    all_console = {}
    all_netfails = {}
    try:
        with browser_session(region="us-east-1", name="cdn-capture-scroll") as browser:
            ws_url, headers = browser.generate_ws_headers()
            with NovaAct(
                cdp_endpoint_url=ws_url, cdp_headers=headers,
                starting_page=AUTH_URL, headless=True, tty=False,
                record_video=True, logs_directory='/tmp/nova-act-logs', go_to_url_timeout=30,
                stop_hooks=[s3_writer],
            ) as nova:
                # --- Login ---
                log(f"Login as {EMAIL}")
                nova.act(f"Enter '{EMAIL}' in the email field.")
                nova.page.fill('input[type="password"], input[name="password"], #password', PASSWORD)
                try:
                    nova.act("Click the sign in button.")
                except ActActuationError:
                    pass
                time.sleep(6)
                log(f"Post-login: {nova.page.url}")

                # --- Capture each viewport ---
                for w, h in VIEWPORTS:
                    log(f"=== Viewport {w}x{h} ===")
                    c, n = capture_viewport(nova.page, w, h)
                    all_console[str(w)] = c
                    all_netfails[str(w)] = n

    except TimeoutError:
        log("TIMEOUT")
    except Exception as e:
        log(f"ERROR: {e}")
        import traceback
        log(traceback.format_exc())
    finally:
        signal.alarm(0)
    return all_console, all_netfails


if __name__ == "__main__":
    log(f"Capture logged-in scroll state — {TS}")
    all_console, all_netfails = run()

    # --- Report ---
    print(f"\n{'='*60}")
    print("ARTIFACTS (grouped by viewport)")
    print(f"{'='*60}")
    for vp, urls in artifacts.items():
        print(f"\n  [{vp}px]")
        for u in urls:
            print(f"    {u}")

    print(f"\n{'='*60}")
    print("CONSOLE ERRORS (errors/warns only)")
    print(f"{'='*60}")
    for vp, logs in all_console.items():
        errs = [l for l in logs if '[ERROR]' in l or '[WARN]' in l]
        if errs:
            print(f"\n  [{vp}px] ({len(errs)} errors/warns)")
            for e in errs[:20]:
                print(f"    {e[:200]}")

    print(f"\n{'='*60}")
    print("NETWORK FAILURES (status >= 400)")
    print(f"{'='*60}")
    for vp, fails in all_netfails.items():
        if fails:
            print(f"\n  [{vp}px] ({len(fails)} failures)")
            for nf in fails[:20]:
                print(f"    {nf}")

    print(f"\n{'='*60}")
    print("NO VERDICT — evidence only for Bryan's visual review.")
    print(f"{'='*60}")
