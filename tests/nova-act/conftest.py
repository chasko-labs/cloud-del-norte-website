"""Shared fixtures and helpers for Nova Act smoketests.

Credentials are fetched from AWS SSM Parameter Store at runtime.
NEVER hardcode secrets in this file or any tracked file.
"""

import os
import sys
import time
from pathlib import Path

import boto3
import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

JITSI_DOMAIN = "meet.clouddelnorte.org"
EXTERNAL_API_URL = f"https://{JITSI_DOMAIN}/external_api.js"
AUTH_SUBDOMAIN = "https://auth.clouddelnorte.org"
AWSUG_SUBDOMAIN = "https://awsug.clouddelnorte.org"
MAIN_SUBDOMAIN = "https://clouddelnorte.org"

COGNITO_USER_POOL_ID = "us-west-2_cyPQF4F3r"
COGNITO_CLIENT_ID = "57eikmt418ea6vti2f6h0pl74r"

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"

# Exit code that means "infra not ready" — distinct from test failure (1)
EXIT_INFRA_NOT_READY = 75


# ---------------------------------------------------------------------------
# Pre-flight gate
# ---------------------------------------------------------------------------


class InfraNotReadyError(Exception):
    """Raised when the jitsi stack is cold (non-200 from external_api.js)."""

    pass


def preflight_check() -> None:
    """Assert jitsi stack is warm. Raises InfraNotReadyError if not.

    This gate prevents false-negative test runs when the ECS Fargate
    task is scaled to zero. A 503 from awselb/2.0 means zero healthy
    targets — not an auth or code regression.
    """
    try:
        resp = requests.get(EXTERNAL_API_URL, timeout=15)
    except requests.RequestException as exc:
        raise InfraNotReadyError(
            f"Cannot reach {EXTERNAL_API_URL}: {exc}"
        ) from exc

    if resp.status_code != 200:
        raise InfraNotReadyError(
            f"Jitsi stack not ready: {EXTERNAL_API_URL} returned "
            f"HTTP {resp.status_code} (server: {resp.headers.get('server', 'unknown')}). "
            f"Scale up via ghost-kade-vox-jitsi-perl-ops scale-up.pl (5-8 min)."
        )


# ---------------------------------------------------------------------------
# SSM credential helpers
# ---------------------------------------------------------------------------


def get_ssm_parameter(name: str, with_decryption: bool = True) -> str:
    """Fetch a single SSM parameter value."""
    client = boto3.client("ssm", region_name="us-west-2")
    resp = client.get_parameter(Name=name, WithDecryption=with_decryption)
    return resp["Parameter"]["Value"]


def get_admin_credentials() -> tuple[str, str]:
    """Return (email, password) for the admin/moderator test user."""
    email = os.environ.get("TEST_USER_ADMIN_EMAIL") or get_ssm_parameter(
        "/device-farm/test-users/admin-email", with_decryption=False
    )
    password = os.environ.get("TEST_USER_ADMIN_PASSWORD") or get_ssm_parameter(
        "/device-farm/test-users/admin-password"
    )
    return email, password


def get_admin_totp_secret() -> str:
    """Return the TOTP secret for the admin user (pre-enrolled).

    The admin user's TOTP secret must be stored in SSM so the harness
    can generate valid TOTP codes at runtime.
    """
    return os.environ.get("TEST_USER_ADMIN_TOTP_SECRET") or get_ssm_parameter(
        "/cloud-del-norte/test/admin-totp-secret"
    )


# ---------------------------------------------------------------------------
# Artifact helpers
# ---------------------------------------------------------------------------


def artifact_path(name: str) -> Path:
    """Return a timestamped artifact path inside artifacts/."""
    ts = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    run_dir = ARTIFACTS_DIR / ts
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir / name


def save_screenshot(page, name: str) -> Path:
    """Save a screenshot from a Nova Act page to artifacts."""
    path = artifact_path(name)
    page.screenshot(path=str(path))
    return path
