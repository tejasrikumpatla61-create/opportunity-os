import { apiRequest } from '@/services/api-client';

export interface ResumeMetadata {
  resume_available: boolean;
  file_name?: string | null;
  file_size?: number | null;
  uploaded_at?: string | null;
  message?: string | null;
}

export async function getResumeMetadata(): Promise<ResumeMetadata> {
  return apiRequest<ResumeMetadata>('/api/profile/resume');
}

export async function uploadResume(file: File): Promise<ResumeMetadata> {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<ResumeMetadata>('/api/profile/resume', {
    method: 'POST',
    body: formData,
  });
}

export async function deleteResume(): Promise<ResumeMetadata> {
  return apiRequest<ResumeMetadata>('/api/profile/resume', {
    method: 'DELETE',
  });
}
