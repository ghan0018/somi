import { Patient, PaginatedResponse } from '../types/index';
import { apiFetch } from './client';

export interface CreatePatientParams {
  displayName: string;
  email: string;
}

export interface UpdatePatientParams {
  displayName?: string;
  status?: 'active' | 'inactive';
}

export async function listPatients(params?: {
  search?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResponse<Patient>> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.status) qs.set('status', params.status);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query ? `/v1/clinic/patients?${query}` : '/v1/clinic/patients';

  return apiFetch<PaginatedResponse<Patient>>(path, {
    method: 'GET',
  });
}

export async function createPatient(
  data: CreatePatientParams
): Promise<Patient> {
  return apiFetch<Patient>('/v1/clinic/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPatient(patientId: string): Promise<Patient> {
  return apiFetch<Patient>(`/v1/clinic/patients/${patientId}`, {
    method: 'GET',
  });
}

export async function updatePatient(
  patientId: string,
  data: UpdatePatientParams
): Promise<Patient> {
  return apiFetch<Patient>(`/v1/clinic/patients/${patientId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function reactivatePatient(patientId: string): Promise<Patient> {
  return updatePatient(patientId, { status: 'active' });
}
