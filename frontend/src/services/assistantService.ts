import { apiRequest } from '@/services/api-client';

export type AssistantResponse = {
  message: string;
  suggested_actions?: string[];
};

export async function askAssistant(input: {
  message: string;
  opportunity_id?: string;
}): Promise<AssistantResponse> {
  return apiRequest<AssistantResponse>('/api/assistant/chat', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}