const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
    public readonly unavailable = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError('The API service is not connected yet.', 0, true);
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('opportunity_os_access_token') : null;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const contentTypeHeader = isFormData ? {} : (init.body ? { 'Content-Type': 'application/json' } : {});

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...contentTypeHeader,
      ...authHeaders,
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'detail' in payload
      ? String(payload.detail)
      : 'The API request could not be completed.';
    throw new ApiError(message, response.status, response.status >= 500);
  }

  return payload as T;
}

export function unwrapCollection<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>)[key])) {
    return (payload as Record<string, T[]>)[key];
  }
  return [];
}

export function unwrapResource<T>(payload: unknown, key: string): T | null {
  if (!payload || typeof payload !== 'object') return payload as T | null;
  const value = (payload as Record<string, unknown>)[key];
  return value && typeof value === 'object' ? value as T : payload as T;
}