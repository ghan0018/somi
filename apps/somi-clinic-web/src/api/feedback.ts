import { PaginatedResponse } from '../types/index';
import { apiFetch } from './client';

export interface Feedback {
  [key: string]: any;
}

export async function listFeedback(
  patientId: string,
  params?: {
    cursor?: string;
    limit?: number;
  }
): Promise<PaginatedResponse<Feedback>> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query
    ? `/v1/clinic/patients/${patientId}/feedback?${query}`
    : `/v1/clinic/patients/${patientId}/feedback`;

  return apiFetch<PaginatedResponse<Feedback>>(path, {
    method: 'GET',
  });
}

export async function createFeedback(
  patientId: string,
  data: { text: string; uploadId?: string }
): Promise<Feedback> {
  return apiFetch<Feedback>(`/v1/clinic/patients/${patientId}/feedback`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
