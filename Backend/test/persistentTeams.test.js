const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { createPersistentTeamStore } = require("../src/services/events/persistentTeamStore");

function createStore() {
  return createPersistentTeamStore({
    dbPath: path.join(os.tmpdir(), `persistent-teams-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`),
  });
}

function createSession(profileData) {
  return {
    loggedIn: true,
    profileData: {
      TableContent: {
        "Register No.": profileData.userId,
        "Student Name": profileData.name || profileData.userId,
        "Student E-Mail": profileData.email || `${profileData.userId}@example.edu`,
        "Program / Section": "B.Tech CSE / A",
      },
    },
  };
}

function createSessionStore() {
  const sessions = {
    "leader-session": createSession({ userId: "AP23110010001" }),
    "member-session": createSession({ userId: "AP23110010002" }),
    "outsider-session": createSession({ userId: "AP23110010003" }),
  };
  return {
    async getOrThrow(sessionId) {
      const session = sessions[sessionId];
      if (!session) throw new Error("missing session");
      return session;
    },
  };
}

async function invokeRouter(router, { method = "GET", url, headers = {}, body = {} }) {
  return new Promise((resolve, reject) => {
    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    );
    const parsed = new URL(url, "http://localhost");
    const req = {
      method,
      url: `${parsed.pathname}${parsed.search}`,
      originalUrl: `${parsed.pathname}${parsed.search}`,
      baseUrl: "",
      path: parsed.pathname,
      headers: normalizedHeaders,
      body,
      query: Object.fromEntries(parsed.searchParams.entries()),
      header(name) {
        return normalizedHeaders[String(name).toLowerCase()] || "";
      },
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()] || "";
      },
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };

    router.handle(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ status: res.statusCode, body: null });
    });
  });
}

test("persistent team store creates teams with leader membership and pending invitations", () => {
  const store = createStore();
  const team = store.createTeam("AP23110010001", {
    name: "Hackathon Squad",
    inviteRegNos: ["AP23110010002", "AP23110010003"],
  });

  assert.equal(team.name, "Hackathon Squad");
  assert.equal(team.leaderRegNo, "AP23110010001");
  assert.equal(team.members.length, 1);
  assert.equal(team.members[0].status, "accepted");
  assert.equal(team.pendingInvitations.length, 2);

  const leaderTeams = store.listMyTeams("ap23110010001");
  assert.equal(leaderTeams.length, 1);
  assert.equal(store.listMyTeams("AP23110010002").length, 0);

  const invites = store.listMyInvitations("AP23110010002");
  assert.equal(invites.length, 1);
  assert.equal(invites[0].teamName, "Hackathon Squad");
  assert.equal(invites[0].inviterRegisterNumber, "AP23110010001");
  assert.equal(invites[0].status, "pending");
});

test("accepting an invitation adds the invitee as an accepted member", () => {
  const store = createStore();
  const team = store.createTeam("AP23110010001", {
    name: "Robo Team",
    inviteRegNos: ["AP23110010002"],
  });

  const invitation = store.listMyInvitations("AP23110010002")[0];
  store.respondToInvitation("AP23110010002", invitation.id, true);

  const members = store.listMyTeams("AP23110010002");
  assert.equal(members.length, 1);
  assert.deepEqual(
    members[0].members.map((member) => member.regNo),
    ["AP23110010001", "AP23110010002"]
  );

  // A resolved invitation can no longer be responded to.
  assert.throws(
    () => store.respondToInvitation("AP23110010002", invitation.id, false),
    /already been resolved/
  );
});

test("declining keeps the invitee out of the team", () => {
  const store = createStore();
  store.createTeam("AP23110010001", {
    name: "Declined Team",
    inviteRegNos: ["AP23110010003"],
  });

  const invitation = store.listMyInvitations("AP23110010003")[0];
  store.respondToInvitation("AP23110010003", invitation.id, false);

  assert.equal(store.listMyTeams("AP23110010003").length, 0);
  assert.equal(store.listMyInvitations("AP23110010003").length, 0);
});

test("only the leader can delete teams or manage invitations", () => {
  const store = createStore();
  const team = store.createTeam("AP23110010001", {
    name: "Leader Only",
    inviteRegNos: ["AP23110010002"],
  });

  assert.throws(
    () => store.inviteMembers("AP23110010002", team.id, ["AP23110010003"]),
    /Only the team leader/
  );
  assert.throws(
    () => store.cancelInvitation("AP23110010002", team.id, "AP23110010002"),
    /Only the team leader/
  );
  assert.throws(
    () => store.deleteTeam("AP23110010002", team.id),
    /Only the team leader/
  );
});

