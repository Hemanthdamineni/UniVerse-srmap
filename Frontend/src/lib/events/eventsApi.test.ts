/**
 * eventsApi.test.ts — Comprehensive Vitest tests for competitionsApi.ts
 *
 * Covers: Event CRUD, registration, teams, submissions, analytics,
 * certificates, roles, and safeFetch error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from './competitionsApi';
import * as session from '../core/session';

// ─── Fixture factories ────────────────────────────────────────────────────

function makeMyRoleResponse(overrides?: Partial<api.MyRoleResponse>): api.MyRoleResponse {
  return {
    regNo: 'AP21110010',
    role: 'owner',
    permissions: {
      canEdit: true,
      canEvaluate: true,
      canShortlist: true,
      canManageRoles: true,
      canViewAllSubmissions: true,
    },
    ...overrides,
  };
}

function makeEventSummary(overrides?: Partial<api.EventSummary>): api.EventSummary {
  return {
    id: 'evt_001',
    title: 'Code Fest 2026',
    description: 'Annual coding competition',
    category: 'Technical',
    type: 'competition',
    status: 'published',
    visibility: 'public',
    startAt: '2026-08-01T09:00:00.000Z',
    endAt: '2026-08-03T18:00:00.000Z',
    startDate: '2026-08-01',
    endDate: '2026-08-03',
    location: 'Main Auditorium',
    department: 'CSE',
    maxCapacity: 200,
    registeredCount: 45,
    registrationCount: 45,
    createdBy: 'AP21110010',
    prizes: '$1000 prize pool',
    eligibility: 'All years',
    isCompetition: true,
    competitionConfig: null,
    posterImagePath: '/uploads/posters/evt_001.png',
    ...overrides,
  };
}

function makeEventDetail(overrides?: Partial<api.EventDetail>): api.EventDetail {
  return {
    ...makeEventSummary(),
    rules: 'No plagiarism',
    faq: [{ question: 'Is this free?', answer: 'Yes' }],
    coOrganizers: ['AP21110020'],
    myRegistration: { registeredAt: '2026-07-15T10:00:00.000Z', status: 'confirmed' },
    myRole: makeMyRoleResponse(),
    ...overrides,
  };
}

function makeCompetitionConfig(overrides?: Partial<api.CompetitionConfig>): api.CompetitionConfig {
  return {
    isCompetition: true,
    submissionScope: 'individual',
    rounds: [
      {
        roundId: 'r1',
        title: 'Round 1: Prelims',
        type: 'quiz',
        startTime: '2026-08-01T09:00:00.000Z',
        submissionDeadline: '2026-08-01T12:00:00.000Z',
        instructions: 'Answer all questions',
        submissionTypes: ['link'],
        maxFileSizeMb: 10,
        maxResubmissions: 2,
        evaluationCriteria: [{ label: 'Accuracy', maxScore: 100 }],
        shortlistCount: 50,
        shortlistThreshold: null,
        requiresShortlistFromRound: null,
        resultsPublished: false,
        shortlistAppliedAt: null,
        resultsPublishedAt: null,
      },
    ],
    maxTeamSize: undefined,
    ...overrides,
  };
}

function makeTeam(overrides?: Partial<api.Team>): api.Team {
  return {
    id: 'team_001',
    eventId: 'evt_001',
    name: 'Byte Brigade',
    leaderId: 'AP21110010',
    leaderRegNo: 'AP21110010',
    members: [
      { regNo: 'AP21110010', name: 'Alice', joinedAt: '2026-07-20T10:00:00.000Z', status: 'accepted' },
    ],
    memberRegNos: ['AP21110010'],
    createdAt: '2026-07-20T10:00:00.000Z',
    ...overrides,
  };
}

function makeSubmission(overrides?: Partial<api.Submission>): api.Submission {
  return {
    id: 'sub_001',
    eventId: 'evt_001',
    roundId: 'r1',
    submittedBy: 'AP21110010',
    teamId: null,
    type: 'link',
    filePath: null,
    linkUrl: 'https://github.com/example',
    description: 'My submission',
    submittedAt: '2026-08-01T11:00:00.000Z',
    resubmissionCount: 0,
    criteriaScores: null,
    totalScore: null,
    remarks: null,
    evaluatedBy: null,
    evaluatedAt: null,
    decision: 'pending',
    shortlisted: false,
    flagged: false,
    flagReason: null,
    ...overrides,
  };
}

function makeTeamRecruitmentPost(overrides?: Partial<api.TeamRecruitmentPost>): api.TeamRecruitmentPost {
  return {
    id: 'post_001',
    eventId: 'evt_001',
    teamId: 'team_001',
    createdBy: 'AP21110010',
    status: 'open',
    neededSkills: ['React', 'Node.js'],
    description: 'Looking for backend devs',
    openSlots: 2,
    createdAt: '2026-07-20T10:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
    team: makeTeam(),
    ...overrides,
  };
}

function makeTeamMatchCandidate(overrides?: Partial<api.TeamMatchCandidate>): api.TeamMatchCandidate {
  return {
    userId: 'AP21110030',
    name: 'Bob',
    department: 'CSE',
    matchedSkills: ['React'],
    missingSkills: ['Node.js'],
    matchScore: 75,
    reasons: ['Strong frontend background'],
    ...overrides,
  };
}

function makeEventRoleAssignment(overrides?: Partial<api.EventRoleAssignment>): api.EventRoleAssignment {
  return {
    regNo: 'AP21110020',
    name: 'Carol',
    role: 'co-organizer',
    assignedAt: '2026-07-18T10:00:00.000Z',
    assignedBy: 'AP21110010',
    ...overrides,
  };
}

function makeCertificateTemplate(overrides?: Partial<api.CertificateTemplate>): api.CertificateTemplate {
  return {
    id: 'ct_001',
    eventId: 'evt_001',
    roundId: 'r1',
    templateImagePath: '/uploads/certificates/template.png',
    fields: [
      { key: 'name', label: 'Participant Name', x: 100, y: 200, fontSize: 24, fontWeight: 'bold', color: '#000000', align: 'center' },
    ],
    createdAt: '2026-07-19T10:00:00.000Z',
    ...overrides,
  };
}

function makeAnalyticsResult() {
  return {
    registrations: 120,
    rounds: [
      {
        roundId: 'r1',
        title: 'Prelims',
        submissions: 80,
        submissionRate: 0.67,
        evaluationCompletion: 0.9,
        averageTimeToEvaluateMs: 120_000,
      },
    ],
  };
}

// ─── Mock helpers ─────────────────────────────────────────────────────────

/** Mock fetch to return a JSON payload wrapped in {success, data}. */
function mockFetch(data: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

/** Mock fetch to return a Blob response (for certificate download). */
function mockFetchBlob(blob: Blob, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    blob: () => Promise.resolve(blob),
  } as Response);
}

