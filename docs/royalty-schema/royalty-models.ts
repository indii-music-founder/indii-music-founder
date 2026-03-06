// Royalty Collection Data Models for indiiOS
// Version: 1.0
// Date: 2026-03-05

// ============================================================================
// CORE ENTITY: Artist Royalty Profile
// ============================================================================

/**
 * Master profile tracking all royalty-related registrations and statuses
 * for an artist/user in the indiiOS system.
 */
export interface RoyaltyProfile {
  id: string;                          // UUID
  userId: string;                      // Link to indiiOS user
  createdAt: Date;
  updatedAt: Date;
  
  // Registration Status Tracking
  proRegistration: ProRegistrationStatus;
  soundExchangeRegistration: SoundExchangeStatus;
  mlcRegistration: MlcStatus;
  copyrightRegistrations: CopyrightRegistration[];
  
  // Collection Preferences
  preferredPro: 'BMI' | 'ASCAP' | 'SESAC' | null;
  isSelfPublished: boolean;            // Claims publisher share?
  
  // Distributor History
  distributorHistory: DistributorRecord[];
  currentDistributor: string | null;   // Distributor ID
  
  // Metadata
  ipiNumber: string | null;            // IPI/CAE from PRO
  taxTreatyCountry: string | null;     // For international withholding
}

// ============================================================================
// PRO (Performance Rights Organization) Registration
// ============================================================================

export interface ProRegistrationStatus {
  status: RegistrationState;
  selectedPro: 'BMI' | 'ASCAP' | 'SESAC' | null;
  
  // Songwriter Registration
  songwriterRegistered: boolean;
  songwriterRegistrationDate: Date | null;
  ipiNumber: string | null;
  
  // Publisher Registration (if self-published)
  publisherRegistered: boolean;
  publisherRegistrationDate: Date | null;
  publisherIpiNumber: string | null;
  
  // Application Tracking
  applicationSubmitted: boolean;
  applicationDate: Date | null;
  confirmationNumber: string | null;
  
  // Notes/Issues
  blockingIssues: RegistrationIssue[];
  notes: string;
}

export type RegistrationState = 
  | 'not_started'
  | 'in_progress'      // Gathering info, preparing application
  | 'submitted'        // Application sent, awaiting confirmation
  | 'pending'          // Confirmed, waiting for IPI assignment
  | 'active'           // Fully registered, can collect
  | 'blocked';         // Has issues preventing completion

export interface RegistrationIssue {
  id: string;
  type: 'missing_info' | 'name_conflict' | 'tax_id_issue' | 'payment_setup' | 'other';
  description: string;
  severity: 'blocking' | 'warning';
  createdAt: Date;
  resolvedAt: Date | null;
}

// ============================================================================
// SoundExchange Registration
// ============================================================================

export interface SoundExchangeStatus {
  status: RegistrationState;
  
  // Account Details
  accountId: string | null;
  registrationDate: Date | null;
  
  // Payment Setup
  paymentMethod: 'direct_deposit' | 'check' | null;
  paymentThreshold: number;            // Min payout amount ($25-$100)
  
  // Track Registration
  registeredTracks: number;
  totalTracks: number;
  
  // Collection Stats
  lastPaymentDate: Date | null;
  lastPaymentAmount: number | null;
  
  // Notes
  blockingIssues: RegistrationIssue[];
}

// ============================================================================
// MLC (Mechanical Licensing Collective) Registration
// ============================================================================

export interface MlcStatus {
  status: RegistrationState;
  
  // Account Details
  accountId: string | null;
  registrationDate: Date | null;
  
  // Dependencies
  requiresIpiNumber: boolean;          // True - needs PRO registration first
  ipiNumberLinked: string | null;
  
  // Work Registration
  registeredWorks: number;
  pendingWorks: number;
  
  // Publisher Status
  claimsPublisherShare: boolean;
  publisherAccountId: string | null;
  
  // Collection Stats
  lastStatementDate: Date | null;
  
  // Notes
  blockingIssues: RegistrationIssue[];
}

