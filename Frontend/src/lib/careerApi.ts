import { requestData } from "./apiClient";

export type CareerOpportunityType =
  | "job"
  | "internship"
  | "hackathon"
  | "competition"
  | "fellowship"
  | "workshop";

export type CareerOpportunity = {
  id: string;
  type: CareerOpportunityType;
  title: string;
  company?: string;
  organizer?: string;
  organization?: string;
  description?: string;
  shortDescription?: string;
  requirements?: string;
  skills: string[];
  tags: string[];
  location?: string;
  mode?: 'remote' | 'onsite' | 'hybrid' | 'online' | 'offline';
  isPanIndia: boolean;
  eligibleBranches: string[];
  eligibleYears: number[];
  minCGPA?: number;
  stipend?: string;
  prize?: string;
  isFree: boolean;
  postedAt?: string;
  deadline?: string;
  startDate?: string;
  duration?: string;
  source: string;
  sourceUrl: string;
  applyUrl: string;
  link?: string;
  viewCount: number;
  bookmarkCount: number;
  applyCount: number;
  relevanceScore: number;
  status?: string;
  isActive: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  featured?: boolean;
  isBookmarked?: boolean;
  hasApplied?: boolean;
  saved?: boolean;
  applied?: boolean;
  personalizedScore?: number;
  skillMatch?: {
    matched: string[];
    missing: string[];
    percent: number;
  };
  similar?: CareerOpportunity[];
};

export type CareerProfile = {
  userId: string;
  name?: string;
  email?: string;
  department?: string;
  skills: string[];
  preferredTypes: string[];
  preferredLocations: string[];
  minStipend?: string;
  cgpa?: number;
  bio?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  updatedAt: string;
};

export type ResumeCareerSkill = { name: string; level: string };

export type ResumeCareerProject = {
  id: string;
  title: string;
  description: string;
  tech: string;
  link: string;
};

export type ResumeCareerProfile = Omit<CareerProfile, "skills"> & {
  name: string;
  email: string;
  department: string;
  headline: string;
  summary: string;
  completionPercent: number;
  skills: ResumeCareerSkill[];
  projects: ResumeCareerProject[];
};

export type SkillGap = {
  skill: string;
  opportunityCount: number;
  updatedAt: string;
  gapLevel?: string;
};

export type CareerApplication = {
  id: string;
  opportunityId: string;
  userId: string;
  status: 'applied' | 'under_review' | 'shortlisted' | 'interviewed' | 'offered' | 'rejected' | 'withdrawn';
  appliedAt: string;
  notes?: string;
  updatedAt?: string;
  opportunityTitle?: string;
  company?: string;
  type?: string;
};

export type CareerSubmission = {
  id: string;
  submittedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  type: string;
  title: string;
  company?: string;
  organizer?: string;
  description?: string;
  skills: string[];
  tags: string[];
  location?: string;
  mode?: string;
  eligibleBranches: string[];
  eligibleYears: number[];
  stipend?: string;
  prize?: string;
  deadline?: string;
  startDate?: string;
  applyUrl: string;
  createdAt: string;
};

