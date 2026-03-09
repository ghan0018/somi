import { CompletionEvent, PaginatedResponse } from '../types/index';
import { apiFetch } from './client';

export async function listCompletions(
  patientId: string,
  params?: {
    cursor?: string;
    limit?: number;
  }
): Promise<PaginatedResponse<CompletionEvent>> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query
    ? `/v1/clinic/patients/${patientId}/completions?${query}`
    : `/v1/clinic/patients/${patientId}/completions`;

  return apiFetch<PaginatedResponse<CompletionEvent>>(path, {
    method: 'GET',
  });
}
