"""
Shared pytest fixtures for Nova Act tests.

Fetches test credentials from AWS SSM Parameter Store on session start.
Account: 170473530355, profile: jitsi-video-hosting, region: us-west-2.
"""

import os
import sys

import boto3
import pytest
import requests

SSM_PREFIX = "/cloud-del-norte/test/"
AWS_PROFILE = "jitsi-video-hosting"
AWS_REGION = "us-west-2"

JITSI_API_URL = "https://meet.clouddelnorte.org/external_api.js"


def _get_ssm_param(client, name: str) -> str:
    """fetch a single SSM parameter value"""
    resp = client.get_parameter(Name=f"{SSM_PREFIX}{name}", WithDecryption=True)
    return resp["Parameter"]["Value"]


def pytest_configure(config):
    """fetch credentials from SSM and set as env vars before tests run"""
    # skip if credentials already set (e.g. CI injects them)
    if os.environ.get("CDN_TEST_EMAIL") and os.environ.get("CDN_TEST_PASSWORD"):
        return

    try:
        session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
        client = session.client("ssm")

        os.environ["CDN_TEST_EMAIL"] = _get_ssm_param(client, "member-only-user-email")
        os.environ["CDN_TEST_PASSWORD"] = _get_ssm_param(client, "smoketest-user-password")

        # admin credentials (optional — for full flow tests)
        try:
            os.environ["CDN_ADMIN_EMAIL"] = _get_ssm_param(client, "admin-user-email")
            os.environ["CDN_ADMIN_PASSWORD"] = _get_ssm_param(client, "admin-user-password")
        except Exception:
            pass  # admin creds are optional for basic tests

        print(f"[conftest] loaded test credentials from SSM ({AWS_PROFILE})")
    except Exception as e:
        print(f"[conftest] WARNING: could not fetch SSM credentials: {e}")
        print("[conftest] tests requiring auth will SKIP")


@pytest.fixture(scope="session", autouse=True)
def preflight_jitsi_check():
    """verify Jitsi is reachable before any tests in the session"""
    try:
        resp = requests.get(JITSI_API_URL, timeout=10)
        if resp.status_code != 200:
            print(f"PREFLIGHT FAIL: Jitsi external_api.js returned {resp.status_code}")
            sys.exit(75)
    except requests.RequestException as e:
        print(f"PREFLIGHT FAIL: cannot reach Jitsi — {e}")
        sys.exit(75)
    print(f"[preflight] Jitsi external_api.js → 200 OK")
