import type { HarnessEvidenceRef, HarnessLegalBasis, HarnessRun, HarnessSeverity } from '@/services/business-harness';

export type PersonaAssetType = 'artist_name' | 'legal_name' | 'voice' | 'photo' | 'logo' | 'signature' | 'stage_persona';
export type ReplicaIncidentType =
  | 'copyright_infringement'
  | 'voice_clone'
  | 'likeness_image'
  | 'artist_name_brand_confusion'
  | 'impersonation_fraud'
  | 'platform_policy_violation'
  | 'take_it_down_ncii'
  | 'uncertain';

export type TakedownRoute =
  | 'dmca'
  | 'platform_digital_replica'
  | 'platform_impersonation'
  | 'trademark_brand_confusion'
  | 'dsp_duplicate_fraud'
  | 'take_it_down_ftc'
  | 'attorney_escalation';

export interface IdentityProtectionProfile {
  id: string;
  userId: string;
  legalName?: string;
  artistName?: string;
  state?: string;
  country: string;
  entityName?: string;
  labelName?: string;
  publisherName?: string;
  pro?: 'ASCAP' | 'BMI' | 'SESAC' | 'GMR' | 'Other' | 'None';
  ipiCae?: string;
  trademarkStatus?: 'none' | 'search_needed' | 'pending' | 'registered' | 'unknown';
  copyrightStatus?: 'none' | 'draft' | 'pending' | 'registered' | 'unknown';
  aiVoiceLikenessPermission: 'not_authorized' | 'case_by_case' | 'authorized_license_only';
  monitoringOptIn: boolean;
  biometricFingerprintOptIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProtectedPersonaAsset {
  id: string;
  userId: string;
  profileId: string;
  type: PersonaAssetType;
  label: string;
  value?: string;
  storagePath?: string;
  hash?: string;
  consentRequired: boolean;
  createdAt: string;
}

export interface VoiceLikenessConsentRecord {
  id: string;
  userId: string;
  profileId: string;
  grantee: string;
  scope: string;
  status: 'draft' | 'active' | 'revoked' | 'expired';
  startsAt?: string;
  endsAt?: string;
  revocationNotes?: string;
  createdAt: string;
}

export interface AuthorizedReplicaLicense {
  id: string;
  userId: string;
  profileId: string;
  licensee: string;
  permittedUses: string[];
  prohibitedUses: string[];
  compensation: string;
  revocation: string;
  approvalRequiredForNewUse: boolean;
  createdAt: string;
}

export interface ReplicaIncident {
  id: string;
  userId: string;
  profileId?: string;
  incidentType: ReplicaIncidentType;
  severity: HarnessSeverity;
  status: 'draft' | 'needs_review' | 'packet_ready' | 'submitted' | 'resolved' | 'closed';
  suspectedUrl?: string;
  platform?: string;
  description: string;
  confidence: number;
  route: TakedownRoute;
  evidenceRefs: HarnessEvidenceRef[];
  legalBasisRefs: string[];
  createdAt: string;
}

export interface TakedownCase {
  id: string;
  userId: string;
  incidentId: string;
  route: TakedownRoute;
  status: 'draft' | 'needs_user_approval' | 'ready_for_counsel' | 'submitted' | 'closed';
  recipient: string;
  subject: string;
  draftText: string;
  approvalRequired: true;
  attorneyReviewRecommended: boolean;
  warnings: string[];
  createdAt: string;
}

export interface EvidencePacket {
  id: string;
  userId: string;
  title: string;
  profileId?: string;
  incidentId?: string;
  workTitle?: string;
  identifiers: Record<string, string | undefined>;
  evidenceRefs: HarnessEvidenceRef[];
  declaration: string;
  warnings: string[];
  createdAt: string;
}

export interface LegalSourceSnapshot extends HarnessLegalBasis {
  checkedAt: string;
}

export interface ProtectionReadinessScore {
  score: number;
  status: 'protected' | 'partial' | 'at_risk' | 'unknown';
  blockers: string[];
  strengths: string[];
  nextActions: string[];
}

export interface CreatorProtectionReadinessOutput {
  profile: IdentityProtectionProfile;
  readiness: ProtectionReadinessScore;
  lawSnapshots: LegalSourceSnapshot[];
}

export type CreatorProtectionRun = HarnessRun<CreatorProtectionReadinessOutput>;

