export type OpportunityType = 'internship' | 'scholarship' | 'hackathon' | 'fellowship' | 'competition' | 'program';

export type StudentRole = 'Student' | 'Recent Graduate';

export type OnboardingProfileData = {
  role: StudentRole;
  degree: string;
  branch: string;
  studyYear: number;
  skills: string[];
  interests: string[];
  preferredOpportunityTypes: string[];
};

export type Opportunity = {
  id: string;
  title: string;
  organization: string;
  opportunity_type?: OpportunityType;
  type?: OpportunityType;
  location?: string;
  deadline?: string;
  required_skills?: string[];
  source_url?: string;
  url?: string;
  description?: string;
  tags?: string[];
  source_name?: string;
  last_verified_at?: string;
  status?: string;
  is_demo?: boolean;
  relevance_score?: number;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  school?: string;
  major?: string;
  graduationYear?: number;
  degree?: string;
  branch?: string;
  studyYear?: number;
  skills: string[];
  interests: string[];
  preferredOpportunityTypes?: string[];
  resumeUrl?: string;
  role?: StudentRole;
};

export type ApplicationStatus = 'saved' | 'preparing' | 'submitted' | 'closed';

export type Application = {
  id: string;
  opportunityId: string;
  status: ApplicationStatus;
  notes?: string;
};

export type Task = {
  id: string;
  title: string;
  dueAt?: string;
  completed: boolean;
  applicationId?: string;
};

export type AnalysisReadiness = {
  isAvailable: boolean;
  missingProfileFields: string[];
  missingOpportunityFields: string[];
  unavailableReason?: string;
};

export type OpportunityAnalysis = {
  opportunityId?: string;
  matchScore?: number;
  matchLevel?: string;
  eligibilityStatus?: string;
  eligibilitySummary?: string;
  matchedSkills: string[];
  matchedRequirements: string[];
  missingRequirements: string[];
  unknownRequirements: string[];
  skillsWithNoEvidence?: string[];
  documentsNeeded: string[];
  applicationBlockers: string[];
  tasks: (string | AnalysisTask)[];
  recommendedNextAction?: string | null;
  sourceUrl?: string | null;
};

export type AnalysisTask = {
  id?: string;
  title: string;
  dueAt?: string;
  completed?: boolean;
};