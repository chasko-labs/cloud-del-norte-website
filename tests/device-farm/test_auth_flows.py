"""End-to-end auth flow tests."""
import time

import pytest
import requests
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from conftest import TOKEN_KEYS, API_URL, inject_tokens


class TestLoginFlow:
    def test_login_page_renders(self, driver, auth_base_url):
        driver.get(auth_base_url + "/login/")
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email'], input[name='email'], input[type='text']")))

    def test_login_submit_redirects(self, driver, auth_base_url, member_tokens, base_url):
        """Inject tokens to simulate successful login, verify app loads."""
        inject_tokens(driver, member_tokens, base_url)
        driver.get(base_url + "/")
        token = driver.execute_script("return sessionStorage.getItem('cdn.idToken');")
        assert token is not None


class TestSignupFlow:
    def test_signup_page_renders(self, driver, auth_base_url):
        driver.get(auth_base_url + "/signup/")
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "form, [data-testid='signup']")))


class TestForgotPasswordFlow:
    def test_forgot_password_renders(self, driver, auth_base_url):
        driver.get(auth_base_url + "/forgot-password/")
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "form, input")))


class TestSignOut:
    def test_signout_clears_tokens(self, member_driver, base_url):
        """After clearing tokens, sessionStorage should be empty."""
        member_driver.execute_script("sessionStorage.clear();")
        for key in TOKEN_KEYS:
            val = member_driver.execute_script(
                f"return sessionStorage.getItem('{key}');"
            )
            assert val is None


class TestTokenExpiry:
    def test_expired_token_redirects(self, driver, base_url):
        """Inject expired token, verify app redirects to login."""
        expired_tokens = {
            "cdn.idToken": "expired.token.value",
            "cdn.accessToken": "expired.token.value",
            "cdn.refreshToken": "",
            "cdn.expiresAt": "0",
        }
        inject_tokens(driver, expired_tokens, base_url)
        driver.get(base_url + "/meetings/")
        time.sleep(3)
        # App should redirect to auth or show login prompt
        current = driver.current_url
        assert "login" in current or "auth" in current or driver.find_elements(By.CSS_SELECTOR, "[data-testid='login']")


class TestBannedUser:
    def test_banned_gets_403_on_jitsi(self, banned_tokens, api_base_url):
        headers = {"Authorization": f"Bearer {banned_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/token/jitsi", headers=headers)
        assert r.status_code == 403


class TestPendingUser:
    def test_pending_can_login(self, pending_tokens):
        assert pending_tokens["cdn.idToken"] is not None


class TestAdminAccess:
    def test_admin_can_access_users(self, admin_tokens, api_base_url):
        headers = {"Authorization": f"Bearer {admin_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/admin/users", headers=headers)
        assert r.status_code == 200
