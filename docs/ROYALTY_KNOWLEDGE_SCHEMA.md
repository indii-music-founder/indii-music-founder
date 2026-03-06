# indiiOS Royalty Management System - Knowledge Schema & Data Models

## Overview
AI-native platform for guiding independent artists through US music royalty collection.

---

## 1. ENTITY RELATIONSHIP DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE ENTITIES                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Artist    │────▶│   Identity   │◄────│   Entity     │
│  (Person)    │     │   (User)     │     │  (Business)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │         ┌──────────┴──────────┐         │
       │         │                     │         │
       └────────▶│     Song/Work       │◄────────┘
                 │                     │
                 │  ┌───────────────┐  │
                 └──│ Composition   │──┘
                    │   (Publishing)│
                    │               │
                    │  • Lyrics     │
                    │  • Melody     │
                    │  • Songwriter │
                    │    splits     │
                    └───────┬───────┘
                            │ 1:N
                            ▼
                    ┌───────────────┐
                    │ Master        │
                    │ Recording     │
                    │               │
                    │  • Sound      │
                    │  • Performer  │
                    │  • Producer   │
                    │    splits     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Release     │
                    │               │
                    │  • Album/EP/  │
                    │    Single     │
                    │  • UPC        │
                    │  • Release    │
                    │    date       │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Distributor  │
                    │   Account     │
                    │               │
                    │  • Platform   │
                    │  • Store IDs  │
                    │  • ISRC       │
                    └───────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         COLLECTION ENTITIES                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      PRO        │    │  SoundExchange  │    │      MLC        │
│  (BMI/ASCAP/    │    │                 │    │                 │
│    SESAC)       │    │  • Non-interact │    │  • Mechanical   │
│                 │    │    streaming    │    │    streaming    │
│  • Performance  │    │  • Satellite    │    │  • Downloads    │
│    royalties    │    │  • Cable        │    │  • Physical     │
│  • Radio/TV/    │    │  • Webcasters   │    │    (US only)    │
│    Live         │    │                 │    │                 │
│  • Streaming    │    │  50% Artist     │    │  Songwriter     │
│    (performing  │    │  45% Label      │    │  only           │
│    rights)      │    │  5% Session     │    │                 │
└────────┬────────┘    └─────────────────┘    └─────────────────┘
         │
         │ 1:1 with Songwriter
         ▼
┌─────────────────┐
│  PRO Membership │
│                 │
│  • IPI Number   │
│  • CAE/IPI      │
│  • Affiliation  │
│    date         │
│  • Works        │
│    registered   │
└─────────────────┘
```

---

## 2. CORE DATA MODELS (TypeScript)

```typescript
// ============================================================================
// BASE TYPES
// ============================================================================

type UUID = string;
type ISWC = string;  // International Standard Musical Work Code
type ISRC = string;  // International Standard Recording Code
type ISNI = string;  // International Standard Name Identifier
type IPI = string;   // Interested Party Information (CAE/IPI)
type UPC = string;   // Universal Product Code
type EIN = string;   // Employer Identification Number

// ============================================================================
// ENUMS
// ============================================================================

enum PRO {
  BMI = 'BMI',
  ASCAP = 'ASCAP',
  SESAC = 'SESAC',
  GMR = 'GMR'  // Global Music Rights (invite-only)
}

enum RoyaltyType {
  PERFORMANCE = 'performance',
  MECHANICAL = 'mechanical',
  STREAMING_MASTER = 'streaming_master',
  NON_INTERACTIVE = 'non_interactive',
  SYNC = 'sync',
  PRINT = 'print',
  THEATRICAL = 'theatrical'
}

enum CollectionSource {
  BMI = 'BMI',
  ASCAP = 'ASCAP',
  SESAC = 'SESAC',
  MLC = 'MLC',
  HARRY_FOX = 'HARRY_FOX',
  SOUND_EXCHANGE = 'SOUND_EXCHANGE',
  DISTROKID = 'DISTROKID',
  TUNECORE = 'TUNECORE',
  CD_BABY = 'CD_BABY',
  UNITED_MASTERS = 'UNITED_MASTERS',
  AWAL = 'AWAL',
  SPOTIFY = 'SPOTIFY',
  APPLE_MUSIC = 'APPLE_MUSIC',
  YOUTUBE = 'YOUTUBE',
  BANDCAMP = 'BANDCAMP'
}

enum WorkStatus {
  DRAFT = 'draft',
  UNREGISTERED = 'unregistered',
  PRO_PENDING = 'pro_pending',
  PRO_REGISTERED = 'pro_registered',
  MLC_PENDING = 'mlc_pending',
  MLC_REGISTERED = 'mlc_registered',
  FULLY_REGISTERED = 'fully_registered',
  DISPUTED = 'disputed',
  INACTIVE = 'inactive'
}

