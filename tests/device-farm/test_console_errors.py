"""Test for browser console errors across all roles and routes."""
import pytest

AUTH_ROUTES = ["/login/", "/signup/", "/verify/", "/forgot-password/"]
APP_ROUTES = [
    "/", "/home/", "/feed/", "/meetings/", "/create-meeting/",
    "/roadmap/", "/learning/api/", "/maintenance-calendar/",
    "/theme/", "/plans/", "/auth/callback/",
]
ADMIN_ROUTES = ["/admin/"]


def collect_severe_errors(driver):
    """Return list of SEVERE console log entries."""
    logs = driver.get_log("browser")
    return [e for e in logs if e.get("level") == "SEVERE"]


class TestConsoleErrorsAnonymous:
    @pytest.mark.parametrize("route", AUTH_ROUTES)
    def test_no_severe_errors(self, driver, auth_base_url, route):
        driver.get(auth_base_url + route)
        errors = collect_severe_errors(driver)
        assert not errors, f"SEVERE errors on {route}: {errors}"


class TestConsoleErrorsMember:
    @pytest.mark.parametrize("route", APP_ROUTES)
    def test_no_severe_errors(self, member_driver, base_url, route):
        member_driver.get(base_url + route)
        errors = collect_severe_errors(member_driver)
        assert not errors, f"SEVERE errors on {route}: {errors}"


class TestConsoleErrorsAdmin:
    @pytest.mark.parametrize("route", APP_ROUTES + ADMIN_ROUTES)
    def test_no_severe_errors(self, admin_driver, base_url, route):
        admin_driver.get(base_url + route)
        errors = collect_severe_errors(admin_driver)
        assert not errors, f"SEVERE errors on {route}: {errors}"


class TestConsoleErrorsBanned:
    @pytest.mark.parametrize("route", APP_ROUTES)
    def test_no_severe_errors(self, banned_driver, base_url, route):
        banned_driver.get(base_url + route)
        errors = collect_severe_errors(banned_driver)
        assert not errors, f"SEVERE errors on {route}: {errors}"
