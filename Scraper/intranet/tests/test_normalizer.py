"""
Offline unit tests for the SRMAP Intranet normalizer.

No network / Playwright required. Run from the Scraper/ directory:

    venv/bin/python3 -m unittest discover -s intranet/tests -v
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
from normalizer import (
    clean_text,
    make_summary,
    normalize_item,
    normalize_url,
    safe_parse_date,
)


class DateParsingTests(unittest.TestCase):
    def test_parses_common_formats(self):
        self.assertEqual(safe_parse_date("05 November 2026"), "2026-11-05")
        self.assertEqual(safe_parse_date("5 Nov 2026"), "2026-11-05")
        self.assertEqual(safe_parse_date("November 5, 2026"), "2026-11-05")
        self.assertEqual(safe_parse_date("2026-11-05"), "2026-11-05T00:00:00")
        self.assertEqual(safe_parse_date("05/11/2026"), "2026-11-05")

    def test_strips_prefixes(self):
        self.assertEqual(safe_parse_date("Posted: 15 November 2026"), "2026-11-15")
        self.assertEqual(safe_parse_date("Deadline: 2026-12-01"), "2026-12-01")

    def test_returns_none_for_invalid_or_placeholder(self):
        for value in (None, "", "   ", "TBD", "N/A", "NaN", "not a date"):
            self.assertIsNone(safe_parse_date(value), f"expected None for {value!r}")

    def test_preserves_timezone_on_iso_input(self):
        parsed = safe_parse_date("2026-11-05T09:30:00+05:30")
        self.assertIsNotNone(parsed)
        self.assertTrue(parsed.startswith("2026-11-05T09:30:00"))


class UrlNormalizationTests(unittest.TestCase):
    def test_absolute_path_resolves_against_base(self):
        self.assertEqual(
            normalize_url("/announcements/1", config.INTRANET_BASE_URL),
            "https://intranet.srmap.edu.in/announcements/1",
        )

    def test_protocol_relative_gets_https(self):
        self.assertEqual(normalize_url("//intranet.srmap.edu.in/x"), "https://intranet.srmap.edu.in/x")

    def test_rejects_javascript_and_anchor(self):
        self.assertIsNone(normalize_url("javascript:void(0)"))
        self.assertIsNone(normalize_url("#section"))
        self.assertIsNone(normalize_url(""))


class TextCleaningTests(unittest.TestCase):
    def test_collapses_whitespace(self):
        self.assertEqual(clean_text("  hello \n\t  world  "), "hello world")

    def test_empty_input(self):
        self.assertEqual(clean_text(None), "")
        self.assertEqual(clean_text(""), "")

    def test_summary_uses_first_sentence(self):
        self.assertEqual(make_summary("First sentence here. Second sentence."), "First sentence here")

    def test_summary_truncates_long_text(self):
        long = "word " * 100
        summary = make_summary(long, max_len=20)
        self.assertLessEqual(len(summary), 21)


class NormalizeItemTests(unittest.TestCase):
    def test_valid_item_is_normalized(self):
        raw = {
            "title": "  Scholarship  Applications Open ",
            "source_url": "/announcements/scholarship",
            "body": "Apply before Friday. Eligibility: CGPA 8+.",
            "date": "05 November 2026",
            "department": "Student Affairs",
            "tags": "merit, scholarship",
        }
        item = normalize_item(raw, "announcements")
        self.assertIsNotNone(item)
        self.assertEqual(item["title"], "Scholarship Applications Open")
        self.assertEqual(item["source_url"], "https://intranet.srmap.edu.in/announcements/scholarship")
        self.assertEqual(item["published_at"], "2026-11-05")
        self.assertEqual(item["department"], "Student Affairs")
        self.assertEqual(item["tags"], ["merit", "scholarship"])
        self.assertEqual(item["content_type"], "announcement")
        self.assertEqual(item["audience"], config.AUDIENCE_SHARED)

    def test_missing_title_is_dropped(self):
        self.assertIsNone(normalize_item({"source_url": "/x"}, "announcements"))

    def test_missing_url_is_dropped(self):
        self.assertIsNone(normalize_item({"title": "No url"}, "announcements"))

    def test_unknown_content_type_defaults_to_announcement(self):
        item = normalize_item({"title": "T", "source_url": "/t", "content_type": "bogus"}, "x")
        self.assertEqual(item["content_type"], "announcement")

    def test_document_links_normalized(self):
        raw = {
            "title": "Form",
            "source_url": "/f",
            "document_links": ["/files/a.pdf", {"url": "/files/b.docx", "label": "B"}],
        }
        item = normalize_item(raw, "documents")
        urls = [d["url"] for d in item["document_links"]]
        self.assertIn("https://intranet.srmap.edu.in/files/a.pdf", urls)
        self.assertIn("https://intranet.srmap.edu.in/files/b.docx", urls)

    def test_audience_is_preserved_for_cohort(self):
        item = normalize_item(
            {"title": "Dept notice", "source_url": "/d", "audience": "cohort"}, "announcements"
        )
        self.assertEqual(item["audience"], config.AUDIENCE_COHORT)

    def test_invalid_audience_falls_back_to_shared(self):
        item = normalize_item(
            {"title": "X", "source_url": "/x", "audience": "private"}, "announcements"
        )
        self.assertEqual(item["audience"], config.AUDIENCE_SHARED)


if __name__ == "__main__":
    unittest.main()