test("cancelling a pending invitation removes it from the invitee list and allows re-invite", () => {
  const store = createStore();
  const team = store.createTeam("AP23110010001", {
    name: "Reinvite Team",
    inviteRegNos: ["AP23110010002"],
  });

  store.cancelInvitation("AP23110010001", team.id, "AP23110010002");
  assert.equal(store.listMyInvitations("AP23110010002").length, 0);

  const reinvited = store.inviteMembers("AP23110010001", team.id, ["AP23110010002"]);
  assert.equal(reinvited.length, 1);
  assert.equal(reinvited[0].inviteeRegisterNumber, "AP23110010002");

  assert.throws(
    () => store.cancelInvitation("AP23110010001", team.id, "AP23999999999"),
    /Pending invitation not found/
  );
});

test("deleting a team removes it along with its invitations", () => {
  const store = createStore();
  const team = store.createTeam("AP23110010001", {
    name: "Doomed Team",
    inviteRegNos: ["AP23110010002"],
  });

  store.deleteTeam("AP23110010001", team.id);
  assert.equal(store.listMyTeams("AP23110010001").length, 0);
  assert.equal(store.listMyInvitations("AP23110010002").length, 0);
  assert.throws(() => store._getTeamRow(team.id), /Team not found/);
});

test("persistent team HTTP routes cover the frontend contract and enforce auth", async (t) => {
  const { createPersistentTeamRoutes } = require("../src/routes/persistentTeamRoutes");
  const router = createPersistentTeamRoutes({
    persistentTeamStore: createStore(),
    sessionStore: createSessionStore(),
  });

  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const routePath of [
    "/teams/persistent",
    "/teams/persistent/invitations",
    "/teams/persistent/:teamId",
    "/teams/persistent/:teamId/invitations",
    "/teams/persistent/invitations/:invitationId",
    "/teams/persistent/:teamId/invitations/:inviteeRegisterNumber",
  ]) {
    assert.ok(paths.includes(routePath), `missing route ${routePath}`);
  }

  const unauthenticated = await invokeRouter(router, { url: "/teams/persistent" });
  assert.equal(unauthenticated.status, 401);

  const created = await invokeRouter(router, {
    method: "POST",
    url: "/teams/persistent",
    headers: { cookie: "erp_session=leader-session" },
    body: { name: "HTTP Team", inviteRegNos: ["AP23110010002"] },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.success, true);
  const teamId = created.body.data.id;
  assert.ok(teamId);

  const listed = await invokeRouter(router, {
    url: "/teams/persistent",
    headers: { cookie: "erp_session=leader-session" },
  });
  assert.equal(listed.body.data.length, 1);

  const invitations = await invokeRouter(router, {
    url: "/teams/persistent/invitations",
    headers: { cookie: "erp_session=member-session" },
  });
  assert.equal(invitations.body.data.length, 1);

  const accepted = await invokeRouter(router, {
    method: "PATCH",
    url: `/teams/persistent/invitations/${invitations.body.data[0].id}`,
    headers: { cookie: "erp_session=member-session" },
    body: { accept: true },
  });
  assert.equal(accepted.status, 200);

  const memberView = await invokeRouter(router, {
    url: "/teams/persistent",
    headers: { cookie: "erp_session=member-session" },
  });
  assert.equal(memberView.body.data.length, 1);

  const invited = await invokeRouter(router, {
    method: "POST",
    url: `/teams/persistent/${teamId}/invitations`,
    headers: { cookie: "erp_session=leader-session" },
    body: { inviteRegNos: ["AP23110010003"] },
  });
  assert.equal(invited.body.data.length, 1);

  const cancelled = await invokeRouter(router, {
    method: "DELETE",
    url: `/teams/persistent/${teamId}/invitations/AP23110010003`,
    headers: { cookie: "erp_session=leader-session" },
  });
  assert.equal(cancelled.status, 200);

  const forbidden = await invokeRouter(router, {
    method: "DELETE",
    url: `/teams/persistent/${teamId}`,
    headers: { cookie: "erp_session=outsider-session" },
  });
  assert.equal(forbidden.status, 403);

  const deleted = await invokeRouter(router, {
    method: "DELETE",
    url: `/teams/persistent/${teamId}`,
    headers: { cookie: "erp_session=leader-session" },
  });
  assert.equal(deleted.status, 200);
});
