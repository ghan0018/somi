import { apiFetch } from './client';

export interface WeeklyAdherenceResult {
  [key: string]: any;
}

export interface OverallAdherenceResult {
  [key: string]: any;
}

export async function getWeeklyAdherence(
  patientId: string,
  weekStart?: string
): Promise<WeeklyAdherenceResult> {
  const qs = new URLSearchParams();
  if (weekStart) qs.set('weekStart', weekStart);

  const query = qs.toString();
  const path = query
    ? `/v1/clinic/patients/${patientId}/adherence/weekly?${query}`
    : `/v1/clinic/patients/${patientId}/adherence/weekly`;

  return apiFetch<WeeklyAdherenceResult>(path, {
    method: 'GET',
  });
}

export async function getOverallAdherence(
  patientId: string
): Promise<OverallAdherenceResult> {
  return apiFetch<OverallAdherenceResult>(
    `/v1/clinic/patients/${patientId}/adherence/overall`,
    {
      method: 'GET',
    }
  );
}
