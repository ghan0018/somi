import { LoginResponse, MfaChallengeResponse, User } from '../types/index';
import { apiFetch } from './client';

const BASE = '/api';

export async function login(
  email: string,
  password: string
): Promise<LoginResponse | MfaChallengeResponse> {
  const credentials = btoa(`${email}:${password}`);
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message ?? res.statusText);
    (err as any).status = res.status;
    (err as any).code = body?.error?.code;
    throw err;
  }

  return res.json();
}

export async function verifyMfa(
  challengeId: string,
  code: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/v1/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, code }),
  });
}

export async function refreshToken(
  refreshToken: string
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function logout(refreshToken: string): Promise<void> {
  return apiFetch<void>('/v1/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function getMe(): Promise<User> {
  return apiFetch<User>('/v1/me', {
    method: 'GET',
  });
}
