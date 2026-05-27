"""
Music Player Playback Diagnostic — Device Farm TestGrid Spike

What: Selenium-driven diagnostic that captures audio element state, browser
console logs, and network performance entries for each curated station on each
of the three Cloud del Norte subdomains. Produces per-station JSON captures and
a summary.json for downstream classification in findings.md.

Why: The persistent music player does not play on production despite all streams
being alive at source and CSP covering all domains. Root cause is unknown. This
diagnostic captures the runtime evidence needed to lock a fix family (autoplay-
policy, CORS, MIME, rate-limit, or other) without modifying production code.

Transport boundaries:
  1. boto3 → Device Farm TestGrid API (us-west-2) — mints a hub URL (HTTPS)
  2. selenium.webdriver.Remote → TestGrid hub URL — WebDriver JSON Wire Protocol
  3. driver.get() → production subdomains (HTTPS) — page load
  4. driver.execute_script() → in-page JS — reads audio element + DOM state
  5. driver.get_log('browser') → Chrome DevTools console log drain
  6. driver.get_log('performance') → Chrome DevTools Network domain events

Exit: always 0. Failures are captured into per-station records, not raised.
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
from selenium import webdriver
from selenium.common.exceptions import (
    JavascriptException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.command import Command
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# ── Constants ────────────────────────────────────────────────────────────────

PROJECT_ARN = (
    "arn:aws:devicefarm:us-west-2:946179428633:"
    "testgrid-project:0f1bfe22-0371-40c8-bcac-f96709363893"
)
REGION = "us-west-2"

SUBDOMAINS = [
    "https://clouddelnorte.org",
    "https://awsug.clouddelnorte.org",
    "https://auth.clouddelnorte.org",
]

# Curated stations hardcoded from src/lib/streams.ts (commit 0498c766).
# 10 stations — spec narrative mentions 6; discrepancy noted in findings.md.
CURATED_STATIONS: list[dict[str, Any]] = [
    {
        "key": "kexp",
        "type": "radio",
        "url": "https://kexp.streamguys1.com/kexp160.aac",
        "label": "kexp 90.3",
        "metaUrl": "https://api.kexp.org/v2/plays/?limit=1&format=json",
    },
    {
        "key": "ksfr",
        "type": "radio",
        "url": "https://playerservices.streamtheworld.com/api/livestream-redirect/KSFRFM_ICE.aac",
        "label": "ksfr 101.1",
        "metaUrl": "https://api.composer.nprstations.org/v1/widget/5182a3cce1c805df63015f16/now?format=json&style=v2&show_song=true",
    },
    {
        "key": "aws_podcast",
        "type": "podcast",
        "url": "https://d1le29qyzha1u4.cloudfront.net/AWS_Podcast_Episode_754.mp3",
        "label": "the aws podcast",
        "metaUrl": None,
    },
    {
        "key": "aws_bites",
        "type": "podcast",
        "url": "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-2-5/419350002-44100-2-d983932023608.mp3",
        "label": "aws bites",
        "metaUrl": None,
    },
    {
        "key": "talking_serverless",
        "type": "podcast",
        "url": "https://d3ctxlq1ktw2nl.cloudfront.net/staging/2025-10-11/412279204-44100-2-c5fbb32d7a846.mp3",
        "label": "talking serverless",
        "metaUrl": None,
    },
    {
        "key": "rust_in_production",
        "type": "podcast",
        "url": "https://letscast.fm/media/public/938e6879-4aff-480d-8772-d0e0967725c5.mp3",
        "label": "rust in production",
        "metaUrl": None,
    },
    {
        "key": "onda_aws",
        "type": "podcast",
        "url": "https://rss.art19.com/episodes/dcdecbda-f200-4c08-842e-40d9cf459dc5.mp3",
        "label": "onda aws latam",
        "metaUrl": None,
    },
    {
        "key": "writing_on_the_wall",
        "type": "podcast",
        "url": "https://podcasts.captivate.fm/media/e6669b29-0d10-4ff3-9d67-b802b29f4850/WOTW-Jan-28-2025.mp3",
        "label": "writing on the wall",
        "metaUrl": None,
    },
    {
        "key": "el_sonido_kexp",
        "type": "podcast",
        "url": "https://traffic.omny.fm/d/clips/bad5d079-8dcb-4630-8770-aa090049131d/8b13edbf-a871-4333-9331-afbf01766a62/509ca84e-787b-4abc-9e28-b44a00009667/audio.mp3",
        "label": "el sonido (kexp)",
        "metaUrl": None,
    },
    {
        "key": "fight_for_our_existence",
        "type": "podcast",
        "url": "https://content.rss.com/episodes/126551/2820809/fight4ourexistence/2026_05_15_06_55_58_5a8d17f3-a3d8-4e29-9a63-6b240f7b833b.mp3",
        "label": "the fight for our existence",
        "metaUrl": None,
    },
]

MEDIA_URL_PATTERNS = (
    "mp3", "aac", "m3u8", "rss", "xml",
    "streamguys", "megaphone", "zeno", "streamtheworld",
    "cloudfront", "art19", "captivate", "omny", "letscast",
    "podtrac", "anchor", "rss.com", "podbean",
)

LOCALSTORAGE_KEY = "cdn:player:v1"

# JS to read audio element state from section.cdn-pp
AUDIO_STATE_JS = """
return (function() {
    var section = document.querySelector('section.cdn-pp');
    if (!section) return {audioPresent: false, playerMounted: false};
    var audio = section.querySelector('audio');
    if (!audio) return {audioPresent: false, playerMounted: true};
    var err = audio.error ? {code: audio.error.code, message: audio.error.message} : null;
    var resumeBtn = section.querySelector('button.cdn-pp__btn--resume[aria-label="resume playback"]');
    return {
        audioPresent: true,
        playerMounted: true,
        readyState: audio.readyState,
        networkState: audio.networkState,
        paused: audio.paused,
        currentTime: audio.currentTime,
        duration: audio.duration,
        src: audio.src,
        currentSrc: audio.currentSrc,
        error: err,
        crossOrigin: audio.crossOrigin,
        preload: audio.preload,
        bodyClasses: Array.from(document.body.classList),
        blockedButtonPresent: !!resumeBtn
    };
})();
"""


def mint_hub_url() -> str:
    """Mint a Device Farm TestGrid hub URL via boto3. Raises on failure."""
    client = boto3.client("devicefarm", region_name=REGION)
    resp = client.create_test_grid_url(
        projectArn=PROJECT_ARN, expiresInSeconds=600
    )
    return resp["url"]


def make_driver(hub_url: str) -> webdriver.Remote:
    """Create a Remote WebDriver with Chrome + logging prefs."""
    opts = webdriver.ChromeOptions()
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL", "performance": "ALL"})
    opts.add_experimental_option(
        "perfLoggingPrefs", {"enableNetwork": True}
    )
    return webdriver.Remote(command_executor=hub_url, options=opts)


def seed_localstorage(driver: webdriver.Remote, station: dict[str, Any]) -> None:
    """Seed localStorage with player state for the given station."""
    state = {
        "stationKey": station["key"],
        "stationUrl": station["url"],
        "stationLabel": station["label"],
    }
    if station.get("metaUrl"):
        state["metaUrl"] = station["metaUrl"]
    driver.execute_script(
        f"localStorage.setItem('{LOCALSTORAGE_KEY}', arguments[0]);",
        json.dumps(state),
    )


def drain_console(driver: webdriver.Remote) -> list[dict[str, Any]]:
    """Drain browser console log (all levels)."""
    try:
        resp = driver.execute(Command.GET_LOG, {"type": "browser"})
        return resp if isinstance(resp, list) else resp.get("value", [])
    except WebDriverException:
        return []


def drain_performance(driver: webdriver.Remote) -> list[dict[str, Any]]:
    """Drain performance log, filter to media-relevant Network events."""
    try:
        raw = driver.execute(Command.GET_LOG, {"type": "performance"})
        if not isinstance(raw, list):
            raw = raw.get("value", [])
    except WebDriverException:
        return []

    relevant: list[dict[str, Any]] = []
    for entry in raw:
        try:
            msg = json.loads(entry["message"])["message"]
        except (json.JSONDecodeError, KeyError):
            continue
        method = msg.get("method", "")
        params = msg.get("params", {})

        if method == "Network.responseReceived":
            resp = params.get("response", {})
            url = resp.get("url", "")
            if any(p in url.lower() for p in MEDIA_URL_PATTERNS):
                headers = resp.get("headers", {})
                relevant.append({
                    "type": "responseReceived",
                    "url": url,
                    "status": resp.get("status"),
                    "statusText": resp.get("statusText"),
                    "mimeType": resp.get("mimeType"),
                    "acao": headers.get("access-control-allow-origin")
                        or headers.get("Access-Control-Allow-Origin"),
                    "retryAfter": headers.get("retry-after")
                        or headers.get("Retry-After"),
                })
        elif method == "Network.loadingFailed":
            url = params.get("request", {}).get("url", "") if "request" in params else ""
            # loadingFailed doesn't always have the URL in params directly
            relevant.append({
                "type": "loadingFailed",
                "errorText": params.get("errorText"),
                "blockedReason": params.get("blockedReason"),
                "requestId": params.get("requestId"),
            })
    return relevant


def capture_station(
    driver: webdriver.Remote,
    subdomain: str,
    station: dict[str, Any],
) -> dict[str, Any]:
    """Run the full diagnostic for one station on one subdomain. Returns record."""
    record: dict[str, Any] = {
        "subdomain": subdomain,
        "stationKey": station["key"],
        "stationType": station.get("type", "radio"),
        "stationUrl": station["url"],
        "fatal": None,
    }

    try:
        # Navigate and seed localStorage
        driver.get(subdomain)
        seed_localstorage(driver, station)
        driver.get(subdomain)  # reload to hydrate from seeded state

        # Wait for section.cdn-pp to mount (up to 15s)
        try:
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "section.cdn-pp"))
            )
        except TimeoutException:
            record["fatal"] = "TimeoutException: section.cdn-pp did not mount within 15s"
            record["playerMounted"] = False
            return record

        # Pre-click audio state
        pre_click = driver.execute_script(AUDIO_STATE_JS) or {}
        record["preClickAudio"] = pre_click
        record["playerMounted"] = pre_click.get("playerMounted", False)

        # Click play button
        clicked = False
        try:
            play_btn = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable(
                    (By.CSS_SELECTOR, "button.cdn-pp__btn--play")
                )
            )
            play_btn.click()
            clicked = True
        except (TimeoutException, WebDriverException) as e:
            record["fatal"] = f"{type(e).__name__}: play button not clickable: {e}"
        record["clicked"] = clicked

        # Sample audio state every 500ms for 8 seconds
        samples: list[dict[str, Any]] = []
        if clicked:
            for _ in range(16):
                time.sleep(0.5)
                try:
                    sample = driver.execute_script(AUDIO_STATE_JS) or {}
                    samples.append(sample)
                except JavascriptException as e:
                    samples.append({"error": str(e)})
        record["samples"] = samples

        # Post-click final state
        try:
            post_click = driver.execute_script(AUDIO_STATE_JS) or {}
        except JavascriptException as e:
            post_click = {"error": str(e)}
        record["postClickAudio"] = post_click

        # Console + performance logs
        record["consoleLogs"] = drain_console(driver)
        record["performanceLogs"] = drain_performance(driver)

        # Compute property2Pass
        final = post_click if isinstance(post_click, dict) else {}
        audio_present = final.get("audioPresent", False)
        ready_state = final.get("readyState", 0)
        paused = final.get("paused", True)
        body_classes = final.get("bodyClasses", [])
        record["property2Pass"] = (
            audio_present
            and ready_state >= 2
            and paused is False
            and "cdn-stream-playing" in body_classes
        )
        record["finalReadyState"] = ready_state
        record["finalPaused"] = paused
        record["finalErrorCode"] = (final.get("error") or {}).get("code") if isinstance(final.get("error"), dict) else None
        record["blockedButtonPresent"] = final.get("blockedButtonPresent", False)

    except (WebDriverException, JavascriptException, TimeoutException) as e:
        record["fatal"] = f"{type(e).__name__}: {e}"

    return record


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--stations", type=str, default=None,
                        help="Comma-delimited station keys to test (default: all)")
    parser.add_argument("--subdomains", type=str, default=None,
                        help="Comma-delimited subdomain URLs to test (default: all)")
    args = parser.parse_args()

    global CURATED_STATIONS, SUBDOMAINS
    if args.stations:
        keys = {k.strip() for k in args.stations.split(",")}
        CURATED_STATIONS = [s for s in CURATED_STATIONS if s["key"] in keys]
    if args.subdomains:
        urls = {u.strip() for u in args.subdomains.split(",")}
        SUBDOMAINS = [s for s in SUBDOMAINS if s in urls]

    # Timestamp for captures directory
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    repo_root = Path(__file__).resolve().parent.parent.parent
    captures_dir = repo_root / "tests" / "device-farm" / "captures" / ts
    captures_dir.mkdir(parents=True, exist_ok=True)

    print(f"Captures dir: {captures_dir}", file=sys.stderr)

    # Mint hub URL
    try:
        hub_url = mint_hub_url()
    except Exception as e:
        # Cannot proceed without TestGrid — write error and exit
        error_path = captures_dir / "error.json"
        error_path.write_text(json.dumps({
            "error": f"{type(e).__name__}: {e}",
            "phase": "mint_hub_url",
            "timestamp": ts,
        }, indent=2))
        print(f"FATAL: cannot mint hub URL: {e}", file=sys.stderr)
        sys.exit(0)

    summary_rows: list[dict[str, Any]] = []

    for subdomain in SUBDOMAINS:
        host = subdomain.replace("https://", "")
        subdomain_dir = captures_dir / host
        subdomain_dir.mkdir(parents=True, exist_ok=True)

        # One fresh session per subdomain
        try:
            driver = make_driver(hub_url)
        except WebDriverException as e:
            # Record session failure for all stations on this subdomain
            for station in CURATED_STATIONS:
                err_record = {
                    "subdomain": subdomain,
                    "stationKey": station["key"],
                    "fatal": f"WebDriverException: session creation failed: {e}",
                    "property2Pass": False,
                    "playerMounted": False,
                    "clicked": False,
                }
                out_path = subdomain_dir / f"{station['key']}.json"
                out_path.write_text(json.dumps(err_record, indent=2))
                summary_rows.append({
                    "subdomain": host,
                    "station": station["key"],
                    "property2Pass": False,
                    "fatal": err_record["fatal"],
                    "playerMounted": False,
                    "clicked": False,
                    "finalReadyState": None,
                    "finalPaused": None,
                    "finalErrorCode": None,
                    "blockedButtonPresent": False,
                    "outPath": str(out_path.relative_to(repo_root)),
                })
            continue

        try:
            for station in CURATED_STATIONS:
                record = capture_station(driver, subdomain, station)
                out_path = subdomain_dir / f"{station['key']}.json"
                record["outPath"] = str(out_path.relative_to(repo_root))
                out_path.write_text(json.dumps(record, indent=2))

                summary_rows.append({
                    "subdomain": host,
                    "station": station["key"],
                    "property2Pass": record.get("property2Pass", False),
                    "fatal": record.get("fatal"),
                    "playerMounted": record.get("playerMounted", False),
                    "clicked": record.get("clicked", False),
                    "finalReadyState": record.get("finalReadyState"),
                    "finalPaused": record.get("finalPaused"),
                    "finalErrorCode": record.get("finalErrorCode"),
                    "blockedButtonPresent": record.get("blockedButtonPresent", False),
                    "outPath": record.get("outPath"),
                })
        finally:
            driver.quit()

    # Write summary
    summary_path = captures_dir / "summary.json"
    summary_path.write_text(json.dumps(summary_rows, indent=2))
    print(f"Summary: {summary_path}", file=sys.stderr)
    print(f"Stations tested: {len(CURATED_STATIONS)} × {len(SUBDOMAINS)} subdomains", file=sys.stderr)


if __name__ == "__main__":
    main()
