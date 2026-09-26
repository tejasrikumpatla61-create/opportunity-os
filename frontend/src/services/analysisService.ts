import type { AnalysisTask, OpportunityAnalysis } from '@/types/domain';
import { apiRequest, unwrapResource } from '@/services/api-client';
import { getStudentProfileForAnalysis, getStoredProfile } from '@/services/profileService';

type BackendAnalysis = {
  opportunity_id?: string;
  source_url?: string | null;
  match_score?: number;
  fit_score?: number;
  match_level?: string;
  eligibility_status?: string;
  eligibility_summary?: string;
  matched_skills?: string[];
  matched_requirements?: string[];
  missing_requirements?: string[];
  unknown_requirements?: string[];
  skills_with_no_evidence?: string[];
  documents_needed?: string[];
  application_blockers?: string[];
  tasks?: (string | AnalysisTask)[];
  recommended_next_action?: string | null;
};

function normalizeAnalysis(payload: BackendAnalysis, opportunityId: string): OpportunityAnalysis {
  return {
    opportunityId: payload.opportunity_id || opportunityId,
    matchScore: typeof payload.match_score === 'number' ? payload.match_score : payload.fit_score,
    matchLevel: payload.match_level,
    eligibilityStatus: payload.eligibility_status,
    eligibilitySummary: payload.eligibility_summary,
    matchedSkills: payload.matched_skills || [],
    matchedRequirements: payload.matched_requirements || [],
    missingRequirements: payload.missing_requirements || [],
    unknownRequirements: payload.unknown_requirements || [],
    skillsWithNoEvidence: payload.skills_with_no_evidence || [],
    documentsNeeded: payload.documents_needed || [],
    applicationBlockers: payload.application_blockers || [],
    tasks: payload.tasks || [],
    recommendedNextAction: payload.recommended_next_action,
    sourceUrl: payload.source_url,
  };
}

export async function analyzeOpportunity(opportunityId: string): Promise<OpportunityAnalysis> {
  const studentProfile = getStudentProfileForAnalysis();
  const profile = getStoredProfile();
  
  // Use resume text if set in user profile, otherwise fallback to demo student resume
  const resumeText = (profile as Record<string, unknown>).resume_text
    || (profile as Record<string, unknown>).resumeText
    || 'B.Tech CSE student with Python and cybersecurity project experience.';

  const requestBody = {
    student_profile: studentProfile,
    resume_text: String(resumeText),
  };

  const payload = await apiRequest<unknown>(`/api/opportunities/${encodeURIComponent(opportunityId)}/analyze`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  const resource = unwrapResource<BackendAnalysis>(payload, 'analysis');
  return normalizeAnalysis(resource || {}, opportunityId);
}