export type AlumniProfile = {
  id: string;
  userId: string;
  name: string;
  email: string;
  batch: string;
  branch: string;
  degree: string;
  company: string;
  position?: string;
  role: string;
  location: string;
  linkedinUrl?: string;
  bio?: string;
  skills: string[];
  expertise: string[];
  isAvailableForMentoring: boolean;
  requested: boolean;
  openToConnect: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InterviewSlot = {
  id: string;
  interviewerId: string;
  interviewerName: string;
  date: string;
  startTime: string;
  endTime: string;
  time: string;
  duration: number; // in minutes
  type: string;
  company: string;
  location: string;
  status: string;
  isBooked: boolean;
  available: boolean;
  bookedBy?: string;
  bookedByName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type InterviewBooking = {
  id: string;
  slotId: string;
  studentId: string;
  studentName: string;
  interviewerId: string;
  interviewerName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  status: 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  slot?: {
    company: string;
    date: string;
    time: string;
    type: string;
  };
  notes?: string;
  feedback?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
};

export async function getCareerPermissions() {
  return requestData<{ canModerateSubmissions: boolean }>("/api/career/permissions");
}

export async function listTrendingOpportunities(limit: number = 12) {
  return requestData<{ items: CareerOpportunity[] }>(
    `/api/career/trending?limit=${encodeURIComponent(String(limit))}`
  );
}

export async function listOpportunities(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters || {});
  return requestData<{ items: CareerOpportunity[] }>(
    `/api/career/opportunities${params.toString() ? `?${params.toString()}` : ""}`
  );
}

/** Bookmarked rows expiring within `days` (default 3). See GET /api/career/deadline-soon. */
export async function listDeadlineSoonBookmarked(days: number = 3) {
  const params = new URLSearchParams({ days: String(days) });
  return requestData<{ items: CareerOpportunity[] }>(`/api/career/deadline-soon?${params.toString()}`);
}

export async function getPersonalizedFeed() {
  return requestData<{ items: CareerOpportunity[] }>("/api/career/feed");
}

export async function getOpportunity(id: string) {
  return requestData<CareerOpportunity>(`/api/career/opportunities/${encodeURIComponent(id)}`);
}

export async function getProfile() {
  return requestData<CareerProfile>("/api/career/profile");
}

export async function updateProfile(data: Partial<CareerProfile>) {
  return requestData<{ updated: boolean }>("/api/career/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getCareerProfile() {
  return requestData<ResumeCareerProfile>("/api/career/profile");
}

export async function updateCareerProfile(data: Partial<ResumeCareerProfile>) {
  return requestData<ResumeCareerProfile>("/api/career/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function uploadResume(file: File) {
  const formData = new FormData();
  formData.append("resume", file);
  
  // Custom request for FormData
  const response = await fetch("/api/career/profile/resume", {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to upload resume");
  }
  
  return response.json() as Promise<{ url: string; fileName: string }>;
}

export async function listSkillGaps() {
  return requestData<{ items: SkillGap[] }>("/api/career/profile/skill-gaps");
}

export async function bookmarkOpportunity(id: string) {
  return requestData<{ bookmarked: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}/bookmark`, {
    method: "POST",
  });
}

export async function dismissOpportunity(id: string) {
  return requestData<{ dismissed: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}/dismiss`, {
    method: "POST",
  });
}

export async function trackApply(id: string) {
  return requestData<{ tracked: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}/apply`, {
    method: "POST",
  });
}

export async function flagOpportunity(id: string, reason: string) {
  return requestData<{ flagged: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}/flag`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function trackView(id: string) {
  return requestData<{ tracked: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}/view`, {
    method: "POST",
  });
}

export async function listApplications() {
  return requestData<{ items: CareerApplication[] }>("/api/career/applications");
}

export async function createApplication(opportunityId: string, notes?: string) {
  return requestData<CareerApplication>("/api/career/applications", {
    method: "POST",
    body: JSON.stringify({ opportunityId, notes }),
  });
}

export async function updateApplication(id: string, status: string, notes?: string) {
  return requestData<{ updated: boolean }>(`/api/career/applications/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ status, notes }),
  });
}

