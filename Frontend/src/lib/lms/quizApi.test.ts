import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildQuizFromQuestionBank,
  createQuestionBankItem,
  getPendingExamFeedback,
  getQuizAttempts,
  listQuestionBank,
  submitExamFeedback,
  submitQuizAttempt,
  upvoteQuestionBankItem,
} from "./quizApi";

function mockFetchSuccess(data: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
    } as Response)
  );
}

function mockFetchRaw(data: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response)
  );
}

describe("quizApi", () => {
  afterEach(() => vi.restoreAllMocks());

  describe("getPendingExamFeedback", () => {
    it("GETs pending exam feedback list", async () => {
      const feedback = [{ id: "fb1", title: "DBMS Exam" }];
      vi.stubGlobal("fetch", mockFetchSuccess(feedback));
      const result = await getPendingExamFeedback();
      expect(result).toEqual(feedback);
      expect(fetch).toHaveBeenCalledWith("/api/lms/exam-feedback/pending", expect.anything());
    });

    it("returns empty array on empty response", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      const result = await getPendingExamFeedback();
      expect(result).toEqual([]);
    });
  });

  describe("submitExamFeedback", () => {
    it("POSTs feedback items and returns submitted count", async () => {
      const items = [{ resourceId: "res-1", helpful: true }];
      vi.stubGlobal("fetch", mockFetchSuccess({ submitted: 1 }));
      const result = await submitExamFeedback(items);
      expect(result).toEqual({ submitted: 1 });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/exam-feedback",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ feedbackItems: items }),
        })
      );
    });

    it("submits multiple feedback items", async () => {
      const items = [
        { resourceId: "res-1", helpful: true },
        { resourceId: "res-2", helpful: false },
      ];
      vi.stubGlobal("fetch", mockFetchSuccess({ submitted: 2 }));
      const result = await submitExamFeedback(items);
      expect(result.submitted).toBe(2);
    });

    it("submits empty feedback array", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ submitted: 0 }));
      const result = await submitExamFeedback([]);
      expect(result.submitted).toBe(0);
    });
  });

  describe("submitQuizAttempt", () => {
    it("POSTs attempt data to resource endpoint", async () => {
      const payload = { answers: { q1: "A" }, score: 80 };
      vi.stubGlobal("fetch", mockFetchRaw({ success: true }));
      await submitQuizAttempt("res-quiz-1", payload);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-quiz-1/quiz-attempt",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe("getQuizAttempts", () => {
    it("GETs quiz attempts for a resource", async () => {
      const attempts = [{ score: 80, date: "2026-01-01" }];
      vi.stubGlobal("fetch", mockFetchSuccess(attempts));
      const result = await getQuizAttempts("res-quiz-1");
      expect(result).toEqual(attempts);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/resources/res-quiz-1/quiz-attempts",
        expect.anything()
      );
    });

    it("returns empty array when no attempts", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess([]));
      const result = await getQuizAttempts("res-quiz-1");
      expect(result).toEqual([]);
    });
  });

  describe("listQuestionBank", () => {
    it("GETs questions with query params", async () => {
      const response = {
        items: [{ id: "q1", question: "What is SQL?" }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      vi.stubGlobal("fetch", mockFetchSuccess(response));
      const result = await listQuestionBank({ subjectCode: "CSE301" });
      expect(result).toEqual(response);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/question-bank?subjectCode=CSE301",
        expect.anything()
      );
    });

    it("omits empty params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ items: [], pagination: { page: 1, limit: 20, total: 0 } }));
      await listQuestionBank({ subjectCode: "CSE301", query: undefined, type: "" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/question-bank?subjectCode=CSE301",
        expect.anything()
      );
    });
  });

  describe("createQuestionBankItem", () => {
    it("POSTs question and returns created item", async () => {
      const payload = { question: "What is a JOIN?", answer: "Combines rows" };
      vi.stubGlobal("fetch", mockFetchSuccess({ id: "q-new", ...payload }));
      const result = await createQuestionBankItem(payload);
      expect(result).toEqual({ id: "q-new", question: "What is a JOIN?", answer: "Combines rows" });
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/question-bank",
        expect.objectContaining({ method: "POST", body: JSON.stringify(payload) })
      );
    });
  });

  describe("upvoteQuestionBankItem", () => {
    it("POSTs to upvote endpoint", async () => {
      const response = { id: "q1", upvotes: 5 };
      vi.stubGlobal("fetch", mockFetchSuccess(response));
      const result = await upvoteQuestionBankItem("q1");
      expect(result).toEqual(response);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/question-bank/q1/upvote",
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("buildQuizFromQuestionBank", () => {
    it("GETs built quiz with params", async () => {
      const response = { questions: [{ id: "q1" }], count: 1 };
      vi.stubGlobal("fetch", mockFetchSuccess(response));
      const result = await buildQuizFromQuestionBank({ subjectCode: "CSE301", count: "5" });
      expect(result).toEqual(response);
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/question-bank/build-quiz?subjectCode=CSE301&count=5",
        expect.anything()
      );
    });

    it("handles empty params", async () => {
      vi.stubGlobal("fetch", mockFetchSuccess({ questions: [], count: 0 }));
      await buildQuizFromQuestionBank({});
      expect(fetch).toHaveBeenCalledWith(
        "/api/lms/question-bank/build-quiz?",
        expect.anything()
      );
    });
  });
});
