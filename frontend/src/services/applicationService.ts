import { apiRequest } from '@/services/api-client';
import type { Opportunity } from '@/types/domain';

export type ApplicationItem = {
  id: string;
  profile_id: string;
  opportunity_id: string;
  status: string;
  display_status: string;
  created_at?: string;
  updated_at?: string;
  opportunity?: Opportunity;
  task_count: number;
  completed_task_count: number;
  progress_percentage: number;
};

export async function listApplications(): Promise<ApplicationItem[]> {
  return apiRequest<ApplicationItem[]>('/api/applications', {
    method: 'GET',
  });
}

export async function trackApplication(opportunityId: string, status = 'planning'): Promise<ApplicationItem> {
  return apiRequest<ApplicationItem>('/api/applications', {
    method: 'POST',
    body: JSON.stringify({
      opportunity_id: opportunityId,
      status: status,
    }),
  });
}

export async function updateApplicationStatus(applicationId: string, status: string): Promise<ApplicationItem> {
  return apiRequest<ApplicationItem>(`/api/applications/${encodeURIComponent(applicationId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteApplication(applicationId: string): Promise<{ status: string; id: string }> {
  return apiRequest<{ status: string; id: string }>(`/api/applications/${encodeURIComponent(applicationId)}`, {
    method: 'DELETE',
  });
}
