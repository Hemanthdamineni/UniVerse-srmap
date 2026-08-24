const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const {
  SCRAPER_DIR,
  RUN_NOW_FLAG,
  createCareerScraperSupervisor,
  computeRestartDelayMs,
  resolveScraperCommand,
} = require("../src/services/career/careerScraperSupervisor");

function createFakeStream() {
  const listeners = {};
  return {
    on(event, fn) {
      (listeners[event] ||= []).push(fn);
    },
    emit(event, ...args) {
      (listeners[event] || []).forEach((fn) => fn(...args));
    },
    setEncoding() {},
  };
}

function createFakeChild({ pid = 4242 } = {}) {
  const listeners = {};
  const child = {
    pid,
    exitCode: null,
    signalCode: null,
    lastSignal: null,
    stdout: createFakeStream(),
    stderr: createFakeStream(),
    spawnOptions: null,
    on(event, fn) {
      (listeners[event] ||= []).push(fn);
    },
    emit(event, ...args) {
      (listeners[event] || []).forEach((fn) => fn(...args));
    },
    kill(signal) {
      child.lastSignal = signal;
      return true;
    },
  };
  return child;
}

function createHarness() {
  const timers = [];
  let timerSeq = 0;
  const harness = {
    children: [],
    timers,
    setTimeoutFn(fn, ms) {
      const timer = { id: ++timerSeq, fn, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn(timer) {
      if (timer) timer.cleared = true;
    },
    fireTimer(timer) {
      if (!timer.cleared && !timer.fired) {
        timer.fired = true;
        timer.fn();
      }
    },
    pendingTimers() {
      return timers.filter((timer) => !timer.cleared && !timer.fired);
    },
  };
  harness.spawnFn = (command, args, options) => {
    const child = createFakeChild();
    child.spawnCommand = command;
    child.spawnArgs = args;
    child.spawnOptions = options;
    harness.children.push(child);
    return child;
  };
  return harness;
}

function createSupervisor(harness, overrides = {}) {
  return createCareerScraperSupervisor({
    spawnFn: harness.spawnFn,
    setTimeoutFn: harness.setTimeoutFn,
    clearTimeoutFn: harness.clearTimeoutFn,
    enabled: true,
    baseDelayMs: 1000,
    maxDelayMs: 16000,
    stableUptimeMs: 600000,
    ...overrides,
  });
}

test("computeRestartDelayMs doubles per failure and caps at max", () => {
  assert.equal(computeRestartDelayMs(1, 1000, 16000), 1000);
  assert.equal(computeRestartDelayMs(2, 1000, 16000), 2000);
  assert.equal(computeRestartDelayMs(3, 1000, 16000), 4000);
  assert.equal(computeRestartDelayMs(9, 1000, 16000), 16000);
});

test("resolveScraperCommand returns null when venv python is missing", () => {
  const resolved = resolveScraperCommand({
    scraperDir: "/tmp/no-such-scraper",
    existsFn: () => false,
  });
  assert.equal(resolved, null);
});

test("resolveScraperCommand resolves venv python and main.py entry", () => {
  const resolved = resolveScraperCommand({
    scraperDir: "/fake/scraper",
    existsFn: () => true,
  });
  assert.equal(resolved.command, "/fake/scraper/venv/bin/python3");
  assert.deepEqual(resolved.args, ["main.py"]);
  assert.equal(resolved.cwd, "/fake/scraper");
});

test("start spawns the scraper once and reports running state", () => {
  const harness = createHarness();
  const supervisor = createSupervisor(harness);

  const status = supervisor.start();
  assert.equal(status.state, "running");
  assert.equal(status.pid, 4242);
  assert.equal(harness.children.length, 1);
  assert.equal(harness.children[0].spawnArgs[0], "main.py");
  assert.match(harness.children[0].spawnCommand, /venv\/bin\/python3$/);
  assert.equal(harness.children[0].spawnOptions.cwd, SCRAPER_DIR);

  // Idempotent: a second start must not spawn another process.
  supervisor.start();
  assert.equal(harness.children.length, 1);
});

test("unexpected exit schedules exactly one restart with backoff delay", () => {
  const harness = createHarness();
  const supervisor = createSupervisor(harness);
  supervisor.start();

  harness.children[0].emit("exit", 1, null);
  const status = supervisor.getStatus();
  assert.equal(status.state, "backoff");
  assert.equal(status.failures, 1);

  const pending = harness.pendingTimers();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].ms, 1000);

  harness.fireTimer(pending[0]);
  assert.equal(harness.children.length, 2);
  assert.equal(supervisor.getStatus().state, "running");
});

