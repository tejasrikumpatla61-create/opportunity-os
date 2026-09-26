import { apiRequest } from '@/services/api-client';

export type TaskItem = {
  id: string;
  application_id: string;
  title: string;
  description?: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'completed';
  is_completed: boolean;
  due_date?: string | null;
  created_at?: string | null;
  opportunity_id?: string | null;
  opportunity_title?: string | null;
};

export async function listTasks(applicationId?: string): Promise<TaskItem[]> {
  const query = applicationId ? `?application_id=${encodeURIComponent(applicationId)}` : '';
  return apiRequest<TaskItem[]>(`/api/tasks${query}`, {
    method: 'GET',
  });
}

export async function createTask(data: {
  application_id: string;
  title: string;
  description?: string;
  priority?: string;
  due_date?: string;
}): Promise<TaskItem> {
  return apiRequest<TaskItem>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(
  taskId: string,
  updates: {
    title?: string;
    description?: string;
    priority?: string;
    due_date?: string;
    status?: string;
  }
): Promise<TaskItem> {
  return apiRequest<TaskItem>(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(taskId: string): Promise<{ status: string; id: string }> {
  return apiRequest<{ status: string; id: string }>(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
}

export async function saveActionPlanTasks(
  opportunityId: string,
  tasks: unknown[]
): Promise<{ status: string; application_id: string; tasks_created: number; message: string }> {
  return apiRequest<{ status: string; application_id: string; tasks_created: number; message: string }>(
    '/api/tasks/from-action-plan',
    {
      method: 'POST',
      body: JSON.stringify({
        opportunity_id: opportunityId,
        tasks: tasks,
      }),
    }
  );
}
