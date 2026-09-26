import { apiRequest } from '@/services/api-client';
import type { Opportunity } from '@/types/domain';

export type PersonalizedFeed = {
  new_for_you: Opportunity[];
  best_matches: Opportunity[];
  latest_scholarships: Opportunity[];
  latest_internships: Opportunity[];
  latest_hackathons: Opportunity[];
  latest_fellowships: Opportunity[];
  closing_soon: Opportunity[];
  new_matches_count: number;
  last_checked?: string | null;
};

export async function getPersonalizedFeed(): Promise<PersonalizedFeed> {
  return apiRequest<PersonalizedFeed>('/api/feed', {
    method: 'GET',
  });
}

export async function dismissFeedCheckpoint(): Promise<{ status: string; last_feed_checked_at: string }> {
  return apiRequest<{ status: string; last_feed_checked_at: string }>('/api/feed/checkpoint', {
    method: 'POST',
  });
}
