import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureClient } from '../client';
import {
  getTherapistPlan,
  createPlan,
  replacePlan,
  publishPlan,
  archivePlan,
  advanceSession,
  revertToDraft,
  updatePlanSettings,
} from '../plans';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchResponse(opts: {
  status: number;
  ok?: boolean;
  json?: () => Promise<unknown>;
  statusText?: string;
}): Response {
  return {
    status: opts.status,
    ok: opts.ok ?? (opts.status >= 200 && opts.status < 300),
    statusText: opts.statusText ?? '',
    json: opts.json ?? (() => Promise.resolve({})),
    headers: new Headers(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('plans API', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
    configureClient({
      getToken: () => 'test-token',
      getRefreshToken: () => null,
      tryRefresh: () => Promise.resolve(null),
      onUnauthorized: () => {},
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // getTherapistPlan
  // -------------------------------------------------------------------------

  describe('getTherapistPlan', () => {
    it('returns the plan when the API responds with 200', async () => {
      const plan = { planId: 'plan-1', status: 'draft', sessions: [] };
      global.fetch = vi.fn().mockResolvedValue(
        makeFetchResponse({ status: 200, json: () => Promise.resolve(plan) }),
      );

      const result = await getTherapistPlan('pat-abc');

      expect(result).toEqual(plan);
      expect(global.fetch).toHaveBeenCalledOnce();
      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(url).toBe('/api/v1/clinic/patients/pat-abc/plan');
    });

    it('returns null when the API responds with 404 (no plan exists)', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeFetchResponse({
          status: 404,
          ok: false,
          json: () =>
            Promise.resolve({
              error: { message: 'No treatment plan found for this patient' },
            }),
        }),
      );

      const result = await getTherapistPlan('pat-abc');

      expect(result).toBeNull();
    });

    it('throws on non-404 errors (e.g. 500)', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeFetchResponse({
          status: 500,
          ok: false,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ error: { message: 'Server error' } }),
        }),
      );

      await expect(getTherapistPlan('pat-abc')).rejects.toThrow('Server error');
    });

    it('throws on 403 Forbidden (not swallowed as null)', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        makeFetchResponse({
          status: 403,
          ok: false,
          json: () => Promise.resolve({ error: { message: 'Forbidden' } }),
        }),
      );

      await expect(getTherapistPlan('pat-abc')).rejects.toThrow('Forbidden');
    });
  });

  // -------------------------------------------------------------------------
  // createPlan
  // -------------------------------------------------------------------------

  describe('createPlan', () => {
    it('sends POST with sessions and returns the created plan', async () => {
      const plan = { planId: 'plan-new', status: 'draft', sessions: [] };
      const mockFetch = vi.fn().mockResolvedValue(
        makeFetchResponse({ status: 201, json: () => Promise.resolve(plan) }),
      );
      global.fetch = mockFetch;

      const sessions = [{ timesPerDay: 1, assignments: [{ exerciseId: 'ex-1' }] }];
      const result = await createPlan('pat-abc', sessions);

      expect(result).toEqual(plan);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/clinic/patients/pat-abc/plan');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ sessions });
    });
  });

  // -------------------------------------------------------------------------
  // replacePlan
  // -------------------------------------------------------------------------

  describe('replacePlan', () => {
    it('sends PUT with sessions to the correct plan URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeFetchResponse({ status: 204, ok: true }),
      );
      global.fetch = mockFetch;

      const sessions = [{ timesPerDay: 2, assignments: [{ exerciseId: 'ex-2' }] }];
      await replacePlan('pat-abc', 'plan-1', sessions);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/clinic/patients/pat-abc/plan/plan-1');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({ sessions });
    });
  });

  // -------------------------------------------------------------------------
  // publishPlan
  // -------------------------------------------------------------------------

  describe('publishPlan', () => {
    it('sends POST to the publish endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeFetchResponse({ status: 204, ok: true }),
      );
      global.fetch = mockFetch;

      await publishPlan('pat-abc', 'plan-1');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/clinic/patients/pat-abc/plan/plan-1/publish');
      expect(init.method).toBe('POST');
    });
  });

  // -------------------------------------------------------------------------
  // archivePlan
  // -------------------------------------------------------------------------

  describe('archivePlan', () => {
    it('sends POST to the archive endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeFetchResponse({ status: 204, ok: true }),
      );
      global.fetch = mockFetch;

      await archivePlan('pat-abc', 'plan-1');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/clinic/patients/pat-abc/plan/plan-1/archive');
      expect(init.method).toBe('POST');
    });
  });

  // -------------------------------------------------------------------------
  // updatePlanSettings
  // -------------------------------------------------------------------------

  describe('updatePlanSettings', () => {
    it('sends PATCH with remindersEnabled', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeFetchResponse({ status: 204, ok: true }),
      );
      global.fetch = mockFetch;

      await updatePlanSettings('pat-abc', 'plan-1', { remindersEnabled: true });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/clinic/patients/pat-abc/plan/plan-1');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body)).toEqual({ remindersEnabled: true });
    });
  });

  // -------------------------------------------------------------------------
  // advanceSession
  // -------------------------------------------------------------------------

  describe('advanceSession', () => {
    it('sends POST to the advance-session endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeFetchResponse({ status: 204, ok: true }),
      );
      global.fetch = mockFetch;

      await advanceSession('pat-abc', 'plan-1');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/clinic/patients/pat-abc/plan/plan-1/advance-session');
      expect(init.method).toBe('POST');
    });
  });

  // -------------------------------------------------------------------------
  // revertToDraft
  // -------------------------------------------------------------------------

  describe('revertToDraft', () => {
    it('sends POST to the revert-to-draft endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeFetchResponse({ status: 204, ok: true }),
      );
      global.fetch = mockFetch;

      await revertToDraft('pat-abc', 'plan-1');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/clinic/patients/pat-abc/plan/plan-1/revert-to-draft');
      expect(init.method).toBe('POST');
    });
  });
});
