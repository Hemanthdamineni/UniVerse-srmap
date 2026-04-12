const cheerio = require("cheerio");
const {
  createApiContext,
  callEndpointViaApi,
  isErpSessionExpiredResponse,
  makeSessionExpiredError,
} = require("./erpClient");
const {
  getRandomFeedbackTemplate,
  readFeedbackTemplates,
  validateFeedbackComment,
} = require("./feedbackTemplates");
const { cleanText } = require("../utils/text");
const { log } = require("../utils/logger");

const FEEDBACK_RESOURCE_URL = "students/transaction/subjectwisefeedbackresources.jsp";

const DEFAULT_FEEDBACK_ENDPOINT = {
  argId: 9,
  method: "POST",
  url: "students/transaction/subjectwisefeedback.jsp",
  paramsTemplate: {
    ids: "{{argId}}",
  },
};

const ANSWER_OPTIONS = [
  { optionNo: 1, value: "21", label: "Strongly disagree", pointvalue: "1.00" },
  { optionNo: 2, value: "22", label: "Somewhat disagree", pointvalue: "2.00" },
  { optionNo: 3, value: "23", label: "Neutral", pointvalue: "3.00" },
  { optionNo: 4, value: "24", label: "Somewhat agree", pointvalue: "4.00" },
  { optionNo: 5, value: "25", label: "Strongly agree", pointvalue: "5.00" },
];

function sanitizeSubjectName(value) {
  return cleanText(value).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function validateOptionNumber(optionNo) {
  const parsed = Number(optionNo);
  const match = ANSWER_OPTIONS.find((option) => option.optionNo === parsed);
  if (!match) {
    const error = new Error("optionNo must be between 1 and 5.");
    error.status = 400;
    error.code = "INVALID_OPTION";
    throw error;
  }
  return match;
}

function resolveEndpoint(discoveryRepository) {
  return (
    discoveryRepository?.resolveEndpoint?.("Feedback", "End Semester Feedback") ||
    DEFAULT_FEEDBACK_ENDPOINT
  );
}

function parseFeedbackLandingPage(html = "") {
  const $ = cheerio.load(String(html || ""));
  const pendingSubjects = [];
  const submittedSubjects = [];

  $("td.clsSubject").each((_index, element) => {
    const id = cleanText($(element).attr("id"));
    const name = sanitizeSubjectName($(element).text());
    if (!id || !name) return;
    pendingSubjects.push({ id, name });
  });

  $("tr, li, div").each((_index, element) => {
    const text = cleanText($(element).text());
    if (!/submitted|completed/i.test(text) || !/feedback/i.test(text)) return;
    const name = sanitizeSubjectName(text.replace(/feedback/gi, ""));
    if (name) {
      submittedSubjects.push({ name });
    }
  });

  const feedbackType = cleanText($("#feedbacktype").val()) || cleanText($("input[name='feedbacktype']").val());
  const controller = cleanText($("#mcontroller").val()) || cleanText($("input[name='controller']").val());
  const pageText = cleanText($.root().text());
  const alreadySubmitted =
    pendingSubjects.length === 0 &&
    /already submitted|feedback completed|no subjects found/i.test(pageText);

  return {
    pendingSubjects,
    submittedSubjects,
    feedbackType,
    controller,
    alreadySubmitted,
    pageText,
  };
}

function parseQuestionRows($form, selectedOption, comment) {
  const answersJson = [];
  const descriptiveJson = [];

  $form("tr.clsquestions").each((_index, element) => {
    const row = $form(element);
    const questionId = cleanText(row.attr("id")).replace(/_\d+$/, "");
    const textarea = row.find("textarea").first();

    if (textarea.length) {
      const descQuestionId = cleanText(row.attr("itemid")).replace(/_\d+$/, "");
      const quesid = cleanText(textarea.attr("quesid"));
      if (descQuestionId && quesid) {
        descriptiveJson.push({
          questionid: descQuestionId,
          answerdesc: comment,
          quesid,
          partid: cleanText(textarea.attr("partid")) || "6",
        });
      }
      return;
    }

    if (!questionId) return;
    const selectedAnswer = row
      .find("input.answers")
      .filter((_answerIndex, answerElement) => cleanText($form(answerElement).attr("answervalue")) === selectedOption.value)
      .first();

    if (!selectedAnswer.length) return;

    answersJson.push({
      questionid: questionId,
      answerid: cleanText(selectedAnswer.attr("id")),
      answerdesc: selectedOption.label,
      quesid: cleanText(selectedAnswer.attr("quesid")) || questionId,
      partid: cleanText(selectedAnswer.attr("partid")),
      answervalue: selectedOption.value,
      pointvalue: selectedOption.pointvalue,
    });
  });

  return { answersJson, descriptiveJson };
}

async function postFeedbackForm(api, formData) {
  const response = await api.post(FEEDBACK_RESOURCE_URL, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
    },
    form: formData,
  });

  const raw = await response.text();
  if (isErpSessionExpiredResponse(raw)) {
    throw makeSessionExpiredError();
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  return {
    status: response.status(),
    raw,
    parsed,
  };
}

class FeedbackAutomationService {
  constructor({ sessionStore, discoveryRepository, enabled }) {
    this.sessionStore = sessionStore;
    this.discoveryRepository = discoveryRepository;
    this.enabled = Boolean(enabled);
  }

