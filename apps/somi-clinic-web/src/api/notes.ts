import { PaginatedResponse } from '../types/index';
import { apiFetch } from './client';

export interface Note {
  [key: string]: any;
}

export async function listNotes(
  patientId: string,
  params?: {
    cursor?: string;
    limit?: number;
  }
): Promise<PaginatedResponse<Note>> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query
    ? `/v1/clinic/patients/${patientId}/notes?${query}`
    : `/v1/clinic/patients/${patientId}/notes`;

  return apiFetch<PaginatedResponse<Note>>(path, {
    method: 'GET',
  });
}

export async function createNote(
  patientId: string,
  data: { noteText: string; planId?: string; sessionKey?: string }
): Promise<Note> {
  return apiFetch<Note>(`/v1/clinic/patients/${patientId}/notes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
