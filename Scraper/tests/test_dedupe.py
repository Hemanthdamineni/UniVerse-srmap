"""Tests for near-duplicate merging (normalized title+employer keys).

Run from the repo's Scraper/ directory:
    venv/bin/python3 -m unittest discover -s tests -v
"""

import sys
import os
import shutil
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db as db_module
from deduplicator import compute_dupe_key, normalize_company, normalize_title


class NormalizeCompanyTests(unittest.TestCase):
    def test_strips_legal_suffixes(self):
        self.assertEqual(normalize_company("Google LLC"), "google")
        self.assertEqual(normalize_company("Google India Pvt. Ltd."), "google")
        self.assertEqual(normalize_company("Zeta Corp"), "zeta")
        self.assertEqual(normalize_company("Zeta Co & Holdings"), "zeta")

    def test_stips_trailing_role_context(self):
        self.assertEqual(normalize_company("Freshworks Technologies"), "freshworks")
        self.assertEqual(normalize_company("Postman Labs"), "postman")

    def test_keeps_distinctive_names(self):
        self.assertNotEqual(normalize_company("Infosys"), normalize_company("TCS"))
        # 'Tech Mahindra' keeps its leading token even though 'tech'-family
        # suffixes are stripped only from trailing position.
        self.assertEqual(normalize_company("Tech Mahindra Ltd"), "tech mahindra")


class NormalizeTitleTests(unittest.TestCase):
    def test_expands_abbreviations(self):
        self.assertEqual(
            normalize_title("SDE Intern"),
            normalize_title("Software Development Engineer Intern"),
        )
        self.assertEqual(
            normalize_title("ML Intern"),
            normalize_title("Machine Learning Intern"),
        )

    def test_ignores_case_punctuation_and_pipe_suffixes(self):
        self.assertEqual(
            normalize_title("Backend Engineer | Acme Careers"),
            normalize_title("backend engineer"),
        )
        self.assertEqual(
            normalize_title("Data  Analyst!!"),
            normalize_title("data analyst"),
        )

    def test_different_roles_stay_different(self):
        self.assertNotEqual(
            normalize_title("Frontend Engineer Intern"),
            normalize_title("Backend Engineer Intern"),
        )


class DupeKeyTests(unittest.TestCase):
    def test_cross_source_variants_collapse(self):
        a = compute_dupe_key({"title": "SDE Intern", "company": "Google LLC"})
        b = compute_dupe_key({"title": "software development engineer intern", "company": "Google India Pvt Ltd"})
        self.assertEqual(a, b)
        self.assertNotEqual(a, "")

    def test_deadline_and_location_do_not_affect_key(self):
        a = compute_dupe_key({"title": "Data Analyst", "company": "Acme", "deadline": None})
        b = compute_dupe_key({"title": "Data Analyst", "company": "Acme", "deadline": "2026-09-30"})
        self.assertEqual(a, b)

    def test_missing_company_yields_empty_key(self):
        self.assertEqual(compute_dupe_key({"title": "Intern", "company": ""}), "")


class NearDupMergeDbTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="dupe-merge-test-")
        self.original_path = db_module.DB_PATH
        db_module.DB_PATH = os.path.join(self.tmpdir, "career.sqlite")
        self.career_db = db_module.CareerDB()

    def tearDown(self):
        self.career_db.close()
        db_module.DB_PATH = self.original_path
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def make_opp(self, title, company, source, url, type_="internship"):
        return {
            "id": url,
            "type": type_,
            "title": title,
            "company": company,
            "description": "desc",
            "mode": "onsite",
            "sourceUrl": url,
            "source": source,
            "scrapedAt": "2026-08-24T12:00:00",
            "updatedAt": "2026-08-24T12:00:00",
            "fingerprint": f"fp-{url}",
            "sources": [source],
            # Normalizer always attaches this before upsert; mirror that here.
            "dupeKey": compute_dupe_key({"title": title, "company": company}),
            "relevanceScore": 0,
        }

    def test_near_duplicate_from_another_source_merges(self):
        first = self.make_opp(
            "Software Development Engineer Intern", "Google LLC", "jobspy",
            "https://linkedin.com/jobs/1",
        )
        second = self.make_opp(
            "SDE Intern", "Google India Pvt Ltd", "ats",
            "https://boards.greenhouse.io/google/jobs/9",
        )

        self.assertEqual(self.career_db.upsert_opportunity(first), "new")
        result = self.career_db.upsert_opportunity(second)
        self.assertEqual(result, "skipped")

        count = self.career_db.conn.execute("SELECT COUNT(*) AS c FROM career_opportunities").fetchone()["c"]
        self.assertEqual(count, 1)

        row = self.career_db.conn.execute("SELECT sources FROM career_opportunities").fetchone()
        self.assertIn("jobspy", row["sources"])
        self.assertIn("ats", row["sources"])

    def test_type_guard_keeps_internship_and_job_separate(self):
        intern = self.make_opp("Platform Engineer", "Acme", "jobspy", "https://x/1", type_="internship")
        job = self.make_opp("Platform Engineering Intern", "Acme India", "ats", "https://x/2", type_="job")
        self.assertEqual(self.career_db.upsert_opportunity(intern), "new")
        self.assertEqual(self.career_db.upsert_opportunity(job), "new")
        count = self.career_db.conn.execute("SELECT COUNT(*) AS c FROM career_opportunities").fetchone()["c"]
        self.assertEqual(count, 2)

    def test_expired_row_is_not_a_merge_target(self):
        live = self.make_opp("QA Intern", "Beta", "jobspy", "https://x/10")
        self.assertEqual(self.career_db.upsert_opportunity(live), "new")
        self.career_db.conn.execute("UPDATE career_opportunities SET isActive = 0")

        fresh = self.make_opp("Quality Assurance Intern", "Beta Inc", "indeed", "https://x/11")
        self.assertEqual(self.career_db.upsert_opportunity(fresh), "new")

    def test_backfill_populates_legacy_rows(self):
        legacy = self.make_opp("DevOps Engineer", "Gamma", "manual", "https://x/20")
        self.career_db.conn.execute(
            """INSERT INTO career_opportunities
               (id, type, title, company, description, mode, source, sourceUrl,
                scrapedAt, updatedAt, fingerprint, sources)
               VALUES (?, 'job', ?, ?, '', 'onsite', ?, ?, ?, ?, ?, ?)""",
            (
                legacy["id"], legacy["title"], legacy["company"], legacy["source"],
                legacy["sourceUrl"], legacy["scrapedAt"], legacy["updatedAt"],
                legacy["fingerprint"], "[]",
            ),
        )
        self.career_db._backfill_dupe_keys()

        row = self.career_db.conn.execute(
            "SELECT dupeKey FROM career_opportunities WHERE id = ?", (legacy["id"],)
        ).fetchone()
        expected = compute_dupe_key({"title": "DevOps Engineer", "company": "Gamma"})
        self.assertEqual(row["dupeKey"], expected)


if __name__ == "__main__":
    unittest.main()