  async _loadLandingPage(sessionId) {
    const session = await this.sessionStore.getOrThrow(sessionId);
    const endpoint = resolveEndpoint(this.discoveryRepository);
    const api = await createApiContext(session.storageState);

    try {
      const payload = await callEndpointViaApi(api, endpoint, {
        dropdown: "Feedback",
        subitem: "End Semester Feedback",
      });
      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });
      return {
        session,
        payload,
      };
    } finally {
      await api.dispose();
    }
  }

  async getStatus(sessionId) {
    const { payload } = await this._loadLandingPage(sessionId);
    const landing = parseFeedbackLandingPage(payload.rawHtml || "");

    return {
      enabled: this.enabled,
      pendingSubjects: landing.pendingSubjects,
      submittedSubjects: landing.submittedSubjects,
      totalPending: landing.pendingSubjects.length,
      defaultOption: 5,
      templateAvailable: readFeedbackTemplates().length > 0,
      alreadySubmitted: landing.alreadySubmitted,
    };
  }

  getRandomTemplate() {
    const template = getRandomFeedbackTemplate();
    return {
      comment: template,
      available: Boolean(template),
    };
  }

  async submit(sessionId, { optionNo, comment, subjectIds, requestId } = {}) {
    if (!this.enabled) {
      const error = new Error("Feedback automation is disabled right now.");
      error.status = 403;
      error.code = "FEEDBACK_AUTOMATION_DISABLED";
      throw error;
    }

    const selectedOption = validateOptionNumber(optionNo);
    const normalizedComment = validateFeedbackComment(comment);
    const session = await this.sessionStore.getOrThrow(sessionId);
    const api = await createApiContext(session.storageState);

    try {
      const landingPayload = await callEndpointViaApi(
        api,
        resolveEndpoint(this.discoveryRepository),
        {
          dropdown: "Feedback",
          subitem: "End Semester Feedback",
        }
      );

      const landing = parseFeedbackLandingPage(landingPayload.rawHtml || "");
      const requestedSubjectIds = Array.isArray(subjectIds)
        ? new Set(subjectIds.map((entry) => cleanText(entry)).filter(Boolean))
        : null;
      const subjectsToProcess = landing.pendingSubjects.filter((subject) =>
        requestedSubjectIds ? requestedSubjectIds.has(subject.id) : true
      );

      if (!subjectsToProcess.length) {
        return {
          optionNo: selectedOption.optionNo,
          comment: normalizedComment,
          results: [],
          counts: {
            submitted: 0,
            skipped: 0,
            failed: 0,
          },
          message: landing.alreadySubmitted
            ? "No pending subjects found. Feedback looks already completed."
            : "No matching pending subjects found.",
        };
      }

      const results = [];

      for (const subject of subjectsToProcess) {
        const formData = {
          ids: "1",
          filter: subject.id,
          controller: landing.controller,
        };

        const formResponse = await postFeedbackForm(api, formData);
        const $form = cheerio.load(formResponse.raw || "");
        const hdnControllerId =
          cleanText($form("#hdnControllerId").val()) || cleanText($form("input[name='hdnControllerId']").val());
        const remarks = cleanText($form("#txtRemarks").val());
        const { answersJson, descriptiveJson } = parseQuestionRows($form, selectedOption, normalizedComment);

        if (!answersJson.length) {
          results.push({
            subjectId: subject.id,
            subjectName: subject.name,
            status: "failed",
            message: "Unable to build feedback answers for this subject.",
          });
          continue;
        }

        const submitResponse = await postFeedbackForm(api, {
          txtRemarks: remarks,
          hdnSubjectId: subject.id,
          hdnControllerId,
          ids: "2",
          filter: "",
          answers: JSON.stringify(answersJson),
          descriptiveanswer: JSON.stringify(descriptiveJson),
          remarks,
          feedbacktype: landing.feedbackType,
        });

        const submitMessage =
          cleanText(submitResponse.parsed?.result || submitResponse.parsed?.message || submitResponse.raw) ||
          "Unknown response";
        const wasSubmitted =
          submitResponse.status === 200 &&
          /feedback completed|success|submitted/i.test(submitMessage);

        results.push({
          subjectId: subject.id,
          subjectName: subject.name,
          status: wasSubmitted ? "submitted" : "failed",
          message: submitMessage,
        });
      }

      const counts = results.reduce(
        (acc, item) => {
          if (item.status === "submitted") acc.submitted += 1;
          else if (item.status === "skipped") acc.skipped += 1;
          else acc.failed += 1;
          return acc;
        },
        { submitted: 0, skipped: 0, failed: 0 }
      );

      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });

      log({
        level: counts.failed > 0 ? "warn" : "info",
        msg: "End-semester feedback batch executed",
        requestId,
        sessionId,
        optionNo: selectedOption.optionNo,
        requestedSubjects: subjectsToProcess.length,
        submitted: counts.submitted,
        failed: counts.failed,
      });

      return {
        optionNo: selectedOption.optionNo,
        comment: normalizedComment,
        results,
        counts,
        message:
          counts.submitted > 0 && counts.failed === 0
            ? "Feedback submitted successfully."
            : counts.submitted > 0
              ? "Feedback submitted for some subjects."
              : "Feedback submission failed.",
      };
    } finally {
      await api.dispose();
    }
  }
}

module.exports = {
  FeedbackAutomationService,
  parseFeedbackLandingPage,
  validateOptionNumber,
};
