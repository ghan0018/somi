import { apiFetch } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestUploadResponse {
  uploadId: string;
  uploadUrl: string;
  expiresAt: string;
  status: 'pending';
}

export interface CompleteUploadResponse {
  uploadId: string;
  status: string;
  contentType: string;
  sizeBytes: number;
}

export interface AccessUploadResponse {
  uploadId: string;
  accessUrl: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function requestUpload(data: {
  patientId?: string;
  purpose: string;
  contentType: string;
  sizeBytes: number;
}): Promise<RequestUploadResponse> {
  return apiFetch<RequestUploadResponse>('/v1/uploads', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function completeUpload(uploadId: string): Promise<CompleteUploadResponse> {
  return apiFetch<CompleteUploadResponse>(`/v1/uploads/${uploadId}/complete`, {
    method: 'POST',
  });
}

export async function getAccessUrl(uploadId: string): Promise<AccessUploadResponse> {
  return apiFetch<AccessUploadResponse>(`/v1/uploads/${uploadId}/access`, {
    method: 'POST',
  });
}
