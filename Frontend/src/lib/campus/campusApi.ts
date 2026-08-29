import { requestData, requestMultipart } from "../core/apiClient";
import { isStaticPrototype } from "../core/prototype";
import { isPrototypeEventRegistered, setPrototypeEventRegistration } from "../events/prototypeEventState";

export type EventSummary = {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  startDate: string;
  endDate: string;
  category: string;
  department: string;
  type?: string;
  status: string;
  approvalStatus?: string;
  visibility: string;
  createdByUserId?: string;
  createdBy?: string;
  venue?: string;
  location?: string | { physical?: string; virtual?: string; mapUrl?: string };
  registeredCount?: number;
  registrationCount?: number;
  seatsAvailable?: number;
  maxCapacity?: number | null;
  registrationDeadline?: string;
  prizes?: string | null;
  eligibility?: string | null;
  isCompetition?: boolean;
  competitionConfig?: CompetitionConfig | null;
  posterImagePath?: string | null;
  tags?: string[];
  featured?: boolean;
  myRegistration?: unknown;
};

export type EventDetail = EventSummary & {
  rules?: string | null;
  faq?: Array<{ question: string; answer: string }> | null;
  registrations?: Array<Record<string, unknown>>;
  feedback?: Array<Record<string, unknown>>;
  gallery?: Array<Record<string, unknown>>;
  checkIns?: Array<Record<string, unknown>>;
  calendar?: { googleUrl?: string; outlookUrl?: string; icalUrl?: string };
  coOrganizers?: string[];
};

export type CompetitionRound = {
  roundId: string;
  title: string;
  startTime?: string;
  submissionDeadline?: string;
  instructions?: string;
  submissionTypes?: string[];
  maxResubmissions?: number;
  requiresShortlistFromRound?: string | null;
  evaluationCriteria?: Array<{ label: string; maxScore: number }>;
  resultsPublished?: boolean;
};

export type CompetitionConfig = {
  isCompetition: boolean;
  submissionScope?: "individual" | "team";
  rounds: CompetitionRound[];
  maxTeamSize?: number;
};

export type CompetitionSubmission = {
  id: string;
  eventId: string;
  roundId: string;
  submittedBy: string;
  type: "file" | "link";
  filePath?: string | null;
  linkUrl?: string | null;
  description?: string;
  submittedAt: string;
  resubmissionCount: number;
  criteriaScores?: Record<string, number>;
  totalScore?: number | null;
  remarks?: string | null;
  evaluatedBy?: string | null;
  evaluatedAt?: string | null;
  decision?: string | null;
  shortlisted?: boolean;
  flagged?: boolean;
  flagReason?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  teamLeaderId?: string | null;
  teamMembers?: string[];
  memberCount?: number;
  evaluations?: Array<{
    evaluatorId: string;
    totalScore: number;
    updatedAt: string;
    criteriaScores: Record<string, number>;
    remarks?: string;
    decision?: string;
  }>;
};

export type LeaderboardRow = CompetitionSubmission & { rank: number };

export type Team = {
  id: string;
  eventId: string;
  name: string;
  leaderId: string;
  members: string[];
  createdAt: string;
};

export type TeamInvitation = {
  id: string;
  teamId: string;
  teamName: string;
  eventId: string;
  invitedBy: string;
  inviteeRegisterNumber: string;
  status: string;
  createdAt: string;
};

export type CampusTicket = {
  id: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  assignedTo: string;
  assignedTeam?: string;
  ownerUserId?: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
  resolutionSummary?: string;
  replyCount?: number;
  slaBreached?: boolean;
  queueState?: string;
  sla?: {
    policyHours: number;
    dueAt: string;
    breachedAt?: string;
  };
  replies?: Array<{
    id: string;
    message: string;
    visibility: string;
    authorName: string;
    authorRole: string;
    createdAt: string;
  }>;
  statusHistory?: Array<{
    id: string;
    status: string;
    note: string;
    actorName: string;
    actorRole: string;
    createdAt: string;
  }>;
  auditTrail?: Array<{
    id: string;
    action: string;
    fromStatus: string;
    toStatus: string;
    note: string;
    actorName: string;
    actorRole: string;
    createdAt: string;
  }>;
};

export type CampusFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags?: string[];
  visible?: boolean;
};

