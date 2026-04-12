const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

test("logger writes to configured file with structured JSON lines", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "erp-logger-"));
  const previousEnv = {
    LOG_DIR: process.env.LOG_DIR,
    LOG_FILE_NAME: process.env.LOG_FILE_NAME,
    LOG_LEVEL: process.env.LOG_LEVEL,
  };

  process.env.LOG_DIR = tempDir;
  process.env.LOG_FILE_NAME = "test.log";
  process.env.LOG_LEVEL = "info";

  clearModule("../src/config/env");
  clearModule("../src/utils/logger");

  const logger = require("../src/utils/logger");

  try {
    logger.log({ msg: "hello", requestId: "req-1" });
    logger.error({ msg: "boom", error: new Error("kaput") });
    await logger.flush();

    const logPath = logger.getLogFilePath();
    const lines = fs
      .readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    assert.equal(lines.length, 2);
    assert.equal(lines[0].msg, "hello");
    assert.equal(lines[0].requestId, "req-1");
    assert.equal(lines[0].level, "info");
    assert.equal(lines[1].level, "error");
    assert.equal(lines[1].error.message, "kaput");
  } finally {
    await logger.shutdownLogger();

    if (previousEnv.LOG_DIR === undefined) delete process.env.LOG_DIR;
    else process.env.LOG_DIR = previousEnv.LOG_DIR;

    if (previousEnv.LOG_FILE_NAME === undefined) delete process.env.LOG_FILE_NAME;
    else process.env.LOG_FILE_NAME = previousEnv.LOG_FILE_NAME;

    if (previousEnv.LOG_LEVEL === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = previousEnv.LOG_LEVEL;

    clearModule("../src/utils/logger");
    clearModule("../src/config/env");
  }
});
