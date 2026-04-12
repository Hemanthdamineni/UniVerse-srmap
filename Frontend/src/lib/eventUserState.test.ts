import { describe, it, expect } from "vitest";
import { getEventUserState } from "./eventUserState";
import type { EventDetail, CompetitionConfig } from "./campusApi";

describe("eventUserState", () => {
  const baseEvent = {
    id: "evt_1",
    title: "Code Fest",
    type: "event",
    category: "Technical",
    createdAt: "",
    updatedAt: "",
    status: "published",
    createdBy: "usr_org",
    startTime: "2026-05-01T10:00:00Z",
    endTime: "2026-05-02T18:00:00Z"
  } as unknown as EventDetail;

  const baseConfig: CompetitionConfig = {
    isCompetition: true,
    submissionScope: "individual",
    rounds: [
      {
        roundId: "r1",
        title: "Initial Pitch",
        submissionDeadline: "2026-05-01T12:00:00Z",
        maxResubmissions: 2,
        evaluationCriteria: []
      }
    ]
  };

  const basePerms = { canEdit: false, canEvaluate: false, canShortlist: false };

  it("returns defaults for missing user ID", () => {
    const state = getEventUserState(baseEvent, baseConfig, "", {}, basePerms);
    expect(state.role).toBe("visitor");
  });

  it("identifies creator as organizer regardless of permission overrides", () => {
    const state = getEventUserState(baseEvent, baseConfig, "usr_org", {}, undefined);
    expect(state.role).toBe("organizer");
    expect(state.canEdit).toBe(true);
  });

  it("identifies users with explicit backend canEdit permission as organizer", () => {
    const state = getEventUserState(baseEvent, baseConfig, "usr_other", {}, { ...basePerms, canEdit: true });
    expect(state.role).toBe("organizer");
    expect(state.canEdit).toBe(true);
  });

  it("detects submission counts and evaluates limits accurately", () => {
    const submissions = {
      "r1": {
        id: "sub_1",
        eventId: "evt_1",
        roundId: "r1",
        submittedBy: "usr_participant",
        type: "link",
        resubmissionCount: 1, // Has submitted before + this current submission = 2
        decision: "pending",
        linkUrl: "github.com",
        submittedAt: "2026-05-01T11:00:00Z"
      } as unknown as { criteriaScores?: null }
    };
    
    // Deadline is far in future
    const futureConfig = { ...baseConfig, rounds: [{ ...baseConfig.rounds[0], submissionDeadline: "2099-05-01T12:00:00Z" }] };
    
    const state = getEventUserState(baseEvent, futureConfig, "usr_participant", submissions, basePerms);
    
    const roundState = state.roundStates.find((r) => r.roundId === "r1");
    expect(roundState?.submissionState).toBe("submitted");
  });
});
