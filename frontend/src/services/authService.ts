import { apiRequest } from '@/services/api-client';
import { supabase } from '@/services/supabase';

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

export async function loginWithProvider(provider: 'google' | 'github'): Promise<void> {
  const callbackUrl = `${window.location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl,
    },
  });
  if (error) {
    throw error;
  }
  if (data?.url) {
    window.location.assign(data.url);
  }
}

export async function loginWithGoogle(): Promise<void> {
  return loginWithProvider('google');
}

export async function loginWithGitHub(): Promise<void> {
  return loginWithProvider('github');
}

export async function handleOAuthCallback(): Promise<{ user: AuthUser; hasCompletedOnboarding: boolean }> {
  const searchParams = new URLSearchParams(window.location.search);
  const searchError = searchParams.get('error_description') || searchParams.get('error');
  if (searchError) {
    throw new Error(searchError);
  }

  let token: string | null = null;

  // Handle hash fragment containing OAuth tokens (implicit flow)
  if (window.location.hash) {
    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const hashError = hashParams.get('error_description') || hashParams.get('error');
    if (hashError) {
      throw new Error(hashError);
    }
    const hashAccessToken = hashParams.get('access_token');
    const hashRefreshToken = hashParams.get('refresh_token');
    if (hashAccessToken) {
      token = hashAccessToken;
      try {
        await supabase.auth.setSession({
          access_token: hashAccessToken,
          refresh_token: hashRefreshToken || '',
        });
      } catch {
        // ignore
      }
    }
  }

  // Handle PKCE code flow if present
  const code = searchParams.get('code');
  if (!token && code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      throw error;
    }
    if (data.session?.access_token) {
      token = data.session.access_token;
    }
  }

  // Fallback to existing Supabase session
  if (!token) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      token = session.access_token;
    }
  }

  if (!token) {
    throw new Error('No authentication session found in response');
  }

  localStorage.setItem(TOKEN_KEY, token);

  const sessionData = await restoreSession();
  if (!sessionData) {
    throw new Error('Failed to verify session with backend service');
  }

  return sessionData;
}

export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  } finally {
    clearSession();
  }
}

export async function restoreSession(): Promise<{ user: AuthUser; hasCompletedOnboarding: boolean } | null> {
  let token = getStoredToken();
  if (!token && typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hashToken = hashParams.get('access_token');
    if (hashToken) {
      token = hashToken;
      localStorage.setItem(TOKEN_KEY, hashToken);
    }
  }

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
