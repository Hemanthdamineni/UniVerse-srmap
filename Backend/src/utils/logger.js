const fs = require("fs");
const path = require("path");
const { LOG_DIR, LOG_FILE_NAME, LOG_LEVEL } = require("../config/env");

const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let fileStream = null;
let fileStreamErrored = false;
let filePath = "";

function nowIso() {
  return new Date().toISOString();
}

function currentLogFilePath() {
  if (filePath) return filePath;
  return path.join(LOG_DIR, LOG_FILE_NAME);
}

function serializeError(error) {
  if (!error) return undefined;
  return {
    name: error.name || "Error",
    message: error.message || String(error),
    stack: error.stack || undefined,
    code: error.code || undefined,
    status: error.status || undefined,
  };
}

function toSerializable(value, depth = 0) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Error) return serializeError(value);
  if (typeof value === "bigint") return String(value);
  if (typeof value === "function") return undefined;
  if (typeof value !== "object") return value;
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item, depth + 1));
  }

  const result = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const serialized = toSerializable(nestedValue, depth + 1);
    if (serialized !== undefined) {
      result[key] = serialized;
    }
  }
  return result;
}

function normalizePayload(payload) {
  if (typeof payload === "string") {
    return { msg: payload };
  }

  if (payload instanceof Error) {
    return {
      msg: payload.message || "Unexpected error",
      error: serializeError(payload),
    };
  }

  if (payload && typeof payload === "object") {
    return payload;
  }

  return { msg: String(payload) };
}

function normalizeLevel(level) {
  const normalized = String(level || "info").toLowerCase();
  return LEVEL_PRIORITY[normalized] ? normalized : "info";
}

function shouldLog(level) {
  const configuredLevel = normalizeLevel(LOG_LEVEL);
  return LEVEL_PRIORITY[normalizeLevel(level)] >= LEVEL_PRIORITY[configuredLevel];
}

function ensureFileStream() {
  if (fileStream || fileStreamErrored) {
    return fileStream;
  }

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    filePath = currentLogFilePath();
    fileStream = fs.createWriteStream(filePath, { flags: "a" });
    fileStream.on("error", (error) => {
      fileStreamErrored = true;
      fileStream = null;
      const detail = error?.message || String(error);
      // eslint-disable-next-line no-console
      console.error(`[${nowIso()}] ERROR Logger file stream failed {"file":"${currentLogFilePath()}","detail":"${detail}"}`);
    });
  } catch (error) {
    fileStreamErrored = true;
    const detail = error?.message || String(error);
    // eslint-disable-next-line no-console
    console.error(`[${nowIso()}] ERROR Logger initialization failed {"file":"${currentLogFilePath()}","detail":"${detail}"}`);
  }

  return fileStream;
}

function buildLogEntry(payload) {
  const normalized = normalizePayload(payload);
  const level = normalizeLevel(normalized.level);
  return toSerializable({
    ts: nowIso(),
    level,
    pid: process.pid,
    msg: normalized.msg || "",
    ...normalized,
  });
}

function formatConsoleLine(entry) {
  const meta = { ...entry };
  delete meta.ts;
  delete meta.level;
  delete meta.msg;

  const message = entry.msg || "Log event";
  const base = `[${entry.ts}] ${String(entry.level || "info").toUpperCase()} ${message}`;
  const metaKeys = Object.keys(meta);

  if (!metaKeys.length) {
    return base;
  }

  return `${base} ${JSON.stringify(meta)}`;
}

function writeConsole(entry) {
  const line = formatConsoleLine(entry);
  if (entry.level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
    return;
  }
  if (entry.level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
    return;
  }
  // eslint-disable-next-line no-console
  console.log(line);
}

function writeFile(entry) {
  const stream = ensureFileStream();
  if (!stream) return;
  stream.write(`${JSON.stringify(entry)}\n`);
}

function log(payload) {
  const entry = buildLogEntry(payload);
  if (!shouldLog(entry.level)) return;
  writeConsole(entry);
  writeFile(entry);
}

function error(payload) {
  log({
    level: "error",
    ...normalizePayload(payload),
  });
}

function debug(payload) {
  log({
    level: "debug",
    ...normalizePayload(payload),
  });
}

function info(payload) {
  log({
    level: "info",
    ...normalizePayload(payload),
  });
}

function warn(payload) {
  log({
    level: "warn",
    ...normalizePayload(payload),
  });
}

function flush() {
  return new Promise((resolve) => {
    if (!fileStream) {
      resolve();
      return;
    }

    fileStream.write("", resolve);
  });
}

function shutdownLogger() {
  return new Promise((resolve) => {
    if (!fileStream) {
      resolve();
      return;
    }

    const stream = fileStream;
    fileStream = null;
    stream.end(resolve);
  });
}

function getLogFilePath() {
  return currentLogFilePath();
}

module.exports = {
  nowIso,
  log,
  debug,
  info,
  warn,
  error,
  flush,
  shutdownLogger,
  getLogFilePath,
};