// ============================================================================
// Copyright Registration (Library of Congress)
// ============================================================================

export interface CopyrightRegistration {
  id: string;
  workId: string;                      // Link to indiiOS work/track
  workType: 'single' | 'album' | 'collection';
  
  // Registration Details
  status: RegistrationState;
  registrationNumber: string | null;
  registrationDate: Date | null;
  effectiveDate: Date | null;          // When protection begins
  
  // Application
  applicationSubmitted: boolean;
  applicationDate: Date | null;
  depositCopySent: boolean;            // Physical/digital deposit
  
  // Fees
  feePaid: boolean;
  feeAmount: number;                   // ~$45-65 per work
  
  // Notes
  blockingIssues: RegistrationIssue[];
}

// ============================================================================
// Distributor Management
// ============================================================================

export interface DistributorRecord {
  id: string;
  distributorName: string;             // 'DistroKid', 'TuneCore', etc.
  distributorType: 'unlimited' | 'per_release' | 'free';
  
  // Timeline
  startDate: Date;
  endDate: Date | null;                // Null if current
  isCurrent: boolean;
  
  // Trailing Royalties Tracking
  trailingRoyaltiesStatus: 'active' | 'transferred' | 'claimed' | 'at_risk';
  lastStatementDownloaded: Date | null;
  finalStatementRequested: boolean;
  
  // Releases
  releases: string[];                  // Array of release IDs
  
  // Notes
  migrationNotes: string;              // Important info for transition
}

export interface DistributorMigration {
  id: string;
  fromDistributor: string;
  toDistributor: string;
  initiatedDate: Date;
  status: 'planning' | 'notified_old' | 'downloading_statements' | 'completed' | 'cancelled';
  
  // Checklist
  stepsCompleted: {
    notifiedOldDistributor: boolean;
    downloadedAllStatements: boolean;
    updatedBankingInfo: boolean;
    removedReleasesFromOld: boolean;
    uploadedToNewDistributor: boolean;
    verifiedFirstPayment: boolean;
  };
  
  // Risk Tracking
  atRiskAmount: number | null;         // Estimated royalties in limbo
  riskMitigationNotes: string;
}

// ============================================================================
// Royalty Streams & Payments
// ============================================================================

export interface RoyaltyStream {
  id: string;
  profileId: string;                   // Link to RoyaltyProfile
  
  // Source
  sourceType: RoyaltySourceType;
  sourceName: string;                  // 'BMI', 'Spotify', 'SoundExchange', etc.
  sourceId: string | null;             // Internal ID if applicable
  
  // Payment Details
  paymentDate: Date;
  periodStart: Date;                   // What period this covers
  periodEnd: Date;
  amount: number;
  currency: string;
  
  // Breakdown
  grossAmount: number;
  deductions: Deduction[];
  netAmount: number;
  
  // Documentation
  statementUrl: string | null;
  statementDownloaded: boolean;
  
  // Reconciliation
  reconciled: boolean;
  reconciliationNotes: string | null;
}

export type RoyaltySourceType = 
  | 'pro_performance'      // BMI, ASCAP, SESAC
  | 'sound_exchange'       // Digital performance
  | 'mlc_mechanical'       // Streaming mechanicals
  | 'distributor'          // Spotify, Apple Music, etc.
  | 'sync_license'         // TV, film, commercial
  | 'neighboring_rights'   // International performance
  | 'youtube_content_id'   // YouTube claims
  | 'direct_sale'          // Merch, Bandcamp, etc.
  | 'other';

export interface Deduction {
  type: 'tax_withholding' | 'admin_fee' | 'distribution_fee' | 'other';
  description: string;
  amount: number;
  percentage: number | null;
}

// ============================================================================
// Split Sheets & Collaboration
// ============================================================================

export interface SplitSheet {
  id: string;
  workId: string;                      // Link to indiiOS work
  workTitle: string;
  
  // Parties
  contributors: SplitContributor[];
  
  // Splits
  totalSplits: number;                 // Should equal 100
  songwriterSplits: number;            // Sum of all songwriter %
  publisherSplits: number;             // Sum of all publisher %
  
