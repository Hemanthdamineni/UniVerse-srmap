const { randomUUID } = require("crypto");
const { nowIso, toSafeString, ensureArray } = require("./utils");

const faqMethods = {
  _seedFaqsIfNeeded() {
    if (this.faqs.length > 0) return;

    const seeded = [
      {
        id: randomUUID(),
        question: "How long does a normal helpdesk ticket take to resolve?",
        answer: "Most tickets are triaged within one working day. Urgent tickets are prioritized automatically.",
        category: "General",
        tags: ["sla", "timeline"],
        visible: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: randomUUID(),
        question: "When should I escalate a ticket?",
        answer: "Escalate when the issue blocks attendance, exams, payments, hostel access, or any deadline-sensitive work.",
        category: "General",
        tags: ["escalation", "urgent"],
        visible: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        id: randomUUID(),
        question: "What should I include in an IT Support ticket?",
        answer: "Include screenshots, the device used, the page or portal name, and the exact time the issue happened.",
        category: "IT & Technical",
        tags: ["it", "screenshots"],
        visible: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ];

    this.faqs = seeded;
    this._persist();
    this._reindex();
  },

  listFaqs({ query = "", category = "", includeHidden = false } = {}) {
    const normalizedQuery = toSafeString(query).toLowerCase();
    const normalizedCategory = toSafeString(category);

    return this.faqs
      .filter((faq) => (includeHidden ? true : faq.visible !== false))
      .filter((faq) => (normalizedCategory ? faq.category === normalizedCategory : true))
      .filter((faq) => {
        if (!normalizedQuery) return true;
        return [faq.question, faq.answer, faq.category, ...ensureArray(faq.tags)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  },

  createFaq(payload, { user }) {
    this._ensureAdmin(user);
    const question = toSafeString(payload?.question);
    const answer = toSafeString(payload?.answer);
    if (!question || !answer) {
      const error = new Error("question and answer are required");
      error.status = 400;
      throw error;
    }

    const createdAt = nowIso();
    const faq = {
      id: randomUUID(),
      question,
      answer,
      category: toSafeString(payload?.category) || "General",
      tags: ensureArray(payload?.tags).map((tag) => toSafeString(tag)).filter(Boolean),
      visible: payload?.visible !== false,
      createdAt,
      updatedAt: createdAt,
    };

    this.faqs.unshift(faq);
    this._persist();
    return faq;
  },

  updateFaq(faqId, payload, { user }) {
    this._ensureAdmin(user);
    const faq = this.faqs.find((item) => item.id === toSafeString(faqId));
    if (!faq) {
      const error = new Error("FAQ not found");
      error.status = 404;
      throw error;
    }

    faq.question = payload?.question !== undefined ? toSafeString(payload.question) : faq.question;
    faq.answer = payload?.answer !== undefined ? toSafeString(payload.answer) : faq.answer;
    faq.category = payload?.category !== undefined ? toSafeString(payload.category) : faq.category;
    faq.visible = payload?.visible !== undefined ? Boolean(payload.visible) : faq.visible;
    faq.tags =
      payload?.tags !== undefined
        ? ensureArray(payload.tags).map((tag) => toSafeString(tag)).filter(Boolean)
        : faq.tags;
    faq.updatedAt = nowIso();

    this._persist();
    return faq;
  },

  deleteFaq(faqId, { user }) {
    this._ensureAdmin(user);
    const targetId = toSafeString(faqId);
    const next = this.faqs.filter((faq) => faq.id !== targetId);
    if (next.length === this.faqs.length) {
      const error = new Error("FAQ not found");
      error.status = 404;
      throw error;
    }

    this.faqs = next;
    this._persist();
    return { deleted: true, id: targetId };
  },
};

module.exports = { faqMethods };