enum ReleaseStatus {
  PLANNED = 'planned',
  DISTRIBUTOR_PENDING = 'distributor_pending',
  DISTRIBUTED = 'distributed',
  LIVE = 'live',
  TAKEDOWN_PENDING = 'takedown_pending',
  TAKEN_DOWN = 'taken_down',
  MIGRATING = 'migrating'
}

enum AlertPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

enum AlertType {
  REGISTRATION_DEADLINE = 'registration_deadline',
  PRO_AFFILIATION_REQUIRED = 'pro_affiliation_required',
  MLC_REGISTRATION = 'mlc_registration',
  SOUNDEXCHANGE_REGISTRATION = 'soundexchange_registration',
  SPLIT_AGREEMENT_MISSING = 'split_agreement_missing',
  PAYOUT_AVAILABLE = 'payout_available',
  DISTRIBUTOR_MIGRATION = 'distributor_migration',
  UNCLAIMED_ROYALTIES = 'unclaimed_royalties',
  COPYRIGHT_CLAIM = 'copyright_claim',
  CONTRACT_RENEWAL = 'contract_renewal'
}

// ============================================================================
// CORE ENTITIES
// ============================================================================

interface Identity {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  legalName: string;
  stageName?: string;
  email: string;
  phone?: string;
  ssn?: string;
  ein?: EIN;
  taxClassification: 'individual' | 'llc' | 'corporation' | 'partnership';
  proMemberships: PROMembership[];
  soundExchangeId?: string;
  soundExchangeRegisteredAt?: Date;
  mlcRegistered: boolean;
  mlcRegisteredAt?: Date;
  paymentMethods: PaymentMethod[];
  notificationSettings: NotificationSettings;
}

interface PROMembership {
  id: UUID;
  pro: PRO;
  ipiNumber: IPI;
  caeNumber: string;
  affiliatedAt: Date;
  status: 'active' | 'suspended' | 'terminated';
  performingRightsSociety?: string;
  surveyOptIn: boolean;
}

interface PaymentMethod {
  id: UUID;
  type: 'ach' | 'wire' | 'paypal' | 'check';
  isDefault: boolean;
  bankName?: string;
  accountNumberLast4?: string;
  routingNumber?: string;
  verifiedAt?: Date;
  sourceRouting?: {
    source: CollectionSource;
    paymentMethodId: UUID;
  }[];
}

// ============================================================================
// SONG/WORK ENTITIES
// ============================================================================

interface Composition {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  alternateTitles: string[];
  iswc?: ISWC;
  songwriters: SongwriterCredit[];
  publishers: PublisherCredit[];
  status: WorkStatus;
  registrations: WorkRegistration[];
  genre: string[];
  mood?: string[];
  language: string;
  explicit: boolean;
  writtenAt?: Date;
  firstPublishedAt?: Date;
  version: number;
  previousVersions: UUID[];
}

interface SongwriterCredit {
  identityId: UUID;
  role: 'author' | 'composer' | 'author_composer' | 'arranger';
  splitPercentage: number;
  pro: PRO;
  ipiNumber: IPI;
  canCollectPublisherShare: boolean;
}

interface PublisherCredit {
  identityId?: UUID;
  publisherName: string;
  adminPercentage: number;
  collectionPercentage: number;
  territory: 'worldwide' | string[];
  startDate: Date;
  endDate?: Date;
  isExclusive: boolean;
}

interface WorkRegistration {
  id: UUID;
  source: CollectionSource;
  externalWorkId?: string;
  registeredAt: Date;
  status: 'pending' | 'confirmed' | 'rejected' | 'disputed';
  registeredSplits: {
    identityId: UUID;
    role: string;
    percentage: number;
  }[];
  retroactiveEligibleFrom?: Date;
  retroactiveClaimDeadline?: Date;
}

// ============================================================================
// MASTER RECORDING ENTITIES
// ============================================================================

interface MasterRecording {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  version?: string;
  isrc: ISRC;
  compositionId: UUID;
  performers: PerformerCredit[];
  producers: ProducerCredit[];
  rightsOwners: MasterRightsOwner[];
  duration: number;
  audioFileUrl?: string;
  soundExchangeRegistered: boolean;
  soundExchangeRegistration?: SoundExchangeRegistration;
}

interface PerformerCredit {
  identityId: UUID;
  isPrimary: boolean;
  role: 'lead' | 'featured' | 'background';
}

