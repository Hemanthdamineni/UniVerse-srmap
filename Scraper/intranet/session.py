"""
Playwright-based session manager for the SRMAP Intranet.

Handles login, session reuse across scraper sources, and session expiry detection.
Credentials are read exclusively from config (which reads from environment variables).
"""

import logging
import re
import time
from typing import Optional
from urllib.parse import urljoin, urlparse

from playwright.sync_api import Browser, BrowserContext, Page, Playwright, sync_playwright

import config

logger = logging.getLogger("IntranetSession")

# Known login path patterns on the intranet
_LOGIN_PATH_PATTERNS = [
    "/login",
    "/signin",
    "/sign-in",
    "/auth/login",
    "/wp-login",
    "/user/login",
    "/account/login",
]

# Indicators that the current page is a login wall
_LOGIN_INDICATOR_SELECTORS = [
    "input[type='password']",
    "form[action*='login']",
    "form[action*='signin']",
    "#loginform",
    ".login-form",
    ".wp-login",
]


class IntranetSessionError(Exception):
    """Raised when login fails or the session cannot be established."""


class IntranetSession:
    """Manages a single authenticated Playwright session for the intranet.

    Usage:
        with IntranetSession() as session:
            page = session.get_page()
            page.goto("https://intranet.srmap.edu.in/some-page")
    """

    def __init__(self, playwright: Playwright, headless: bool = True) -> None:
        self._pw = playwright
        self._headless = headless
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        self._authenticated = False
        self._login_url: Optional[str] = None

    def __enter__(self) -> "IntranetSession":
        self._browser = self._pw.chromium.launch(headless=self._headless)
        self._context = self._browser.new_context(
            user_agent=config.PLAYWRIGHT_USER_AGENT,
            ignore_https_errors=False,
            java_script_enabled=True,
        )
        self._context.set_default_timeout(config.PAGE_NAVIGATION_TIMEOUT_MS)
        self._page = self._context.new_page()
        return self

    def __exit__(self, *_) -> None:
        self._close()

    def _close(self) -> None:
        try:
            if self._page:
                self._page.close()
        except Exception:
            pass
        try:
            if self._context:
                self._context.close()
        except Exception:
            pass
        try:
            if self._browser:
                self._browser.close()
        except Exception:
            pass

    def authenticate(self) -> None:
        """Navigate to the intranet and log in. Raises IntranetSessionError on failure."""
        config.validate_credentials()

        page = self._page
        base = config.INTRANET_BASE_URL.rstrip("/")

        logger.info(f"Navigating to intranet: {base}")
        try:
            response = page.goto(base, wait_until="domcontentloaded",
                                 timeout=config.PAGE_NAVIGATION_TIMEOUT_MS)
        except Exception as exc:
            raise IntranetSessionError(f"Cannot reach intranet at {base}: {exc}") from exc

        if response and response.status >= 500:
            raise IntranetSessionError(
                f"Intranet returned HTTP {response.status} — server error"
            )

        # Detect redirect to login page
        current_url = page.url
        if self._is_login_page(current_url, page):
            self._login_url = current_url
            self._do_login(page)
        else:
            # Try to verify authentication by checking for logout link, etc.
            if not self._is_authenticated(page):
                # Navigate to login explicitly
                login_url = self._discover_login_url(base, page)
                self._login_url = login_url
                page.goto(login_url, wait_until="domcontentloaded",
                          timeout=config.PAGE_NAVIGATION_TIMEOUT_MS)
                self._do_login(page)

        self._authenticated = True
        logger.info("Intranet authentication succeeded")

    def _is_login_page(self, url: str, page: Page) -> bool:
        """Heuristically determine if the current page is a login wall."""
        parsed = urlparse(url)
        path = parsed.path.lower()
        if any(pat in path for pat in _LOGIN_PATH_PATTERNS):
            return True
        for selector in _LOGIN_INDICATOR_SELECTORS:
            try:
                if page.query_selector(selector):
                    return True
            except Exception:
                pass
        return False

    def _is_authenticated(self, page: Page) -> bool:
        """Check whether the current page indicates an active session."""
        # Look for logout link / user menu as authentication indicator
        auth_selectors = [
            "a[href*='logout']",
            "a[href*='sign-out']",
            "a[href*='signout']",
            ".user-menu",
            ".logged-in",
            "#user-info",
            ".wp-admin-bar",
        ]
        for sel in auth_selectors:
            try:
                if page.query_selector(sel):
                    return True
            except Exception:
                pass
        return False

    def _discover_login_url(self, base: str, page: Page) -> str:
        """Return the most likely login URL for the intranet."""
        # Try canonical paths in order
        for path in ["/login", "/wp-login.php", "/user/login", "/signin"]:
            url = base + path
            try:
                resp = page.goto(url, wait_until="domcontentloaded",
                                 timeout=15_000)
                if resp and resp.status < 400:
                    if self._is_login_page(page.url, page):
                        return page.url
            except Exception:
                continue
        # Fallback: return base URL and hope for redirect
        return base

    def _do_login(self, page: Page) -> None:
        """Fill the login form and submit. Raises IntranetSessionError on failure."""
        logger.info(f"Attempting login at: {page.url}")

        # Locate username/student-id field
        username_selectors = [
            "input[name='username']",
            "input[name='user_login']",
            "input[name='studentId']",
            "input[name='student_id']",
            "input[name='regno']",
            "input[name='reg_no']",
            "input[name='email']",
            "input[type='email']",
            "input[type='text'][placeholder*='ID' i]",
            "input[type='text'][placeholder*='username' i]",
            "input[type='text'][placeholder*='student' i]",
            "input[type='text']",  # fallback: first text input
        ]
        password_selectors = [
            "input[type='password']",
        ]

        username_input = None
        for sel in username_selectors:
            try:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    username_input = el
                    break
            except Exception:
                continue

        password_input = None
        for sel in password_selectors:
            try:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    password_input = el
                    break
            except Exception:
                continue

        if not username_input or not password_input:
            raise IntranetSessionError(
                "Cannot locate login form fields. The intranet login page structure "
                "may have changed, or the page requires JavaScript rendering."
            )

        # Fill credentials — never log the actual values
        username_input.click()
        username_input.fill(config.INTRANET_STUDENT_ID)
        time.sleep(0.3)

        password_input.click()
        password_input.fill(config.INTRANET_PASSWORD)
        time.sleep(0.3)

        # Submit: try submit button first, then Enter
        submit_selectors = [
            "button[type='submit']",
            "input[type='submit']",
            "button:has-text('Login')",
            "button:has-text('Sign in')",
            "button:has-text('Log in')",
        ]
        submitted = False
        for sel in submit_selectors:
            try:
                btn = page.query_selector(sel)
                if btn and btn.is_visible():
                    btn.click()
                    submitted = True
                    break
            except Exception:
                continue

        if not submitted:
            password_input.press("Enter")

        # Wait for navigation / response
        try:
            page.wait_for_load_state("networkidle", timeout=20_000)
        except Exception:
            try:
                page.wait_for_load_state("domcontentloaded", timeout=10_000)
            except Exception:
                pass

        # Verify success
        current_url = page.url
        if self._is_login_page(current_url, page):
            # Still on login page — authentication failed
            # Look for error message
            error_msg = ""
            for err_sel in [".error-msg", ".alert-danger", "#error", ".login-error", ".notice"]:
                try:
                    el = page.query_selector(err_sel)
                    if el:
                        error_msg = el.inner_text().strip()
                        break
                except Exception:
                    pass
            raise IntranetSessionError(
                f"Login failed — still on login page. "
                f"Error from site: {error_msg or 'none visible'}"
            )

        if self._is_authenticated(page):
            logger.info("Login successful — authenticated session established")
            return

        # We navigated away from login but can't confirm auth — treat as success
        # (some sites redirect to dashboard without obvious auth indicators).
        logger.info(f"Login navigation complete — now at: {current_url}")

    def get_page(self) -> Page:
        """Return the authenticated page. Call authenticate() first."""
        if not self._authenticated:
            raise IntranetSessionError("Not authenticated. Call authenticate() first.")
        return self._page

    def navigate(self, url: str, wait_until: str = "domcontentloaded") -> Optional[object]:
        """Navigate the page and check for session expiry. Re-authenticates if needed."""
        page = self._page
        try:
            resp = page.goto(url, wait_until=wait_until,
                             timeout=config.PAGE_NAVIGATION_TIMEOUT_MS)
            # Check for session expiry redirect
            if self._is_login_page(page.url, page):
                logger.warning("Session expired — re-authenticating")
                self._authenticated = False
                self.authenticate()
                # Retry original navigation
                resp = page.goto(url, wait_until=wait_until,
                                 timeout=config.PAGE_NAVIGATION_TIMEOUT_MS)
            return resp
        except Exception as exc:
            logger.error(f"Navigation failed for {url}: {exc}")
            raise

    def is_same_origin(self, url: str) -> bool:
        """Return True if the URL belongs to the intranet origin (safe to follow)."""
        base_host = urlparse(config.INTRANET_BASE_URL).netloc.lower()
        target_host = urlparse(url).netloc.lower()
        return target_host == base_host or target_host == ""


def run_with_session(fn, *, headless: bool = True) -> object:
    """Execute fn(session) inside a managed authenticated session.

    fn should be: fn(session: IntranetSession) -> any
    """
    with sync_playwright() as pw:
        with IntranetSession(pw, headless=headless) as session:
            session.authenticate()
            return fn(session)
