import { Exercise, PaginatedResponse } from '../types/index';
import { apiFetch } from './client';

export interface CreateExerciseParams {
  title: string;
  description: string;
  tagIds?: string[];
  defaultParams?: { reps?: number; sets?: number; seconds?: number };
  mediaId?: string;
}

export interface UpdateExerciseParams {
  title?: string;
  description?: string;
  tagIds?: string[];
  defaultParams?: { reps?: number; sets?: number; seconds?: number };
  mediaId?: string;
}

export async function listExercises(params?: {
  q?: string;
  tagIds?: string[];
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResponse<Exercise>> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.tagIds?.length) qs.set('tagIds', params.tagIds.join(','));
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query ? `/v1/exercises?${query}` : '/v1/exercises';

  return apiFetch<PaginatedResponse<Exercise>>(path, {
    method: 'GET',
  });
}

export async function getExercise(exerciseId: string): Promise<Exercise> {
  return apiFetch<Exercise>(`/v1/exercises/${exerciseId}`, {
    method: 'GET',
  });
}

export async function createExercise(
  data: CreateExerciseParams
): Promise<Exercise> {
  return apiFetch<Exercise>('/v1/exercises', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExercise(
  exerciseId: string,
  data: UpdateExerciseParams
): Promise<Exercise> {
  return apiFetch<Exercise>(`/v1/exercises/${exerciseId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function archiveExercise(exerciseId: string): Promise<void> {
  return apiFetch<void>(`/v1/exercises/${exerciseId}/archive`, {
    method: 'POST',
  });
}

export async function restoreExercise(exerciseId: string): Promise<void> {
  return apiFetch<void>(`/v1/exercises/${exerciseId}/restore`, {
    method: 'POST',
  });
}
