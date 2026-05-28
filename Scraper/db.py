import sqlite3
import json
import os
import logging
from datetime import datetime
from typing import Optional

from config import DB_PATH

logger = logging.getLogger("CareerDB")


class CareerDB:
    """SQLite interface for the career scraper pipeline.

    Design contract:
    - The Node.js backend owns schema creation (via careerStore.js _ensureSchema).
    - This class READS from and WRITES to the same SQLite file.
    - WAL mode is enabled for safe concurrent reader/writer access.
    - All writes commit per-row to avoid losing batches on crash.
    """

    def __init__(self) -> None:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        self.conn = sqlite3.connect(DB_PATH, timeout=10)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")  # Faster than FULL, safe with WAL
        self.conn.execute("PRAGMA busy_timeout=5000")
        self.conn.execute("PRAGMA cache_size=-16000")   # 16MB page cache for read perf
        self._ensure_scraper_tables()

    def _ensure_scraper_tables(self) -> None:
        """Create only the tables the scraper needs to write to, if they
        don't exist yet. The main career_opportunities table and other
        tables are created by the Node.js backend."""
        try:
            self.conn.executescript("""
                CREATE TABLE IF NOT EXISTS career_scraper_runs (
                    id             TEXT PRIMARY KEY,
                    source         TEXT NOT NULL,
                    startedAt      TEXT NOT NULL,
                    completedAt    TEXT,
                    status         TEXT DEFAULT 'running',
                    newCount       INTEGER DEFAULT 0,
                    updatedCount   INTEGER DEFAULT 0,
                    expiredCount   INTEGER DEFAULT 0,
                    errorMessage   TEXT,
                    durationMs     INTEGER
                );
                CREATE TABLE IF NOT EXISTS career_source_health (
                    source              TEXT PRIMARY KEY,
                    lastSuccess         TEXT,
                    lastAttempt         TEXT,
                    consecutiveFails    INTEGER DEFAULT 0,
                    isBlocked           INTEGER DEFAULT 0,
                    notes               TEXT
                );
            """)
            # Verify career_opportunities exists (created by Node backend)
            self.conn.execute("SELECT 1 FROM career_opportunities LIMIT 0")
        except sqlite3.OperationalError as e:
            if "no such table: career_opportunities" in str(e):
                logger.warning(
                    "career_opportunities table does not exist yet. "
                    "Creating minimal schema for scraper operation."
                )
                self._create_opportunities_table()
            else:
                raise

    def _create_opportunities_table(self) -> None:
        """Fallback: create the opportunities table if the Node backend
        hasn't been started yet."""
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS career_opportunities (
                id              TEXT PRIMARY KEY,
                type            TEXT NOT NULL CHECK(type IN ('job','internship','hackathon','competition','fellowship','workshop')),
                title           TEXT NOT NULL,
                company         TEXT,
                organizer       TEXT,
                description     TEXT,
                shortDescription TEXT,
                requirements    TEXT,
                skills          TEXT DEFAULT '[]',
                tags            TEXT DEFAULT '[]',
                location        TEXT,
                mode            TEXT CHECK(mode IN ('remote','onsite','hybrid','online','offline')),
                isPanIndia      INTEGER DEFAULT 0,
                eligibleBranches TEXT DEFAULT '[]',
                eligibleYears    TEXT DEFAULT '[]',
                minCGPA         REAL,
                stipend         TEXT,
                prize           TEXT,
                isFree          INTEGER DEFAULT 1,
                postedAt        TEXT,
                deadline        TEXT,
                startDate       TEXT,
                duration        TEXT,
                source          TEXT NOT NULL,
                sourceUrl       TEXT NOT NULL UNIQUE,
                sources         TEXT DEFAULT '[]',
                fingerprint     TEXT,
                applyUrl        TEXT,
                viewCount       INTEGER DEFAULT 0,
                bookmarkCount   INTEGER DEFAULT 0,
                applyCount      INTEGER DEFAULT 0,
                relevanceScore  REAL DEFAULT 0,
                isActive        INTEGER DEFAULT 1,
                isVerified      INTEGER DEFAULT 0,
                isFeatured      INTEGER DEFAULT 0,
                moderationState INTEGER DEFAULT 0,
                scrapedAt       TEXT NOT NULL,
                updatedAt       TEXT,
                status          TEXT DEFAULT 'active',
                expiredAt       TEXT,
                archivedAt      TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_career_type        ON career_opportunities(type);
            CREATE INDEX IF NOT EXISTS idx_career_active      ON career_opportunities(isActive);
            CREATE INDEX IF NOT EXISTS idx_career_source      ON career_opportunities(source);
            CREATE INDEX IF NOT EXISTS idx_career_fingerprint ON career_opportunities(fingerprint);
        """)
        
        # Migrations
        try:
            self.conn.execute("ALTER TABLE career_opportunities ADD COLUMN status TEXT DEFAULT 'active'")
        except sqlite3.OperationalError:
            pass
        try:
            self.conn.execute("ALTER TABLE career_opportunities ADD COLUMN expiredAt TEXT")
        except sqlite3.OperationalError:
            pass
        try:
            self.conn.execute("ALTER TABLE career_opportunities ADD COLUMN archivedAt TEXT")
        except sqlite3.OperationalError:
            pass

    # ── Opportunity UPSERT ───────────────────────────────────────────────────

    def upsert_opportunity(self, opp: dict) -> str:
        """Insert or update an opportunity. Returns 'new', 'updated', or 'skipped'."""
        try:
            # Validate required fields
            if not opp.get("title") or not opp.get("sourceUrl"):
                logger.warning(f"Skipping opportunity with missing title or sourceUrl: {opp.get('title', 'N/A')}")
                return "skipped"

            # Cross-source deduplication via fingerprint
            if opp.get("fingerprint"):
                existing = self.conn.execute(
                    "SELECT id, sources FROM career_opportunities WHERE fingerprint = ?",
                    (opp["fingerprint"],)
                ).fetchone()

                if existing:
                    sources = json.loads(existing["sources"] or "[]")
                    if opp["source"] not in sources:
                        sources.append(opp["source"])
                        self.conn.execute(
                            "UPDATE career_opportunities SET sources = ?, updatedAt = ? WHERE id = ?",
                            (json.dumps(sources), opp["scrapedAt"], existing["id"])
                        )
                        self.conn.commit()
                        logger.debug(f"Duplicate found by fingerprint, added source: {opp['source']}")
                    return "skipped"

            sql = """
                INSERT INTO career_opportunities (
                    id, type, title, company, organizer, description, shortDescription,
                    requirements, skills, tags, location, mode, isPanIndia,
                    eligibleBranches, eligibleYears, minCGPA, stipend, prize,
                    isFree, postedAt, deadline, startDate, duration,
                    source, sourceUrl, sources, fingerprint, applyUrl, scrapedAt, updatedAt,
                    isActive, isVerified, isFeatured, relevanceScore
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?
                ) ON CONFLICT(sourceUrl) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    shortDescription = excluded.shortDescription,
                    skills = excluded.skills,
                    tags = excluded.tags,
                    location = excluded.location,
                    mode = excluded.mode,
                    stipend = excluded.stipend,
                    prize = excluded.prize,
                    deadline = excluded.deadline,
                    updatedAt = excluded.updatedAt,
                    relevanceScore = excluded.relevanceScore
            """

            params = (
                opp["id"], opp["type"], opp["title"], opp.get("company"), opp.get("organizer"),
                opp.get("description"), opp.get("shortDescription"), opp.get("requirements"),
                json.dumps(opp.get("skills", [])), json.dumps(opp.get("tags", [])),
                opp.get("location"), opp.get("mode"), 1 if opp.get("isPanIndia") else 0,
                json.dumps(opp.get("eligibleBranches", [])), json.dumps(opp.get("eligibleYears", [])),
                opp.get("minCGPA"), opp.get("stipend"), opp.get("prize"),
                1 if opp.get("isFree", True) else 0,
                opp.get("postedAt"), opp.get("deadline"), opp.get("startDate"), opp.get("duration"),
                opp["source"], opp["sourceUrl"], json.dumps(opp.get("sources", [opp["source"]])),
                opp.get("fingerprint"), opp.get("applyUrl"),
                opp["scrapedAt"], opp.get("updatedAt") or opp["scrapedAt"],
                opp.get("relevanceScore", 0),
            )

            cursor = self.conn.execute(sql, params)
            self.conn.commit()

            # rowcount == 1 for insert, may be 1 or 2 for upsert depending on SQLite version
            # Check if it was a new insert by checking changes
            if cursor.rowcount > 0:
                # Check if the row already existed
                check = self.conn.execute(
                    "SELECT updatedAt, scrapedAt FROM career_opportunities WHERE sourceUrl = ?",
                    (opp["sourceUrl"],)
                ).fetchone()
                if check and check["scrapedAt"] == opp["scrapedAt"]:
                    return "new"
                return "updated"
            return "skipped"

        except sqlite3.IntegrityError:
            # URL conflict handled by ON CONFLICT, but catch edge cases
            self.conn.rollback()
            return "updated"
        except sqlite3.Error as e:
            logger.error(f"Error upserting opportunity '{opp.get('title', 'N/A')}': {e}")
            try:
                self.conn.rollback()
            except sqlite3.Error:
                pass
            return "skipped"

    # ── Scraper Runs ─────────────────────────────────────────────────────────

    def start_run(self, source: str) -> Optional[str]:
        run_id = f"run_{int(datetime.now().timestamp())}_{source}"
        now = datetime.now().isoformat()
        try:
            self.conn.execute(
                "INSERT INTO career_scraper_runs (id, source, startedAt, status) VALUES (?, ?, ?, 'running')",
                (run_id, source, now),
            )
            self.conn.commit()
            return run_id
        except sqlite3.Error as e:
            logger.error(f"Error starting run for {source}: {e}")
            return None

    def complete_run(
        self,
        run_id: str,
        status: str = "completed",
        counts: Optional[dict] = None,
        error: Optional[str] = None,
        duration_ms: Optional[int] = None,
    ) -> None:
        now = datetime.now().isoformat()
        final_counts = counts or {}
        final_error = error or ""
        try:
            self.conn.execute(
                """UPDATE career_scraper_runs SET
                   completedAt = ?, status = ?, newCount = ?, updatedCount = ?,
                   expiredCount = ?, errorMessage = ?, durationMs = ?
                   WHERE id = ?""",
                (
                    now, status,
                    final_counts.get("new", 0),
                    final_counts.get("updated", 0),
                    final_counts.get("expired", 0),
                    final_error,
                    duration_ms,
                    run_id,
                ),
            )
            self.conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Error completing run {run_id}: {e}")

    # ── Source Health / Circuit Breaker ───────────────────────────────────────

    def get_source_health(self, source: str) -> dict:
        try:
            cursor = self.conn.execute(
                "SELECT * FROM career_source_health WHERE source = ?", (source,)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
            return {"source": source, "consecutiveFails": 0, "isBlocked": 0}
        except sqlite3.Error:
            return {"source": source, "consecutiveFails": 0, "isBlocked": 0}

    def update_source_health(
        self, source: str, success: bool, notes: Optional[str] = None
    ) -> None:
        now = datetime.now().isoformat()
        final_notes = notes or ""
        try:
            if success:
                self.conn.execute(
                    """INSERT INTO career_source_health (source, lastSuccess, lastAttempt, consecutiveFails, isBlocked, notes)
                       VALUES (?, ?, ?, 0, 0, ?)
                       ON CONFLICT(source) DO UPDATE SET
                       lastSuccess = ?, lastAttempt = ?, consecutiveFails = 0, isBlocked = 0, notes = ?""",
                    (source, now, now, final_notes, now, now, final_notes),
                )
            else:
                self.conn.execute(
                    """INSERT INTO career_source_health (source, lastAttempt, consecutiveFails, notes)
                       VALUES (?, ?, 1, ?)
                       ON CONFLICT(source) DO UPDATE SET
                       lastAttempt = ?, consecutiveFails = consecutiveFails + 1, notes = ?""",
                    (source, now, final_notes, now, final_notes),
                )
                # Check for circuit breaker
                cursor = self.conn.execute(
                    "SELECT consecutiveFails FROM career_source_health WHERE source = ?",
                    (source,),
                )
                row = cursor.fetchone()
                if row and row["consecutiveFails"] >= 5:
                    self.conn.execute(
                        "UPDATE career_source_health SET isBlocked = 1 WHERE source = ?",
                        (source,),
                    )

            self.conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Error updating health for {source}: {e}")

    # ── Expiry Logic ─────────────────────────────────────────────────────────

    def expire_old_opportunities(self) -> int:
        """Mark stale opportunities as expired, and older expired ones as archived. Returns count of expired rows."""
        try:
            # 1. Expire based on deadline
            c1 = self.conn.execute("""
                UPDATE career_opportunities
                SET isActive = 0,
                    status = 'expired',
                    expiredAt = datetime('now')
                WHERE deadline < datetime('now')
                  AND deadline IS NOT NULL
                  AND (isActive = 1 OR status = 'active')
            """)
            # 2. Expire based on age if no deadline
            c2 = self.conn.execute("""
                UPDATE career_opportunities
                SET isActive = 0,
                    status = 'expired',
                    expiredAt = datetime('now')
                WHERE deadline IS NULL
                  AND postedAt < datetime('now', '-60 days')
                  AND (isActive = 1 OR status = 'active')
            """)
            # 3. Archive expired ones after 30 days
            c3 = self.conn.execute("""
                UPDATE career_opportunities
                SET status = 'archived',
                    archivedAt = datetime('now')
                WHERE status = 'expired'
                  AND expiredAt < datetime('now', '-30 days')
            """)
            self.conn.commit()
            total = c1.rowcount + c2.rowcount
            if total > 0 or c3.rowcount > 0:
                logger.info(f"Lifecycle: Expired {total} opportunities, Archived {c3.rowcount} opportunities")
            return total
        except sqlite3.Error as e:
            logger.error(f"Error expiring opportunities: {e}")
            return 0

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def close(self) -> None:
        try:
            self.conn.close()
        except sqlite3.Error:
            pass