const STATIC_HELPDESK_TICKETS: CampusTicket[] = [
  {
    id: "HD-STATIC-001",
    category: "IT Support",
    priority: "urgent",
    subject: "ERP login blocked",
    description: "The student portal fails after OTP and blocks attendance access.",
    status: "open",
    queueState: "breached",
    assignedTo: "Asha Rao",
    assignedTeam: "IT Support",
    ownerName: "Asha Rao",
    createdAt: "2026-05-25T03:00:00.000Z",
    updatedAt: "2026-05-26T03:00:00.000Z",
    resolutionSummary: "",
    replyCount: 0,
    slaBreached: true,
    sla: {
      policyHours: 4,
      dueAt: "2026-05-25T07:00:00.000Z",
      breachedAt: "2026-05-25T07:00:00.000Z",
    },
    replies: [],
    statusHistory: [
      {
        id: "hist-static-1",
        status: "open",
        note: "Ticket created and routed to IT Support",
        actorName: "Student One",
        actorRole: "student",
        createdAt: "2026-05-25T03:00:00.000Z",
      },
    ],
    auditTrail: [
      {
        id: "audit-static-1",
        action: "created",
        fromStatus: "",
        toStatus: "open",
        note: "Ticket created and routed to IT Support",
        actorName: "Student One",
        actorRole: "student",
        createdAt: "2026-05-25T03:00:00.000Z",
      },
    ],
  },
];

const STATIC_EVENTS: EventSummary[] = [
  {
    id: "evt-static-ai-summit",
    title: "AI Builders Summit",
    description: "A student-led showcase with project demos, mentor sessions, and team formation.",
    startAt: "2026-08-05T09:30:00.000Z",
    endAt: "2026-08-05T16:30:00.000Z",
    startDate: "2026-08-05",
    endDate: "2026-08-05",
    category: "Technical",
    department: "CS Department",
    status: "published",
    approvalStatus: "approved",
    visibility: "public",
    venue: "APJ Abdul Kalam Auditorium",
    location: "APJ Abdul Kalam Auditorium",
    registeredCount: 186,
    registrationCount: 186,
    seatsAvailable: 64,
    maxCapacity: 250,
    registrationDeadline: "2026-08-03T18:00:00.000Z",
    prizes: "Certificates",
    eligibility: "Open to all SRM AP students",
    isCompetition: false,
    tags: ["ai", "projects", "networking"],
    featured: true,
  },
  {
    id: "evt-static-hack-night",
    title: "Campus Hack Night",
    description: "Build a prototype in teams and submit by midnight.",
    startAt: "2026-08-12T12:30:00.000Z",
    endAt: "2026-08-13T00:30:00.000Z",
    startDate: "2026-08-12",
    endDate: "2026-08-13",
    category: "Workshop",
    department: "Student Union",
    status: "published",
    approvalStatus: "approved",
    visibility: "public",
    venue: "Innovation Lab",
    location: "Innovation Lab",
    registeredCount: 92,
    registrationCount: 92,
    seatsAvailable: 28,
    maxCapacity: 120,
    registrationDeadline: "2026-08-10T18:00:00.000Z",
    prizes: "₹25,000 prize pool",
    eligibility: "Teams of 2–4 students",
    isCompetition: true,
    competitionConfig: {
      isCompetition: true,
      submissionScope: "team",
      maxTeamSize: 4,
      rounds: [],
    },
    tags: ["hackathon", "prototype"],
  },
  {
    id: "evt-static-cultural-evening",
    title: "Cultural Evening Auditions",
    description: "Auditions for music, dance, theatre, and anchoring slots.",
    startAt: "2026-08-18T10:00:00.000Z",
    endAt: "2026-08-18T15:00:00.000Z",
    startDate: "2026-08-18",
    endDate: "2026-08-18",
    category: "Cultural",
    department: "Arts School",
    status: "published",
    approvalStatus: "approved",
    visibility: "public",
    venue: "Open Air Theatre",
    location: "Open Air Theatre",
    registeredCount: 74,
    registrationCount: 74,
    seatsAvailable: 46,
    maxCapacity: 120,
    registrationDeadline: "2026-08-16T18:00:00.000Z",
    prizes: "Performance slots",
    eligibility: "Individual and group entries",
    tags: ["culture", "auditions"],
  },
];

function getStaticEventDetail(eventId: string): EventDetail {
  const event = STATIC_EVENTS.find((item) => item.id === eventId);
  if (!event) {
    throw new Error("This event is not available in the static prototype.");
  }

  const registered = isPrototypeEventRegistered(eventId);
  return {
    ...event,
    rules: "Bring a valid SRM AP ID, follow the organizer's schedule, and submit original work where required.",
    faq: [
      { question: "Who can register?", answer: event.eligibility || "SRM AP students who meet the listed eligibility." },
      { question: "Where is the event held?", answer: typeof event.location === "string" ? event.location : event.venue || "The listed campus venue." },
    ],
    myRegistration: registered ? { registeredAt: new Date().toISOString(), status: "registered" } : undefined,
  };
}