export async function deleteApplication(id: string) {
  return requestData<{ deleted: boolean }>(`/api/career/applications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function submitOpportunity(payload: Record<string, unknown>) {
  return requestData<{ id: string; status: string }>("/api/career/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listPendingSubmissions() {
  return requestData<{ items: CareerSubmission[] }>("/api/career/submit/pending");
}

export async function approveSubmission(id: string) {
  return requestData<{ approved: boolean }>(`/api/career/submit/${encodeURIComponent(id)}/approve`, {
    method: "POST",
  });
}

export async function getCareerHealth() {
  return requestData<{ sources: unknown[]; recentRuns: unknown[] }>("/api/career/health");
}

export async function getCareerStats() {
  return requestData<{ 
    byType: unknown[]; 
    bySource?: unknown[];
    newThisWeek?: number;
    totalActive: number; 
    totalBookmarks: number; 
    totalApplications: number 
  }>("/api/career/stats");
}

// Alumni functions
export async function listAlumni(filters?: { query?: string; batch?: string }, headers?: HeadersInit) {
  const params = new URLSearchParams(filters || {});
  return requestData<{ items: AlumniProfile[] }>(
    `/api/career/alumni${params.toString() ? `?${params.toString()}` : ""}`,
    { headers }
  );
}

export async function createAlumniProfile(data: Partial<AlumniProfile>, headers?: HeadersInit) {
  return requestData<AlumniProfile>("/api/career/alumni", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
}

export async function updateAlumniProfile(id: string, data: Partial<AlumniProfile>, headers?: HeadersInit) {
  return requestData<{ updated: boolean }>(`/api/career/alumni/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
}

export async function deleteAlumniProfile(id: string, headers?: HeadersInit) {
  return requestData<{ deleted: boolean }>(`/api/career/alumni/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
}

export async function requestAlumniConnection(alumniId: string, message?: string | { message?: string }) {
  const normalizedMessage = typeof message === "string" ? message : message?.message;
  return requestData<{ requested: boolean }>(`/api/career/alumni/${encodeURIComponent(alumniId)}/requests`, {
    method: "POST",
    body: JSON.stringify({ message: normalizedMessage }),
  });
}

// Interview functions
export async function listInterviewSlots(headers?: HeadersInit) {
  return requestData<{ items: InterviewSlot[] }>("/api/career/interviews/slots", { headers });
}

export async function createInterviewSlot(data: Partial<InterviewSlot>, headers?: HeadersInit) {
  return requestData<InterviewSlot>("/api/career/interviews/slots", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
}

export async function updateInterviewSlot(id: string, data: Partial<InterviewSlot>, headers?: HeadersInit) {
  return requestData<{ updated: boolean }>(`/api/career/interviews/slots/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
}

export async function deleteInterviewSlot(id: string, headers?: HeadersInit) {
  return requestData<{ deleted: boolean }>(`/api/career/interviews/slots/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
}

export async function listInterviewBookings() {
  return requestData<{ items: InterviewBooking[] }>("/api/career/interviews/bookings");
}

export async function bookInterviewSlot(slotId: string, notes?: string) {
  return requestData<InterviewBooking>("/api/career/interviews/bookings", {
    method: "POST",
    body: JSON.stringify({ slotId, notes }),
  });
}

export async function cancelInterviewBooking(bookingId: string) {
  return requestData<{ cancelled: boolean }>(`/api/career/interviews/bookings/${encodeURIComponent(bookingId)}`, {
    method: "DELETE",
  });
}

// Career Opportunities CRUD functions
export async function listCareerOpportunities(filters?: Record<string, string>, headers?: HeadersInit) {
  const params = new URLSearchParams(filters || {});
  return requestData<{ items: CareerOpportunity[] }>(
    `/api/career/opportunities${params.toString() ? `?${params.toString()}` : ""}`,
    { headers }
  );
}

export async function createCareerOpportunity(data: Record<string, unknown>, headers?: HeadersInit) {
  return requestData<CareerOpportunity>("/api/career/opportunities", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
}

export async function updateCareerOpportunity(id: string, data: Record<string, unknown>, headers?: HeadersInit) {
  return requestData<{ updated: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
}

export async function deleteCareerOpportunity(id: string, headers?: HeadersInit) {
  return requestData<{ deleted: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
}

export async function applyToCareerOpportunity(id: string, notes?: string) {
  return requestData<{ applied: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}/apply`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function saveCareerOpportunity(id: string) {
  return requestData<{ saved: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}/save`, {
    method: "POST",
  });
}

export async function unsaveCareerOpportunity(id: string) {
  return requestData<{ unsaved: boolean }>(`/api/career/opportunities/${encodeURIComponent(id)}/save`, {
    method: "DELETE",
  });
}
