"""Unit tests for stipend parsing, remote feed mappers, and net utilities.

Run from the repo's Scraper/ directory:
    venv/bin/python3 -m unittest discover -s tests -v
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from intelligence import parse_stipend
from scrapers.remote_scraper import location_allowed, map_remoteok, map_remotive
from scrapers.net import HostThrottle, ProxyPool, host_of


class StipendParsingTests(unittest.TestCase):
    def test_range_with_k_suffix(self):
        self.assertEqual(parse_stipend("₹20K-40K/month"), (20000.0, 40000.0))

    def test_plain_rupee_range(self):
        self.assertEqual(parse_stipend("₹20,000 - 30,000"), (20000.0, 30000.0))

    def test_single_value_rs_prefix(self):
        self.assertEqual(parse_stipend("Rs. 15000"), (15000.0, 15000.0))

    def test_lakh_lump_sum(self):
        self.assertEqual(parse_stipend("₹1.5 Lakh lump sum"), (150000.0, 150000.0))

    def test_en_dash_range(self):
        self.assertEqual(parse_stipend("₹5k–10k per month"), (5000.0, 10000.0))

    def test_non_numeric_phrases(self):
        for text in ("Unpaid", "Performance based", "Negotiable", ""):
            self.assertEqual(parse_stipend(text), (None, None), text)

    def test_foreign_currency_rejected(self):
        self.assertEqual(parse_stipend("$14/hour"), (None, None))
        self.assertEqual(parse_stipend("€2000 monthly"), (None, None))

    def test_garbage_numbers_out_of_bounds(self):
        # A single digit like '7' is below the sanity floor.
        self.assertEqual(parse_stipend("₹7"), (None, None))


class RemoteLocationTests(unittest.TestCase):
    def test_worldwide_and_india_allowed(self):
        for loc in ("Worldwide", "", None, "Remote", "India", "Bengaluru, India"):
            self.assertTrue(location_allowed(loc), loc)

    def test_region_locked_rejected(self):
        for loc in ("USA", "Newcastle Upon Tyne", "Germany only"):
            self.assertFalse(location_allowed(loc), loc)


class RemoteMapperTests(unittest.TestCase):
    def test_map_remoteok_full_mapping(self):
        raw = {
            "position": "Backend Intern",
            "url": "https://remoteOK.com/remote-jobs/x-1",
            "company": "Acme",
            "location": "Worldwide",
            "date": "2026-08-23T14:25:00+00:00",
            "description": "<p>Build APIs</p>",
            "tags": "['python', 'django']",
        }
        parsed = map_remoteok(raw)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["type"], "internship")
        self.assertEqual(parsed["mode"], "remote")
        self.assertIn("python", parsed["description"])
        self.assertIn("Build APIs", parsed["description"])

    def test_map_remoteok_rejects_legal_notice_element(self):
        self.assertIsNone(map_remoteok({"legal": "...", "last_updated": "..."}))

    def test_map_remoteok_rejects_region_locked(self):
        raw = {"position": "Engineer", "url": "https://x/1", "company": "C", "location": "Germany"}
        self.assertIsNone(map_remoteok(raw))

    def test_map_remotive_full_mapping(self):
        job = {
            "title": "Data Analyst Internship",
            "url": "https://remotive.com/remote-jobs/x/1",
            "company_name": "Beta",
            "candidate_required_location": "Remote - India",
            "job_type": "part_time",
            "publication_date": "2026-08-21T05:54:39",
            "description": "<ul><li>SQL</li></ul>",
            "salary": "",
        }
        parsed = map_remotive(job)
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["type"], "internship")
        self.assertIn("Commitment: part-time", parsed["description"])

    def test_map_remotive_keeps_salary_display_only(self):
        job = {
            "title": "Developer",
            "url": "https://remotive.com/remote-jobs/x/2",
            "company_name": "Gamma",
            "candidate_required_location": "Anywhere",
            "salary": "$14/hour",
        }
        parsed = map_remotive(job)
        self.assertIn("Salary: $14/hour", parsed["description"])


class NetUtilityTests(unittest.TestCase):
    def test_proxy_pool_empty_returns_none(self):
        pool = ProxyPool([])
        self.assertIsNone(pool.next())

    def test_proxy_pool_cycles_round_robin(self):
        pool = ProxyPool(["http://a:1", "http://b:2"])
        picks = [pool.next(), pool.next(), pool.next()]
        self.assertEqual(picks, ["http://a:1", "http://b:2", "http://a:1"])

    def test_host_of_extracts_netloc(self):
        self.assertEqual(host_of("https://unstop.com/api?x=1"), "unstop.com")

    def test_throttle_cooldown_after_strike_threshold(self):
        throttle = HostThrottle(strike_threshold=2, base_cooldown_s=120, max_cooldown_s=1800)
        self.assertEqual(throttle.wait_time("h"), 0)
        throttle.report_blocked("h", "403")
        self.assertEqual(throttle.wait_time("h"), 0)  # below threshold yet
        throttle.report_blocked("h", "403")
        self.assertGreater(throttle.wait_time("h"), 100)  # ~120s minus timer drift

    def test_throttle_escalates_then_resets_on_success(self):
        throttle = HostThrottle(strike_threshold=1, base_cooldown_s=100, max_cooldown_s=1000)
        throttle.report_blocked("h")
        first = throttle.wait_time("h")
        throttle.report_blocked("h")
        second = throttle.wait_time("h")
        self.assertGreater(second, first)  # exponential growth
        self.assertLessEqual(second, 1000)  # capped
        throttle.report_ok("h")
        self.assertEqual(throttle.wait_time("h"), 0)


if __name__ == "__main__":
    unittest.main()
