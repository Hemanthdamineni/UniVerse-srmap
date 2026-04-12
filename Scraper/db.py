import sqlite3
import json
import logging
from datetime import datetime
from config import DB_PATH

logger = logging.getLogger(__name__)

class CareerDB:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        self._ensure_connection()

    def _ensure_connection(self):
        # Just a sanity check
        try:
            self.conn.execute("SELECT 1")
        except sqlite3.Error:
            self.conn = sqlite3.connect(DB_PATH)
            self.conn.row_factory = sqlite3.Row

    def upsert_opportunity(self, opp: dict):
        try:
            # Cross-source deduplication via fingerprint
            if opp.get('fingerprint'):
                existing = self.conn.execute(
                    "SELECT id, sources FROM career_opportunities WHERE fingerprint = ?",
                    (opp['fingerprint'],)
                ).fetchone()
                
                if existing:
                    sources = json.loads(existing['sources'] or '[]')
                    if opp['source'] not in sources:
                        sources.append(opp['source'])
                        self.conn.execute(
                            "UPDATE career_opportunities SET sources = ?, updatedAt = ? WHERE id = ?",
                            (json.dumps(sources), opp['scrapedAt'], existing['id'])
                        )
                        self.conn.commit()
                        logger.info(f"Duplicate found by fingerprint, added source: {opp['source']}")
                    return True # Skip insert, already have it

            # skills, tags, eligibleBranches, eligibleYears, sources are stored as JSON strings
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
                opp['id'], opp['type'], opp['title'], opp.get('company'), opp.get('organizer'),
                opp.get('description'), opp.get('shortDescription'), opp.get('requirements'),
                json.dumps(opp.get('skills', [])), json.dumps(opp.get('tags', [])),
                opp.get('location'), opp.get('mode'), 1 if opp.get('isPanIndia') else 0,
                json.dumps(opp.get('eligibleBranches', [])), json.dumps(opp.get('eligibleYears', [])),
                opp.get('minCGPA'), opp.get('stipend'), opp.get('prize'),
                1 if opp.get('isFree', True) else 0,
                opp.get('postedAt'), opp.get('deadline'), opp.get('startDate'), opp.get('duration'),
                opp['source'], opp['sourceUrl'], json.dumps(opp.get('sources', [opp['source']])),
                opp.get('fingerprint'), opp.get('applyUrl'),
                opp['scrapedAt'], opp.get('updatedAt') or opp['scrapedAt'],
                opp.get('relevanceScore', 0)
            )
            
            self.conn.execute(sql, params)
            self.conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error(f"Error upserting opportunity: {e}")
            self.conn.rollback()
            return False

    def start_run(self, source: str):
        run_id = f"run_{int(datetime.now().timestamp())}_{source}"
        now = datetime.now().isoformat()
        try:
            self.conn.execute(
                "INSERT INTO career_scraper_runs (id, source, startedAt, status) VALUES (?, ?, ?, 'running')",
                (run_id, source, now)
            )
            self.conn.commit()
            return run_id
        except sqlite3.Error as e:
            logger.error(f"Error starting run: {e}")
            return None

    def complete_run(self, run_id: str, status: str = "completed", counts: dict = None, error: str = None):
        now = datetime.now().isoformat()
        final_counts = counts if counts is not None else {}
        final_error = error if error is not None else ""
        try:
            self.conn.execute(
                """UPDATE career_scraper_runs SET 
                   completedAt = ?, status = ?, newCount = ?, updatedCount = ?, 
                   expiredCount = ?, errorMessage = ? 
                   WHERE id = ?""",
                (now, status, final_counts.get('new', 0), final_counts.get('updated', 0), 
                 final_counts.get('expired', 0), final_error, run_id)
            )
            self.conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Error completing run: {e}")

    def get_source_health(self, source: str):
        try:
            cursor = self.conn.execute("SELECT * FROM career_source_health WHERE source = ?", (source,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return {"source": source, "consecutiveFails": 0, "isBlocked": 0}
        except sqlite3.Error:
            return {"source": source, "consecutiveFails": 0, "isBlocked": 0}

    def update_source_health(self, source: str, success: bool, notes: str = None):
        now = datetime.now().isoformat()
        final_notes = notes if notes is not None else ""
        try:
            if success:
                self.conn.execute(
                    """INSERT INTO career_source_health (source, lastSuccess, lastAttempt, consecutiveFails, isBlocked, notes)
                       VALUES (?, ?, ?, 0, 0, ?)
                       ON CONFLICT(source) DO UPDATE SET 
                       lastSuccess = ?, lastAttempt = ?, consecutiveFails = 0, isBlocked = 0, notes = ?""",
                    (source, now, now, final_notes, now, now, final_notes)
                )
            else:
                self.conn.execute(
                    """INSERT INTO career_source_health (source, lastAttempt, consecutiveFails, notes)
                       VALUES (?, ?, 1, ?)
                       ON CONFLICT(source) DO UPDATE SET 
                       lastAttempt = ?, consecutiveFails = consecutiveFails + 1, notes = ?""",
                    (source, now, final_notes, now, final_notes)
                )
                # Check for circuit breaker
                cursor = self.conn.execute("SELECT consecutiveFails FROM career_source_health WHERE source = ?", (source,))
                row = cursor.fetchone()
                if row and row['consecutiveFails'] >= 5:
                    self.conn.execute("UPDATE career_source_health SET isBlocked = 1 WHERE source = ?", (source,))
            
            self.conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Error updating health: {e}")

    def expire_old_opportunities(self):
        try:
            # Past deadline
            self.conn.execute("""
                UPDATE career_opportunities
                SET isActive = 0
                WHERE deadline < datetime('now')
                  AND deadline IS NOT NULL
                  AND isActive = 1
            """)
            # No deadline + older than 60 days
            self.conn.execute("""
                UPDATE career_opportunities
                SET isActive = 0
                WHERE deadline IS NULL
                  AND postedAt < datetime('now', '-60 days')
                  AND isActive = 1
            """)
            self.conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Error expiring opportunities: {e}")

    def close(self):
        self.conn.close()