function getStaticCompetitionConfig(eventId: string): CompetitionConfig {
  const event = STATIC_EVENTS.find((item) => item.id === eventId);
  if (!event?.isCompetition) return { isCompetition: false, rounds: [] };

  return {
    isCompetition: true,
    submissionScope: "team",
    maxTeamSize: 4,
    rounds: [
      {
        roundId: "round-prototype-build",
        title: "Prototype submission",
        startTime: "2026-08-12T12:30:00.000Z",
        submissionDeadline: "2026-08-13T00:00:00.000Z",
        instructions: "Build with your team and submit a working prototype before midnight.",
        submissionTypes: ["link", "file"],
        maxResubmissions: 2,
        evaluationCriteria: [
          { label: "Problem fit", maxScore: 30 },
          { label: "Execution", maxScore: 40 },
          { label: "Presentation", maxScore: 30 },
        ],
        resultsPublished: false,
      },
    ],
  };
}

function buildStaticHelpdeskList(filters?: Record<string, string>) {
  let items = [...STATIC_HELPDESK_TICKETS];
  if (filters?.queue) items = items.filter((ticket) => ticket.queueState === filters.queue);
  if (filters?.status) items = items.filter((ticket) => ticket.status === filters.status);
  if (filters?.query) {
    const query = filters.query.toLowerCase();
    items = items.filter((ticket) =>
      [ticket.subject, ticket.description, ticket.category, ticket.assignedTo, ticket.assignedTeam]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }
  const queues = STATIC_HELPDESK_TICKETS.reduce<Record<string, number>>((acc, ticket) => {
    const queue = ticket.queueState || "new";
    acc[queue] = (acc[queue] || 0) + 1;
    return acc;
  }, {});
  return {
    items,
    counts: {
      total: STATIC_HELPDESK_TICKETS.length,
      filtered: items.length,
      open: STATIC_HELPDESK_TICKETS.filter((ticket) => ticket.status === "open").length,
      inProgress: STATIC_HELPDESK_TICKETS.filter((ticket) => ticket.status === "in-progress").length,
      escalated: STATIC_HELPDESK_TICKETS.filter((ticket) => ticket.status === "escalated").length,
      resolved: STATIC_HELPDESK_TICKETS.filter((ticket) => ticket.status === "resolved").length,
      slaBreached: STATIC_HELPDESK_TICKETS.filter((ticket) => ticket.slaBreached).length,
      queues,
    },
    pagination: { limit: 50, offset: 0, total: items.length },
    workload: [{ assignedTeam: "IT Support", ownerName: "Asha Rao", open: 1, breached: 1, total: 1 }],
  };
}

function normalizeEventList(payload: EventSummary[] | { events?: EventSummary[] }) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.events)) return payload.events;
  return [];
}

export async function listEvents(query?: Record<string, string>, headers?: HeadersInit) {
  if (isStaticPrototype()) {
    let items = [...STATIC_EVENTS];
    if (query?.status) items = items.filter((event) => event.status === query.status);
    if (query?.type === "upcoming") {
      const now = Date.now();
      items = items.filter((event) => new Date(event.startAt || event.startDate).getTime() >= now);
    }
    if (query?.registered === "true") {
      items = items.filter((event) => isPrototypeEventRegistered(event.id));
    }
    return items;
  }
  const params = new URLSearchParams(query || {});
  const payload = await requestData<EventSummary[] | { events?: EventSummary[] }>(`/api/events${params.toString() ? `?${params.toString()}` : ""}`, {
    headers,
  });
  return normalizeEventList(payload);
}

export async function getEvent(eventId: string, headers?: HeadersInit) {
  if (isStaticPrototype()) return getStaticEventDetail(eventId);
  return requestData<EventDetail>(`/api/events/${encodeURIComponent(eventId)}`, {
    headers,
  });
}

export async function createEvent(payload: Record<string, unknown>, headers?: HeadersInit) {
  return requestData<EventSummary[] | EventSummary>("/api/events", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function deleteEvent(eventId: string, headers?: HeadersInit) {
  return requestData<{ deleted: boolean }>(`/api/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers,
  });
}

export async function registerForEvent(eventId: string) {
  if (isStaticPrototype()) {
    getStaticEventDetail(eventId);
    setPrototypeEventRegistration(eventId, true);
    return { registered: true };
  }
  return requestData<Record<string, unknown>>(`/api/events/${encodeURIComponent(eventId)}/register`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function cancelEventRegistration(eventId: string) {
  if (isStaticPrototype()) {
    getStaticEventDetail(eventId);
    setPrototypeEventRegistration(eventId, false);
    return { cancelled: true };
  }
  return requestData<Record<string, unknown>>(
    `/api/events/${encodeURIComponent(eventId)}/cancel-registration`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function getCompetitionConfig(eventId: string) {
  if (isStaticPrototype()) return getStaticCompetitionConfig(eventId);
  return requestData<CompetitionConfig>(`/api/competitions/${encodeURIComponent(eventId)}/config`);
}

export async function submitCompetitionWork(
  eventId: string,
  roundId: string,
  payload: { type: "file" | "link"; file?: File | null; linkUrl?: string; description?: string }
) {
  const formData = new FormData();
  formData.set("type", payload.type);
  if (payload.description) formData.set("description", payload.description);
  if (payload.type === "file" && payload.file) {
    formData.set("file", payload.file);
  }
  if (payload.type === "link" && payload.linkUrl) {
    formData.set("linkUrl", payload.linkUrl);
  }
  return requestMultipart<CompetitionSubmission>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submit`,
    formData
  );
}

export async function getMyCompetitionSubmission(eventId: string, roundId: string) {
  return requestData<CompetitionSubmission | null>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/my-submission`
  );
}

export async function getMyCompetitionResult(eventId: string, roundId: string) {
  return requestData<CompetitionSubmission | null>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/my-result`
  );
}

export async function getCompetitionSubmissions(eventId: string, roundId: string) {
  return requestData<CompetitionSubmission[]>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submissions`
  );
}

export async function getSubmissionEvaluations(eventId: string, roundId: string, submissionId: string) {
  return requestData<{
    submission: CompetitionSubmission;
    evaluations: Array<{
      evaluatorId: string;
      totalScore: number;
      updatedAt: string;
      criteriaScores: Record<string, number>;
      remarks?: string;
      decision?: string;
    }>;
  }>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(submissionId)}/evaluations`
  );
}

