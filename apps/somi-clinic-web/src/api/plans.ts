import { TreatmentPlan } from '../types/index';
import { apiFetch } from './client';

export interface Session {
  [key: string]: any;
}

export async function getTherapistPlan(
  patientId: string
): Promise<TreatmentPlan | null> {
  return apiFetch<TreatmentPlan | null>(
    `/v1/clinic/patients/${patientId}/plan`,
    {
      method: 'GET',
    }
  );
}

export async function createPlan(
  patientId: string,
  sessions: Session[]
): Promise<TreatmentPlan> {
  return apiFetch<TreatmentPlan>(
    `/v1/clinic/patients/${patientId}/plan`,
    {
      method: 'POST',
      body: JSON.stringify({ sessions }),
    }
  );
}

export async function replacePlan(
  patientId: string,
  planId: string,
  sessions: Session[]
): Promise<void> {
  return apiFetch<void>(
    `/v1/clinic/patients/${patientId}/plan/${planId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ sessions }),
    }
  );
}

export async function publishPlan(
  patientId: string,
  planId: string
): Promise<void> {
  return apiFetch<void>(
    `/v1/clinic/patients/${patientId}/plan/${planId}/publish`,
    {
      method: 'POST',
    }
  );
}

export async function archivePlan(
  patientId: string,
  planId: string
): Promise<void> {
  return apiFetch<void>(
    `/v1/clinic/patients/${patientId}/plan/${planId}/archive`,
    {
      method: 'POST',
    }
  );
}

export async function updatePlanSettings(
  patientId: string,
  planId: string,
  data: { remindersEnabled: boolean }
): Promise<void> {
  return apiFetch<void>(
    `/v1/clinic/patients/${patientId}/plan/${planId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );
}
