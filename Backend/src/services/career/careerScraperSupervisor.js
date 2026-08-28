const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const {
  CAREER_SCRAPER_ENABLED,
  CAREER_SCRAPER_RESTART_DELAY_MS,
  CAREER_SCRAPER_RESTART_DELAY_MAX_MS,
} = require("../../config/env");
const { log } = require("../../utils/logger");

// Backend/src/services/career -> repo root
const SCRAPER_DIR = path.resolve(__dirname, "../../../..", "Scraper");
const VENV_PYTHON = "venv/bin/python3";
const SCRAPER_ENTRY = "main.py";
const RUN_NOW_FLAG = path.join(SCRAPER_DIR, ".run-now");
// A run that survives this long is considered healthy; the restart backoff
// resets so a later crash starts again from the base delay.
const STABLE_UPTIME_MS = 10 * 60 * 1000;
const KILL_GRACE_MS = 8000;
// Clean exits faster than this are read as instance-lock contention; later
// ones as external termination that should be respawned.
const LOCK_CONTENTION_WINDOW_MS = 15 * 1000;

function computeRestartDelayMs(failureCount, baseDelayMs, maxDelayMs) {
  const delay = baseDelayMs * Math.pow(2, Math.max(0, failureCount - 1));
  return Math.min(delay, maxDelayMs);
}

function resolveScraperCommand({ scraperDir = SCRAPER_DIR, existsFn = fs.existsSync } = {}) {
  const command = path.join(scraperDir, VENV_PYTHON);
  if (!existsFn(command)) return null;
  return { command, args: [SCRAPER_ENTRY], cwd: scraperDir };
}

function classifyLogLine(line) {
  if (/ \| ERROR\s+\| | \| CRITICAL\s+\| /.test(line)) return "error";
  if (/ \| WARNING\s+\| /.test(line)) return "warn";
  return "info";
}

