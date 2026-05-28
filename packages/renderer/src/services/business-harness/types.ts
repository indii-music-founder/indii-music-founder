export type HarnessDomain =
  | 'artist_memory'
  | 'song_dna'
  | 'creator_protection'
  | 'distribution_ddex'
  | 'release'
  | 'finance'
  | 'activity_time_value'
  | 'road_travel'
  | 'gear_asset'
  | 'merch_pod'
  | 'marketing_growth'
  | 'fan_crm'
  | 'publishing_rights'
  | 'collaboration_splits'
  | 'licensing_sync'
  | 'royalty_revenue'
  | 'legal_compliance'
  | 'creative_production'
  | 'opportunity'
  | 'education_curriculum'
  | 'security_trust'
  | 'boardroom_meta';

export type HarnessSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type HarnessConfidence = 'low' | 'medium' | 'high';

export interface HarnessInputRef {
  type: 'user' | 'project' | 'release' | 'track' | 'contract' | 'expense' | 'url' | 'asset' | 'manual';
  id?: string;
  label?: string;
  url?: string;
}

export interface HarnessScore {
  label: string;
  value: number;
  max: number;
  status: 'good' | 'watch' | 'blocked';
  rationale: string;
}

export interface HarnessLegalBasis {
  id: string;
  label: string;
  jurisdiction: 'federal' | 'state' | 'platform' | 'contract' | 'international';
  status: 'enacted' | 'proposed' | 'guidance' | 'policy' | 'unknown';
  effectiveDate?: string;
  sourceUrl?: string;
  summary: string;
  attorneyReviewRequired: boolean;
}

export interface HarnessEvidenceRef {
  id: string;
  type:
    | 'audio'
    | 'video'
    | 'image'
    | 'document'
    | 'url'
    | 'screenshot'
    | 'identifier'
    | 'metadata'
    | 'statement'
    | 'hash';
  label: string;
  value?: string;
  url?: string;
  hash?: string;
  createdAt?: string;
}

export interface HarnessFinding {
  id: string;
  domain: HarnessDomain;
  severity: HarnessSeverity;
  title: string;
  detail: string;
  confidence: HarnessConfidence;
  evidenceRefs?: HarnessEvidenceRef[];
  legalBasisRefs?: string[];
}

export interface HarnessRecommendation {
  id: string;
  domain: HarnessDomain;
  priority: HarnessSeverity;
  title: string;
  detail: string;
  ownerAgentId: string;
  approvalRequired: boolean;
  nextAction?: string;
}

export type HarnessCostType =
  | 'cash_expense'
  | 'time_value'
  | 'mileage'
  | 'asset_depreciation'
  | 'inventory_cost'
  | 'service_fee'
  | 'royalty_obligation'
  | 'opportunity_cost'
  | 'legal_protection_cost';

export interface HarnessCostLine {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  category: string;
  costType: HarnessCostType;
  sourceDomain: HarnessDomain;
  projectId?: string;
  releaseId?: string;
  tourId?: string;
  expenseId?: string;
  activityEventId?: string;
  taxTreatment?: string;
  reimbursable: boolean;
  confidence: HarnessConfidence;
  notes: string;
  createdAt: string;
}

export interface HarnessAgentBrief {
  agentId: string;
  departmentId?: string;
  brief: string;
  inputs: string[];
  blockedBy?: string[];
}

export interface HarnessApprovalGate {
  id: string;
  label: string;
  reason: string;
  requiredFor: string;
  riskTier: 'approval' | 'blocked' | 'attorney_review' | 'destructive';
}

export interface HarnessRun<TOutput = Record<string, unknown>> {
  runId: string;
  userId: string;
  projectId?: string;
  domain: HarnessDomain;
  createdAt: string;
  inputRefs: HarnessInputRef[];
  scores: HarnessScore[];
  findings: HarnessFinding[];
  recommendations: HarnessRecommendation[];
  costLines: HarnessCostLine[];
  legalBasis: HarnessLegalBasis[];
  evidenceRefs: HarnessEvidenceRef[];
  agentBriefs: HarnessAgentBrief[];
  approvalGates: HarnessApprovalGate[];
  assumptions: string[];
  confidence: number;
  output: TOutput;
}

export interface BusinessActivityEvent {
  id: string;
  userId: string;
  sessionId: string;
  eventType: 'module_focus' | 'manual_work' | 'agent_work' | 'travel' | 'upload_wait' | 'generation_wait';
  module?: string;
  projectId?: string;
  releaseId?: string;
  tourId?: string;
  category:
    | 'creative_labor'
    | 'admin_labor'
    | 'marketing_labor'
    | 'travel_labor'
    | 'legal_labor'
    | 'learning'
    | 'unallocated';
  startedAt: string;
  endedAt?: string;
  durationMinutes: number;
  activeMinutes: number;
  idleMinutes: number;
  hourlyRate: number;
  notes?: string;
  source: 'automatic' | 'manual' | 'agent';
}

export interface HarnessCostSummary {
  total: number;
  currency: string;
  byType: Record<HarnessCostType, number>;
  byDomain: Partial<Record<HarnessDomain, number>>;
}

export interface BoardroomHarnessDecision {
  decisionId: string;
  mode: 'advisory' | 'approval' | 'execution_ready' | 'blocked';
  decision: 'approve' | 'defer' | 'reroute' | 'escalate' | 'block';
  rationale: string[];
  sourceRunIds: string[];
  departmentsConsulted: string[];
  blockers: string[];
  costImpact: HarnessCostSummary;
  legalRisk: HarnessSeverity;
  nextAction: string;
  userApprovalRequired: boolean;
  createdAt: string;
}

export function createHarnessRun<TOutput>(params: Omit<HarnessRun<TOutput>, 'runId' | 'createdAt'> & { runId?: string; createdAt?: string }): HarnessRun<TOutput> {
  return {
    ...params,
    runId: params.runId ?? `harness_${params.domain}_${Date.now()}`,
    createdAt: params.createdAt ?? new Date().toISOString(),
  };
}

