"""API access control tests per role."""
import pytest
import requests

from conftest import API_URL

ENDPOINTS = ["/token/jitsi", "/admin/users"]


class TestAnonymousAPI:
    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    def test_returns_401(self, api_base_url, endpoint):
        r = requests.get(f"{api_base_url}{endpoint}")
        assert r.status_code == 401


class TestMemberAPI:
    def test_jitsi_200(self, member_tokens, api_base_url):
        headers = {"Authorization": f"Bearer {member_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/token/jitsi", headers=headers)
        assert r.status_code == 200

    def test_admin_403(self, member_tokens, api_base_url):
        headers = {"Authorization": f"Bearer {member_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/admin/users", headers=headers)
        assert r.status_code == 403


class TestAdminAPI:
    def test_jitsi_200(self, admin_tokens, api_base_url):
        headers = {"Authorization": f"Bearer {admin_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/token/jitsi", headers=headers)
        assert r.status_code == 200

    def test_admin_users_200(self, admin_tokens, api_base_url):
        headers = {"Authorization": f"Bearer {admin_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/admin/users", headers=headers)
        assert r.status_code == 200


class TestBannedAPI:
    def test_jitsi_403(self, banned_tokens, api_base_url):
        headers = {"Authorization": f"Bearer {banned_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/token/jitsi", headers=headers)
        assert r.status_code == 403


class TestPendingAPI:
    def test_jitsi_response(self, pending_tokens, api_base_url):
        """Pending users may get 200 or 403 depending on policy."""
        headers = {"Authorization": f"Bearer {pending_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/token/jitsi", headers=headers)
        assert r.status_code in (200, 403)

    def test_admin_403(self, pending_tokens, api_base_url):
        headers = {"Authorization": f"Bearer {pending_tokens['cdn.accessToken']}"}
        r = requests.get(f"{api_base_url}/admin/users", headers=headers)
        assert r.status_code == 403
