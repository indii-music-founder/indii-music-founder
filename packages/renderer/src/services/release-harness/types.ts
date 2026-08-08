import type { AudioIntelligenceProfile } from '@/services/audio/types';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { UserProfile } from '@/types/User';

export type HarnessReleaseGoal =
  | 'grow_fanbase'
  | 'playlisting'
  | 'touring'
  | 'sync'
  | 'direct_sales'
  | 'brand_growth';

export type BudgetRange = 'none' | 'low' | 'moderate' | 'aggressive';

export interface ReleaseHarnessInput {
  userId: string;
  projectId?: string;
  trackId?: string;
  audioFile?: File;
  audioProfile?: AudioIntelligenceProfile;
  userProfile?: UserProfile;
  analyticsReports?: Record<string, unknown>;
  metadata?: Partial<ExtendedGoldenMetadata>;
  selectedStores?: string[];
  deliveryAuthority?: DdexDeliveryAuthorityEvidence;
  releaseIntent?: {
    title?: string;
    releaseType?: 'single' | 'ep' | 'album';
    targetDate?: string;
    budgetRange?: BudgetRange;
    primaryGoal?: HarnessReleaseGoal;
  };
}

export interface DdexDeliveryAuthorityEvidence {
  sender?: {
    dpid: string;
    verificationStatus: 'verified' | 'pending' | 'unverified';
    credentialStatus: 'active' | 'missing' | 'expired';
    verifiedAt?: string;
    evidenceRef?: string;
  };
  recipients?: Record<string, {
    systemIdentifier?: string;
    onboardingStatus: 'verified' | 'pending' | 'missing';
    credentialStatus: 'active' | 'missing' | 'expired';
    feedProfileId?: string;
    validationReceipt?: {
      receiptId: string;
      status: 'accepted' | 'rejected' | 'pending';
      validatedAt: string;
    };
  }>;
}

export interface ReleaseDna {
  fingerprint?: string;
  genreSignals: string[];
  moodSignals: string[];
  energy: number;
  tempo?: number;
  key?: string;
  vocalPresence?: 'instrumental' | 'light' | 'prominent';
  commercialFit: {
    shortForm: number;
    playlist: number;
    sync: number;
    club: number;
    editorial: number;
  };
  metadataSuggestions: {
    title?: string;
    genre?: string;
    subgenre?: string;
    mood?: string[];
    language?: string;
    explicit?: boolean;
    marketingComment?: string;
  };
  confidence: number;
}

export interface ArtistOperatingModel {
  identity: {
    artistName?: string;
    brandDescription?: string;
    careerStage?: string;
    goals: string[];
    aesthetic?: string;
    distributor?: string;
  };
  preferences: {
    communicationStyle?: string;
    workCadence?: string;
    riskTolerance: 'low' | 'medium' | 'high';
    budgetBehavior?: string;
    preferredChannels: string[];
  };
  history: {
    successfulReleasePatterns: string[];
    weakSpots: string[];
    priorCampaignSignals: string[];
    priorDistributionIssues: string[];
    importantCareerMemories: string[];
  };
  confidence: number;
}

export interface DistributionReadiness {
  metadataComplete: boolean;
  ddexPackageReady: boolean;
  deliveryAuthorityReady: boolean;
  identifiers: {
    isrc?: string;
    upc?: string;
    iswc?: string;
    iswcStatus?: 'missing' | 'draft' | 'pending_registration' | 'registered';
    workId?: string;
    catalogNumber?: string;
    missing: Array<'isrc' | 'upc' | 'iswc' | 'catalogNumber'>;
  };
  connectedStores: string[];
  blockedStores: string[];
  recipientReadiness: Array<{
    store: string;
    ready: boolean;
    blockers: string[];
  }>;
  missingFields: string[];
  rightsWarnings: string[];
  authorityBlockers: string[];
  authorityLevel: 'metadata_only' | 'package_ready' | 'delivery_authorized';
}

export type ReleaseStrategyId =
  | 'distribution_first_release'
  | 'short_form_algorithmic_push'
  | 'playlist_ladder'
  | 'direct_fan_conversion'
  | 'sync_or_b2b_positioning'
  | 'club_dj_or_scene_push'
  | 'catalog_foundation_release';

export interface ReleaseStrategy {
  id: ReleaseStrategyId;
  name: string;
  score: number;
  primaryChannel: string;
  rationale: string[];
  nextTasks: string[];
}

export interface HarnessTimelineItem {
  offsetDays: number;
  owner: 'distribution' | 'marketing' | 'creative' | 'legal' | 'finance' | 'artist';
  title: string;
  description: string;
}

export interface HarnessAgentBrief {
  // Must be ValidAgentIds. Release-plan/milestone orchestration routes to the
  // Conductor hub ('generalist') — there is no standalone 'timeline' agent.
  agentId: 'distribution' | 'marketing' | 'creative' | 'legal' | 'finance' | 'generalist';
  brief: string;
  inputs: string[];
  blockedBy?: string[];
}

export interface ReleaseHarnessResult {
  runId: string;
  userId: string;
  projectId?: string;
  trackId?: string;
  createdAt: string;
  releaseDna: ReleaseDna;
  artistOperatingModel: ArtistOperatingModel;
  distributionReadiness: DistributionReadiness;
  recommendedStrategy: ReleaseStrategy;
  strategyAlternatives: ReleaseStrategy[];
  timelineDraft: HarnessTimelineItem[];
  agentBriefs: HarnessAgentBrief[];
  metadataDraft: Partial<ExtendedGoldenMetadata>;
  assumptions: string[];
  warnings: string[];
  confidence: number;
}
