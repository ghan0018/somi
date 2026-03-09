const BASE = '/api';

let getToken: (() => string | null) | null = null;
let getRefreshToken: (() => string | null) | null = null;
let tryRefresh: (() => Promise<string | null>) | null = null;
let onUnauthorized: (() => void) | null = null;

// Deduplicates concurrent refresh attempts so multiple 401s
// don't each trigger their own refresh call.
let activeRefresh: Promise<string | null> | null = null;

export function configureClient(opts: {
  getToken: () => string | null;
  getRefreshToken: () => string | null;
  tryRefresh: () => Promise<string | null>;
  onUnauthorized: () => void;
}) {
  getToken = opts.getToken;
  getRefreshToken = opts.getRefreshToken;
  tryRefresh = opts.tryRefresh;
  onUnauthorized = opts.onUnauthorized;
}

/**
 * Attempt a token refresh, deduplicating concurrent calls.
 * Returns the new access token or null if refresh failed.
 */
async function attemptRefresh(): Promise<string | null> {
  if (!tryRefresh) return null;
  if (!activeRefresh) {
    activeRefresh = tryRefresh().finally(() => {
      activeRefresh = null;
    });
  }
  return activeRefresh;
}

/**
 * Only destroy the session when auth is truly dead — i.e. we have no
 * refresh token left to try.  Transient failures (429, 5xx, network)
 * should surface as errors to the caller but NOT wipe the session.
 */
function endSessionIfUnrecoverable(): void {
  const rt = getRefreshToken?.();
  if (!rt) {
    onUnauthorized?.();
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  let token = getToken?.();

  // No token — try refresh before giving up
  if (!token) {
    token = await attemptRefresh();
    if (!token) {
      endSessionIfUnrecoverable();
      const err = new Error('Not authenticated');
      (err as any).status = 401;
      (err as any).noAuth = true;
      throw err;
    }
  }

  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    // Token expired — attempt refresh and retry once
    const newToken = await attemptRefresh();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      const retryRes = await fetch(`${BASE}${path}`, { ...init, headers });
      if (retryRes.status === 401) {
        onUnauthorized?.();
        throw new Error('Unauthorized');
      }
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => ({}));
        const err = new Error(body?.error?.message ?? retryRes.statusText);
        (err as any).status = retryRes.status;
        (err as any).code = body?.error?.code;
        (err as any).details = body?.error?.details;
        throw err;
      }
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json();
    }
    // Refresh returned null — only nuke session if truly unrecoverable
    endSessionIfUnrecoverable();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message ?? res.statusText);
    (err as any).status = res.status;
    (err as any).code = body?.error?.code;
    (err as any).details = body?.error?.details;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
