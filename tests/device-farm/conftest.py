"""Pytest fixtures for Device Farm Selenium tests."""
import os
import time
import json

import boto3
import pytest
from selenium import webdriver
from selenium.webdriver.remote.webdriver import WebDriver

COGNITO_CLIENT_ID = "57eikmt418ea6vti2f6h0pl74r"
COGNITO_ENDPOINT = "https://cognito-idp.us-west-2.amazonaws.com/"
AUTH_URL = "https://auth.clouddelnorte.org"
APP_URL = "https://awsug.clouddelnorte.org"
API_URL = "https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com"

TOKEN_KEYS = ["cdn.idToken", "cdn.accessToken", "cdn.refreshToken", "cdn.expiresAt"]


def cognito_auth(email: str, password: str) -> dict:
    """Authenticate via Cognito USER_PASSWORD_AUTH and return tokens."""
    client = boto3.client("cognito-idp", region_name="us-west-2")
    resp = client.initiate_auth(
        ClientId=COGNITO_CLIENT_ID,
        AuthFlow="USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": email, "PASSWORD": password},
    )
    result = resp["AuthenticationResult"]
    expires_at = int(time.time()) + result["ExpiresIn"]
    return {
        "cdn.idToken": result["IdToken"],
        "cdn.accessToken": result["AccessToken"],
        "cdn.refreshToken": result.get("RefreshToken", ""),
        "cdn.expiresAt": str(expires_at),
    }


def inject_tokens(driver: WebDriver, tokens: dict, base_url: str):
    """Navigate to base_url then inject tokens into sessionStorage."""
    driver.get(base_url)
    for key, value in tokens.items():
        driver.execute_script(
            "sessionStorage.setItem(arguments[0], arguments[1]);", key, value
        )


@pytest.fixture(scope="session")
def grid_url():
    return os.environ.get("DEVICE_FARM_GRID_URL", "http://localhost:4444/wd/hub")


@pytest.fixture(scope="session")
def base_url():
    return os.environ.get("TEST_URL", APP_URL)


@pytest.fixture(scope="session")
def auth_base_url():
    return os.environ.get("TEST_AUTH_URL", AUTH_URL)


@pytest.fixture(scope="session")
def api_base_url():
    return os.environ.get("TEST_API_URL", API_URL)


@pytest.fixture
def driver(grid_url):
    """Create a remote WebDriver session."""
    caps = webdriver.DesiredCapabilities.CHROME.copy()
    caps["goog:loggingPrefs"] = {"browser": "ALL"}
    opts = webdriver.ChromeOptions()
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    d = webdriver.Remote(command_executor=grid_url, options=opts)
    yield d
    d.quit()


@pytest.fixture(scope="session")
def member_tokens():
    return cognito_auth(
        os.environ["TEST_USER_MEMBER_EMAIL"],
        os.environ["TEST_USER_MEMBER_PASSWORD"],
    )


@pytest.fixture(scope="session")
def admin_tokens():
    return cognito_auth(
        os.environ["TEST_USER_ADMIN_EMAIL"],
        os.environ["TEST_USER_ADMIN_PASSWORD"],
    )


@pytest.fixture(scope="session")
def pending_tokens():
    return cognito_auth(
        os.environ["TEST_USER_PENDING_EMAIL"],
        os.environ["TEST_USER_PENDING_PASSWORD"],
    )


@pytest.fixture(scope="session")
def banned_tokens():
    return cognito_auth(
        os.environ["TEST_USER_BANNED_EMAIL"],
        os.environ["TEST_USER_BANNED_PASSWORD"],
    )


@pytest.fixture
def anonymous_driver(driver, base_url):
    """Driver with no tokens (anonymous user)."""
    driver.get(base_url)
    return driver


@pytest.fixture
def member_driver(driver, member_tokens, base_url):
    inject_tokens(driver, member_tokens, base_url)
    return driver


@pytest.fixture
def admin_driver(driver, admin_tokens, base_url):
    inject_tokens(driver, admin_tokens, base_url)
    return driver


@pytest.fixture
def banned_driver(driver, banned_tokens, base_url):
    inject_tokens(driver, banned_tokens, base_url)
    return driver


@pytest.fixture
def pending_driver(driver, pending_tokens, base_url):
    inject_tokens(driver, pending_tokens, base_url)
    return driver
