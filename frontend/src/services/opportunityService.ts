import type { Opportunity, OpportunityType } from '@/types/domain';
import { apiRequest, unwrapCollection, unwrapResource } from '@/services/api-client';

export async function listOpportunities(query: { search?: string; type?: OpportunityType } = {}): Promise<Opportunity[]> {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.type) params.set('type', query.type);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await apiRequest<unknown>(`/api/opportunities${suffix}`);
  return unwrapCollection<Opportunity>(payload, 'opportunities');
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const payload = await apiRequest<unknown>(`/api/opportunities/${encodeURIComponent(id)}`);
  return unwrapResource<Opportunity>(payload, 'opportunity');
}