interface ProducerCredit {
  identityId: UUID;
  role: 'producer' | 'co_producer' | 'executive_producer';
  splitPercentage: number;
  royaltyPercentage?: number;
}

interface MasterRightsOwner {
  identityId: UUID;
  percentage: number;
  isLabel: boolean;
  isArtist: boolean;
  distributorAccountIds: UUID[];
}

interface SoundExchangeRegistration {
  registeredAt: Date;
  accountId: string;
  artistPercentage: number;
  labelPercentage: number;
  sessionPercentage: number;
  artistPayeeId: UUID;
  labelPayeeId?: UUID;
  sessionPayeeId?: UUID;
}

// ============================================================================
// RELEASE ENTITIES
// ============================================================================

interface Release {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  upc: UPC;
  type: 'single' | 'ep' | 'album' | 'compilation';
  tracks: Track[];
  coverArtUrl?: string;
  releaseDate: Date;
  originalReleaseDate?: Date;
  distributorAccounts: DistributorAccount[];
  status: ReleaseStatus;
  territories: string[];
  migrationHistory: DistributionMigration[];
}

interface Track {
  id: UUID;
  position: number;
  compositionId: UUID;
  masterRecordingId: UUID;
  isrc: ISRC;
  title: string;
  version?: string;
  explicit: boolean;
}

interface DistributorAccount {
  id: UUID;
  distributor: CollectionSource;
  accountId: string;
  accountEmail: string;
  status: 'active' | 'pending' | 'suspended' | 'migrating';
  connectedAt: Date;
  spotifyArtistId?: string;
  appleMusicArtistId?: string;
  autoPay: boolean;
  payThreshold: number;
}

interface DistributionMigration {
  id: UUID;
  fromDistributor: CollectionSource;
  toDistributor: CollectionSource;
  initiatedAt: Date;
  completedAt?: Date;
  trailingRoyaltyPeriodEnd: Date;
  status: 'planned' | 'notified' | 'in_progress' | 'completed' | 'cancelled';
  takedownRequestedAt?: Date;
  takedownConfirmedAt?: Date;
  reuploadCompletedAt?: Date;
}

// ============================================================================
// ALERT/NOTIFICATION ENTITIES
// ============================================================================

interface Alert {
  id: UUID;
  createdAt: Date;
  type: AlertType;
  priority: AlertPriority;
  identityId: UUID;
  title: string;
  description: string;
  relatedWorkId?: UUID;
  relatedReleaseId?: UUID;
  relatedCollectionSource?: CollectionSource;
  dueDate?: Date;
  suggestedActions: SuggestedAction[];
  status: 'unread' | 'read' | 'dismissed' | 'actioned';
  dismissedAt?: Date;
  actionedAt?: Date;
}

interface SuggestedAction {
  id: UUID;
  type: 'register_pro' | 'register_mlc' | 'register_soundexchange' | 
        'sign_agreement' | 'update_splits' | 'migrate_distributor' |
        'claim_royalties' | 'contact_support';
  label: string;
  url?: string;
  canAutoComplete: boolean;
  autoCompletePayload?: Record<string, unknown>;
}
```

---

## 3. KEY BUSINESS LOGIC RULES

### Rule 1: Registration Timing (CRITICAL)
```
RULE: Money only accrues from registration date forward
- PROs: Must affiliate BEFORE first public performance
- MLC: Must register work BEFORE streaming revenue accrues
- SoundExchange: Must register recording BEFORE non-interactive play

ENFORCEMENT:
- Block "release" action if composition not PRO-registered
- Alert at 30, 14, 7 days before release if gaps exist
- Track "first use" date for retroactive eligibility
```

### Rule 2: Split Validation
```
RULE: All splits must sum to 100%
- Composition: Sum of songwriter splits = 100%
- Master: Sum of rights owner splits = 100%
- Producer points come FROM artist share, not additive

ENFORCEMENT:
- Validate on split agreement creation
- Require signed agreement before distributor upload
- Flag disputes if registrations don't match agreements
```

### Rule 3: PRO Exclusivity
```
RULE: Songwriters can only affiliate with ONE PRO at a time
- US PROs are mutually exclusive
- Foreign PROs can be reciprocal

ENFORCEMENT:
- Validate on affiliation attempt
- Track affiliation history
- Alert if co-writer has different PRO (split collection)
```

### Rule 4: SoundExchange Allocation
```
RULE: Fixed statutory split
- 50% Featured Artist
- 45% Rights Owner (label/artist)
- 5% Non-featured musicians (session players)

ENFORCEMENT:
- Validate allocation on registration
- Ensure all three buckets have payees
- Default to statutory if not specified
```

### Rule 5: Distributor Migration Trailing Period
```
RULE: Old distributor collects for 6-12 months post-takedown
- Trailing royalties belong to OLD distributor
- New distributor only collects from re-upload date

