"""Unit tests for pure parser/filter logic in the career scrapers.

Run from the repo's Scraper/ directory:
    venv/bin/python3 -m unittest discover -s tests -v

No network access and no browser launch — only module-level helpers are
exercised.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrapers.devpost_scraper import clean_prize, parse_deadline_end, parse_hackathon
from scrapers.ats_scraper import (
    is_india_location,
    map_greenhouse_job,
    map_lever_posting,
    ms_to_iso,
    passes_title_filter,
)
from scrapers.unstop_scraper import _parse_api_item, _strip_html


class DevpostParserTests(unittest.TestCase):
    def test_parse_deadline_end_extracts_close_date(self):
        self.assertEqual(parse_deadline_end("Jul 31 - Oct 01, 2026"), "Oct 01, 2026")

    def test_parse_deadline_end_handles_missing_year_in_end_segment(self):
        # Some entries put the year only once at the very end.
        self.assertEqual(parse_deadline_end("Jul 31 - Oct 01 2026"), "Oct 01 2026")

    def test_parse_deadline_end_empty(self):
        self.assertIsNone(parse_deadline_end(""))
        self.assertIsNone(parse_deadline_end(None))

    def test_clean_prize_strips_html(self):
        self.assertEqual(clean_prize("$<span data-currency-value>740,000</span>"), "$740,000")
        self.assertEqual(clean_prize(""), None)

    def test_parse_hackathon_maps_online_event(self):
        raw = {
            "title": "Test Hack",
            "url": "https://testhack.devpost.com/",
            "organization_name": "Acme",
            "displayed_location": {"location": "Online"},
            "submission_period_dates": "Jul 31 - Oct 01, 2026",
            "prize_amount": "$<span data-currency-value>10,000</span>",
            "themes": [{"name": "AI"}, {"name": "Web"}],
            "registrations_count": 1234,
        }
        parsed = parse_hackathon(raw)
        self.assertEqual(parsed["type"], "hackathon")
        self.assertEqual(parsed["organizer"], "Acme")
        self.assertTrue(parsed["mode"] == "online")
        self.assertIsNone(parsed["location"])
        self.assertEqual(parsed["deadline"], "Oct 01, 2026")
        self.assertEqual(parsed["prize"], "$10,000")

    def test_parse_hackathon_rejects_missing_title_or_url(self):
        self.assertIsNone(parse_hackathon({"url": "https://x.devpost.com"}))
        self.assertIsNone(parse_hackathon({"title": "No URL"}))
        self.assertIsNone(parse_hackathon(None))

    def test_parse_hackathon_upgrades_protocol_relative_url(self):
        parsed = parse_hackathon({
            "title": "T",
            "url": "//foo.devpost.com/",
            "displayed_location": {"location": "Online"},
        })
        self.assertEqual(parsed["sourceUrl"], "https://foo.devpost.com/")


class AtsFilterTests(unittest.TestCase):
    def test_is_india_location_matches_major_cities(self):
        for loc in ("Bengaluru", "Mumbai, IND", "Remote - India", "Gurugram", "HYDERABAD"):
            self.assertTrue(is_india_location(loc), loc)

    def test_is_india_location_rejects_other_regions(self):
        for loc in ("London, UK", "Singapore", "Remote - Global", ""):
            self.assertFalse(is_india_location(loc), loc)

    def test_title_filter_keeps_student_roles_only_by_default(self):
        import config

        if config.ATS_INCLUDE_ALL_ROLES:
            self.skipTest("ATS_INCLUDE_ALL_ROLES enabled in env")
        self.assertTrue(passes_title_filter("Software Engineering Intern"))
        self.assertTrue(passes_title_filter("Graduate Engineer Trainee"))
        self.assertFalse(passes_title_filter("Senior Staff Engineer"))

    def test_ms_to_iso_converts_lever_epoch(self):
        iso = ms_to_iso(1787543704191)
        self.assertIn("2026", iso)

    def test_ms_to_iso_rejects_garbage(self):
        self.assertIsNone(ms_to_iso(None))
        self.assertIsNone(ms_to_iso("not-a-number"))


class AtsMapperTests(unittest.TestCase):
    def test_map_greenhouse_job_full_mapping(self):
        job = {
            "title": "Backend Engineer Intern",
            "absolute_url": "https://boards.greenhouse.io/zscaler/jobs/123",
            "location": {"name": "Bengaluru, India"},
            "content": "<p>Build APIs.</p><ul><li>Python</li></ul>",
            "departments": [{"name": "Engineering"}],
            "updated_at": "2026-08-20T12:00:00+05:30",
        }
        raw = map_greenhouse_job(job, "Zscaler")
        self.assertIsNotNone(raw)
        self.assertEqual(raw["type"], "internship")
        self.assertEqual(raw["company"], "Zscaler")
        self.assertEqual(raw["mode"], "onsite")
        self.assertIn("Build APIs.", raw["description"])

    def test_map_greenhouse_job_skips_non_india(self):
        job = {
            "title": "Intern",
            "absolute_url": "https://boards.greenhouse.io/x/jobs/1",
            "location": {"name": "San Jose, CA"},
            "content": "",
        }
        self.assertIsNone(map_greenhouse_job(job, "X"))

    def test_map_greenhouse_job_skips_senior_roles(self):
        import config

        if config.ATS_INCLUDE_ALL_ROLES:
            self.skipTest("ATS_INCLUDE_ALL_ROLES enabled in env")
        job = {
            "title": "Director of Engineering",
            "absolute_url": "https://boards.greenhouse.io/x/jobs/2",
            "location": {"name": "Pune, India"},
            "content": "",
        }
        self.assertIsNone(map_greenhouse_job(job, "X"))

    def test_map_lever_posting_full_mapping(self):
        posting = {
            "text": "SDE Intern",
            "hostedUrl": "https://jobs.lever.co/cred/abc",
            "createdAt": 1787543704191,
            "descriptionPlain": "Work on payments.",
            "categories": {"location": "bengaluru", "commitment": "Internship"},
        }
        raw = map_lever_posting(posting, "CRED")
        self.assertIsNotNone(raw)
        self.assertEqual(raw["type"], "internship")
        self.assertEqual(raw["location"], "Bengaluru")
        self.assertIsNotNone(raw["postedAt"])

    def test_map_lever_posting_skips_non_india(self):
        posting = {
            "text": "Intern",
            "hostedUrl": "https://jobs.lever.co/x/y",
            "categories": {"location": "New York"},
        }
        self.assertIsNone(map_lever_posting(posting, "X"))


class UnstopParserTests(unittest.TestCase):
    def test_jobs_subtype_maps_to_job_type(self):
        item = {
            "id": "1743662",
            "public_url": "jobs/analyst-acme-1743662",
            "seo_url": "https://unstop.com/jobs/analyst-acme-1743662",
            "title": "Data Analyst",
            "type": "jobs",
            "subtype": "jobs",
        }
        parsed = _parse_api_item(item)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["type"], "job")

    def test_internships_subtype_maps_to_internship(self):
        item = {
            "id": "1743662",
            "seo_url": "https://unstop.com/internships/social-media-intern-aeternum-1743662",
            "title": "Social Media Intern",
            "type": "jobs",
            "subtype": "internships",
            "region": "online",
            "details": "<p>Handle socials</p>",
        }
        parsed = _parse_api_item(item)
        self.assertEqual(parsed["type"], "internship")
        self.assertIn("Handle socials", parsed["description"])

    def test_strip_html(self):
        self.assertEqual(_strip_html("<p>Hello <b>world</b></p>"), "Hello world")
        self.assertEqual(_strip_html(""), "")

    def test_category_items_without_id_and_slug_are_rejected(self):
        self.assertIsNone(_parse_api_item({"title": "Competitions"}))


if __name__ == "__main__":
    unittest.main()
