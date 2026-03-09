import { Message, PaginatedResponse } from '../types/index';
import { apiFetch } from './client';

export interface MessageThread {
  [key: string]: any;
}

export async function getPatientThread(
  patientId: string
): Promise<MessageThread> {
  return apiFetch<MessageThread>(
    `/v1/clinic/patients/${patientId}/messages/thread`,
    {
      method: 'GET',
    }
  );
}

export async function listMessages(
  threadId: string,
  params?: {
    cursor?: string;
    limit?: number;
  }
): Promise<PaginatedResponse<Message>> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));

  const query = qs.toString();
  const path = query
    ? `/v1/messages/threads/${threadId}/messages?${query}`
    : `/v1/messages/threads/${threadId}/messages`;

  return apiFetch<PaginatedResponse<Message>>(path, {
    method: 'GET',
  });
}

export async function sendMessage(
  threadId: string,
  data: { text: string }
): Promise<Message> {
  return apiFetch<Message>(`/v1/messages/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
