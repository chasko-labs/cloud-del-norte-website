#!/usr/bin/env python3
"""Capture logged-OUT scrolled state on awsug.clouddelnorte.org/index.html.

Plain Playwright, headless Chromium. No auth. Cookies/localStorage cleared.
Upload: s3://clouddelnorte.org/screenshots/bryan-review/
Evidence-only — no verdict.
"""
import time
from datetime import datetime, timezone
from pathlib import Path

import boto3
from playwright.sync_api import sync_playwright

TARGET_URL = "https://awsug.clouddelnorte.org/index.html"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
S3_BUCKET = "clouddelnorte.org"
S3_PREFIX = "screenshots/bryan-review/"

VIEWPORTS = [(1440, 900), (375, 812)]
SCROLL_POSITIONS = [0, 400, 800, 1200, 2000]


def log(msg: str):
    print(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)


def upload(local_path: str) -> str:
    s3 = boto3.Session(profile_name="aerospaceug-admin").client("s3")
    key = S3_PREFIX + Path(local_path).name
    s3.upload_file(local_path, S3_BUCKET, key, ExtraArgs={"ContentType": "image/png"})
    url = f"https://{S3_BUCKET}/{key}"
    log(f"  ↑ {url}")
    return url


def capture_viewport(page, context, width, height):
    urls = []
    page.set_viewport_size({"width": width, "height": height})
    context.clear_cookies()
    page.goto(TARGET_URL, wait_until="networkidle", timeout=30000)
    page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    page.reload(wait_until="networkidle", timeout=30000)
    time.sleep(3)

    # Full page
    fname = f"awsug-logged-OUT-full-{width}-{TS}.png"
    fpath = str(OUTPUT_DIR / fname)
    page.screenshot(path=fpath, full_page=True)
    urls.append(upload(fpath))

    # Scroll positions
    for y in SCROLL_POSITIONS:
        page.evaluate(f"window.scrollTo(0, {y})")
        time.sleep(0.4)
        fname = f"awsug-logged-OUT-{width}-y{y}-{TS}.png"
        fpath = str(OUTPUT_DIR / fname)
        page.screenshot(path=fpath, full_page=False)
        urls.append(upload(fpath))

    # Bottom
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(0.4)
    fname = f"awsug-logged-OUT-{width}-ybottom-{TS}.png"
    fpath = str(OUTPUT_DIR / fname)
    page.screenshot(path=fpath, full_page=False)
    urls.append(upload(fpath))

    return urls


def main():
    log(f"Capture logged-OUT scroll state — {TS}")
    artifacts = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        for w, h in VIEWPORTS:
            log(f"=== Viewport {w}x{h} ===")
            artifacts[str(w)] = capture_viewport(page, context, w, h)

        browser.close()

    # Report
    print(f"\n{'='*60}")
    print("LOGGED-OUT ARTIFACTS (grouped by viewport)")
    print(f"{'='*60}")
    for vp, urls in artifacts.items():
        print(f"\n  [{vp}px]")
        for u in urls:
            print(f"    {u}")
    print(f"\n{'='*60}")
    print("NO VERDICT — evidence only for Bryan's visual review.")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