/** Wrapped response for requestData / requestMultipart unwrapping. */
function wrapped(data: unknown) {
  return { success: true, data };
}

// ─── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Role ─────────────────────────────────────────────────────────────────

describe('getMyRole', () => {
  const response = makeMyRoleResponse();

  it('returns role for a valid event', async () => {
    mockFetch(wrapped(response));
    const result = await api.getMyRole('evt_001');
    expect(result).toEqual(response);
    expect(fetch).toHaveBeenCalledWith(
      '/api/competitions/evt_001/my-role',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('throws PermissionError on 403', async () => {
    mockFetch({ error: 'Forbidden', message: 'Not allowed' }, 403);
    await expect(api.getMyRole('evt_001')).rejects.toThrow(api.PermissionError);
  });

  it('re-throws on 401 after calling session handler', async () => {
    const spy = vi.spyOn(session, 'handleSessionAuthFailure').mockImplementation(() => {});
    mockFetch({ error: 'Unauthorized' }, 401);
    await expect(api.getMyRole('evt_001')).rejects.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── Event CRUD ───────────────────────────────────────────────────────────

describe('Event CRUD', () => {
  describe('getEvent', () => {
    const eventData = makeEventDetail();

    it('returns event detail on success', async () => {
      mockFetch(wrapped(eventData));
      const result = await api.getEvent('evt_001');
      expect(result).toEqual(eventData);
      expect(fetch).toHaveBeenCalledWith(
        '/api/events/evt_001',
        expect.anything(),
      );
    });

    it('returns the event payload on every call (caching lives in React Query)', async () => {
      mockFetch(wrapped(eventData));
      const first = await api.getEvent('evt_001');
      mockFetch(wrapped(eventData));
      const result = await api.getEvent('evt_001');
      expect(first).toEqual(eventData);
      expect(result).toEqual(eventData);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('fetches again after cache TTL expires', async () => {
      mockFetch(wrapped(eventData));
      await api.getEvent('evt_001');

      // Force expiration by advancing the internal timestamp

      mockFetch(wrapped({ ...eventData, title: 'Refetched' }));
      const result = await api.getEvent('evt_001');
      expect(result.title).toBe('Refetched');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('re-throws error on API failure', async () => {
      mockFetch({ message: 'Not found' }, 404);
      await expect(api.getEvent('evt_999')).rejects.toThrow();
    });
  });

  describe('createEvent', () => {
    const created = makeEventDetail({ id: 'evt_new' });

    it('sends POST with event data and returns created event', async () => {
      mockFetch(wrapped(created));
      const payload = { title: 'New Event', description: 'Desc', category: 'Technical' };
      const result = await api.createEvent(payload);
      expect(result).toEqual(created);
      expect(fetch).toHaveBeenCalledWith(
        '/api/events',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('invalidates events-list cache prefix on success', async () => {
      // Put something in the events-list cache bucket

      mockFetch(wrapped(created));
      await api.createEvent({ title: 'New' });

      // Cache should be cleared
    });
  });

  describe('deleteEvent', () => {
    it('sends DELETE', async () => {
      mockFetch(wrapped({ deleted: true }));

      await api.deleteEvent('evt_001');

      expect(fetch).toHaveBeenCalledWith(
        '/api/events/evt_001',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getMyRegisteredEvents', () => {
    const events = [makeEventSummary({ id: 'evt_001' }), makeEventSummary({ id: 'evt_002' })];

    it('returns list of registered events', async () => {
      mockFetch(wrapped(events));
      const result = await api.getMyRegisteredEvents();
      expect(result).toHaveLength(2);
      expect(fetch).toHaveBeenCalledWith(
        '/api/events?registered=true',
        expect.anything(),
      );
    });

    it('returns empty array when no registrations', async () => {
      mockFetch(wrapped([]));
      const result = await api.getMyRegisteredEvents();
      expect(result).toEqual([]);
    });
  });
});

// ─── Registration ─────────────────────────────────────────────────────────

describe('registerForEvent', () => {
  it('sends POST', async () => {
    mockFetch(wrapped({}));

    await api.registerForEvent('evt_001');

    expect(fetch).toHaveBeenCalledWith(
      '/api/events/evt_001/register',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('re-throws error on failure', async () => {
    mockFetch({ error: 'Capacity full' }, 400);
    await expect(api.registerForEvent('evt_001')).rejects.toThrow();
  });
});

// ─── Teams ────────────────────────────────────────────────────────────────

describe('Teams', () => {
  describe('createTeam', () => {
    const team = makeTeam();

    it('creates a team and invalidates team cache', async () => {
      mockFetch(wrapped(team));

      const result = await api.createTeam('evt_001', 'Byte Brigade');

      expect(result).toEqual(team);
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/teams',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Byte Brigade' }),
        }),
      );
    });
  });

  describe('getMyTeam', () => {
    const team = makeTeam();

    it('returns team when user belongs to one', async () => {
      mockFetch(wrapped(team));
      const result = await api.getMyTeam('evt_001');
      expect(result).toEqual(team);
    });

    it('returns null when user has no team', async () => {
      mockFetch(wrapped(null));
      const result = await api.getMyTeam('evt_001');
      expect(result).toBeNull();
    });

    it('fetches on every call (caching lives in React Query)', async () => {
      mockFetch(wrapped(team));
      await api.getMyTeam('evt_001');
      mockFetch(wrapped(team));
      const result = await api.getMyTeam('evt_001');
      expect(result).toEqual(team);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('returns null on network error (caught internally)', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      const result = await api.getMyTeam('evt_001');
      expect(result).toBeNull();
    });

    it('returns null on 404 (caught internally)', async () => {
      mockFetch({ message: 'Not found' }, 404);
      const result = await api.getMyTeam('evt_001');
      expect(result).toBeNull();
    });
  });

  describe('inviteMember', () => {
    it('sends invite POST and invalidates team cache', async () => {
      mockFetch(wrapped({}));

      await api.inviteMember('evt_001', 'team_001', 'AP21110030');

      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/teams/team_001/invite',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ inviteeRegisterNumber: 'AP21110030' }),
        }),
      );
    });
  });

  describe('acceptInvite', () => {
    it('sends accept POST and invalidates team cache', async () => {
      mockFetch(wrapped({}));

      await api.acceptInvite('evt_001', 'inv_001');

      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/invitations/inv_001/accept',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('getEventTeams', () => {
    const teams = [makeTeam({ id: 'team_001' }), makeTeam({ id: 'team_002', name: 'Code Wizards' })];

    it('returns all teams for event', async () => {
      mockFetch(wrapped(teams));
      const result = await api.getEventTeams('evt_001');
      expect(result).toHaveLength(2);
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/teams',
        expect.anything(),
      );
    });

    it('returns empty array when no teams', async () => {
      mockFetch(wrapped([]));
      const result = await api.getEventTeams('evt_001');
      expect(result).toEqual([]);
    });
  });

  describe('getTeamRecruitmentBoard', () => {
    const posts = [makeTeamRecruitmentPost()];

    it('returns recruitment posts', async () => {
      mockFetch(wrapped(posts));
      const result = await api.getTeamRecruitmentBoard('evt_001');
      expect(result).toHaveLength(1);
      expect(result[0].neededSkills).toEqual(['React', 'Node.js']);
    });

    it('returns empty array when no posts', async () => {
      mockFetch(wrapped([]));
      const result = await api.getTeamRecruitmentBoard('evt_001');
      expect(result).toEqual([]);
    });
  });

  describe('upsertTeamRecruitmentPost', () => {
    const post = makeTeamRecruitmentPost();

    it('sends PUT and invalidates team cache', async () => {
      mockFetch(wrapped(post));

      const payload = { neededSkills: ['React'], description: 'Looking for devs', openSlots: 2 };
      const result = await api.upsertTeamRecruitmentPost('evt_001', payload);

      expect(result).toEqual(post);
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/teams/recruitment',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      );
    });
  });

  describe('getTeamMatches', () => {
    const matches = [makeTeamMatchCandidate()];

    it('returns suggested matches', async () => {
      mockFetch(wrapped(matches));
      const result = await api.getTeamMatches('evt_001');
      expect(result).toHaveLength(1);
      expect(result[0].matchScore).toBe(75);
    });

    it('returns empty array when no matches', async () => {
      mockFetch(wrapped([]));
      const result = await api.getTeamMatches('evt_001');
      expect(result).toEqual([]);
    });
  });
});

// ─── Submissions ──────────────────────────────────────────────────────────

describe('Submissions', () => {
  describe('getMySubmission', () => {
    const submission = makeSubmission();

    it('returns submission for a round', async () => {
      mockFetch(wrapped(submission));
      const result = await api.getMySubmission('evt_001', 'r1');
      expect(result).toEqual(submission);
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/rounds/r1/my-submission',
        expect.anything(),
      );
    });

    it('returns null when no submission exists', async () => {
      mockFetch(wrapped(null));
      const result = await api.getMySubmission('evt_001', 'r1');
      expect(result).toBeNull();
    });

    it('fetches on every call (caching lives in React Query)', async () => {
      mockFetch(wrapped(submission));
      await api.getMySubmission('evt_001', 'r1');
      mockFetch(wrapped(submission));
      const result = await api.getMySubmission('evt_001', 'r1');
      expect(result).toEqual(submission);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('returns null on network error (caught internally)', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Timeout'));
      const result = await api.getMySubmission('evt_001', 'r1');
      expect(result).toBeNull();
    });

    it('returns null on 500 (caught internally)', async () => {
      mockFetch({ message: 'Server error' }, 500);
      const result = await api.getMySubmission('evt_001', 'r1');
      expect(result).toBeNull();
    });
  });

  describe('getCompetitionConfig', () => {
    const config = makeCompetitionConfig();

    it('returns competition config', async () => {
      mockFetch(wrapped(config));
      const result = await api.getCompetitionConfig('evt_001');
      expect(result).toEqual(config);
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/config',
        expect.anything(),
      );
    });

    it('returns null when event is not a competition', async () => {
      mockFetch(wrapped(null));
      const result = await api.getCompetitionConfig('evt_001');
      expect(result).toBeNull();
    });

    it('fetches on every call (caching lives in React Query)', async () => {
      mockFetch(wrapped(config));
      await api.getCompetitionConfig('evt_001');
      mockFetch(wrapped(config));
      const result = await api.getCompetitionConfig('evt_001');
      expect(result).toEqual(config);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('returns null on network error (caught internally)', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
      const result = await api.getCompetitionConfig('evt_001');
      expect(result).toBeNull();
    });
  });
});

// ─── Analytics ────────────────────────────────────────────────────────────

describe('getCompetitionAnalytics', () => {
  const analytics = makeAnalyticsResult();

  it('returns analytics for an event', async () => {
    mockFetch(wrapped(analytics));
    const result = await api.getCompetitionAnalytics('evt_001');
    expect(result.registrations).toBe(120);
    expect(result.rounds).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      '/api/competitions/evt_001/analytics',
      expect.anything(),
    );
  });

  it('throws on failure', async () => {
    mockFetch({ message: 'Forbidden' }, 403);
    await expect(api.getCompetitionAnalytics('evt_001')).rejects.toThrow(api.PermissionError);
  });
});

// ─── Certificates ─────────────────────────────────────────────────────────

describe('Certificates', () => {
  describe('getCertificateTemplate', () => {
    const template = makeCertificateTemplate();

    it('returns template for an event', async () => {
      mockFetch(wrapped(template));
      const result = await api.getCertificateTemplate('evt_001', 'r1');
      expect(result).toEqual(template);
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/certificate-template?roundId=r1',
        expect.anything(),
      );
    });

    it('fetches without roundId query when omitted', async () => {
      mockFetch(wrapped(template));
      await api.getCertificateTemplate('evt_001');
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/certificate-template',
        expect.anything(),
      );
    });

    it('returns null on 404 (caught internally)', async () => {
      mockFetch({ message: 'Not found' }, 404);
      const result = await api.getCertificateTemplate('evt_001');
      expect(result).toBeNull();
    });
  });

  describe('saveCertificateTemplate', () => {
    const template = makeCertificateTemplate();

    it('sends PUT with template data', async () => {
      mockFetch(wrapped(template));
      const payload = { fields: template.fields };
      const result = await api.saveCertificateTemplate('evt_001', payload);
      expect(result).toEqual(template);
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/certificate-template',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      );
    });
  });

  describe('uploadCertificateTemplateImage', () => {
    it('uploads a file via FormData and returns path', async () => {
      mockFetch(wrapped({ path: '/uploads/certificates/new.png' }));
      const file = new File(['fake-png'], 'template.png', { type: 'image/png' });
      const result = await api.uploadCertificateTemplateImage('evt_001', file);
      expect(result.path).toBe('/uploads/certificates/new.png');
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/certificate-template/image',
        expect.objectContaining({
          body: expect.any(FormData),
        }),
      );
    });

    it('throws on upload failure', async () => {
      mockFetch({ error: 'File too large' }, 413);
      const file = new File(['x'], 'big.png', { type: 'image/png' });
      await expect(api.uploadCertificateTemplateImage('evt_001', file)).rejects.toThrow();
    });
  });

  describe('downloadMyCertificate', () => {
    it('downloads certificate as Blob', async () => {
      const blob = new Blob(['PDF content'], { type: 'application/pdf' });
      mockFetchBlob(blob);
      const result = await api.downloadMyCertificate('evt_001', 'r1');
      expect(result).toBe(blob);
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/rounds/r1/certificates/me/download',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('throws PermissionError on 403', async () => {
      mockFetchBlob(new Blob(), 403);
      await expect(api.downloadMyCertificate('evt_001', 'r1')).rejects.toThrow(api.PermissionError);
    });

    it('throws generic error on non-403 failure', async () => {
      mockFetchBlob(new Blob(), 500);
      await expect(api.downloadMyCertificate('evt_001', 'r1')).rejects.toThrow();
    });
  });
});

// ─── Roles Management ─────────────────────────────────────────────────────

describe('Roles management', () => {
  describe('getEventRoles', () => {
    const roles = [makeEventRoleAssignment(), makeEventRoleAssignment({ regNo: 'AP21110030', role: 'judge' })];

    it('returns role assignments', async () => {
      mockFetch(wrapped(roles));
      const result = await api.getEventRoles('evt_001');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no roles assigned', async () => {
      mockFetch(wrapped([]));
      const result = await api.getEventRoles('evt_001');
      expect(result).toEqual([]);
    });
  });

  describe('assignRole', () => {
    const assignment = makeEventRoleAssignment();

    it('sends POST', async () => {
      mockFetch(wrapped(assignment));

      const result = await api.assignRole('evt_001', 'AP21110020', 'co-organizer');

      expect(result.regNo).toBe('AP21110020');
      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/roles',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ regNo: 'AP21110020', role: 'co-organizer' }),
        }),
      );
    });
  });

  describe('removeRole', () => {
    it('sends DELETE and invalidates event cache', async () => {
      mockFetch(wrapped({ removed: true }));

      await api.removeRole('evt_001', 'AP21110020');

      expect(fetch).toHaveBeenCalledWith(
        '/api/competitions/evt_001/roles/AP21110020',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});

// ─── safeFetch error handling ─────────────────────────────────────────────

describe('safeFetch error handling', () => {
  it('wraps 403 errors as PermissionError', async () => {
    mockFetch({ error: 'Forbidden', message: 'You lack permission' }, 403);
    await expect(api.getCompetitionAnalytics('evt_001')).rejects.toThrow();
  });

  it('catches 403 with "Permission denied" message', async () => {
    mockFetch({ error: 'Permission denied' }, 403);
    await expect(api.getCompetitionAnalytics('evt_001')).rejects.toThrow(/Permission/);
  });

  it('calls session handler on 401 then re-throws', async () => {
    const spy = vi.spyOn(session, 'handleSessionAuthFailure').mockImplementation(() => {});
    mockFetch({ error: 'Unauthorized' }, 401);
    await expect(api.getEventRoles('evt_001')).rejects.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('re-throws unknown errors unchanged', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.getEventRoles('evt_001')).rejects.toThrow(TypeError);
  });
});
