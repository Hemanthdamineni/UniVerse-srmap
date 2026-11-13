"""
Offline unit tests for the SRMAP Intranet SQLite persistence layer.

Uses a temporary database; no network or Playwright required.

    venv/bin/python3 -m unittest discover -s intranet/tests -v
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import IntranetDB


def make_item(**overrides):
    base = {
        "id": "item-1",
        "source_key": "announcements",
        "content_type": "announcement",
        "audience": "shared",
        "title": "Scholarship Open",
        "summary": "Apply now",
        "body": "Full body text",
        "published_at": "2026-11-05",
        "source_url": "https://intranet.srmap.edu.in/announcements/scholarship",
        "document_links": [{"url": "https://x/f.pdf", "label": "form"}],
    }
    base.update(overrides)
    return base


class DBTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp(prefix="intranet-db-test-")
        self.db_path = os.path.join(self.tmpdir, "intranet.sqlite")
        self.db = IntranetDB(self.db_path)

    def tearDown(self):
        self.db.close()
        for name in os.listdir(self.tmpdir):
            try:
                os.unlink(os.path.join(self.tmpdir, name))
            except OSError:
                pass
        os.rmdir(self.tmpdir)

    def _row(self, item_id):
        return self.db.conn.execute(
            "SELECT * FROM intranet_items WHERE id=?", (item_id,)
        ).fetchone()

    def test_upsert_new_then_unchanged_then_updated(self):
        result = self.db.upsert_item(make_item())
        self.assertEqual(result, "new")
        row = self._row("item-1")
        self.assertEqual(row["title"], "Scholarship Open")
        self.assertEqual(row["is_active"], 1)

        # Same content again → unchanged (only verification timestamp moves).
        result = self.db.upsert_item(make_item())
        self.assertEqual(result, "unchanged")

        # Changed title → updated.
        result = self.db.upsert_item(make_item(title="Scholarship Open — Extended"))
        self.assertEqual(result, "updated")
        self.assertEqual(self._row("item-1")["title"], "Scholarship Open — Extended")

    def test_upsert_reactivates_previously_expired_item(self):
        self.db.upsert_item(make_item())
        self.db.conn.execute("UPDATE intranet_items SET is_active=0 WHERE id='item-1'")
        self.db.conn.commit()
        result = self.db.upsert_item(make_item(title="Back again"))
        self.assertEqual(result, "updated")
        self.assertEqual(self._row("item-1")["is_active"], 1)

    def test_content_hash_is_stable_and_changes_with_content(self):
        h1 = IntranetDB.compute_content_hash(make_item())
        h2 = IntranetDB.compute_content_hash(make_item())
        h3 = IntranetDB.compute_content_hash(make_item(title="Different"))
        self.assertEqual(h1, h2)
        self.assertNotEqual(h1, h3)

    def test_mark_items_expired_only_removes_unseen(self):
        for i in range(3):
            self.db.upsert_item(
                make_item(
                    id=f"item-{i}",
                    source_url=f"https://intranet.srmap.edu.in/announcements/{i}",
                )
            )
        # Keep only item-0 and item-2 in this run.
        seen = {
            "https://intranet.srmap.edu.in/announcements/0",
            "https://intranet.srmap.edu.in/announcements/2",
        }
        expired = self.db.mark_items_expired("announcements", seen)
        self.assertEqual(expired, 1)
        self.assertEqual(self._row("item-1")["is_active"], 0)
        self.assertEqual(self._row("item-0")["is_active"], 1)

    def test_mark_items_expired_noop_on_empty_seen_set(self):
        self.db.upsert_item(make_item())
        self.assertEqual(self.db.mark_items_expired("announcements", set()), 0)
        self.assertEqual(self._row("item-1")["is_active"], 1)

    def test_run_logging(self):
        self.db.begin_run("run-1", "announcements")
        self.db.complete_run("run-1", status="ok", items_new=2, items_updated=1)
        status = self.db.get_operational_status()
        self.assertIsNotNone(status["lastRun"])
        self.assertEqual(status["lastRun"]["id"], "run-1")
        self.assertEqual(status["lastRun"]["items_new"], 2)
        self.assertEqual(status["lastSuccess"]["status"], "ok")

    def test_circuit_breaker_opens_then_resets(self):
        source = "events"
        for _ in range(5):
            self.db.record_source_failure(source, "boom")
        health = self.db.get_source_health(source)
        self.assertTrue(health["is_blocked"])
        self.assertEqual(health["consecutive_fails"], 5)

        self.db.reset_circuit_breaker(source)
        health = self.db.get_source_health(source)
        self.assertFalse(health["is_blocked"])
        self.assertEqual(health["consecutive_fails"], 0)

    def test_success_clears_failure_count(self):
        source = "news"
        self.db.record_source_failure(source, "x")
        self.db.record_source_success(source)
        health = self.db.get_source_health(source)
        self.assertEqual(health["consecutive_fails"], 0)
        self.assertFalse(health["is_blocked"])

    def test_auth_log(self):
        self.db.log_auth_attempt(True)
        self.db.log_auth_attempt(False, "bad password")
        status = self.db.get_operational_status()
        self.assertIsNotNone(status["lastAuth"])
        self.assertEqual(status["lastAuth"]["failure_reason"], "bad password")


if __name__ == "__main__":
    unittest.main()