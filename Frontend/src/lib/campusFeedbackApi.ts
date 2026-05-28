import { requestData } from "./apiClient";
import { isStaticPrototype } from "./prototype/staticPrototypeEnv";

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
  unofficial: CampusFeedbackGovernance;
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
      unofficial: {
        label: "Unofficial campus feedback",
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
        label: "Unofficial campus feedback",
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
        label: "Unofficial campus feedback",
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
