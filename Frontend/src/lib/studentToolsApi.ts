import { ApiError } from "./erpApi";
import { handleSessionAuthFailure, isSessionAuthFailure } from "./session";

type FeedbackSubject = {
  id?: string;
  name: string;
};

export type FeedbackStatusResponse = {
  enabled: boolean;
  pendingSubjects: FeedbackSubject[];
  submittedSubjects: FeedbackSubject[];
  totalPending: number;
  defaultOption: number;
  templateAvailable: boolean;
  alreadySubmitted?: boolean;
};

export type FeedbackTemplateResponse = {
  comment: string;
  available: boolean;
};

export type FeedbackSubmitResult = {
  subjectId: string;
  subjectName: string;
  status: "submitted" | "skipped" | "failed";
  message: string;
};

export type FeedbackSubmitResponse = {
  optionNo: number;
  comment: string;
  results: FeedbackSubmitResult[];
  counts: {
    submitted: number;
    skipped: number;
    failed: number;
  };
  message: string;
};

export type ResourceCatalogCourse = {
  year: number | null;
  courseCode: string;
  courseName: string;
  subjectCount: number;
  resourceCount: number;
};

export type ResourceCatalogResponse = {
  years: number[];
  selectedYear: number | null;
  courses: ResourceCatalogCourse[];
};

export type ResourceSubjectResponse = {
  year: number;
  courseCode: string;
  subjects: Array<{
    subjectCode: string;
    subjectName: string;
    semester: number | null;
    groups: string[];
    resourceCount: number;
  }>;
};

export type ResourceLibraryResponse = {
  subject: {
    year: number;
    courseCode: string;
    courseName: string;
    subjectCode: string;
    subjectName: string;
    semester: number | null;
  };
  groups: Array<{
    group: string;
    label: string;
    items: Array<{
      id: string;
      title: string;
      description: string;
      metadata?: Record<string, unknown>;
      resources: Array<{
        id: string;
        contentId: string;
        kind: string;
        title: string;
        urlOrPath: string;
        mimeType?: string | null;
        sizeBytes?: number | null;
        createdAt?: string;
      }>;
    }>;
  }>;
  totalItems: number;
  totalResources: number;
};

function parseApiErrorBody(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const body = payload as Record<string, unknown>;
  const errorValue = body.error;
  if (errorValue && typeof errorValue === "object") {
    const errorObject = errorValue as Record<string, unknown>;
    return {
      message: String(errorObject.message || "Request failed"),
      code: String(errorObject.code || "UNKNOWN"),
      retryable: Boolean(errorObject.retryable),
    };
  }

  if (typeof errorValue === "string" && errorValue.trim()) {
    return {
      message: errorValue,
      code: "UNKNOWN",
      retryable: false,
    };
  }

  if (typeof body.message === "string" && body.message.trim()) {
    return {
      message: body.message,
      code: "UNKNOWN",
      retryable: false,
    };
  }

  return null;
}

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    if (isSessionAuthFailure(response.status, payload)) {
      handleSessionAuthFailure();
    }

    const parsed = parseApiErrorBody(payload);
    throw new ApiError(
      parsed?.message || `Request failed with status ${response.status}`,
      response.status,
      parsed?.code || "UNKNOWN",
      parsed?.retryable || false
    );
  }

  return payload as T;
}

export function validateFeedbackComment(value: string) {
  const comment = String(value || "").replace(/\s+/g, " ").trim();
  if (comment.length <= 10) return "Comment must be more than 10 characters.";
  if (comment.length > 500) return "Comment must be less than 500 characters.";
  return "";
}

export async function getEndSemesterFeedbackStatus(): Promise<FeedbackStatusResponse> {
  return requestJson<FeedbackStatusResponse>("/api/feedback/end-semester/status");
}

export async function getRandomFeedbackTemplate(): Promise<FeedbackTemplateResponse> {
  return requestJson<FeedbackTemplateResponse>("/api/feedback/end-semester/templates/random");
}

export async function submitEndSemesterFeedback(payload: {
  optionNo: number;
  comment: string;
  subjectIds?: string[];
}): Promise<FeedbackSubmitResponse> {
  return requestJson<FeedbackSubmitResponse>("/api/feedback/end-semester/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLearningMaterialCatalog(year?: number | null): Promise<ResourceCatalogResponse> {
  const query = year ? `?year=${encodeURIComponent(String(year))}` : "";
  return requestJson<ResourceCatalogResponse>(`/api/resources/catalog${query}`);
}

export async function getLearningMaterialSubjects(
  year: number,
  courseCode: string
): Promise<ResourceSubjectResponse> {
  return requestJson<ResourceSubjectResponse>(
    `/api/resources/subjects?year=${encodeURIComponent(String(year))}&courseCode=${encodeURIComponent(courseCode)}`
  );
}

export async function getLearningMaterialLibrary(payload: {
  year: number;
  courseCode: string;
  subjectCode: string;
  query?: string;
}): Promise<ResourceLibraryResponse> {
  const params = new URLSearchParams({
    year: String(payload.year),
    courseCode: payload.courseCode,
    subjectCode: payload.subjectCode,
  });

  if (payload.query && payload.query.trim()) {
    params.set("query", payload.query.trim());
  }

  return requestJson<ResourceLibraryResponse>(`/api/resources/library?${params.toString()}`);
}
