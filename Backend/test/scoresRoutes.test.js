/**
 * Integration test for GET /api/scores/me.
 *
 * Wires the real createApp with a temp SQLite-backed events store, a fake
 * authenticated session, and a participant who registered + submitted work.
 * Then asserts the JSON response shape matches the contract the frontend uses.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

const { EventsStore } = require("../src/services/events/eventsStore");
const { createCompetitionStore } = require("../src/services/events/competitionStore");
const { createPersistentTeamStore } = require("../src/services/events/persistentTeamStore");
const { createApp } = require("../src/app");

function makeUser(overrides = {}) {
  return {
    role: "student",
    userId: "s1",
    name: "Student",
    email: "student@erp.edu",
    department: "CSE",
    ...overrides,
  };
}

function makeStores() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scores-integration-"));
  const eventsDbPath = path.join(tempDir, "events.sqlite");
  const persistentDbPath = path.join(tempDir, "persistent-teams.sqlite");
  const eventsStore = new EventsStore({ dataDir: tempDir, dbPath: eventsDbPath });
  const competitionStore = createCompetitionStore({ eventsStore, dbPath: eventsDbPath });
  const persistentTeamStore = createPersistentTeamStore({ dbPath: persistentDbPath });
  return { tempDir, eventsStore, competitionStore, persistentTeamStore };
}

function makeFakeSessionStore(currentUser) {
  // The auth middleware calls getOrThrow(sessionId) and reads
  // profileData.TableContent["Register No."] for the userId. We pre-seed
  // a session keyed by sessionId "test-session".
  const sessionId = "test-session";
  const profileData = currentUser
    ? { TableContent: { "Register No.": currentUser.userId, "Student Name": currentUser.name } }
    : { TableContent: {} };
  return {
    async getOrThrow(id) {
      if (id !== sessionId) {
        const err = new Error("Session not found");
        err.status = 401;
        throw err;
      }
      return { loggedIn: Boolean(currentUser), profileData, currentUser };
    },
  };
}

function startApp(stores, currentUser) {
  const sessionStore = makeFakeSessionStore(currentUser);
  const app = createApp({
    sessionStore,
    eventsStore: stores.eventsStore,
    competitionStore: stores.competitionStore,
    persistentTeamStore: stores.persistentTeamStore,
  });
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

function httpGet(port, path, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path, method: "GET", headers: cookie ? { cookie } : {} },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(body) });
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

test("GET /api/scores/me returns real competition + team breakdown", async (t) => {
  const stores = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const student = makeUser({ userId: "s1" });

  // Create one competition event with two rounds; student registers and submits r1.
  const [event] = stores.eventsStore.createEvent(
    {
      title: "Comp",
      description: "comp",
      startAt: "2026-08-01T09:00:00.000Z",
      endAt: "2026-08-30T11:00:00.000Z",
      location: { physical: "Hall" },
      organizer: "Club",
      department: "CSE",
      maxCapacity: 100,
      registrationDeadline: "2026-08-29T23:59:59.000Z",
      visibility: "public",
      status: "published",
      competitionConfig: JSON.stringify({
        isCompetition: true,
        rounds: [
          {
            roundId: "r1",
            title: "Round 1",
            submissionDeadline: "2099-01-01T00:00:00.000Z",
            submissionTypes: ["link"],
            maxResubmissions: 2,
            evaluationCriteria: [{ label: "Innovation", maxScore: 10 }],
            resultsPublished: false,
          },
        ],
      }),
    },
    { user: creator }
  );
  stores.eventsStore.register(event.id, {}, { user: student });
  stores.competitionStore.createSubmission(event.id, "r1", student.userId, {
    type: "link",
    linkUrl: "https://example.com/work",
  });
  stores.persistentTeamStore.createTeam(student.userId, { name: "Squad", inviteRegNos: [] });

  const { server, port } = await startApp(stores, student);
  t.after(() => new Promise((r) => server.close(r)));

  const res = await httpGet(port, "/api/scores/me", "erp_session=test-session");
  assert.equal(res.status, 200);
  assert.equal(res.json.success, true);
  const { competition, team, user } = res.json.data;
  assert.equal(user.id, "s1");
  // Competition: should be > 0 (1 active reg + 1/1 submission progress + recency)
  assert.ok(competition.score > 0, `competition score should be > 0, got ${competition.score}`);
  assert.equal(competition.dimensions.length, 4);
  const ids = competition.dimensions.map((d) => d.id);
  assert.deepEqual(ids, ["participation", "submission-progress", "evaluation", "recency"]);
  for (const dim of competition.dimensions) {
    assert.equal(typeof dim.points, "number");
    assert.equal(typeof dim.max, "number");
    assert.equal(typeof dim.bandLabel, "string");
    assert.equal(typeof dim.progressPct, "number");
    assert.equal(typeof dim.summary, "string");
  }
  // Team: 1 persistent squad (leader) + 0 event teams = leadership=10, roster=4, breadth=5 → 19
  assert.ok(team.score > 0);
  assert.equal(team.dimensions.length, 3);
  const teamIds = team.dimensions.map((d) => d.id);
  assert.deepEqual(teamIds, ["leadership", "roster", "breadth"]);
});

test("GET /api/scores/me requires authentication", async (t) => {
  const stores = makeStores();
  const { server, port } = await startApp(stores, null);
  t.after(() => new Promise((r) => server.close(r)));
  const res = await httpGet(port, "/api/scores/me");
  assert.equal(res.status, 401);
  assert.equal(res.json.success, false);
});
