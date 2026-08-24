"""Shared Playwright browser factory with anti-bot hardening.

Every browser-backed scraper (devfolio, unstop, internshala) launches
through here so stealth patches, locale/timezone consistency, and the
lazy-load scroll loop live in one place.
"""

import asyncio
import logging

from playwright.async_api import Browser, BrowserContext, Page

import config

logger = logging.getLogger("Scraper.Browser")

# Masks the most common headless-detection signals. Kept deliberately
# minimal — aggressive spoofing (canvas/WebGL noise) corrupts more pages
# than it saves.
_STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = window.chrome || { runtime: {} };
Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
"""

_LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
]


async def launch_stealth_browser(
    pw,
    viewport: tuple[int, int] = (1280, 800),
    proxy: str | None = None,
) -> tuple[Browser, BrowserContext]:
    """Launch a hardened headless Chromium + context.

    `pw` is the Playwright handle from `async with async_playwright() as p`.
    `proxy` is an optional proxy server URL from the SCRAPER_PROXIES pool.
    Returns (browser, context); caller must close both (context first).
    """
    browser = await pw.chromium.launch(
        headless=config.PLAYWRIGHT_HEADLESS,
        args=_LAUNCH_ARGS,
    )
    context = await browser.new_context(
        user_agent=config.PLAYWRIGHT_USER_AGENT,
        viewport={"width": viewport[0], "height": viewport[1]},
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        extra_http_headers={
            "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
        },
        **({"proxy": {"server": proxy}} if proxy else {}),
    )
    await context.add_init_script(_STEALTH_INIT_SCRIPT)
    return browser, context


async def scroll_until_stable(
    page: Page,
    card_selector: str,
    max_rounds: int = 6,
    scroll_pause_ms: int = 1200,
) -> int:
    """Scroll a lazy-loaded listing until card count stops growing.

    Returns the final card count. Used by internshala and devfolio to
    reach listings below the initial viewport payload.
    """
    prev_count = 0
    count = 0
    for _ in range(max_rounds):
        await page.evaluate("window.scrollBy(0, window.innerHeight * 1.5)")
        await asyncio.sleep(scroll_pause_ms / 1000)
        try:
            count = len(await page.query_selector_all(card_selector))
        except Exception:
            break
        if count == prev_count and prev_count > 0:
            break
        prev_count = count
    return prev_count or count
