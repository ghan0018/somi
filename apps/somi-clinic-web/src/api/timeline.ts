import { apiFetch } from './client';

export interface TimelineResult {
  [key: string]: any;
}

export async function getTimeline(
  patientId: string,
  params?: {
    types?: string[];
    cursor?: string;
    limit?: number;
  }
): Promise<TimelineResult> {
  const qs = new URLSearchParams();
  if (params?.types?.length) qs.set('types', params.types.join(','));
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query
    ? `/v1/clinic/patients/${patientId}/timeline?${query}`
    : `/v1/clinic/patients/${patientId}/timeline`;

  return apiFetch<TimelineResult>(path, {
    method: 'GET',
  });
}
