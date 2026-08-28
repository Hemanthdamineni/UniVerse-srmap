const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const SLOT_TIMES = [
  "09:00–09:50",
  "10:00–10:50",
  "11:00–11:50",
  "12:00–12:50",
  "13:00–13:50",
  "14:00–14:50",
  "15:00–15:50",
  "16:00–17:30",
];

function normalizeDay(day) {
  const key = String(day || "").trim().toLowerCase();
  return DAY_ORDER.find((candidate) => key.startsWith(candidate.slice(0, 3))) || null;
}

/** Extracts the room token from a period cell like "CSE401(C311) — Subject Name". */
function extractRoomToken(periodText) {
  const text = String(periodText || "").trim();
  if (!text) return null;
  const beforeDash = text.split("—")[0].trim();
  const match = beforeDash.match(/\(([^)]+)\)/);
  if (!match) return null;
  const room = match[1].trim().toUpperCase();
  if (!room || /^(TBA|NA|NIL)$/.test(room)) return null;
  return room;
}

/**
 * Resolves the day/period schedule from an ERP v2 page payload as delivered
 * to erpDataSink.onLivePageFetched. Live payloads embed the typed extractor
 * result under `_extracted` (see adaptToLegacyPayload); the top-level shape
 * stays supported for callers holding raw extractor output.
 */
function timetableScheduleFromPagePayload(payload) {
  const extractedSchedule = payload?._extracted?.schedule;
  if (Array.isArray(extractedSchedule)) return extractedSchedule;
  return Array.isArray(payload?.schedule) ? payload.schedule : null;
}

/**
 * Accumulates which rooms are occupied on which weekday/slot from every
 * live timetable fetch, then answers "which rooms are free right now".
 * Occupancy rows carry no user identity — only day/slot/room.
 */
class VacantRoomStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS room_occupancy (
        day TEXT NOT NULL,
        slot_index INTEGER NOT NULL,
        room TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (day, slot_index, room)
      )
    `);
  }

  /** Ingests one timetable extractor payload; returns number of occupancy rows written. */
  ingestTimetable(schedule, now = new Date()) {
    if (!Array.isArray(schedule)) return 0;
    const updatedAt = now.toISOString();
    let written = 0;

    const insert = this.db.prepare(
      `INSERT INTO room_occupancy (day, slot_index, room, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(day, slot_index, room) DO UPDATE SET updated_at = excluded.updated_at`
    );

    for (const dayRow of schedule) {
      const day = normalizeDay(dayRow?.day);
      if (!day || !Array.isArray(dayRow.periods)) continue;
      dayRow.periods.forEach((periodText, slotIndex) => {
        const room = extractRoomToken(periodText);
        if (!room || !SLOT_TIMES[slotIndex]) return;
        insert.run(day, slotIndex, room, updatedAt);
        written += 1;
      });
    }
    return written;
  }

  listRooms() {
    return this.db
      .prepare("SELECT DISTINCT room FROM room_occupancy ORDER BY room ASC")
      .all()
      .map((row) => row.room);
  }

  /**
   * Rooms free for the requested day (monday..friday) and slot index (0-based).
   * Unknown days/slots return an empty result rather than guessing.
   */
  vacantRooms({ day, slotIndex }) {
    const normalizedDay = normalizeDay(day);
    const index = Number.parseInt(String(slotIndex ?? ""), 10);
    if (!normalizedDay || Number.isNaN(index) || !SLOT_TIMES[index]) {
      return { ok: false, reason: "day must be monday-friday and slot 0-7" };
    }
    const occupied = new Set(
      this.db
        .prepare("SELECT room FROM room_occupancy WHERE day = ? AND slot_index = ?")
        .all(normalizedDay, index)
        .map((row) => row.room),
    );
    const vacant = this.listRooms().filter((room) => !occupied.has(room));
    return {
      ok: true,
      day: normalizedDay,
      slotIndex: index,
      timeWindow: SLOT_TIMES[index],
      vacant,
      occupiedCount: occupied.size,
      knownRooms: this.listRooms().length,
    };
  }

  close() {
    try {
      this.db.close();
    } catch {
      // already closed
    }
  }
}

module.exports = {
  VacantRoomStore,
  normalizeDay,
  extractRoomToken,
  timetableScheduleFromPagePayload,
  SLOT_TIMES,
  DAY_ORDER,
};
