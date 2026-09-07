import { isStaticPrototype } from "../core/prototype";
import { requestJson } from "../core/requestUtils";

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
  disabledMessage?: string;
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


export function validateFeedbackComment(value: string) {
  const comment = String(value || "").replace(/\s+/g, " ").trim();
  if (comment.length <= 10) return "Comment must be more than 10 characters.";
  if (comment.length > 500) return "Comment must be less than 500 characters.";
  return "";
}

export async function getEndSemesterFeedbackStatus(): Promise<FeedbackStatusResponse> {
  if (isStaticPrototype()) {
    return {
      enabled: false,
      pendingSubjects: [],
      submittedSubjects: [],
      totalPending: 0,
      defaultOption: 0,
      templateAvailable: false,
    };
  }
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

