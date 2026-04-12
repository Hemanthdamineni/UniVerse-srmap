const fs = require("fs");
const { toSafeString, ensureArray, safeParseStructuredContent } = require("./lmsUtils");

function countWords(value) {
  return toSafeString(value)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}

function estimatePdfMinutes(fileSizeBytes) {
  const sizeMb = Math.max(1, Math.ceil(Number(fileSizeBytes || 0) / (1024 * 1024)));
  return Math.max(2, sizeMb * 2);
}

function estimateStructuredMinutes(type, structuredContent) {
  const content = safeParseStructuredContent(structuredContent);
  if (!content) return 5;

  if (type === "quiz") {
    const questions = ensureArray(content.questions);
    return Math.max(5, questions.length * 2);
  }

  if (type === "flashcard") {
    const cards = ensureArray(content.cards);
    return Math.max(5, Math.ceil(cards.length * 0.75));
  }

  return 5;
}

class LmsReadingTimeEstimator {
  async computeReadingTime({ type, noteContent, structuredContent, filePath, fileSize, mimeType, url, sections }) {
    const normalizedType = toSafeString(type).toLowerCase();
    const normalizedUrl = toSafeString(url).toLowerCase();
    const normalizedMime = toSafeString(mimeType).toLowerCase();

    if (normalizedType === "note" || normalizedType === "guide") {
      const text = normalizedType === "guide"
        ? ensureArray(sections)
            .map((section) => toSafeString(section?.content))
            .join(" ")
        : toSafeString(noteContent);
      return Math.max(1, Math.ceil(countWords(text) / 200));
    }

    if (normalizedType === "quiz" || normalizedType === "flashcard") {
      return estimateStructuredMinutes(normalizedType, structuredContent);
    }

    if (normalizedMime.includes("pdf") || normalizedUrl.endsWith(".pdf")) {
      return estimatePdfMinutes(fileSize);
    }

    if (normalizedType === "file" || normalizedType === "pyq") {
      if (filePath) {
        try {
          const stats = fs.statSync(filePath);
          return estimatePdfMinutes(stats.size);
        } catch {
          return estimatePdfMinutes(fileSize);
        }
      }
      return estimatePdfMinutes(fileSize);
    }

    if (normalizedUrl.includes("youtube.com") || normalizedUrl.includes("youtu.be")) {
      return 8;
    }

    return 5;
  }
}

module.exports = {
  LmsReadingTimeEstimator,
};
