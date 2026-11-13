"""
SQLite persistence layer for the SRMAP Intranet scraper.

Schema contract:
- The Node.js backend (intranetStore.js) owns schema creation for the
  intranet_items table and intranet_sources table.
- This module creates only the scraper-owned audit / health tables and
  writes to intranet_items via upsert.
- WAL mode + busy_timeout for safe concurrent access with the backend.
"""

import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from hashlib import sha256
from typing import Optional

from config import DB_PATH

logger = logging.getLogger("IntranetDB")


def _now_utc() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


class IntranetDB:
    """SQLite interface for the SRMAP Intranet scraper pipeline."""

    def __init__(self, db_path: str = DB_PATH) -> None:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.conn = sqlite3.connect(db_path, timeout=10, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self.conn.execute("PRAGMA busy_timeout=5000")
        self.conn.execute("PRAGMA cache_size=-16000")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._ensure_scraper_tables()

    # ── Schema ────────────────────────────────────────────────────────────────

    def _ensure_scraper_tables(self) -> None:
        """Create scraper-owned tables and bootstrap the main item table if
        the backend has not created it yet."""
        self.conn.executescript("""
            -- Scraper run log
            CREATE TABLE IF NOT EXISTS intranet_scraper_runs (
                id              TEXT PRIMARY KEY,
                source          TEXT NOT NULL,
                started_at      TEXT NOT NULL,
                completed_at    TEXT,
                status          TEXT DEFAULT 'running',
                items_new       INTEGER DEFAULT 0,
                items_updated   INTEGER DEFAULT 0,
                items_unchanged INTEGER DEFAULT 0,
                items_expired   INTEGER DEFAULT 0,
                error_message   TEXT,
                duration_ms     INTEGER,
                was_complete    INTEGER DEFAULT 0
            );

            -- Per-source circuit-breaker health
            CREATE TABLE IF NOT EXISTS intranet_source_health (
                source              TEXT PRIMARY KEY,
                last_success        TEXT,
                last_attempt        TEXT,
                consecutive_fails   INTEGER DEFAULT 0,
                is_blocked          INTEGER DEFAULT 0,
                notes               TEXT
            );

            -- Auth status log
            CREATE TABLE IF NOT EXISTS intranet_auth_log (
                id              TEXT PRIMARY KEY,
                attempted_at    TEXT NOT NULL,
                success         INTEGER NOT NULL,
                failure_reason  TEXT
            );
        """)

        # Bootstrap main items table if the Node backend hasn't created it yet.
        try:
            self.conn.execute("SELECT 1 FROM intranet_items LIMIT 0")
        except sqlite3.OperationalError as exc:
            if "no such table: intranet_items" in str(exc):
                logger.warning(
                    "intranet_items table does not exist; creating minimal schema. "
                    "The Node.js backend will add indexes and FTS on first start."
                )
                self._create_items_table()
            else:
                raise

        # Idempotent column additions for forward-compatibility.
        self._add_column_if_missing("intranet_items", "content_hash TEXT")
        self._add_column_if_missing("intranet_items", "extraction_status TEXT")
        self.conn.commit()

    def _create_items_table(self) -> None:
        """Minimal item table matching what intranetStore.js creates."""
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS intranet_items (
                id              TEXT PRIMARY KEY,
                source_key      TEXT NOT NULL,
                content_type    TEXT NOT NULL,
                audience        TEXT NOT NULL DEFAULT 'shared',
                title           TEXT NOT NULL,
                summary         TEXT,
                body            TEXT,
                published_at    TEXT,
                effective_at    TEXT,
                expires_at      TEXT,
                event_start     TEXT,
                event_end       TEXT,
                deadline        TEXT,
                department      TEXT,
                programme       TEXT,
                semester        TEXT,
                tags            TEXT,
                source_url      TEXT NOT NULL,
                canonical_url   TEXT,
                document_links  TEXT,
                attachments     TEXT,
                content_hash    TEXT,
                is_active       INTEGER DEFAULT 1,
                extraction_status TEXT DEFAULT 'ok',
                first_seen_at   TEXT NOT NULL,
                last_seen_at    TEXT NOT NULL,
                last_verified_at TEXT,
                last_modified_at TEXT,
                metadata        TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_intranet_items_source_key
                ON intranet_items(source_key);
            CREATE INDEX IF NOT EXISTS idx_intranet_items_content_type
                ON intranet_items(content_type);
            CREATE INDEX IF NOT EXISTS idx_intranet_items_audience
                ON intranet_items(audience);
            CREATE INDEX IF NOT EXISTS idx_intranet_items_is_active
                ON intranet_items(is_active);
            CREATE INDEX IF NOT EXISTS idx_intranet_items_published_at
                ON intranet_items(published_at);
            CREATE INDEX IF NOT EXISTS idx_intranet_items_source_url
                ON intranet_items(source_url);
        """)
        self.conn.commit()

    def _add_column_if_missing(self, table: str, column_def: str) -> None:
        try:
            self.conn.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")
            self.conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists

    # ── Item persistence ──────────────────────────────────────────────────────

    @staticmethod
    def compute_content_hash(item: dict) -> str:
        """Fingerprint the semantic content of an item for change detection."""
        parts = [
            item.get("title", ""),
            item.get("summary", ""),
            item.get("body", ""),
            item.get("source_url", ""),
            item.get("published_at", ""),
        ]
        return sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:16]

    def upsert_item(self, item: dict) -> str:
        """Insert or update an intranet item. Returns 'new', 'updated', or 'unchanged'."""
        now = _now_utc()
        source_url = item.get("source_url", "")
        content_hash = self.compute_content_hash(item)

        # Check for existing record by source_url (canonical identity).
        existing = self.conn.execute(
            "SELECT id, content_hash, is_active FROM intranet_items WHERE source_url = ? LIMIT 1",
            (source_url,),
        ).fetchone()

        def _json(val: object) -> Optional[str]:
            if val is None:
                return None
            if isinstance(val, (list, dict)):
                return json.dumps(val, ensure_ascii=False)
            return str(val)

        if existing is None:
            # New record
            import uuid
            item_id = item.get("id") or str(uuid.uuid4())
            self.conn.execute("""
                INSERT INTO intranet_items (
                    id, source_key, content_type, audience, title, summary, body,
                    published_at, effective_at, expires_at, event_start, event_end,
                    deadline, department, programme, semester, tags,
                    source_url, canonical_url, document_links, attachments,
                    content_hash, is_active, extraction_status,
                    first_seen_at, last_seen_at, last_verified_at, last_modified_at, metadata
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, 1, 'ok',
                    ?, ?, ?, ?, ?
                )
            """, (
                item_id,
                item.get("source_key", ""),
                item.get("content_type", "announcement"),
                item.get("audience", "shared"),
                item.get("title", ""),
                item.get("summary"),
                item.get("body"),
                item.get("published_at"),
                item.get("effective_at"),
                item.get("expires_at"),
                item.get("event_start"),
                item.get("event_end"),
                item.get("deadline"),
                item.get("department"),
                item.get("programme"),
                item.get("semester"),
                _json(item.get("tags")),
                source_url,
                item.get("canonical_url") or source_url,
                _json(item.get("document_links")),
                _json(item.get("attachments")),
                content_hash,
                now,  # first_seen_at
                now,  # last_seen_at
                now,  # last_verified_at
                item.get("published_at") or now,  # last_modified_at
                _json(item.get("metadata")),
            ))
            self.conn.commit()
            return "new"

        existing_id = existing["id"]
        existing_hash = existing["content_hash"]

        if existing_hash == content_hash and existing["is_active"]:
            # Unchanged — just update verification timestamp.
            self.conn.execute(
                "UPDATE intranet_items SET last_seen_at=?, last_verified_at=? WHERE id=?",
                (now, now, existing_id),
            )
            self.conn.commit()
            return "unchanged"

        # Content changed or was previously inactive — update.
        self.conn.execute("""
            UPDATE intranet_items SET
                source_key=?, content_type=?, audience=?, title=?, summary=?, body=?,
                published_at=?, effective_at=?, expires_at=?, event_start=?, event_end=?,
                deadline=?, department=?, programme=?, semester=?, tags=?,
                canonical_url=?, document_links=?, attachments=?,
                content_hash=?, is_active=1, extraction_status='ok',
                last_seen_at=?, last_verified_at=?, last_modified_at=?, metadata=?
            WHERE id=?
        """, (
            item.get("source_key", ""),
            item.get("content_type", "announcement"),
            item.get("audience", "shared"),
            item.get("title", ""),
            item.get("summary"),
            item.get("body"),
            item.get("published_at"),
            item.get("effective_at"),
            item.get("expires_at"),
            item.get("event_start"),
            item.get("event_end"),
            item.get("deadline"),
            item.get("department"),
            item.get("programme"),
            item.get("semester"),
            _json(item.get("tags")),
            item.get("canonical_url") or source_url,
            _json(item.get("document_links")),
            _json(item.get("attachments")),
            content_hash,
            now,  # last_seen_at
            now,  # last_verified_at
            now,  # last_modified_at
            _json(item.get("metadata")),
            existing_id,
        ))
        self.conn.commit()
        return "updated"

    def mark_items_expired(self, source_key: str, seen_urls: set[str]) -> int:
        """Mark items from source_key that were NOT seen in this run as expired.

        Only called when the crawl was complete enough to support reconciliation
        (was_complete=True). Never mass-deletes on a partial crawl.
        """
        if not seen_urls:
            return 0

        rows = self.conn.execute(
            "SELECT id, source_url FROM intranet_items WHERE source_key=? AND is_active=1",
            (source_key,),
        ).fetchall()

        expired_ids = [r["id"] for r in rows if r["source_url"] not in seen_urls]
        if not expired_ids:
            return 0

        now = _now_utc()
        # Batch update (SQLite3 has no array bind; use executemany)
        self.conn.executemany(
            "UPDATE intranet_items SET is_active=0, last_modified_at=? WHERE id=?",
            [(now, eid) for eid in expired_ids],
        )
        self.conn.commit()
        return len(expired_ids)

    # ── Run log ───────────────────────────────────────────────────────────────

    def begin_run(self, run_id: str, source: str) -> None:
        self.conn.execute("""
            INSERT INTO intranet_scraper_runs (id, source, started_at, status)
            VALUES (?, ?, ?, 'running')
        """, (run_id, source, _now_utc()))
        self.conn.commit()

    def complete_run(
        self,
        run_id: str,
        *,
        status: str = "ok",
        items_new: int = 0,
        items_updated: int = 0,
        items_unchanged: int = 0,
        items_expired: int = 0,
        error_message: Optional[str] = None,
        was_complete: bool = True,
    ) -> None:
        started = self.conn.execute(
            "SELECT started_at FROM intranet_scraper_runs WHERE id=?", (run_id,)
        ).fetchone()
        duration_ms = None
        if started:
            try:
                start_dt = datetime.fromisoformat(started["started_at"])
                duration_ms = int(
                    (datetime.now(tz=timezone.utc) - start_dt).total_seconds() * 1000
                )
            except Exception:
                pass

        self.conn.execute("""
            UPDATE intranet_scraper_runs SET
                completed_at=?, status=?,
                items_new=?, items_updated=?, items_unchanged=?, items_expired=?,
                error_message=?, duration_ms=?, was_complete=?
            WHERE id=?
        """, (
            _now_utc(), status, items_new, items_updated, items_unchanged, items_expired,
            error_message, duration_ms, int(was_complete), run_id,
        ))
        self.conn.commit()

    # ── Source health ─────────────────────────────────────────────────────────

    def get_source_health(self, source: str) -> dict:
        row = self.conn.execute(
            "SELECT * FROM intranet_source_health WHERE source=?", (source,)
        ).fetchone()
        if row is None:
            return {"source": source, "consecutive_fails": 0, "is_blocked": False}
        return {**dict(row), "is_blocked": bool(row["is_blocked"])}

    def record_source_success(self, source: str) -> None:
        now = _now_utc()
        self.conn.execute("""
            INSERT INTO intranet_source_health (source, last_success, last_attempt, consecutive_fails, is_blocked)
            VALUES (?, ?, ?, 0, 0)
            ON CONFLICT(source) DO UPDATE SET
                last_success=excluded.last_success,
                last_attempt=excluded.last_attempt,
                consecutive_fails=0,
                is_blocked=0
        """, (source, now, now))
        self.conn.commit()

    def record_source_failure(self, source: str, notes: str = "") -> None:
        now = _now_utc()
        self.conn.execute("""
            INSERT INTO intranet_source_health (source, last_attempt, consecutive_fails, is_blocked, notes)
            VALUES (?, ?, 1, 0, ?)
            ON CONFLICT(source) DO UPDATE SET
                last_attempt=excluded.last_attempt,
                consecutive_fails=consecutive_fails + 1,
                notes=excluded.notes,
                is_blocked = CASE
                    WHEN consecutive_fails + 1 >= ? THEN 1
                    ELSE 0
                END
        """, (source, now, notes, 5))  # 5 = CIRCUIT_BREAKER_THRESHOLD
        self.conn.commit()

    def reset_circuit_breaker(self, source: str) -> None:
        self.conn.execute(
            "UPDATE intranet_source_health SET is_blocked=0, consecutive_fails=0 WHERE source=?",
            (source,),
        )
        self.conn.commit()

    # ── Auth log ──────────────────────────────────────────────────────────────

    def log_auth_attempt(self, success: bool, failure_reason: Optional[str] = None) -> None:
        import uuid
        self.conn.execute("""
            INSERT INTO intranet_auth_log (id, attempted_at, success, failure_reason)
            VALUES (?, ?, ?, ?)
        """, (str(uuid.uuid4()), _now_utc(), int(success), failure_reason))
        self.conn.commit()

    # ── Operational status ────────────────────────────────────────────────────

    def get_operational_status(self) -> dict:
        """Return a compact status dict for the health API."""
        last_run = self.conn.execute("""
            SELECT * FROM intranet_scraper_runs
            ORDER BY started_at DESC LIMIT 1
        """).fetchone()
        last_success = self.conn.execute("""
            SELECT * FROM intranet_scraper_runs
            WHERE status='ok'
            ORDER BY started_at DESC LIMIT 1
        """).fetchone()
        source_health = self.conn.execute(
            "SELECT * FROM intranet_source_health"
        ).fetchall()
        item_counts = self.conn.execute("""
            SELECT content_type, COUNT(*) as cnt
            FROM intranet_items WHERE is_active=1
            GROUP BY content_type
        """).fetchall()
        last_auth = self.conn.execute("""
            SELECT * FROM intranet_auth_log
            ORDER BY attempted_at DESC LIMIT 1
        """).fetchone()

        return {
            "lastRun": dict(last_run) if last_run else None,
            "lastSuccess": dict(last_success) if last_success else None,
            "sources": [dict(r) for r in source_health],
            "itemCounts": {r["content_type"]: r["cnt"] for r in item_counts},
            "lastAuth": dict(last_auth) if last_auth else None,
        }

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass
