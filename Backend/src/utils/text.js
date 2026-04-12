function cleanText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeText(value = "") {
  return cleanText(value).toLowerCase();
}

function normalizeSubitem(value = "") {
  return normalizeText(value).replace(/\bnew\b/g, "").replace(/\s+/g, " ").trim();
}

function toSafeHeaderKey(value, index) {
  const cleaned = cleanText(value);
  if (!cleaned) return `col${index + 1}`;
  return cleaned;
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

module.exports = {
  cleanText,
  normalizeText,
  normalizeSubitem,
  toSafeHeaderKey,
  slugify,
};