export async function evaluateCompetitionSubmission(
  eventId: string,
  roundId: string,
  submissionId: string,
  payload: { criteriaScores: Record<string, number>; remarks?: string; decision?: string }
) {
  return requestData<CompetitionSubmission>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(submissionId)}/evaluate`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function flagCompetitionSubmission(
  eventId: string,
  roundId: string,
  submissionId: string,
  payload: { flagged: boolean; flagReason?: string }
) {
  return requestData<CompetitionSubmission>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/submissions/${encodeURIComponent(submissionId)}/flag`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function applyCompetitionShortlist(
  eventId: string,
  roundId: string,
  payload: { mode: "topN" | "threshold"; value: number }
) {
  return requestData<{ shortlistedCount: number; evaluatedCount: number }>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/shortlist`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function publishCompetitionResults(eventId: string, roundId: string) {
  return requestData<{ published: boolean }>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/publish`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function getCompetitionLeaderboard(eventId: string, roundId: string) {
  return requestData<LeaderboardRow[]>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/leaderboard`
  );
}

export async function getCompetitionAnalytics(eventId: string) {
  return requestData<{
    registrations: number;
    rounds: Array<{
      roundId: string;
      title: string;
      submissions: number;
      submissionRate: number;
      evaluationCompletion: number;
      averageTimeToEvaluateMs: number | null;
    }>;
  }>(`/api/competitions/${encodeURIComponent(eventId)}/analytics`);
}

export async function getMyRoundCertificate(eventId: string, roundId: string) {
  return requestData<{ fileName: string; filePath: string; url?: string }>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/certificates/me`
  );
}

