const EVENT_STATES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

const EVENT_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private",
  DEPARTMENT_ONLY: "department-only",
  CREATOR_ONLY: "creator-only",
  REGISTERED: "registered",
};

const APPROVAL_STATUS = {
  NOT_REQUIRED: "not-required",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const REGISTRATION_STATUS = {
  REGISTERED: "registered",
  CANCELLED: "cancelled",
};

const STATE_FILE_NAMES = {
  events: "events.json",
  registrations: "registrations.json",
  notifications: "notifications.json",
  feedback: "feedback.json",
  gallery: "gallery.json",
  checkIns: "checkins.json",
};

const STATE_KEYS = Object.keys(STATE_FILE_NAMES);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCoOrganizers(value, creatorId = "") {
  const unique = new Set(
    ensureArray(value)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => item !== String(creatorId || "").trim())
  );
  return Array.from(unique);
}

function nowIso() {
  return new Date().toISOString();
}

function parseDate(dateValue, field) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`Invalid ${field}`);
    error.status = 400;
    throw error;
  }
  return date;
}

function toCsvRow(cells) {
  return cells
    .map((cell) => {
      const value = String(cell ?? "").replace(/"/g, '""');
      return `"${value}"`;
    })
    .join(",");
}

function normalizeRecurrence(recurrence) {
  if (!recurrence || recurrence.type === "none") {
    return { type: "none" };
  }

  const type = String(recurrence.type || "none").toLowerCase();
  const interval = Math.max(1, Number(recurrence.interval || 1));
  const count = Math.max(1, Math.min(52, Number(recurrence.count || 1)));
  if (!["weekly", "monthly"].includes(type)) {
    const error = new Error("Invalid recurrence type. Use weekly or monthly.");
    error.status = 400;
    throw error;
  }

  return { type, interval, count };
}

function cloneForRecurrence(base, recurrence, index) {
  const start = new Date(base.startAt);
  const end = new Date(base.endAt);

  if (recurrence.type === "weekly") {
    start.setDate(start.getDate() + recurrence.interval * 7 * index);
    end.setDate(end.getDate() + recurrence.interval * 7 * index);
  } else if (recurrence.type === "monthly") {
    start.setMonth(start.getMonth() + recurrence.interval * index);
    end.setMonth(end.getMonth() + recurrence.interval * index);
  }

  return {
    ...base,
    id: randomUUID(),
    parentEventId: base.id,
    recurrenceIndex: index,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

module.exports = {
  EVENT_STATES,
  EVENT_VISIBILITY,
  APPROVAL_STATUS,
  REGISTRATION_STATUS,
  STATE_FILE_NAMES,
  STATE_KEYS,
  ensureArray,
  normalizeCoOrganizers,
  nowIso,
  parseDate,
  toCsvRow,
  normalizeRecurrence,
  cloneForRecurrence,
};
