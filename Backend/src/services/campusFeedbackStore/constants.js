const FEEDBACK_TYPES = {
  EVENTS: "events",
  HOSTEL_MESS: "hostel_mess",
  TRANSPORT: "transport",
};

const MODERATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const TYPE_LABELS = {
  [FEEDBACK_TYPES.EVENTS]: "Events Feedback",
  [FEEDBACK_TYPES.HOSTEL_MESS]: "Hostel & Mess Feedback",
  [FEEDBACK_TYPES.TRANSPORT]: "Transport Feedback",
};

const FIXED_OPTIONS = {
  [FEEDBACK_TYPES.HOSTEL_MESS]: [
    { id: "hostel-mess-services", label: "Hostel and mess services", active: true },
  ],
};

const SPAM_WINDOW_MS = 10 * 60 * 1000;

module.exports = {
  FEEDBACK_TYPES,
  MODERATION_STATUS,
  TYPE_LABELS,
  FIXED_OPTIONS,
  SPAM_WINDOW_MS,
};
