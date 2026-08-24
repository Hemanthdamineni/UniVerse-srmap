"""Shared network utilities: optional proxy rotation + adaptive per-host throttle.

Proxy pool comes from SCRAPER_PROXIES (comma-separated). When empty all
traffic goes direct. One proxy is assigned per source run (stable within a
run avoids mid-scrape IP switches).

The throttle treats repeated 403/429 responses as a host-wide signal: after
SCRAPER_BLOCK_STRIKES hits the host enters an exponential cooldown (capped),
so one angry endpoint doesn't burn every retry budget.
"""

import asyncio
import itertools
import logging
import os
import time
from urllib.parse import urlsplit
from typing import Optional

import config

logger = logging.getLogger("Scraper.Net")


def build_proxy_pool(raw: Optional[str] = None) -> list[str]:
    value = config.SCRAPER_PROXIES if raw is None else raw
    return [p.strip() for p in value.split(",") if p.strip()]


class ProxyPool:
    """Round-robin over configured proxies; empty pool → always direct."""

    def __init__(self, proxies: Optional[list[str]] = None):
        self._proxies = build_proxy_pool() if proxies is None else proxies
        self._cycle = itertools.cycle(self._proxies) if self._proxies else None

    def next(self) -> Optional[str]:
        return next(self._cycle) if self._cycle else None

    def __len__(self) -> int:
        return len(self._proxies)


pool = ProxyPool()


def host_of(url: str) -> str:
    return urlsplit(url).netloc.lower()


class HostThrottle:
    def __init__(
        self,
        strike_threshold: int = config.SCRAPER_BLOCK_STRIKES,
        base_cooldown_s: float = config.SCRAPER_COOLDOWN_BASE_S,
        max_cooldown_s: float = config.SCRAPER_COOLDOWN_MAX_S,
    ):
        self._strike_threshold = strike_threshold
        self._base_cooldown_s = base_cooldown_s
        self._max_cooldown_s = max_cooldown_s
        self._strikes: dict[str, int] = {}
        self._cooldown_until: dict[str, float] = {}

    def wait_time(self, host: str) -> float:
        until = self._cooldown_until.get(host, 0.0)
        return max(0.0, until - time.monotonic())

    async def wait(self, host: str) -> float:
        remaining = self.wait_time(host)
        if remaining > 0:
            logger.info(f"[net] {host} in cooldown for another {remaining:.0f}s — waiting")
            await asyncio.sleep(remaining)
        return remaining

    def report_blocked(self, host: str, detail: str = "") -> None:
        strikes = self._strikes.get(host, 0) + 1
        self._strikes[host] = strikes
        if strikes >= self._strike_threshold:
            exponent = strikes - self._strike_threshold
            cooldown = min(self._base_cooldown_s * (2**exponent), self._max_cooldown_s)
            self._cooldown_until[host] = time.monotonic() + cooldown
            logger.warning(
                f"[net] {host} blocked ({detail or '403/429'}) x{strikes} — cooling down {cooldown:.0f}s"
            )

    def report_ok(self, host: str) -> None:
        self._strikes.pop(host, None)
        self._cooldown_until.pop(host, None)


throttle = HostThrottle()


async def throttled_get(session, url: str, *, proxy: Optional[str] = None, **kwargs):
    """session.get with host-throttle awareness and block reporting.

    Returns the aiohttp response (status inspectable by the caller) or None
    when the request raised. Callers should still close the response.
    """
    host = host_of(url)
    await throttle.wait(host)
    try:
        resp = await session.get(url, proxy=proxy, **kwargs)
    except Exception:
        return None
    if resp.status in (403, 429):
        throttle.report_blocked(host, str(resp.status))
    elif resp.status == 200:
        throttle.report_ok(host)
    return resp
