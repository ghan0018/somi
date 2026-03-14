import { TreatmentPlan, SessionInput } from '../types/index';
import { apiFetch } from './client';

export async function getTherapistPlan(
  patientId: string
): Promise<TreatmentPlan | null> {
  try {
    return await apiFetch<TreatmentPlan>(
      `/v1/clinic/patients/${patientId}/plan`,
      {
        method: 'GET',
      }
    );
  } catch (err: unknown) {
    // Backend returns 404 when no plan exists — treat as null (empty state)
    if (err instanceof Error && (err as Error & { status?: number }).status === 404) {
      return null;
    }
    throw err;
  }
}

export async function createPlan(
  patientId: string,
  sessions: SessionInput[]
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
  sessions: SessionInput[]
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

export async function advanceSession(
  patientId: string,
  planId: string
): Promise<void> {
  return apiFetch<void>(
    `/v1/clinic/patients/${patientId}/plan/${planId}/advance-session`,
    {
      method: 'POST',
    }
  );
}

export async function revertToDraft(
  patientId: string,
  planId: string
): Promise<void> {
  return apiFetch<void>(
    `/v1/clinic/patients/${patientId}/plan/${planId}/revert-to-draft`,
    {
      method: 'POST',
    }
  );
}
