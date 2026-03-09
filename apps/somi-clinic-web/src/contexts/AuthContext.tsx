import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  login as apiLogin,
  verifyMfa,
  logout as apiLogout,
  getMe,
} from '../api/auth';
import { configureClient } from '../api/client';
import { User, LoginResponse, MfaChallengeResponse } from '../types';

// ----------------------------------------------------------------------------
// Storage keys
// ----------------------------------------------------------------------------

const ACCESS_TOKEN_KEY = 'somi_access_token';
const REFRESH_TOKEN_KEY = 'somi_refresh_token';

// ----------------------------------------------------------------------------
// Context shape
// ----------------------------------------------------------------------------

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login(email: string, password: string): Promise<LoginResponse | MfaChallengeResponse>;
  completeMfa(challengeId: string, code: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

function readStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function persistTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearStoredTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keep refs so the configureClient callbacks always read the latest tokens
  // without needing to re-run configureClient on every token change.
  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken;

  const refreshTokenRef = useRef<string | null>(null);
  refreshTokenRef.current = refreshToken;

  // ------------------------------------------------------------------
  // Configure the API client once on mount. The callbacks close over
  // the refs/stable function references so they never go stale.
  // ------------------------------------------------------------------
  const handleUnauthorized = useCallback(() => {
    // Clear the ref immediately so concurrent API calls don't keep
    // sending the expired token before the next React render.
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    clearStoredTokens();
  }, []);

  const handleRefresh = useCallback(async (): Promise<string | null> => {
    const rt = refreshTokenRef.current;
    if (!rt) return null;
    try {
      // Use raw fetch (not apiFetch) because the refresh endpoint
      // authenticates via the refresh token in the body, not a
      // Bearer access token. Using apiFetch would cause a circular
      // failure when the access token is expired.
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        console.warn(`[Auth] Token refresh failed: ${res.status} ${res.statusText}`);
        return null;
      }
      const data = await res.json();
      const { accessToken: newAccess, refreshToken: newRefresh } = data;

      // Update refs immediately so concurrent API calls pick up the new token
      accessTokenRef.current = newAccess;
      refreshTokenRef.current = newRefresh;
      persistTokens(newAccess, newRefresh);
      setAccessToken(newAccess);
      setRefreshToken(newRefresh);

      return newAccess;
    } catch (err) {
      console.warn('[Auth] Token refresh error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    configureClient({
      getToken: () => accessTokenRef.current,
      getRefreshToken: () => refreshTokenRef.current,
      tryRefresh: handleRefresh,
      onUnauthorized: handleUnauthorized,
    });
  }, [handleUnauthorized, handleRefresh]);

  // ------------------------------------------------------------------
  // On mount: restore session from localStorage
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const { accessToken: storedAccess, refreshToken: storedRefresh } = readStoredTokens();

      if (!storedAccess || !storedRefresh) {
        setIsLoading(false);
        return;
      }

      // Optimistically set the tokens so apiFetch / tryRefresh can use them
      accessTokenRef.current = storedAccess;
      refreshTokenRef.current = storedRefresh;

      try {
        const me = await getMe();
        if (cancelled) return;
        setAccessToken(storedAccess);
        setRefreshToken(storedRefresh);
        setUser(me);
      } catch {
        // Token is invalid or expired — attempt a silent refresh.
        // Use raw fetch to avoid apiFetch's auth requirement.
        try {
          const res = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefresh }),
          });
          if (!res.ok) throw new Error('Refresh failed');
          const refreshed = await res.json();
          if (cancelled) return;
          accessTokenRef.current = refreshed.accessToken;
          refreshTokenRef.current = refreshed.refreshToken;
          const me = await getMe();
          if (cancelled) return;
          persistTokens(refreshed.accessToken, refreshed.refreshToken);
          setAccessToken(refreshed.accessToken);
          setRefreshToken(refreshed.refreshToken);
          setUser(me);
        } catch {
          // Refresh also failed — drop tokens and require fresh login
          if (!cancelled) {
            accessTokenRef.current = null;
            refreshTokenRef.current = null;
            clearStoredTokens();
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // login
  // ------------------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResponse | MfaChallengeResponse> => {
      const response = await apiLogin(email, password);

      // MFA required — return the challenge to the caller without touching state
      if ('mfaRequired' in response) {
        return response;
      }

      // Full token response
      const { accessToken: newAccess, refreshToken: newRefresh } = response;
      persistTokens(newAccess, newRefresh);
      accessTokenRef.current = newAccess;
      refreshTokenRef.current = newRefresh;
      setAccessToken(newAccess);
      setRefreshToken(newRefresh);

      const me = await getMe();
      setUser(me);

      return response;
    },
    []
  );

  // ------------------------------------------------------------------
  // completeMfa
  // ------------------------------------------------------------------
  const completeMfa = useCallback(async (challengeId: string, code: string): Promise<void> => {
    const { accessToken: newAccess, refreshToken: newRefresh } = await verifyMfa(
      challengeId,
      code
    );
    persistTokens(newAccess, newRefresh);
    accessTokenRef.current = newAccess;
    refreshTokenRef.current = newRefresh;
    setAccessToken(newAccess);
    setRefreshToken(newRefresh);

    const me = await getMe();
    setUser(me);
  }, []);

  // ------------------------------------------------------------------
  // logout
  // ------------------------------------------------------------------
  const logout = useCallback(() => {
    const currentRefresh = refreshTokenRef.current;

    // Clear local state immediately so the UI reacts at once
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    clearStoredTokens();

    // Fire-and-forget: invalidate the refresh token server-side
    if (currentRefresh) {
      apiLogout(currentRefresh).catch(() => {
        // Best-effort — local session is already cleared
      });
    }
  }, []);

  // ------------------------------------------------------------------
  // Context value
  // ------------------------------------------------------------------
  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    completeMfa,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
