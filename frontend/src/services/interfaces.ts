import type { AnalysisReadiness, Application, Opportunity, OpportunityAnalysis, Task, UserProfile } from '@/types/domain';

export interface OpportunityRepository {
  list(query?: { search?: string; type?: string }): Promise<Opportunity[]>;
  getById(id: string): Promise<Opportunity | null>;
  create(input: Omit<Opportunity, 'id'>): Promise<Opportunity>;
}

export interface ProfileRepository {
  getCurrent(): Promise<UserProfile | null>;
  update(input: Partial<UserProfile>): Promise<UserProfile>;
}

export interface ApplicationRepository {
  list(): Promise<Application[]>;
  create(input: Omit<Application, 'id'>): Promise<Application>;
  update(id: string, input: Partial<Application>): Promise<Application>;
}

export interface TaskRepository {
  list(): Promise<Task[]>;
  create(input: Omit<Task, 'id'>): Promise<Task>;
  update(id: string, input: Partial<Task>): Promise<Task>;
}

export interface AnalysisService {
  checkReadiness(opportunityId: string): Promise<AnalysisReadiness>;
  analyze(opportunityId: string): Promise<OpportunityAnalysis>;
}

export interface OpportunityAiService {
  ask(input: { message: string; context?: string }): Promise<{ message: string }>;
}

export type ServiceContainer = {
  opportunities: OpportunityRepository;
  profile: ProfileRepository;
  applications: ApplicationRepository;
  tasks: TaskRepository;
  analysis: AnalysisService;
  ai: OpportunityAiService;
};