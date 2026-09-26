import type { OnboardingProfileData, UserProfile } from '@/types/domain';
import { apiRequest } from '@/services/api-client';

const PROFILE_STORAGE_KEY = 'opportunity_os_student_profile';

const DEFAULT_PROFILE: UserProfile = {
  id: 'demo-student-001',
  name: 'Alex Chen',
  email: 'alex.chen@university.edu',
  degree: 'B.Tech',
  branch: 'Computer Science and Engineering',
  studyYear: 2,
  skills: ['Python', 'Cybersecurity'],
  interests: ['Cybersecurity', 'Web Development'],
  preferredOpportunityTypes: ['Hackathons', 'Internships'],
  role: 'Student',
};

export function getStoredProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return DEFAULT_PROFILE;
}

export function saveStoredProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

type RemoteProfile = {
  id?: string;
  user_id: string;
  full_name?: string;
  email?: string;
  college?: string;
  degree?: string;
  branch?: string;
  study_year?: number;
  location?: string;
  skills?: string[];
  interests?: string[];
  preferred_opportunity_types?: string[];
  resume_available?: boolean;
};

function toUserProfile(p: RemoteProfile): UserProfile {
  return {
    id: p.user_id || p.id || 'current-user',
    name: p.full_name || '',
    email: p.email || '',
    school: p.college || '',
    college: p.college || '',
    major: p.branch || p.degree || '',
    degree: p.degree || '',
    branch: p.branch || '',
    studyYear: p.study_year || 1,
    graduationYear: p.study_year || 1,
    skills: p.skills || [],
    interests: p.interests || [],
    preferredOpportunityTypes: p.preferred_opportunity_types || [],
    role: 'Student',
  };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  try {
    const remote = await apiRequest<RemoteProfile>('/api/profile');
    if (remote) {
      const converted = toUserProfile(remote);
      saveStoredProfile(converted);
      return converted;
    }
  } catch {
    // Backend profile fallback
  }
  return getStoredProfile();
}

export async function updateProfile(input: Partial<UserProfile>): Promise<UserProfile> {
  const current = getStoredProfile();
  const updated: UserProfile = { ...current, ...input };
  saveStoredProfile(updated);

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.full_name = input.name;
  if (input.email !== undefined) payload.email = input.email;
  if (input.college !== undefined) payload.college = input.college;
  if (input.school !== undefined) payload.college = input.school;
  if (input.degree !== undefined) payload.degree = input.degree;
  if (input.branch !== undefined) payload.branch = input.branch;
  if (input.major !== undefined) payload.branch = input.major;
  if (input.studyYear !== undefined) payload.study_year = input.studyYear;
  if (input.graduationYear !== undefined) payload.study_year = input.graduationYear;
  if (input.skills !== undefined) payload.skills = input.skills;
  if (input.interests !== undefined) payload.interests = input.interests;
  if (input.preferredOpportunityTypes !== undefined) payload.preferred_opportunity_types = input.preferredOpportunityTypes;

  try {
    const remote = await apiRequest<RemoteProfile>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (remote) {
      const converted = toUserProfile(remote);
      saveStoredProfile(converted);
      return converted;
    }
  } catch {
    // Handled locally
  }

  return updated;
}

export async function saveOnboardingProfile(input: OnboardingProfileData): Promise<UserProfile> {
  const payload = {
    degree: input.degree,
    branch: input.branch,
    study_year: input.studyYear,
    skills: input.skills,
    interests: input.interests,
    preferred_opportunity_types: input.preferredOpportunityTypes,
  };

  const current = getStoredProfile();
  const updated: UserProfile = {
    ...current,
    degree: input.degree,
    branch: input.branch,
    studyYear: input.studyYear,
    skills: input.skills,
    interests: input.interests,
    preferredOpportunityTypes: input.preferredOpportunityTypes,
  };
  saveStoredProfile(updated);

  try {
    const remote = await apiRequest<RemoteProfile>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (remote) {
      const converted = toUserProfile(remote);
      saveStoredProfile(converted);
      return converted;
    }
  } catch {
    // Fallback locally
  }

  return updated;
}

export function getStudentProfileForAnalysis(): {
  degree: string;
  branch: string;
  study_year: number;
  skills: string[];
  interests: string[];
  preferred_opportunity_types: string[];
} {
  const profile = getStoredProfile();
  return {
    degree: profile.degree || 'B.Tech',
    branch: profile.branch || 'Computer Science and Engineering',
    study_year: profile.studyYear || 2,
    skills: profile.skills && profile.skills.length ? profile.skills : ['Python', 'Cybersecurity'],
    interests: profile.interests && profile.interests.length ? profile.interests : ['Cybersecurity'],
    preferred_opportunity_types: profile.preferredOpportunityTypes || ['Hackathons'],
  };
}