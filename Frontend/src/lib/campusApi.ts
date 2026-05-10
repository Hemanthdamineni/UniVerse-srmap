import { requestData, requestMultipart } from "./apiClient";

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
  prizes?: string | null;
  eligibility?: string | null;
  isCompetition?: boolean;
  competitionConfig?: CompetitionConfig | null;
  posterImagePath?: string | null;
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
  createdAt: string;
  updatedAt: string;
  resolutionSummary?: string;
  replyCount?: number;
  slaBreached?: boolean;
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
};

export type CampusFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags?: string[];
  visible?: boolean;
};

function normalizeEventList(payload: EventSummary[] | { events?: EventSummary[] }) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.events)) return payload.events;
  return [];
}

export async function listEvents(query?: Record<string, string>, headers?: HeadersInit) {
  const params = new URLSearchParams(query || {});
  const payload = await requestData<EventSummary[] | { events?: EventSummary[] }>(`/api/events${params.toString() ? `?${params.toString()}` : ""}`, {
    headers,
  });
  return normalizeEventList(payload);
}

export async function getEvent(eventId: string, headers?: HeadersInit) {
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

export async function updateEventApproval(
  eventId: string,
  payload: { approved: boolean; notes?: string },
  headers?: HeadersInit
) {
  return requestData<EventSummary>(`/api/events/${encodeURIComponent(eventId)}/approval`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function updateEventStatus(
  eventId: string,
  payload: { status: string },
  headers?: HeadersInit
) {
  return requestData<EventSummary>(`/api/events/${encodeURIComponent(eventId)}/status`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function updateEventCoOrganizers(eventId: string, coOrganizers: string[]) {
  return requestData<EventSummary>(`/api/events/${encodeURIComponent(eventId)}/co-organizers`, {
    method: "PUT",
    body: JSON.stringify({ coOrganizers }),
  });
}

export async function sendEventMessage(
  eventId: string,
  payload: { subject: string; message: string },
  headers?: HeadersInit
) {
  return requestData<Record<string, unknown>>(`/api/events/${encodeURIComponent(eventId)}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function registerForEvent(eventId: string) {
  return requestData<Record<string, unknown>>(`/api/events/${encodeURIComponent(eventId)}/register`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function cancelEventRegistration(eventId: string) {
  return requestData<Record<string, unknown>>(
    `/api/events/${encodeURIComponent(eventId)}/cancel-registration`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function getCompetitionConfig(eventId: string) {
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

export async function generateRoundCertificates(eventId: string, roundId: string) {
  return requestData<{ generatedCount: number; certificates: Array<{ userId: string; fileName: string; filePath: string }> }>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/certificates/generate`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function getMyRoundCertificate(eventId: string, roundId: string) {
  return requestData<{ fileName: string; filePath: string; url?: string }>(
    `/api/competitions/${encodeURIComponent(eventId)}/rounds/${encodeURIComponent(roundId)}/certificates/me`
  );
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

export async function inviteTeamMember(
  eventId: string,
  teamId: string,
  payload: { inviteeRegisterNumber: string }
) {
  return requestData<TeamInvitation>(
    `/api/competitions/${encodeURIComponent(eventId)}/teams/${encodeURIComponent(teamId)}/invite`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export async function cancelTeamInvitation(eventId: string, teamId: string, inviteeRegisterNumber: string) {
  return requestData<{ cancelled: boolean }>(
    `/api/competitions/${encodeURIComponent(eventId)}/teams/${encodeURIComponent(teamId)}/invite/${encodeURIComponent(inviteeRegisterNumber)}`,
    { method: "DELETE" }
  );
}

export async function transferTeamLeadership(
  eventId: string,
  teamId: string,
  payload: { newLeaderId: string }
) {
  return requestData<{ transferred: boolean }>(
    `/api/competitions/${encodeURIComponent(eventId)}/teams/${encodeURIComponent(teamId)}/leader`,
    { method: "PUT", body: JSON.stringify(payload) }
  );
}

export async function leaveTeam(eventId: string, teamId: string) {
  return requestData<{ left: boolean }>(
    `/api/competitions/${encodeURIComponent(eventId)}/teams/${encodeURIComponent(teamId)}/members/me`,
    { method: "DELETE" }
  );
}

export async function deleteTeam(eventId: string, teamId: string) {
  return requestData<{ deleted: boolean }>(
    `/api/competitions/${encodeURIComponent(eventId)}/teams/${encodeURIComponent(teamId)}`,
    { method: "DELETE" }
  );
}

export async function acceptInvitation(eventId: string, invitationId: string) {
  return requestData<{ accepted: boolean }>(
    `/api/competitions/${encodeURIComponent(eventId)}/invitations/${encodeURIComponent(invitationId)}/accept`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function declineInvitation(eventId: string, invitationId: string) {
  return requestData<{ declined: boolean }>(
    `/api/competitions/${encodeURIComponent(eventId)}/invitations/${encodeURIComponent(invitationId)}/decline`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function getMyInvitations(eventId: string) {
  return requestData<TeamInvitation[]>(
    `/api/competitions/${encodeURIComponent(eventId)}/invitations/my-invitations`
  );
}

export async function listHelpdeskTickets(filters?: Record<string, string>, headers?: HeadersInit) {
  const params = new URLSearchParams(filters || {});
  return requestData<{
    items: CampusTicket[];
    counts: {
      total: number;
      open: number;
      inProgress: number;
      escalated: number;
      resolved: number;
      slaBreached: number;
    };
  }>(`/api/helpdesk/tickets${params.toString() ? `?${params.toString()}` : ""}`, {
    headers,
  });
}

export async function createHelpdeskTicket(payload: Record<string, unknown>) {
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
  return requestData<CampusTicket>(`/api/helpdesk/tickets/${encodeURIComponent(ticketId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function escalateHelpdeskTicket(ticketId: string, reason?: string) {
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
