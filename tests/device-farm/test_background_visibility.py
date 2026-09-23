"""Background visibility across light/dark themes (Device Farm).

Loads each route under both themes (via the `awsaerospace-theme`
localStorage contract in src/utils/theme.ts) and asserts:

1. The theme actually applies: <html> carries `awsui-dark-mode`
   if and only if the stored theme is "dark".
2. The stored theme survives a reload (guards the "background loses
   load / flickers on resize" family — wallpaper lifecycle in
   src/components/cdn-wallpaper + background-viz keys off that class).
3. The <html> background is opaque in both themes (body is
   transparent by design) — catches a missing base layer on
   underpowered devices where canvas layers self-skip.
4. No SEVERE console errors during the theme swap.

Per-theme screenshots land in tests/device-farm/captures/<ts>/ for
human review across the Device Farm device pool — pixel appearance
(star field, mountains, dune) is judged by eye, not asserted here,
because GPU rendering differs legitimately per device.

Routes: "/" always runs (every subdomain serves it). Extra routes via
THEME_ROUTES env, e.g. THEME_ROUTES="/feed/" with
TEST_URL=https://clouddelnorte.org for the main-site feed background.

Anonymous session only — no credentials needed.
"""
import datetime
import os
from pathlib import Path

import pytest

THEME_KEY = "awsaerospace-theme"

CAPTURES_ROOT = (
    Path(__file__).resolve().parent / "captures"
)


def extra_routes():
    raw = os.environ.get("THEME_ROUTES", "")
    return [r for r in (s.strip() for s in raw.split(",")) if r]


def routes():
    return ["/"] + extra_routes()


def apply_theme(driver, base_url, route, theme):
    """Set stored theme, reload, wait out the 240ms transition window."""
    driver.get(base_url + route)
    driver.execute_script(
        "localStorage.setItem(arguments[0], arguments[1]);", THEME_KEY, theme
    )
    driver.get(base_url + route)
    driver.implicitly_wait(2)


def theme_state(driver):
    """Return (is_dark_class, stored_value, html_bg, canvas_count).

    The page background lives on <html> (body is transparent by design
    so wallpaper layers show through) plus full-viewport canvases the
    wallpaper suite injects into body. Canvas count is informational
    only — weak devices legitimately self-skip those layers.
    """
    return driver.execute_script(
        "return [document.documentElement.classList.contains('awsui-dark-mode'),"
        " localStorage.getItem(arguments[0]),"
        " getComputedStyle(document.documentElement).backgroundColor,"
        " document.querySelectorAll('body canvas').length];",
        THEME_KEY,
    )


def background_is_opaque(css_color):
    """rgba(0, 0, 0, 0)-style transparent backgrounds fail."""
    return not css_color.replace(" ", "").startswith("rgba(0,0,0,0)")


ERROR_HOOK = (
    "window.__bgErrors = [];"
    "window.addEventListener('error',"
    " e => window.__bgErrors.push(String((e && e.message) || e)));"
    "window.addEventListener('unhandledrejection',"
    " e => window.__bgErrors.push(String((e.reason && e.reason.message) || e.reason)));"
)


def install_error_hook(driver):
    """Persist a JS error collector across navigations via CDP.

    Returns True when installed. Modern W3C drivers dropped
    get_log('browser'), so the in-page hook is the primary channel;
    drivers without CDP fall back to get_log, else no console signal.
    """
    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument", {"source": ERROR_HOOK}
        )
        return True
    except Exception:
        return False


def severe_errors(driver, cdp_installed):
    if cdp_installed:
        return driver.execute_script("return window.__bgErrors || [];")
    try:
        return [e for e in driver.get_log("browser") if e.get("level") == "SEVERE"]
    except Exception:
        return []


def save_shot(driver, captures_dir, route, theme):
    slug = route.strip("/") or "home"
    driver.save_screenshot(str(captures_dir / f"{slug}-{theme}.png"))


@pytest.fixture(scope="module")
def captures_dir():
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    d = CAPTURES_ROOT / ts
    d.mkdir(parents=True, exist_ok=True)
    return d


class TestBackgroundVisibility:
    @pytest.mark.parametrize("route", routes())
    @pytest.mark.parametrize("theme", ["light", "dark"])
    def test_theme_applies_and_background_opaque(
        self, driver, base_url, captures_dir, route, theme
    ):
        cdp_installed = install_error_hook(driver)
        apply_theme(driver, base_url, route, theme)
        is_dark, stored, html_bg, canvases = theme_state(driver)

        assert stored == theme, f"stored theme {stored!r} != {theme!r}"
        assert is_dark == (theme == "dark"), (
            f"awsui-dark-mode={is_dark} for stored theme {theme!r} on {route}"
        )
        assert background_is_opaque(html_bg), (
            f"transparent <html> background {html_bg!r} in {theme} on {route}"
        )

        # Reload once more: the theme must survive (no flicker back).
        driver.get(base_url + route)
        is_dark2, _, html_bg2, _ = theme_state(driver)
        assert is_dark2 == (theme == "dark"), f"theme lost on reload: {route}"
        assert background_is_opaque(html_bg2), (
            f"transparent <html> background after reload in {theme} on {route}"
        )

        save_shot(driver, captures_dir, route, theme)

        severe = severe_errors(driver, cdp_installed)
        assert not severe, f"SEVERE errors during {theme} on {route}: {severe}"
