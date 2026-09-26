import { apiRequest } from '@/services/api-client';

const TOKEN_KEY = 'opportunity_os_access_token';
const USER_KEY = 'opportunity_os_user';

export type AuthUser = {
  id: string;
  email: string;
  full_name?: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export async function signup(email: string, password: string, fullName?: string): Promise<AuthUser> {
  const res = await apiRequest<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  setSession(res.access_token, res.user);
  return res.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setSession(res.access_token, res.user);
  return res.user;
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  } finally {
    clearSession();
  }
}

export async function restoreSession(): Promise<{ user: AuthUser; hasCompletedOnboarding: boolean } | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await apiRequest<{
      user: AuthUser;
      profile: Record<string, unknown> | null;
      has_completed_onboarding: boolean;
    }>('/api/auth/me');
    setSession(token, res.user);
    return {
      user: res.user,
      hasCompletedOnboarding: res.has_completed_onboarding,
    };
  } catch {
    clearSession();
    return null;
  }
}
