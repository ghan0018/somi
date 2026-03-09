import { User, TaxonomyTag, AuditEvent, PaginatedResponse } from '../types/index';
import { apiFetch } from './client';

export async function listUsers(params?: {
  role?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResponse<User>> {
  const qs = new URLSearchParams();
  if (params?.role) qs.set('role', params.role);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query ? `/v1/admin/users?${query}` : '/v1/admin/users';

  return apiFetch<PaginatedResponse<User>>(path, {
    method: 'GET',
  });
}

export async function inviteUser(data: {
  email: string;
  role: 'therapist' | 'admin';
}): Promise<void> {
  return apiFetch<void>('/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function disableUser(userId: string): Promise<void> {
  return apiFetch<void>(`/v1/admin/users/${userId}/disable`, {
    method: 'POST',
  });
}

export async function enableUser(userId: string): Promise<void> {
  return apiFetch<void>(`/v1/admin/users/${userId}/enable`, {
    method: 'POST',
  });
}

export async function resetMfa(userId: string): Promise<void> {
  return apiFetch<void>(`/v1/admin/users/${userId}/reset-mfa`, {
    method: 'POST',
  });
}

export async function listTaxonomy(): Promise<TaxonomyTag[]> {
  const result = await apiFetch<{ items: TaxonomyTag[] }>(
    '/v1/admin/taxonomy',
    {
      method: 'GET',
    }
  );
  return result.items;
}

export async function createTag(data: {
  category: string;
  label: string;
}): Promise<TaxonomyTag> {
  return apiFetch<TaxonomyTag>('/v1/admin/taxonomy', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTag(tagId: string): Promise<void> {
  return apiFetch<void>(`/v1/admin/taxonomy/${tagId}`, {
    method: 'DELETE',
  });
}

export async function queryAudit(params?: {
  patientId?: string;
  actorEmail?: string;
  actionType?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResponse<AuditEvent>> {
  const qs = new URLSearchParams();
  if (params?.patientId) qs.set('patientId', params.patientId);
  if (params?.actorEmail) qs.set('actorEmail', params.actorEmail);
  if (params?.actionType) qs.set('actionType', params.actionType);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query ? `/v1/admin/audit?${query}` : '/v1/admin/audit';

  return apiFetch<PaginatedResponse<AuditEvent>>(path, {
    method: 'GET',
  });
}
