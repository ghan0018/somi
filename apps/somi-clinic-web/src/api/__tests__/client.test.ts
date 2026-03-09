import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, configureClient } from '../client';

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

const noopRefresh = () => Promise.resolve(null);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('apiFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
    // Reset client configuration so each test starts clean.
    // Use a valid token by default so apiFetch doesn't throw before making the
    // fetch call. Tests that specifically need to exercise the no-token path
    // override this themselves.
    configureClient({
      getToken: () => 'test-token',
      getRefreshToken: () => null,
      tryRefresh: noopRefresh,
      onUnauthorized: () => {},
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  it('prepends /api to the given path', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 200, json: () => Promise.resolve({ ok: true }) })
    );
    global.fetch = mockFetch;

    await apiFetch('/v1/me');

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('/api/v1/me');
  });

  // -------------------------------------------------------------------------
  it('attaches a Bearer token when the configured getToken returns one', async () => {
    const token = 'test-access-token';
    configureClient({
      getToken: () => token,
      getRefreshToken: () => null,
      tryRefresh: noopRefresh,
      onUnauthorized: () => {},
    });

    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 200, json: () => Promise.resolve({}) })
    );
    global.fetch = mockFetch;

    await apiFetch('/v1/me');

    const usedHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(usedHeaders.get('Authorization')).toBe(`Bearer ${token}`);
  });

  // -------------------------------------------------------------------------
  it('throws "Not authenticated" when getToken returns null and refresh fails', async () => {
    configureClient({
      getToken: () => null,
      getRefreshToken: () => null,
      tryRefresh: noopRefresh,
      onUnauthorized: () => {},
    });

    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    await expect(apiFetch('/v1/me')).rejects.toThrow('Not authenticated');

    // The fetch should never have been called — the error is thrown early
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  it('retries with new token when getToken returns null but refresh succeeds', async () => {
    let token: string | null = null;
    configureClient({
      getToken: () => token,
      getRefreshToken: () => 'refresh-token',
      tryRefresh: async () => {
        token = 'refreshed-token';
        return 'refreshed-token';
      },
      onUnauthorized: () => {},
    });

    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 200, json: () => Promise.resolve({ ok: true }) })
    );
    global.fetch = mockFetch;

    await apiFetch('/v1/me');

    expect(mockFetch).toHaveBeenCalledOnce();
    const usedHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(usedHeaders.get('Authorization')).toBe('Bearer refreshed-token');
  });

  // -------------------------------------------------------------------------
  it('attempts refresh on 401 and retries the request', async () => {
    let callCount = 0;
    configureClient({
      getToken: () => 'expired-token',
      getRefreshToken: () => 'refresh-token',
      tryRefresh: async () => 'fresh-token',
      onUnauthorized: () => {},
    });

    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(makeFetchResponse({ status: 401, ok: false }));
      }
      return Promise.resolve(
        makeFetchResponse({ status: 200, json: () => Promise.resolve({ refreshed: true }) })
      );
    });
    global.fetch = mockFetch;

    const result = await apiFetch('/v1/me');

    expect(result).toEqual({ refreshed: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  it('calls onUnauthorized when 401 and refresh fails with no refresh token', async () => {
    const onUnauthorized = vi.fn();
    configureClient({
      getToken: () => 'test-token',
      getRefreshToken: () => null,
      tryRefresh: noopRefresh,
      onUnauthorized,
    });

    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 401, ok: false, statusText: 'Unauthorized' })
    );

    await expect(apiFetch('/v1/me')).rejects.toThrow('Unauthorized');
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  it('does NOT call onUnauthorized when refresh fails transiently but refresh token exists', async () => {
    const onUnauthorized = vi.fn();
    configureClient({
      getToken: () => 'expired-token',
      getRefreshToken: () => 'still-valid-refresh-token',
      tryRefresh: noopRefresh, // returns null (simulates 429 / transient failure)
      onUnauthorized,
    });

    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 401, ok: false })
    );

    await expect(apiFetch('/v1/me')).rejects.toThrow('Unauthorized');
    // Session should NOT be destroyed — refresh token is still valid
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  it('calls onUnauthorized when refresh succeeds but retry still returns 401', async () => {
    const onUnauthorized = vi.fn();
    configureClient({
      getToken: () => 'expired-token',
      getRefreshToken: () => 'refresh-token',
      tryRefresh: async () => 'also-expired-token',
      onUnauthorized,
    });

    // Both the original request and the retry return 401
    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 401, ok: false })
    );

    await expect(apiFetch('/v1/me')).rejects.toThrow('Unauthorized');
    expect(onUnauthorized).toHaveBeenCalledOnce();
    // Original + retry = 2 fetch calls
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  it('deduplicates concurrent refresh attempts into a single tryRefresh call', async () => {
    let refreshCallCount = 0;
    const tryRefresh = vi.fn(async () => {
      refreshCallCount++;
      // Simulate a small async delay so both 401 handlers overlap
      await new Promise((r) => setTimeout(r, 10));
      return 'fresh-token';
    });

    configureClient({
      getToken: () => 'expired-token',
      getRefreshToken: () => 'refresh-token',
      tryRefresh,
      onUnauthorized: () => {},
    });

    let fetchCallCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCallCount++;
      // First two calls (one per concurrent apiFetch) return 401
      // After refresh, retries succeed
      if (fetchCallCount <= 2) {
        return Promise.resolve(makeFetchResponse({ status: 401, ok: false }));
      }
      return Promise.resolve(
        makeFetchResponse({ status: 200, json: () => Promise.resolve({ ok: true }) })
      );
    });

    // Fire two requests concurrently — both should hit 401 and share one refresh
    const [r1, r2] = await Promise.all([
      apiFetch('/v1/exercises'),
      apiFetch('/v1/taxonomy'),
    ]);

    expect(r1).toEqual({ ok: true });
    expect(r2).toEqual({ ok: true });
    // Only ONE refresh call despite two concurrent 401s
    expect(tryRefresh).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  it('calls onUnauthorized when getToken returns null and no refresh token exists', async () => {
    const onUnauthorized = vi.fn();
    configureClient({
      getToken: () => null,
      getRefreshToken: () => null,
      tryRefresh: noopRefresh,
      onUnauthorized,
    });

    global.fetch = vi.fn();

    await expect(apiFetch('/v1/me')).rejects.toThrow('Not authenticated');
    expect(onUnauthorized).toHaveBeenCalledOnce();
    // No fetch call should have been made
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  it('throws with the error code from the response body on non-ok responses', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({
        status: 422,
        ok: false,
        json: () =>
          Promise.resolve({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
          }),
      })
    );

    let caughtError: unknown;
    try {
      await apiFetch('/v1/patients');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe('Invalid input');
    expect((caughtError as any).code).toBe('VALIDATION_ERROR');
    expect((caughtError as any).status).toBe(422);
  });

  // -------------------------------------------------------------------------
  it('throws with statusText when the error body cannot be parsed', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({
        status: 500,
        ok: false,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('not json')),
      })
    );

    await expect(apiFetch('/v1/patients')).rejects.toThrow('Internal Server Error');
  });

  // -------------------------------------------------------------------------
  it('returns undefined for 204 No Content responses', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 204, ok: true })
    );

    const result = await apiFetch('/v1/auth/logout');
    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  it('sets Content-Type to application/json when a body is provided and no Content-Type header is set', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 200, json: () => Promise.resolve({}) })
    );
    global.fetch = mockFetch;

    await apiFetch('/v1/auth/login', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) });

    const usedHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(usedHeaders.get('Content-Type')).toBe('application/json');
  });

  // -------------------------------------------------------------------------
  it('does not override an explicitly provided Content-Type header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 200, json: () => Promise.resolve({}) })
    );
    global.fetch = mockFetch;

    await apiFetch('/v1/uploads', {
      method: 'PUT',
      body: 'raw',
      headers: { 'Content-Type': 'text/plain' },
    });

    const usedHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(usedHeaders.get('Content-Type')).toBe('text/plain');
  });
});
