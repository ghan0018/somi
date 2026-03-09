import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../AuthContext';

// ---------------------------------------------------------------------------
// Module mocks — must be declared at the top level so Vitest hoists them.
// ---------------------------------------------------------------------------

vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  verifyMfa: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  configureClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import mocked modules AFTER vi.mock so we get the mock versions.
// ---------------------------------------------------------------------------

import * as authApi from '../../api/auth';
import * as clientApi from '../../api/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockUser = {
  userId: 'user-1',
  email: 'therapist@example.com',
  role: 'therapist' as const,
  status: 'active' as const,
  mfaEnabled: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockLoginResponse = {
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthContext / useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // By default getMe rejects so restoreSession falls through cleanly
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('not authenticated'));
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error('refresh failed'));
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    vi.mocked(clientApi.configureClient).mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  it('isAuthenticated is false after loading completes when there are no stored tokens', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('login() stores tokens in localStorage and sets the user on success', async () => {
    vi.mocked(authApi.login).mockResolvedValue(mockLoginResponse);
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for the initial session restore to finish
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('therapist@example.com', 'password123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(localStorage.getItem('somi_access_token')).toBe(mockLoginResponse.accessToken);
    expect(localStorage.getItem('somi_refresh_token')).toBe(mockLoginResponse.refreshToken);
  });

  // -------------------------------------------------------------------------
  it('login() returns the MFA challenge response without setting user state', async () => {
    const mfaChallenge = { challengeId: 'chal-1', mfaRequired: true as const };
    vi.mocked(authApi.login).mockResolvedValue(mfaChallenge);
    // getMe should not be called during MFA challenge
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('should not be called'));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.login('therapist@example.com', 'password123');
    });

    expect(returnValue).toEqual(mfaChallenge);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('logout() clears tokens from localStorage and user from state', async () => {
    // Pre-seed an authenticated state by storing tokens and having getMe succeed
    localStorage.setItem('somi_access_token', mockLoginResponse.accessToken);
    localStorage.setItem('somi_refresh_token', mockLoginResponse.refreshToken);
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait until session is restored
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('somi_access_token')).toBeNull();
    expect(localStorage.getItem('somi_refresh_token')).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('on mount with stored tokens it calls getMe to restore the session', async () => {
    localStorage.setItem('somi_access_token', mockLoginResponse.accessToken);
    localStorage.setItem('somi_refresh_token', mockLoginResponse.refreshToken);
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authApi.getMe).toHaveBeenCalledOnce();
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  // -------------------------------------------------------------------------
  it('clears tokens and remains unauthenticated if both getMe and refresh fail on restore', async () => {
    localStorage.setItem('somi_access_token', 'expired-access-token');
    localStorage.setItem('somi_refresh_token', 'expired-refresh-token');

    vi.mocked(authApi.getMe).mockRejectedValue(new Error('expired'));

    // restoreSession uses raw fetch for refresh (not apiFetch), so mock global.fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('somi_access_token')).toBeNull();
    expect(localStorage.getItem('somi_refresh_token')).toBeNull();

    global.fetch = originalFetch;
  });

  // -------------------------------------------------------------------------
  it('useAuth throws when used outside of AuthProvider', () => {
    // Suppress expected React error boundary output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  it('configureClient is called once on mount', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(clientApi.configureClient).toHaveBeenCalledOnce();
    expect(clientApi.configureClient).toHaveBeenCalledWith(
      expect.objectContaining({
        getToken: expect.any(Function),
        getRefreshToken: expect.any(Function),
        tryRefresh: expect.any(Function),
        onUnauthorized: expect.any(Function),
      })
    );
  });
});
