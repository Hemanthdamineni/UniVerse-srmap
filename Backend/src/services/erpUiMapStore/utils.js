function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizePageKey(value) {
  return cleanText(value).toLowerCase().replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeSectionToken(value) {
  return cleanText(value).toLowerCase();
}

function normalizeSectionKey(dropdown, subitem) {
  return `${normalizeSectionToken(dropdown)}::${normalizeSectionToken(subitem)}`;
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeMutationUrl(url) {
  let value = cleanText(url);
  if (!value) return "";

  value = value.replace(/^https?:\/\/[^/]+/i, "");
  value = value.replace(/^\/+/, "");
  if (value.toLowerCase().startsWith("srmapstudentcorner/")) {
    value = value.slice("srmapstudentcorner/".length);
  }

  return value;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

module.exports = {
  cleanText,
  normalizePageKey,
  normalizeSectionToken,
  normalizeSectionKey,
  slugify,
  normalizeMutationUrl,
  cloneJson,
};
