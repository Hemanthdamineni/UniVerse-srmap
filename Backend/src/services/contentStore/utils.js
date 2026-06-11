const {
  CONTENT_TYPES,
  RESOURCE_KINDS,
  LEARNING_MATERIAL_GROUPS,
  CONTENT_LIFECYCLE_STATES,
} = require("./constants");

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toNullableInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function toNullableIsoDate(value, fieldName) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`Invalid ${fieldName}`);
    error.status = 400;
    throw error;
  }
  return date.toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeMetadataValue(value, depth = 0) {
  if (depth > 3 || value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeMetadataValue(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }
  if (!isPlainObject(value)) return undefined;

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const sanitized = sanitizeMetadataValue(entry, depth + 1);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }
  return result;
}

function parseMetadataJson(value) {
  const raw = toSafeString(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeContentType(value) {
  const type = toSafeString(value);
  if (!CONTENT_TYPES.has(type)) {
    const error = new Error("Invalid type. Use event, learning_material, announcement, or page.");
    error.status = 400;
    throw error;
  }
  return type;
}

function normalizeLifecycleState(value, fallback = "published") {
  const state = toSafeString(value || fallback).toLowerCase();
  if (!CONTENT_LIFECYCLE_STATES.has(state)) {
    const error = new Error("Invalid lifecycle state.");
    error.status = 400;
    throw error;
  }
  return state;
}

function normalizeActor(actor = {}) {
  if (typeof actor === "string") {
    return { actorId: toSafeString(actor) || "admin", actorRole: "admin" };
  }
  return {
    actorId: toSafeString(actor.actorId || actor.userId || actor.registerNo) || "admin",
    actorRole: toSafeString(actor.actorRole || actor.role) || "admin",
  };
}

function stableJson(value) {
  if (value === undefined) return null;
  return JSON.stringify(value ?? null);
}

function calculateDiff(before, after) {
  const previous = before || {};
  const next = after || {};
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)]));
  const changes = {};
  for (const key of keys) {
    if (JSON.stringify(previous[key] ?? null) !== JSON.stringify(next[key] ?? null)) {
      changes[key] = {
        before: previous[key] ?? null,
        after: next[key] ?? null,
      };
    }
  }
  return changes;
}

function normalizeMetadata(type, metadata) {
  if (metadata === undefined) return undefined;
  if (metadata === null || metadata === "") return null;
  if (!isPlainObject(metadata)) {
    const error = new Error("metadata must be an object when provided");
    error.status = 400;
    throw error;
  }

  const sanitized = sanitizeMetadataValue(metadata);
  const normalized = isPlainObject(sanitized) ? { ...sanitized } : {};

  if (normalized.year !== undefined) {
    normalized.year = toNullableInteger(normalized.year);
  }
  if (normalized.semester !== undefined) {
    normalized.semester = toNullableInteger(normalized.semester);
  }
  if (normalized.courseCode !== undefined) {
    normalized.courseCode = toSafeString(normalized.courseCode).toUpperCase();
  }
  if (normalized.courseName !== undefined) {
    normalized.courseName = toSafeString(normalized.courseName);
  }
  if (normalized.subjectCode !== undefined) {
    normalized.subjectCode = toSafeString(normalized.subjectCode).toUpperCase();
  }
  if (normalized.subjectName !== undefined) {
    normalized.subjectName = toSafeString(normalized.subjectName);
  }
  if (normalized.resourceGroup !== undefined) {
    normalized.resourceGroup = toSafeString(normalized.resourceGroup).toLowerCase();
  }
  if (normalized.tags !== undefined) {
    normalized.tags = Array.isArray(normalized.tags)
      ? normalized.tags.map((entry) => toSafeString(entry)).filter(Boolean)
      : [];
  }

  if (
    type === "learning_material" &&
    normalized.resourceGroup &&
    !LEARNING_MATERIAL_GROUPS.has(normalized.resourceGroup)
  ) {
    const error = new Error(
      "metadata.resourceGroup must be one of pyq-mid, pyq-sem, slides, notes, links, videos, or roadmaps."
    );
    error.status = 400;
    throw error;
  }

  return Object.keys(normalized).length ? normalized : null;
}

function detectResourceKind(resource) {
  const explicitKind = toSafeString(resource.kind).toLowerCase();
  if (RESOURCE_KINDS.has(explicitKind)) return explicitKind;

  const mime = toSafeString(resource.mime_type || resource.mimeType).toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("powerpoint") || mime.includes("presentation")) return "ppt";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("msword") || mime.includes("officedocument.wordprocessingml")) return "doc";

  const url = toSafeString(resource.url_or_path || resource.url).toLowerCase();
  if (url.endsWith(".pdf")) return "pdf";
  if (url.endsWith(".ppt") || url.endsWith(".pptx")) return "ppt";
  if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/.test(url)) return "image";
  if (/\.(mp4|mov|webm|mkv)(\?|$)/.test(url)) return "video";
  if (/\.(doc|docx|rtf)(\?|$)/.test(url)) return "doc";
  return "link";
}

function looksLikeAbsoluteUrl(value) {
  return /^(https?:)?\/\//i.test(toSafeString(value));
}

function inferTypeFromPageKey(pageKey) {
  const key = toSafeString(pageKey).toLowerCase();
  if (key.startsWith("events/")) return "event";
  if (key.startsWith("resources/")) return "learning_material";
  if (key.includes("announcement") || key.includes("notification")) return "announcement";
  return "page";
}

function toPageTitle(pageKey) {
  return toSafeString(pageKey)
    .split("/")
    .join(" / ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

module.exports = {
  nowIso,
  toSafeString,
  toNullableInteger,
  toNullableIsoDate,
  isPlainObject,
  sanitizeMetadataValue,
  parseMetadataJson,
  normalizeContentType,
  normalizeLifecycleState,
  normalizeActor,
  stableJson,
  calculateDiff,
  normalizeMetadata,
  detectResourceKind,
  looksLikeAbsoluteUrl,
  inferTypeFromPageKey,
  toPageTitle,
};