export async function generateRoundCertificates(eventId: string, roundId: string) {
  return requestData<{ generatedCount: number; certificates: Array<{ fileName: string; filePath: string }> }>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/certificates/generate`,
    {
      method: "POST",
    }
  );
}

export async function updateEventCoOrganizers(eventId: string, coOrganizers: string[]) {
  return requestData<EventSummary>(`/api/events/${encodeURIComponent(eventId)}/co-organizers`, {
    method: "PUT",
    body: JSON.stringify({ coOrganizers }),
  });
}

export async function sendCompetitionAnnouncement(
  eventId: string,
  payload: { subject: string; message: string }
) {
  return requestData<{ sentCount: number }>(
    `/api/competitions/${encodeURIComponent(eventId)}/announce`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function createTeam(eventId: string, payload: { name: string }) {
  return requestData<Team>(`/api/competitions/${encodeURIComponent(eventId)}/teams`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMyTeam(eventId: string) {
  return requestData<Team | null>(`/api/competitions/${encodeURIComponent(eventId)}/teams/my-team`);
}

export async function listHelpdeskTickets(filters?: Record<string, string>, headers?: HeadersInit) {
  if (isStaticPrototype()) return buildStaticHelpdeskList(filters);
  const params = new URLSearchParams(filters || {});
  return requestData<{
    items: CampusTicket[];
    counts: {
      total: number;
      filtered?: number;
      open: number;
      inProgress: number;
      escalated: number;
      resolved: number;
      slaBreached: number;
      queues?: Record<string, number>;
    };
    pagination?: { limit: number; offset: number; total: number };
    workload?: Array<{
      assignedTeam: string;
      ownerName: string;
      open: number;
      breached: number;
      total: number;
    }>;
  }>(`/api/helpdesk/tickets${params.toString() ? `?${params.toString()}` : ""}`, {
    headers,
  });
}

export async function createHelpdeskTicket(payload: Record<string, unknown>) {
  if (isStaticPrototype()) {
    const now = new Date().toISOString();
    const ticket: CampusTicket = {
      id: `HD-STATIC-${STATIC_HELPDESK_TICKETS.length + 1}`,
      category: String(payload.category || "Other"),
      priority: String(payload.priority || "medium"),
      subject: String(payload.subject || "Helpdesk ticket"),
      description: String(payload.description || ""),
      status: "open",
      queueState: "new",
      assignedTo: "General Help Desk",
      assignedTeam: "General Help Desk",
      ownerName: "General Help Desk",
      createdAt: now,
      updatedAt: now,
      slaBreached: false,
      sla: { policyHours: 48, dueAt: new Date(Date.now() + 48 * 36e5).toISOString() },
      replies: [],
      statusHistory: [],
      auditTrail: [],
    };
    STATIC_HELPDESK_TICKETS.unshift(ticket);
    return ticket;
  }
  return requestData<CampusTicket>("/api/helpdesk/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHelpdeskTicket(
  ticketId: string,
  payload: Record<string, unknown>,
  headers?: HeadersInit
) {
  if (isStaticPrototype()) {
    const ticket = STATIC_HELPDESK_TICKETS.find((item) => item.id === ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (payload.status) ticket.status = String(payload.status);
    if (payload.status === "resolved") ticket.queueState = "resolved";
    if (payload.assignedTo) ticket.assignedTo = String(payload.assignedTo);
    if (payload.assignedTeam) ticket.assignedTeam = String(payload.assignedTeam);
    if (payload.ownerName) ticket.ownerName = String(payload.ownerName);
    if (payload.resolutionSummary) ticket.resolutionSummary = String(payload.resolutionSummary);
    ticket.updatedAt = new Date().toISOString();
    ticket.auditTrail = [
      {
        id: `audit-${Date.now()}`,
        action: payload.status ? "status_changed" : "ticket_updated",
        fromStatus: "",
        toStatus: String(payload.status || ""),
        note: String(payload.note || "Static update"),
        actorName: "Admin User",
        actorRole: "admin",
        createdAt: ticket.updatedAt,
      },
      ...(ticket.auditTrail || []),
    ];
    return ticket;
  }
  return requestData<CampusTicket>(`/api/helpdesk/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function bulkUpdateHelpdeskTickets(payload: Record<string, unknown>, headers?: HeadersInit) {
  if (isStaticPrototype()) {
    const ticketIds = Array.isArray(payload.ticketIds) ? payload.ticketIds.map(String) : [];
    const updated = [];
    for (const ticketId of ticketIds) {
      updated.push(await updateHelpdeskTicket(ticketId, payload));
    }
    return { updated, failures: [], counts: { requested: ticketIds.length, updated: updated.length, failed: 0 } };
  }
  return requestData<{
    updated: CampusTicket[];
    failures: Array<{ ticketId: string; message: string; status: number }>;
    counts: { requested: number; updated: number; failed: number };
  }>("/api/helpdesk/tickets/bulk", {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function escalateHelpdeskTicket(ticketId: string, reason?: string) {
  if (isStaticPrototype()) {
    return updateHelpdeskTicket(ticketId, { status: "escalated", note: reason || "Escalated by requester" });
  }
  return requestData<CampusTicket>(`/api/helpdesk/tickets/${encodeURIComponent(ticketId)}/escalate`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function replyToHelpdeskTicket(
  ticketId: string,
  payload: { message: string; visibility?: string },
  headers?: HeadersInit
) {
  if (isStaticPrototype()) {
    const ticket = STATIC_HELPDESK_TICKETS.find((item) => item.id === ticketId);
    if (!ticket) throw new Error("Ticket not found");
    const reply = {
      id: `reply-${Date.now()}`,
      message: payload.message,
      visibility: payload.visibility || "public",
      authorName: payload.visibility === "internal" ? "Admin User" : "Student One",
      authorRole: payload.visibility === "internal" ? "admin" : "student",
      createdAt: new Date().toISOString(),
    };
    ticket.replies = [reply, ...(ticket.replies || [])];
    ticket.replyCount = ticket.replies.length;
    ticket.updatedAt = reply.createdAt;
    return ticket;
  }
  return requestData<CampusTicket>(`/api/helpdesk/tickets/${encodeURIComponent(ticketId)}/replies`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function listHelpdeskFaqs(filters?: Record<string, string>, headers?: HeadersInit) {
  const params = new URLSearchParams(filters || {});
  return requestData<{ items: CampusFaq[] }>(`/api/helpdesk/faqs${params.toString() ? `?${params.toString()}` : ""}`, {
    headers,
  });
}

export async function createHelpdeskFaq(payload: Record<string, unknown>, headers?: HeadersInit) {
  return requestData<CampusFaq>("/api/helpdesk/faqs", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function updateHelpdeskFaq(
  faqId: string,
  payload: Record<string, unknown>,
  headers?: HeadersInit
) {
  return requestData<CampusFaq>(`/api/helpdesk/faqs/${encodeURIComponent(faqId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function deleteHelpdeskFaq(faqId: string, headers?: HeadersInit) {
  return requestData<{ deleted: boolean }>(`/api/helpdesk/faqs/${encodeURIComponent(faqId)}`, {
    method: "DELETE",
    headers,
  });
}

// ── campusFeedbackApi ──────────────────────────────────────────

export type CampusFeedbackType = "events" | "hostel_mess" | "transport";
export type CampusFeedbackStatus = "pending" | "approved" | "rejected";

export type CampusFeedbackOption = {
  id: string;
  type?: CampusFeedbackType;
  label: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CampusFeedbackEntry = {
  id: string;
  type: CampusFeedbackType;
  typeLabel: string;
  targetId: string;
  targetLabel: string;
  ratings: Record<string, number>;
  comment: string;
  status: CampusFeedbackStatus;
  displayMode: "anonymous" | "named";
  moderationReason?: string;
  moderatedByName?: string;
  moderatedAt?: string;
  createdAt: string;
  updatedAt: string;
  governance?: {
    owner: string;
    routeNamespace: string;
    retentionPolicy: string;
  };
  createdBy?: {
    userId: string;
    name: string;
    email: string;
    department: string;
    displayName: string;
  };
  audit?: Array<{
    id: string;
    action: string;
    fromStatus: string;
    toStatus: string;
    reason: string;
    actorName: string;
    actorRole: string;
    createdAt: string;
  }>;
};

export type CampusFeedbackGovernance = {
  label: string;
  owner: string;
  routeNamespace: string;
  statuses?: CampusFeedbackStatus[];
  retentionPolicy?: string;
  editableThroughCampusModeration?: boolean;
};

export type CampusFeedbackGovernanceResponse = {
  official: CampusFeedbackGovernance;
  campus: CampusFeedbackGovernance;
};

export type CampusFeedbackListResponse = {
  items: CampusFeedbackEntry[];
  governance: CampusFeedbackGovernance;
  counts?: Record<string, number>;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
  };
};

const STATIC_OPTIONS: Record<CampusFeedbackType, CampusFeedbackOption[]> = {
  events: [{ id: "demo-event", type: "events", label: "Campus Tech Showcase", active: true }],
  hostel_mess: [
    { id: "hostel-mess-services", type: "hostel_mess", label: "Hostel and mess services", active: true },
  ],
  transport: [{ id: "demo-route", type: "transport", label: "Route 1, Campus to City Center", active: true }],
};

const STATIC_ENTRIES: CampusFeedbackEntry[] = [];

export function normalizeCampusFeedbackType(type: CampusFeedbackType) {
  return type.replace(/_/g, "-");
}

export async function getCampusFeedbackGovernance(): Promise<CampusFeedbackGovernanceResponse> {
  if (isStaticPrototype()) {
    return {
      official: {
        label: "Official ERP feedback",
        owner: "University ERP workflow",
        routeNamespace: "/api/feedback/end-semester",
        editableThroughCampusModeration: false,
      },
      campus: {
        label: "Campus feedback",
        owner: "Campus community feedback with admin moderation",
        routeNamespace: "/api/campus-feedback",
        retentionPolicy:
          "Entries retain internal actor identity for abuse prevention while student-facing display can stay anonymous.",
      },
    };
  }
  return requestData<CampusFeedbackGovernanceResponse>("/api/campus-feedback/governance");
}

export async function getCampusFeedbackOptions(type: CampusFeedbackType): Promise<CampusFeedbackOption[]> {
  if (isStaticPrototype()) return STATIC_OPTIONS[type] || [];
  const data = await requestData<{ items: CampusFeedbackOption[] }>(
    `/api/campus-feedback/${normalizeCampusFeedbackType(type)}/options`
  );
  return data.items;
}

export async function createCampusFeedbackOption(
  type: CampusFeedbackType,
  label: string,
  headers?: HeadersInit
): Promise<CampusFeedbackOption> {
  if (isStaticPrototype()) {
    const option = {
      id: `static-${type}-${Date.now()}`,
      type,
      label,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    STATIC_OPTIONS[type] = [...(STATIC_OPTIONS[type] || []), option];
    return option;
  }
  return requestData<CampusFeedbackOption>(`/api/campus-feedback/${normalizeCampusFeedbackType(type)}/options`, {
    method: "POST",
    headers,
    body: JSON.stringify({ label }),
  });
}

export async function submitCampusFeedback(
  type: CampusFeedbackType,
  payload: {
    targetId?: string;
    targetLabel?: string;
    ratings: Record<string, number>;
    comment?: string;
    displayMode?: "anonymous" | "named";
  }
): Promise<CampusFeedbackEntry> {
  if (isStaticPrototype()) {
    const now = new Date().toISOString();
    const option = STATIC_OPTIONS[type]?.find((item) => item.id === payload.targetId);
    const entry: CampusFeedbackEntry = {
      id: `static-feedback-${Date.now()}`,
      type,
      typeLabel:
        type === "hostel_mess" ? "Hostel & Mess Feedback" : type === "transport" ? "Transport Feedback" : "Events Feedback",
      targetId: payload.targetId || "",
      targetLabel: payload.targetLabel || option?.label || "Campus feedback target",
      ratings: payload.ratings,
      comment: payload.comment || "",
      status: "pending",
      displayMode: payload.displayMode || "anonymous",
      createdAt: now,
      updatedAt: now,
    };
    STATIC_ENTRIES.unshift(entry);
    return entry;
  }
  return requestData<CampusFeedbackEntry>(`/api/campus-feedback/${normalizeCampusFeedbackType(type)}/submissions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function importLegacyCampusFeedback(
  type: CampusFeedbackType,
  entries: Array<{
    targetId?: string;
    targetLabel: string;
    ratings: Record<string, number>;
    comment?: string;
    submittedAt?: string;
    displayMode?: "anonymous" | "named";
  }>
): Promise<{ imported: CampusFeedbackEntry[]; skipped: Array<{ reason: string }>; counts: { imported: number; skipped: number } }> {
  if (isStaticPrototype()) {
    const imported = await Promise.all(entries.map((entry) => submitCampusFeedback(type, entry)));
    return { imported, skipped: [], counts: { imported: imported.length, skipped: 0 } };
  }
  return requestData<{
    imported: CampusFeedbackEntry[];
    skipped: Array<{ reason: string }>;
    counts: { imported: number; skipped: number };
  }>(`/api/campus-feedback/${normalizeCampusFeedbackType(type)}/legacy-import`, {
    method: "POST",
    body: JSON.stringify({ entries }),
  });
}

export async function getMyCampusFeedback(type?: CampusFeedbackType): Promise<CampusFeedbackListResponse> {
  if (isStaticPrototype()) {
    return {
      items: type ? STATIC_ENTRIES.filter((entry) => entry.type === type) : STATIC_ENTRIES,
      governance: {
        label: "Campus feedback",
        owner: "Campus community feedback with admin moderation",
        routeNamespace: "/api/campus-feedback",
      },
    };
  }
  const query = type ? `?type=${encodeURIComponent(normalizeCampusFeedbackType(type))}` : "";
  return requestData<CampusFeedbackListResponse>(`/api/campus-feedback/me/submissions${query}`);
}

export async function getAdminCampusFeedback(
  filters: {
    type?: CampusFeedbackType | "";
    status?: CampusFeedbackStatus | "";
    limit?: number;
    offset?: number;
  } = {},
  headers?: HeadersInit
): Promise<CampusFeedbackListResponse> {
  if (isStaticPrototype()) {
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const filteredItems = STATIC_ENTRIES.filter((entry) => (filters.type ? entry.type === filters.type : true)).filter(
      (entry) => (filters.status ? entry.status === filters.status : true)
    );
    const items = filteredItems.slice(offset, offset + limit);
    return {
      items,
      counts: {
        total: STATIC_ENTRIES.length,
        pending: STATIC_ENTRIES.filter((entry) => entry.status === "pending").length,
        approved: STATIC_ENTRIES.filter((entry) => entry.status === "approved").length,
        rejected: STATIC_ENTRIES.filter((entry) => entry.status === "rejected").length,
      },
      pagination: {
        limit,
        offset,
        total: filteredItems.length,
      },
      governance: {
        label: "Campus feedback",
        owner: "Campus community feedback with admin moderation",
        routeNamespace: "/api/campus-feedback",
      },
    };
  }
  const params = new URLSearchParams();
  if (filters.type) params.set("type", normalizeCampusFeedbackType(filters.type));
  if (filters.status) params.set("status", filters.status);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestData<CampusFeedbackListResponse>(`/api/campus-feedback/admin/submissions${query}`, {
    headers,
  });
}

export async function moderateCampusFeedback(
  feedbackId: string,
  payload: { status: Exclude<CampusFeedbackStatus, "pending">; reason: string },
  headers?: HeadersInit
): Promise<CampusFeedbackEntry> {
  if (isStaticPrototype()) {
    const entry = STATIC_ENTRIES.find((item) => item.id === feedbackId);
    if (!entry) throw new Error("Campus feedback entry not found");
    entry.status = payload.status;
    entry.moderationReason = payload.reason;
    entry.updatedAt = new Date().toISOString();
    return entry;
  }
  return requestData<CampusFeedbackEntry>(`/api/campus-feedback/admin/submissions/${feedbackId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

// ── hostelBuddyApi ──────────────────────────────────────────

export type HostelBuddyBlock = {
  id: string;
  label: string;
  active: boolean;
};

export type HostelBuddyEntry = {
  id?: string;
  userId: string;
  name: string;
  email?: string;
  department?: string;
  roomNo: string;
  blockId: string;
  blockLabel: string;
  hasContact: boolean;
  updatedAt: string;
  createdAt?: string;
  contactInfo?: string | null;
  isSelf?: boolean;
};

export type HostelBuddyGovernance = {
  label: string;
  owner: string;
  routeNamespace: string;
  retentionPolicy: string;
};

const STATIC_HOSTEL_BUDDY_BLOCKS: HostelBuddyBlock[] = [
  { id: "block-a", label: "Block A", active: true },
  { id: "block-b", label: "Block B", active: true },
  { id: "block-c", label: "Block C", active: true },
];

const STATIC_HOSTEL_BUDDY_ENTRIES: HostelBuddyEntry[] = [];

function findStaticBlock(blockId: string): HostelBuddyBlock | undefined {
  return STATIC_HOSTEL_BUDDY_BLOCKS.find((block) => block.id === blockId);
}

function buildStaticHostelBuddyResponse() {
  return {
    items: STATIC_HOSTEL_BUDDY_BLOCKS,
    governance: {
      label: "Hostel Buddy Finder",
      owner: "Student roommate discovery (campus community)",
      routeNamespace: "/api/hostel-buddy",
      retentionPolicy:
        "Entries are retained until the student removes them or until the end of the academic session. Contact info is shared only with students in the same room and block.",
    } satisfies HostelBuddyGovernance,
  };
}

export async function getHostelBuddyGovernance(): Promise<HostelBuddyGovernance> {
  if (isStaticPrototype()) {
    return buildStaticHostelBuddyResponse().governance;
  }
  const data = await requestData<{ governance: HostelBuddyGovernance }>(
    "/api/hostel-buddy/governance"
  );
  return data.governance;
}

export async function listHostelBuddyBlocks(): Promise<HostelBuddyBlock[]> {
  if (isStaticPrototype()) return STATIC_HOSTEL_BUDDY_BLOCKS;
  const data = await requestData<{ items: HostelBuddyBlock[] }>(
    "/api/hostel-buddy/blocks"
  );
  return data.items;
}

export async function getMyHostelBuddy(): Promise<HostelBuddyEntry | null> {
  if (isStaticPrototype()) {
    return STATIC_HOSTEL_BUDDY_ENTRIES.find((entry) => entry.isSelf) || null;
  }
  const data = await requestData<{ entry: HostelBuddyEntry | null }>(
    "/api/hostel-buddy/me"
  );
  return data.entry;
}

export async function submitHostelBuddy(payload: {
  roomNo: string;
  blockId: string;
  contactInfo: string;
}): Promise<HostelBuddyEntry> {
  if (isStaticPrototype()) {
    const block = findStaticBlock(payload.blockId);
    const now = new Date().toISOString();
    const entry: HostelBuddyEntry = {
      userId: "prototype-student",
      name: "You",
      roomNo: payload.roomNo.trim().toUpperCase(),
      blockId: payload.blockId,
      blockLabel: block?.label || payload.blockId,
      hasContact: Boolean(payload.contactInfo.trim()),
      updatedAt: now,
      createdAt: now,
      contactInfo: payload.contactInfo.trim(),
      isSelf: true,
    };
    const existingIndex = STATIC_HOSTEL_BUDDY_ENTRIES.findIndex(
      (item) => item.isSelf
    );
    if (existingIndex >= 0) {
      STATIC_HOSTEL_BUDDY_ENTRIES[existingIndex] = entry;
    } else {
      STATIC_HOSTEL_BUDDY_ENTRIES.push(entry);
    }
    return entry;
  }
  const data = await requestData<{ entry: HostelBuddyEntry }>(
    "/api/hostel-buddy/me",
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
  return data.entry;
}

export async function removeHostelBuddy(): Promise<{ removed: boolean }> {
  if (isStaticPrototype()) {
    const existingIndex = STATIC_HOSTEL_BUDDY_ENTRIES.findIndex(
      (item) => item.isSelf
    );
    if (existingIndex >= 0) {
      STATIC_HOSTEL_BUDDY_ENTRIES.splice(existingIndex, 1);
    }
    return { removed: existingIndex >= 0 };
  }
  return requestData<{ removed: boolean }>("/api/hostel-buddy/me", {
    method: "DELETE",
  });
}

export async function listHostelBuddyMatches(): Promise<{
  items: HostelBuddyEntry[];
  governance: HostelBuddyGovernance;
}> {
  if (isStaticPrototype()) {
    const self = STATIC_HOSTEL_BUDDY_ENTRIES.find((entry) => entry.isSelf);
    const items = self
      ? STATIC_HOSTEL_BUDDY_ENTRIES.filter(
          (entry) =>
            !entry.isSelf &&
            entry.roomNo === self.roomNo &&
            entry.blockId === self.blockId
        )
      : [];
    return {
      items,
      governance: buildStaticHostelBuddyResponse().governance,
    };
  }
  return requestData<{
    items: HostelBuddyEntry[];
    governance: HostelBuddyGovernance;
  }>("/api/hostel-buddy/matches");
}
