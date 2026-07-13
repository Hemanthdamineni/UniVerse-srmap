const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const { performance } = require("perf_hooks");

const { HelpdeskStore } = require("../src/services/campus/helpdeskStore");

function createStore() {
  return new HelpdeskStore({
    dbPath: path.join(os.tmpdir(), `helpdesk-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
  });
}

const student = {
  role: "student",
  userId: "AP23110010001",
  name: "Student One",
  email: "student@example.edu",
  department: "CSE",
};

const admin = {
  role: "admin",
  userId: "admin-1",
  name: "Admin User",
  email: "admin@example.edu",
  department: "Student Affairs",
};

test("helpdesk lifecycle requires admin ownership, audit trail, and resolution summary", () => {
  const store = createStore();
  const ticket = store.createTicket(
    {
      category: "IT Support",
      priority: "high",
      subject: "ERP login blocked",
      description: "The student portal fails after OTP.",
    },
    { user: student }
  );

  assert.equal(ticket.status, "open");
  assert.equal(ticket.queueState, "new");
  assert.equal(ticket.sla.policyHours, 24);

  assert.throws(
    () => store.updateTicket(ticket.id, { status: "in-progress", note: "Taking ownership" }, { user: student }),
    /Admin access required/
  );
  assert.throws(
    () => store.updateTicket(ticket.id, { status: "resolved", note: "Done" }, { user: admin }),
    /resolutionSummary is required/
  );

  const assigned = store.updateTicket(
    ticket.id,
    {
      status: "in-progress",
      assignedTo: "Asha Rao",
      assignedTeam: "IT Support",
      ownerName: "Asha Rao",
      note: "Taking ownership",
    },
    { user: admin }
  );
  assert.equal(assigned.status, "in-progress");
  assert.equal(assigned.ownerName, "Asha Rao");
  assert.ok(assigned.auditTrail.some((entry) => entry.action === "assigned"));

  store.addReply(ticket.id, { message: "VPN logs show repeated OTP failures.", visibility: "internal" }, { user: admin });
  const studentView = store.getTicket(ticket.id, { user: student });
  assert.equal(studentView.replies.length, 0);

  const resolved = store.updateTicket(
    ticket.id,
    {
      status: "resolved",
      resolutionSummary: "Reset the ERP account lock and verified student login.",
      note: "Resolved after account reset",
    },
    { user: admin }
  );
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolutionSummary, "Reset the ERP account lock and verified student login.");
  assert.ok(resolved.auditTrail.some((entry) => entry.action === "resolved"));
});

test("helpdesk queue segmentation marks breached tickets and reports workload", () => {
  const store = createStore();
  const ticket = store.createTicket(
    {
      category: "Finance",
      priority: "urgent",
      subject: "Fee receipt missing",
      description: "Payment succeeded but no receipt is visible.",
    },
    { user: student }
  );

  const rawTicket = store.ticketById.get(ticket.id);
  rawTicket.slaDueAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  rawTicket.updatedAt = rawTicket.slaDueAt;

  const adminQueue = store.listTickets({ user: admin, filters: { queue: "breached" } });
  assert.equal(adminQueue.items.length, 1);
  assert.equal(adminQueue.items[0].queueState, "breached");
  assert.equal(adminQueue.counts.queues.breached, 1);
  assert.equal(adminQueue.counts.slaBreached, 1);
  assert.ok(adminQueue.workload.some((item) => item.breached === 1));
});

test("helpdesk bulk update handles 100 selected tickets under two seconds", () => {
  const store = createStore();
  const ticketIds = [];
  for (let index = 0; index < 100; index += 1) {
    const ticket = store.createTicket(
      {
        category: "Other",
        priority: index % 2 ? "medium" : "low",
        subject: `Bulk ticket ${index}`,
        description: `Bulk update benchmark ${index}`,
      },
      { user: student }
    );
    ticketIds.push(ticket.id);
  }

  const startedAt = performance.now();
  const result = store.bulkUpdateTickets(
    {
      ticketIds,
      status: "in-progress",
      assignedTeam: "General Help Desk",
      assignedTo: "Ops Desk",
      ownerName: "Ops Desk",
      note: "Bulk triage started",
    },
    { user: admin }
  );
  const durationMs = performance.now() - startedAt;

  assert.equal(result.counts.updated, 100);
  assert.equal(result.counts.failed, 0);
  assert.ok(durationMs < 2000, `bulk update took ${durationMs.toFixed(2)}ms`);
});
