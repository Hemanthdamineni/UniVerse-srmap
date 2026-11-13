"""
Offline extraction tests for the SRMAP Intranet scrapers using mocked
Playwright-like DOM elements parsed from HTML fixtures.

No real browser / network required. The fake DOM implements the subset of the
Playwright Locator/ElementHandle API the scrapers use (query_selector,
query_selector_all, inner_text, get_attribute, is_visible).

    venv/bin/python3 -m unittest discover -s intranet/tests -v
"""

import os
import sys
import unittest
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from scrapers.announcements_scraper import _extract_item_from_element
from scrapers.news_scraper import _extract_news_item


# ── Minimal HTML → fake-DOM builder ──────────────────────────────────────────

class _Node:
    __slots__ = ("tag", "attrs", "children", "text")

    def __init__(self, tag, attrs):
        self.tag = tag
        self.attrs = attrs
        self.children = []
        self.text = ""


class _Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = _Node("#root", {})
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = _Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.stack:
            self.stack[-1].text += data


def parse(html):
    p = _Parser()
    p.feed(html)
    return p.root


class FakeEl:
    """Playwright ElementHandle subset backed by a _Node tree."""

    def __init__(self, node):
        self.node = node

    def query_selector(self, css):
        # Support tag, tag.klass, tag[attr], and simple attribute selectors.
        parts = css.strip()
        tag = None
        klass = None
        attr_name = None
        attr_val = None
        if "[" in parts and "]" in parts:
            tag, attrbit = parts.split("[", 1)
            if "=" in attrbit:
                attr_name, attr_val = attrbit.rstrip("]").split("=", 1)
                attr_val = attr_val.strip("'\"")
            else:
                attr_name = attrbit.rstrip("]")
                attr_val = None
        else:
            tag, _, klass = parts.partition(".")
            if not tag:
                tag = "*"
        for node in self._walk(self.node):
            if tag != "*" and node.tag != tag:
                continue
            if klass and klass not in node.attrs.get("class", "").split():
                continue
            if attr_name:
                val = node.attrs.get(attr_name, "")
                if attr_val is not None and val != attr_val:
                    continue
                if attr_val is None and not val:
                    continue
            return FakeEl(node)
        return None

    def query_selector_all(self, css):
        parts = css.strip()
        tag = None
        klass = None
        attr_name = None
        attr_val = None
        if "[" in parts and "]" in parts:
            tag, attrbit = parts.split("[", 1)
            attr_name, attr_val = attrbit.rstrip("]").split("=", 1) if "=" in attrbit else (attrbit.rstrip("]"), None)
            if attr_val is not None:
                attr_val = attr_val.strip("'\"")
        else:
            tag, _, klass = parts.partition(".")
            if not tag:
                tag = "*"
        out = []
        for node in self._walk(self.node):
            if tag and tag != "*" and node.tag != tag:
                continue
            if klass and klass not in node.attrs.get("class", "").split():
                continue
            if attr_name:
                val = node.attrs.get(attr_name, "")
                if attr_val is not None and val != attr_val:
                    continue
                if attr_val is None and not val:
                    continue
            out.append(FakeEl(node))
        return out

    def _walk(self, node):
        for c in node.children:
            yield c
            yield from self._walk(c)

    def inner_text(self):
        return _text(self.node)

    def get_attribute(self, name):
        return self.node.attrs.get(name)

    def is_visible(self):
        return True

    def __bool__(self):
        return True


def _text(node):
    parts = [node.text]
    for c in node.children:
        parts.append(_text(c))
    return " ".join("".join(parts).split())


FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "announcements_list.html")


class AnnouncementsExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(FIXTURE, encoding="utf-8") as fh:
            cls.root = parse(fh.read())
        cls.items = FakeEl(cls.root).query_selector_all(".announcement-item")

    def test_finds_announcement_items_in_fixture(self):
        self.assertEqual(len(self.items), 2)

    def test_extracts_title_url_department_and_body(self):
        item = _extract_item_from_element(self.items[0], "https://intranet.srmap.edu.in/announcements", None)
        self.assertIsNotNone(item)
        self.assertEqual(item["content_type"], "announcement")
        self.assertEqual(item["title"], "Scholarship Applications Open for 2026")
        self.assertEqual(
            item["source_url"], "https://intranet.srmap.edu.in/announcements/scholarship-2026"
        )
        self.assertEqual(item["department"], "Student Affairs")
        self.assertEqual(item["audience"], config.AUDIENCE_COHORT)
        self.assertIn("merit scholarship", item["summary"].lower())

    def test_extracts_pdf_document_links(self):
        item = _extract_item_from_element(self.items[0], "https://intranet.srmap.edu.in/announcements", None)
        urls = [d["url"] for d in (item["document_links"] or [])]
        self.assertIn("https://intranet.srmap.edu.in/files/scholarship-form.pdf", urls)

    def test_departmentless_item_is_shared(self):
        item = _extract_item_from_element(self.items[1], "https://intranet.srmap.edu.in/announcements", None)
        self.assertEqual(item["audience"], config.AUDIENCE_SHARED)
        self.assertIsNone(item["department"])

    def test_extracts_documented_date(self):
        item = _extract_item_from_element(self.items[0], "https://intranet.srmap.edu.in/announcements", None)
        self.assertEqual(item["published_at"], "05 November 2026")


class NewsExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(FIXTURE, encoding="utf-8") as fh:
            cls.root = parse(fh.read())
        cls.news = FakeEl(cls.root).query_selector_all(".news-item")

    def test_extracts_news_title_url_and_datetime(self):
        item = _extract_news_item(self.news[0], "https://intranet.srmap.edu.in/news")
        self.assertIsNotNone(item)
        self.assertEqual(item["content_type"], "news")
        self.assertEqual(item["title"], "CSE Department Research Breakthrough")
        self.assertEqual(item["published_at"], "02 November 2026")
        self.assertEqual(
            item["source_url"], "https://intranet.srmap.edu.in/news/research-breakthrough"
        )
        self.assertEqual(item["audience"], config.AUDIENCE_SHARED)


class FixtureSanityTests(unittest.TestCase):
    def test_event_item_parses_from_fixture(self):
        with open(FIXTURE, encoding="utf-8") as fh:
            root = parse(fh.read())
        events = FakeEl(root).query_selector_all(".event-item")
        self.assertEqual(len(events), 1)


if __name__ == "__main__":
    unittest.main()