test("clean exit (lock held by another instance) does not respawn", () => {
  const harness = createHarness();
  const supervisor = createSupervisor(harness);
  supervisor.start();

  harness.children[0].emit("exit", 0, null);
  assert.equal(supervisor.getStatus().state, "exited");
  assert.equal(harness.pendingTimers().length, 0);
});

test("stop kills the running child and ignores later crash events", () => {
  const harness = createHarness();
  const supervisor = createSupervisor(harness);
  supervisor.start();

  supervisor.stop();
  assert.equal(harness.children[0].lastSignal, "SIGTERM");

  // Late exit after stop lands in "stopped", never schedules a restart.
  harness.children[0].emit("exit", 1, null);
  assert.equal(supervisor.getStatus().state, "stopped");
  assert.equal(harness.pendingTimers().length, 0);
});

test("stop clears a pending restart timer", () => {
  const harness = createHarness();
  const supervisor = createSupervisor(harness);
  supervisor.start();

  harness.children[0].emit("exit", 1, null);
  assert.equal(harness.pendingTimers().length, 1);

  supervisor.stop();
  assert.equal(harness.pendingTimers().length, 0);

  // Firing the cleared timer must be a no-op.
  harness.fireTimer(harness.timers[0]);
  assert.equal(harness.children.length, 1);
});

test("stable uptime resets the failure counter before backoff grows", () => {
  let currentTime = 1000000;
  const harness = createHarness();
  const supervisor = createSupervisor(harness, { now: () => currentTime });
  supervisor.start();

  harness.children[0].emit("exit", 1, null);
  assert.equal(supervisor.getStatus().failures, 1);

  // Restart happens while time is still near the first crash.
  harness.fireTimer(harness.pendingTimers()[0]);
  assert.equal(harness.children.length, 2);

  // The replacement process then runs stably past the threshold before crashing.
  currentTime += 10 * 60 * 1000 + 1;
  harness.children[1].emit("exit", 1, null);
  assert.equal(supervisor.getStatus().failures, 1);
  assert.equal(harness.pendingTimers()[0].ms, 1000);
});

test("triggerOnce spawns a one-shot run when no scheduler daemon is alive", () => {
  const harness = createHarness();
  const supervisor = createSupervisor(harness);
  // Never started → no running daemon child.

  const result = supervisor.triggerOnce();
  assert.equal(result.accepted, true);
  assert.equal(result.mode, "oneshot");
  assert.deepEqual(harness.children[0].spawnArgs, ["main.py", "--once"]);
  assert.equal(supervisor.getStatus().onceRunning, true);

  // A second request while one-shot is in flight is rejected.
  const again = supervisor.triggerOnce();
  assert.equal(again.accepted, false);
  assert.equal(harness.children.length, 1);

  harness.children[0].emit("exit", 0, null);
  assert.equal(supervisor.getStatus().onceRunning, false);
});

test("triggerOnce drops the flag file for the live daemon instead of spawning", () => {
  const harness = createHarness();
  const supervisor = createSupervisor(harness);
  supervisor.start();

  const result = supervisor.triggerOnce();
  assert.equal(result.accepted, true);
  assert.equal(result.mode, "daemon");
  // No extra process spawned; only the long-running daemon child exists.
  assert.equal(harness.children.length, 1);
  assert.equal(supervisor.getStatus().onceRunning, false);

  try {
    fs.unlinkSync(RUN_NOW_FLAG);
  } catch {
    // flag already consumed
  }
});
