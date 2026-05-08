"""Test for broken links (same-origin) across all roles."""
from urllib.parse import urljoin, urlparse

import pytest
import requests
from selenium.webdriver.common.by import By


def find_resource_urls(driver, page_url):
    """Extract all same-origin resource URLs from the current page."""
    origin = f"{urlparse(page_url).scheme}://{urlparse(page_url).netloc}"
    urls = set()
    selectors = [
        ("a", "href"),
        ("img", "src"),
        ("link", "href"),
        ("script", "src"),
    ]
    for tag, attr in selectors:
        for el in driver.find_elements(By.TAG_NAME, tag):
            val = el.get_attribute(attr)
            if not val or val.startswith(("javascript:", "mailto:", "tel:", "#", "data:")):
                continue
            absolute = urljoin(page_url, val)
            if absolute.startswith(origin):
                urls.add(absolute)
    return urls


def check_urls(urls):
    """HEAD-request each URL, return list of broken ones."""
    broken = []
    for url in urls:
        try:
            r = requests.head(url, timeout=10, allow_redirects=True)
            if r.status_code >= 400:
                broken.append((url, r.status_code))
        except requests.RequestException as e:
            broken.append((url, str(e)))
    return broken


AUTH_ROUTES = ["/login/", "/signup/", "/verify/", "/forgot-password/"]
APP_ROUTES = [
    "/", "/home/", "/feed/", "/meetings/", "/create-meeting/",
    "/roadmap/", "/learning/api/", "/maintenance-calendar/",
    "/theme/", "/plans/",
]
ADMIN_ROUTES = ["/admin/"]


class TestBrokenLinksAnonymous:
    @pytest.mark.parametrize("route", AUTH_ROUTES)
    def test_no_broken_links(self, driver, auth_base_url, route):
        url = auth_base_url + route
        driver.get(url)
        urls = find_resource_urls(driver, url)
        broken = check_urls(urls)
        assert not broken, f"Broken links on {route}: {broken}"


class TestBrokenLinksMember:
    @pytest.mark.parametrize("route", APP_ROUTES)
    def test_no_broken_links(self, member_driver, base_url, route):
        url = base_url + route
        member_driver.get(url)
        urls = find_resource_urls(member_driver, url)
        broken = check_urls(urls)
        assert not broken, f"Broken links on {route}: {broken}"


class TestBrokenLinksAdmin:
    @pytest.mark.parametrize("route", APP_ROUTES + ADMIN_ROUTES)
    def test_no_broken_links(self, admin_driver, base_url, route):
        url = base_url + route
        admin_driver.get(url)
        urls = find_resource_urls(admin_driver, url)
        broken = check_urls(urls)
        assert not broken, f"Broken links on {route}: {broken}"


class TestBrokenLinksBanned:
    @pytest.mark.parametrize("route", APP_ROUTES)
    def test_no_broken_links(self, banned_driver, base_url, route):
        url = base_url + route
        banned_driver.get(url)
        urls = find_resource_urls(banned_driver, url)
        broken = check_urls(urls)
        assert not broken, f"Broken links on {route}: {broken}"
