const TICKET_STATUS = {
  OPEN: "open",
  IN_PROGRESS: "in-progress",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
};

const QUEUE_STATE = {
  NEW: "new",
  IN_PROGRESS: "in-progress",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
  BREACHED: "breached",
};

const PRIORITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const SLA_HOURS_BY_PRIORITY = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 72,
};

const DEFAULT_PAGE_SIZE = 50;

const DEFAULT_ASSIGNEE_BY_CATEGORY = {
  "IT Support": "IT Help Desk",
  Academic: "Academic Affairs",
  Hostel: "Hostel Maintenance",
  Finance: "Finance Office",
  Transport: "Transport Office",
  Other: "General Help Desk",
};

module.exports = {
  TICKET_STATUS,
  QUEUE_STATE,
  PRIORITY_ORDER,
  SLA_HOURS_BY_PRIORITY,
  DEFAULT_PAGE_SIZE,
  DEFAULT_ASSIGNEE_BY_CATEGORY,
};