  // Documentation
  documentUrl: string | null;          // Signed PDF
  signedByAll: boolean;
  signatureDates: Record<string, Date>; // contributorId -> date
  
  // Status
  status: 'draft' | 'pending_signatures' | 'signed' | 'registered';
  
  // PRO Registration
  registeredWithPro: boolean;
  registrationDate: Date | null;
}

export interface SplitContributor {
  id: string;
  userId: string | null;               // If indiiOS user
  name: string;
  email: string;
  role: 'songwriter' | 'producer' | 'featured_artist' | 'publisher';
  
  // Splits
  songwriterPercentage: number;        // Of total 100%
  publisherPercentage: number;         // Of total 100% (if applicable)
  
  // PRO Info
  proAffiliation: 'BMI' | 'ASCAP' | 'SESAC' | 'other' | null;
  ipiNumber: string | null;
  
  // Payment
  paymentMethod: 'direct_deposit' | 'check' | 'other' | null;
  
  // Signature
  signed: boolean;
  signedAt: Date | null;
}

// ============================================================================
// Release Gating & Workflow
// ============================================================================

/**
 * Determines if a release can proceed based on registration status
 */
export interface ReleaseGate {
  releaseId: string;
  profileId: string;
  
  // Required Registrations
  requirements: {
    proRegistration: boolean;          // Must be registered with PRO
    soundExchange: boolean;            // Recommended, not blocking
    mlcRegistration: boolean;          // Must have IPI (so PRO first)
    splitsSigned: boolean;             // All contributors signed
  };
  
  // Current Status
  checks: {
    proRegistration: GateCheck;
    soundExchange: GateCheck;
    mlcRegistration: GateCheck;
    splitsSigned: GateCheck;
  };
  
  // Overall
  canRelease: boolean;
  blockingItems: string[];
  warnings: string[];
  
  // Override
  overrideRequested: boolean;
  overrideReason: string | null;
  overrideApprovedBy: string | null;   // User ID who approved
}

export interface GateCheck {
  required: boolean;
  passed: boolean;
  status: 'not_started' | 'in_progress' | 'complete' | 'waived';
  message: string;
}

// ============================================================================
// Business Rules & Validation
// ============================================================================

/**
 * Validation rules for royalty-related operations
 */
export const RoyaltyValidationRules = {
  // PRO Registration
  proRequiredBeforeRelease: true,
  proRetroactivePayment: false,        // Critical: PROs don't pay retroactively
  
  // MLC Registration  
  mlcRequiresIpi: true,                // Must have PRO IPI first
  mlcClaimsBothShares: true,           // Self-published artists claim 200%
  
  // SoundExchange
  soundExchangeRequiresIsrc: true,
  
  // Splits
  maxTotalSplit: 100,
  minContributorSplit: 1,
  splitsMustBeSigned: true,
  
  // Timing
  proRegistrationLeadTime: 30,         // Days recommended before release
  mlcRegistrationLeadTime: 14,         // Days after PRO registration
  
  // Distributors
  trailingRoyaltiesHoldPeriod: 180,    // Days (6 months typical)
} as const;

// ============================================================================
// API Response Types
// ============================================================================

export interface RoyaltyDashboardSummary {
  profileId: string;
  
  // Registration Progress
  registrationProgress: {
    pro: number;                       // 0-100
    soundExchange: number;
    mlc: number;
    copyright: number;
  };
  
  // Financial Summary (Last 12 Months)
  totalRoyalties: number;
  bySource: Record<RoyaltySourceType, number>;
  
  // Upcoming Payments
  expectedPayments: {
    source: string;
    expectedDate: Date;
    estimatedAmount: number | null;
  }[];
  
  // Action Items
  pendingActions: {
    type: 'registration' | 'signature' | 'statement_download' | 'migration';
    priority: 'critical' | 'high' | 'medium';
    description: string;
    dueDate: Date | null;
  }[];
  
  // Alerts
  alerts: {
    type: 'warning' | 'opportunity' | 'deadline';
    message: string;
    actionUrl: string | null;
  }[];
}
