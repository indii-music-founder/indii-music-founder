// ============================================================================
// Registration Center — Core Types
// ============================================================================

export type OrgId = 'loc' | 'ascap' | 'bmi' | 'sesac' | 'soundexchange' | 'mlc';

export type OrgCategory = 'copyright' | 'pro' | 'digital' | 'mechanical';

export type RegistrationStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'confirmed'
  | 'error';

export type FieldType = 'text' | 'date' | 'select' | 'boolean' | 'multiselect' | 'textarea';

// A single field in an org's registration form, in indiiOS language
export interface RegistrationField {
  id: string;
  label: string;             // artist-friendly label
  orgLabel: string;          // what the org actually calls it (for mapping)
  type: FieldType;
  options?: string[];        // for select / multiselect
  required: boolean;
  helpText?: string;         // plain English explanation shown on demand
  autoFillFrom?: keyof CatalogTrack; // field in catalog data to pre-populate from
  placeholder?: string;
}

// A track from the artist's catalog (minimal shape — pulled from existing store)
export interface CatalogTrack {
  id: string;
  title: string;
  artistName: string;
  writersAndContributors: Array<{
    name: string;
    role: string;
    percentage: number;
    ipiNumber?: string;
  }>;
  isrc?: string;
  iswc?: string;
  releaseDate?: string;
  genre?: string;
  duration?: number;          // seconds
  bpm?: number;
  musicalKey?: string;
  isPublished: boolean;
  yearOfCreation?: string;
  copyrightClaimant?: string;
  workForHire?: boolean;
  countryOfFirstPublication?: string;
  publisherName?: string;
  publisherNumber?: string;   // BMI publisher number
}

// Result from submitting to an org
export interface SubmissionResult {
  success: boolean;
  confirmationNumber?: string;
  errorMessage?: string;
  submittedAt: Date;
  requiresManualStep?: boolean;  // web fallback — auto submission not possible
  manualStepUrl?: string;
  manualStepInstructions?: string;
}

// Per-org registration record (stored in Firestore)
export interface OrgRegistrationRecord {
  orgId: OrgId;
  status: RegistrationStatus;
  submittedAt?: Date;
  confirmedAt?: Date;
  confirmationNumber?: string;
  formSnapshot?: Record<string, unknown>;  // what was submitted
  errorMessage?: string;
  lastUpdated: Date;
}

// Per-track aggregated registration state
export interface TrackRegistrationState {
  trackId: string;
  orgs: Partial<Record<OrgId, OrgRegistrationRecord>>;
  completenessScore: number;   // 0–100, % of relevant orgs confirmed
}

// The adapter contract — every org implements this
export interface OrgAdapter {
  id: OrgId;
  name: string;
  shortName: string;
  category: OrgCategory;
  fields: RegistrationField[];
  fee?: { amount: number; currency: string; notes?: string };
  timeline?: string;
  requiresDesktop: boolean;   // true = needs Playwright/Electron for submission
  websiteUrl: string;         // fallback for manual steps
  submit: (
    data: Record<string, unknown>,
    track: CatalogTrack,
    userId: string
  ) => Promise<SubmissionResult>;
  getStatus?: (trackId: string, userId: string) => Promise<RegistrationStatus>;
}

// Form values as the user fills them (gap fields only shown)
export type FormValues = Record<string, string | boolean | string[]>;

// State shape managed by the registration Zustand slice
export interface RegistrationFocus {
  trackId: string | null;
  orgId: OrgId | null;
}