ENFORCEMENT:
- Calculate trailing period end date
- Don't delete old distributor account until period ends
- Aggregate reporting across both during overlap
```

### Rule 6: Retroactive Collection Windows
```
RULE: Limited lookback periods
- BMI: 6 months retroactive from registration
- ASCAP: 6 months retroactive
- MLC: 3 years for unclaimed royalties
- SoundExchange: No retroactive (must register before play)

ENFORCEMENT:
- Calculate claim deadlines
- Prioritize registrations with shortest windows
- Alert on approaching deadlines
```

---

## 4. STATE MACHINE: SONG/RELEASE LIFECYCLE

```
COMPOSITION LIFECYCLE
=====================

[CREATED]
    │
    ▼
[DRAFT]
    │
    │ Split agreement defined?
    ▼
[SPLITS_PENDING] ──signatures──▶ [SPLITS_COMPLETE]
    │                                    │
    │ No                                 │
    ▼                                    │
[AWAITING_PRO_AFFILIATION]              │
    │                                    │
    │ Affiliate with PRO                 │
    ▼                                    │
[PRO_AFFILIATED] ◀──────────────────────┘
    │
    │ Register work with PRO
    ▼
[PRO_REGISTERED]
    │
    │ Register with MLC (if US distribution)
    ▼
[MLC_REGISTERED]
    │
    │ All registrations complete
    ▼
[FULLY_REGISTERED]
    │
    │ Release published
    ▼
[MONETIZING] ◄──────┐
    │               │
    │ Royalties     │
    │ coming in     │
    ▼               │
[REPORTING] ────────┘
    │
    │ Dispute raised
    ▼
[DISPUTED] ──resolved──▶ [MONETIZING]
    │
    │ Agreement ends / takedown
    ▼
[INACTIVE]


RELEASE LIFECYCLE
=================

[PLANNED]
    │
    │ All works fully registered?
    ▼
[READY_FOR_DISTRIBUTION]
    │
    │ Upload to distributor
    ▼
[DISTRIBUTOR_PENDING]
    │
    │ Approved by distributor
    ▼
[DISTRIBUTED]
    │
    │ Live on platforms
    ▼
[LIVE] ◄──────────────────────┐
    │                         │
    │ Royalties accumulating  │
    │                         │
    ▼                         │
[MONETIZING] ─────────────────┘
    │
    │ Migration initiated
    ▼
[MIGRATION_NOTIFIED]
    │
    │ Takedown requested
    ▼
[TAKEDOWN_PENDING]
    │
    │ Takedown confirmed
    ▼
[MIGRATING]
    │
    │ Re-uploaded to new distributor
    ▼
[DISTRIBUTED] (new distributor)
    │
    │ Trailing period ended
    ▼
[TRAILING_COMPLETE]
    │
    │ Close old distributor account
    ▼
[FULLY_MIGRATED]
```

---

## 5. ALERT TRIGGERS (System Notifications)

| Trigger | Priority | Condition | Action |
|---------|----------|-----------|--------|
| PRO Registration Required | CRITICAL | Release date < 14 days, no PRO affiliation | Block release, guide signup |
| MLC Registration Pending | HIGH | PRO registered, MLC not registered | Alert, auto-register if opted in |
| SoundExchange Missing | MEDIUM | Master distributed, no SX registration | Alert, guide registration |
| Split Agreement Missing | CRITICAL | Release planned, no signed splits | Block distribution |
| Trailing Royalty Due | HIGH | Migration completed, trailing period ended | Alert to check old distributor |
| Unclaimed Royalties | HIGH | Unclaimed balance > $100, deadline < 90 days | Alert, guide claim process |
| Registration Deadline | CRITICAL | Retroactive claim deadline < 30 days | Urgent alert, guide action |

---

## Integration Points with Existing indiiOS

### Data Models to Add
- `RoyaltyProfile` (extends Identity)
- `Composition` (new entity)
- `WorkRegistration` (tracks PRO/MLC status)
- `DistributionMigration` (tracks trailing royalties)
- `Alert` (notification system)

### Agent Updates
- **Publishing Agent**: Add `check_registration_status`, `register_work_mlc`, `register_soundexchange`
- **Finance Agent**: Add `track_trailing_royalties`, `alert_unclaimed_payments`
- **Onboarding**: Add PRO/SoundExchange/MLC registration flow

### UI Components
- Registration checklist dashboard
- Alert center with priority badges
- Release gate (blocks if registrations incomplete)
- Migration wizard with trailing payment tracker