function createCareerScraperSupervisor(overrides = {}) {
  const spawnFn = overrides.spawnFn || spawn;
  const existsFn = overrides.existsFn || fs.existsSync;
  const setTimeoutFn = overrides.setTimeoutFn || ((fn, ms) => setTimeout(fn, ms));
  const clearTimeoutFn = overrides.clearTimeoutFn || ((timer) => clearTimeout(timer));
  const now = overrides.now || (() => Date.now());
  const enabled = overrides.enabled ?? CAREER_SCRAPER_ENABLED;
  const baseDelayMs = overrides.baseDelayMs ?? CAREER_SCRAPER_RESTART_DELAY_MS;
  const maxDelayMs = overrides.maxDelayMs ?? CAREER_SCRAPER_RESTART_DELAY_MAX_MS;
  const stableUptimeMs = overrides.stableUptimeMs ?? STABLE_UPTIME_MS;
  const scraperDir = overrides.scraperDir || SCRAPER_DIR;

  let state = "idle"; // idle | running | backoff | stopping | stopped | exited | unavailable | disabled
  let child = null;
  let onceChild = null;
  let restartTimer = null;
  let killTimer = null;
  let failureCount = 0;
  let startedAt = 0;
  let startedOnce = false;
  let stopping = false;

  function logScraper(level, msg) {
    log({ level, msg: `[career-scraper] ${msg}` });
  }

  function routeStream(stream, fallbackLevel) {
    let buffer = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) logScraper(classifyLogLine(line) === "info" ? fallbackLevel : classifyLogLine(line), line);
        newlineIndex = buffer.indexOf("\n");
      }
    });
    stream.on("end", () => {
      const line = buffer.trim();
      if (line) logScraper(classifyLogLine(line) === "info" ? fallbackLevel : classifyLogLine(line), line);
      buffer = "";
    });
  }

  function handleExit(code, signal) {
    child = null;
    if (killTimer) {
      clearTimeoutFn(killTimer);
      killTimer = null;
    }
    if (stopping) {
      state = "stopped";
      logScraper("info", `exited (code=${code}, signal=${signal})`);
      return;
    }

    const uptimeMs = now() - startedAt;
    if (uptimeMs >= stableUptimeMs) failureCount = 0;

    // Instant exit-0 without a stop request is the instance-lock signature
    // (another scraper already running) — do not fight it this session. A
    // LATE clean exit means someone SIGTERM'd the child externally; treat it
    // like a crash and respawn so the pipeline self-heals.
    if (code === 0 && uptimeMs < LOCK_CONTENTION_WINDOW_MS) {
      state = "exited";
      logScraper(
        "warn",
        `exited cleanly after ${Math.round(uptimeMs / 1000)}s — another scraper instance likely holds the lock; will not respawn this session`
      );
      return;
    }

    failureCount += 1;
    const delayMs = computeRestartDelayMs(failureCount, baseDelayMs, maxDelayMs);
    state = "backoff";
    log({
      level: "error",
      msg: `[career-scraper] exited unexpectedly (code=${code}, signal=${signal}); restarting in ${Math.round(delayMs / 1000)}s (failure ${failureCount})`,
    });
    restartTimer = setTimeoutFn(() => {
      restartTimer = null;
      spawnChild();
    }, delayMs);
  }

  function spawnChild() {
    if (stopping) return;
    const resolved = resolveScraperCommand({ scraperDir, existsFn });
    if (!resolved) {
      state = "unavailable";
      log({
        level: "warn",
        msg: `[career-scraper] ${VENV_PYTHON} not found under ${SCRAPER_DIR} — run Scraper/setup.sh to enable automatic scraping`,
      });
      return;
    }

    startedAt = now();
    try {
      child = spawnFn(resolved.command, resolved.args, {
        cwd: resolved.cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      child = null;
      state = "unavailable";
      log({ level: "error", msg: "[career-scraper] failed to launch scraper process", error: error?.message });
      return;
    }

    state = "running";
    logScraper("info", `spawned pid=${child.pid}`);
    routeStream(child.stdout, "info");
    routeStream(child.stderr, "warn");
    child.on("error", (error) => {
      child = null;
      state = "unavailable";
      log({ level: "error", msg: "[career-scraper] scraper process error", error: error?.message });
    });
    child.on("exit", (code, signal) => handleExit(code, signal));
  }

  function start() {
    if (startedOnce) return getStatus();
    startedOnce = true;
    stopping = false;
    if (!enabled) {
      state = "disabled";
      logScraper("info", "disabled via CAREER_SCRAPER_ENABLED=0");
      return getStatus();
    }
    spawnChild();
    return getStatus();
  }

  function stop() {
    stopping = true;
    if (restartTimer) {
      clearTimeoutFn(restartTimer);
      restartTimer = null;
    }
    if (!child) {
      state = "stopped";
      return;
    }
    const active = child;
    state = "stopping";
    logScraper("info", "stopping scraper process");
    try {
      active.kill("SIGTERM");
    } catch {
      // already gone
    }
    if (onceChild) {
      try {
        onceChild.kill("SIGTERM");
      } catch {
        // already gone
      }
    }
    killTimer = setTimeoutFn(() => {
      killTimer = null;
      if (child === active && active.exitCode === null && active.signalCode === null) {
        logScraper("warn", "graceful stop timed out; sending SIGKILL");
        try {
          active.kill("SIGKILL");
        } catch {
          // already gone
        }
      }
    }, KILL_GRACE_MS);
  }

  function triggerOnce() {
    const status = getStatus();
    if (status.state === "running" && child) {
      // Daemon alive: drop the flag file it polls — no second process, and
      // the single-instance lock is respected by construction.
      try {
        fs.writeFileSync(RUN_NOW_FLAG, String(Date.now()));
        return {
          accepted: true,
          mode: "daemon",
          detail: "scheduler will start a run within ~1s",
        };
      } catch (error) {
        return { accepted: false, mode: "daemon", reason: error?.message };
      }
    }

    if (onceChild) {
      return { accepted: false, mode: "oneshot", reason: "a one-shot run is already in progress" };
    }

    const resolved = resolveScraperCommand({ scraperDir, existsFn });
    if (!resolved) {
      return { accepted: false, mode: "oneshot", reason: "scraper runtime missing — run Scraper/setup.sh first" };
    }

    try {
      onceChild = spawnFn(resolved.command, [...resolved.args, "--once"], {
        cwd: resolved.cwd,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      onceChild = null;
      return { accepted: false, mode: "oneshot", reason: error?.message };
    }

    logScraper("info", `one-shot run spawned pid=${onceChild.pid}`);
    routeStream(onceChild.stdout, "info");
    routeStream(onceChild.stderr, "warn");
    onceChild.on("error", (error) => {
      log({ level: "error", msg: "[career-scraper] one-shot run failed to launch", error: error?.message });
      onceChild = null;
    });
    onceChild.on("exit", (code, signal) => {
      logScraper(code === 0 ? "info" : "warn", `one-shot run finished (code=${code}, signal=${signal})`);
      onceChild = null;
    });
    return { accepted: true, mode: "oneshot", pid: onceChild.pid };
  }

  function getStatus() {
    return {
      state,
      pid: child ? child.pid : null,
      failures: failureCount,
      onceRunning: Boolean(onceChild),
    };
  }

  return { start, stop, triggerOnce, getStatus };
}

module.exports = {
  SCRAPER_DIR,
  createCareerScraperSupervisor,
  computeRestartDelayMs,
  resolveScraperCommand,
};
