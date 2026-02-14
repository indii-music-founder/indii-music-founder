# DDEX Implementation Plan: Autonomous Music Distribution Platform

**Status:** APPROVED - COMPLETE IMPLEMENTATION
**Date:** 2025-12-26
**Mission:** Replace traditional gatekeepers (labels, distributors, societies) by automating the entire lifecycle of a musical work using DDEX standards.

---

## Executive Summary

This plan architects the metadata and supply chain infrastructure to transform indiiOS into a fully autonomous music platform. By implementing DDEX (Digital Data Exchange) standards, we enable:

- **Direct DSP delivery** (Spotify, Apple Music, etc.) without intermediaries
- **Automated royalty processing** with DSR (Digital Sales Reporting)
- **Rights management** at creation (studio) through distribution
- **AI-generated content flagging** (ERN 4.3 support)

**Approach:** HYBRID

- **Phase A:** Integrate with existing distributors (DistroKid, TuneCore, CD Baby) via their APIs
- **Phase B:** Build internal DDEX infrastructure for direct DSP relationships
- **Phase C:** Become our own distributor with direct DSP partnerships

**Foundation Status:** ✅ STRONG

- GoldenMetadata schema aligns with DDEX requirements
- 8 distributors already profiled (DistroKid, TuneCore, CD Baby, etc.)
- Agent framework ready (LicensingAgent, PublishingAgent, FinanceAgent)
- Sample clearance and fingerprinting systems exist

**DPID Status:** ❌ NEEDS APPLICATION (First action item)

---

## Phase 1: Access & Authorization

### 1.1 DDEX Knowledge Base Access

**Action:** Register at DDEX Knowledge Base (kb.ddex.net)

- Access text standards, XSD schemas, implementation guides
- Download ERN, DSR, RIN, MWDR specifications

### 1.2 Execute Implementation License

**Action:** Sign DDEX royalty-free "click-wrap" license

- Required to use DDEX intellectual property
- No cost, but legally required for compliance

### 1.3 Acquire DDEX Party Identifier (DPID)

**Action:** Apply at dpid.ddex.net

- Unique identifier for indiiOS as sender/recipient
- Format: `PADPIDA{10-digit-code}`
- Required for all DDEX message exchanges

**Files to create:**

```
src/services/ddex/
├── DDEXIdentity.ts       # DPID management
└── config/
    └── ddex-credentials.ts
```

---

## Phase 2: Tool Integration

### 2.1 Validation Tools

| Tool                   | Purpose                        | Integration      |
| ---------------------- | ------------------------------ | ---------------- |
| **DDEX Workbench**     | ERN 3.8.2, 4.2, 4.3 validation | Web API or local |
| **DDEX XML Validator** | XSD + Schematron validation    | npm package      |
| **fast-xml-parser**    | XML↔JSON conversion            | npm install      |

### 2.2 Python Libraries (Backend)

```bash
# Cloud Functions dependencies
pip install dsrf        # Google's DSR parser
pip install ddexui      # Metadata creation helper
```

### 2.3 New Dependencies

```json
// package.json additions
{
  "fast-xml-parser": "^4.3.0",
  "xml2js": "^0.6.0",
  "ajv": "^8.12.0" // JSON Schema validation
}
```

**Files to create:**

```
src/services/ddex/
├── DDEXParser.ts         # XML parsing/generation
├── DDEXValidator.ts      # Schema validation
└── schemas/
    ├── ern-4.3.xsd       # ERN schema
    ├── dsr-2.1.xsd       # DSR schema
    └── mwn-1.0.xsd       # Musical Work schema
```

---

## Phase 3: Standard Implementation

### 3.1 ERN - Electronic Release Notification (P0 - Critical)

**Purpose:** Deliver releases to DSPs (replaces distributors)

**Implementation:**

```typescript
// src/services/ddex/ERNService.ts
interface ERNMessage {
  messageHeader: {
    messageId: string;
    messageSender: DPID;
    messageRecipient: DPID;
    messageCreatedDateTime: string;
  };
  releaseList: Release[];
  dealList: Deal[];
  resourceList: Resource[];
}
```

**Key Features:**

- Support ERN 4.3 for AI-generated content flagging
- Map GoldenMetadata → ERN Release structure
- Territory-specific deals (worldwide, US-only, etc.)

**Files to modify:**

- [src/services/metadata/types.ts](src/services/metadata/types.ts) - Extend GoldenMetadata
- [src/modules/music/components/MetadataDrawer.tsx](src/modules/music/components/MetadataDrawer.tsx) - Add ERN fields

**Files to create:**

```
src/services/ddex/
├── ERNService.ts           # ERN message generation
├── ERNMapper.ts            # GoldenMetadata → ERN
└── types/
    └── ern.ts              # ERN TypeScript types
```

### 3.2 MEAD - Media Enrichment & Description (P1)

**Purpose:** Enhanced metadata for discovery (lyrics, bios, focus tracks)

```typescript
interface MEADMessage {
  lyrics: LyricContent[];
  artistBiographies: Biography[];
  focusTracks: string[]; // Highlighted for playlists
  credits: DetailedCredits[];
}
```

**Files to create:**

```
src/services/ddex/
└── MEADService.ts
```

### 3.3 RIN - Recording Information Notification (P1)

**Purpose:** Capture data at point of creation (studio sessions)

```typescript
interface RINMessage {
  sessionInfo: {
    studioName: string;
    recordingDate: string;
    engineers: Contributor[];
    equipment: Equipment[];
  };
  contributors: Contributor[]; // Ensures correct credits from start
  masterRecordingId: string;
}
```

**Integration point:** MusicStudio.tsx when user finalizes a track

**Files to create:**

```
src/services/ddex/
└── RINService.ts
```

### 3.4 MWDR - Musical Work Data & Rights (P2)

**Purpose:** Publishing rights management (replaces publishers/societies)

**Sub-standards:**

- **MWN (Musical Work Notification):** Rights claims and conflicts
- **MWL (Musical Work Licensing):** License musical works

```typescript
interface MWDRMessage {
  musicalWork: {
    iswc: string; // International Standard Musical Work Code
    title: string;
    writers: Writer[]; // Songwriters with splits
    publishers: Publisher[];
    territories: string[];
  };
  rightsClaims: RightsClaim[];
}
```

**Integration:** Extends existing PublishingAgent

**Files to create:**

```
src/services/ddex/
├── MWDRService.ts
└── types/
    └── mwdr.ts
```

### 3.5 RDR - Recording Data & Rights (P2)

**Purpose:** Neighboring rights (replaces SoundExchange, PPL)

```typescript
interface RDRMessage {
  soundRecording: {
    isrc: string;
    performers: Performer[];
    producers: Producer[];
    masterOwner: RightsHolder;
  };
  neighboringRights: NeighboringRight[];
}
```

**Files to create:**

```
src/services/ddex/
└── RDRService.ts
```

### 3.6 DSR - Digital Sales Reporting (P0 - Critical)

**Purpose:** Process usage reports from DSPs (replaces royalty departments)

```typescript
interface DSRReport {
  reportingPeriod: { start: string; end: string };
  salesTransactions: SalesTransaction[];
  usageRecords: UsageRecord[]; // Streams, downloads
  royaltyCalculations: RoyaltyCalculation[];
}

// Integration with existing FinanceAgent
class DSRProcessor {
  async processReport(dsr: DSRReport): Promise<RoyaltyStatement[]> {
    // Parse DSR flat file
    // Calculate per-contributor royalties using GoldenMetadata.splits
    // Generate payment instructions
  }
}
```

**Files to create:**

```
src/services/ddex/
├── DSRService.ts           # DSR parsing
├── DSRProcessor.ts         # Royalty calculations
└── types/
    └── dsr.ts
```

---

## Phase 4: Choreography & Protocol

### 4.1 DDEX Choreography Standard

**Implementation:**

```typescript
// src/services/ddex/DDEXChoreography.ts
interface DeliveryConfig {
  protocol: "SFTP" | "S3" | "GCS";
  host: string;
  credentials: EncryptedCredentials;
  directoryNaming: {
    pattern: "{ReleaseID}_{Timestamp}";
    example: "R123456_20251226T120000Z";
  };
}

class DDEXChoreography {
  // File exchange management
  async deliverRelease(
    ern: ERNMessage,
    assets: Asset[],
  ): Promise<DeliveryReceipt>;
  async pollForAcknowledgement(deliveryId: string): Promise<AckStatus>;
  async receiveReport(reportType: "DSR"): Promise<DSRReport>;
}
```

### 4.2 Complete Set Semantics

**Critical Rule:** Every update must contain ALL valid deals. Missing deals = takedown.

```typescript
// Always send complete state, not incremental updates
async updateReleaseDeal(releaseId: string, deals: Deal[]) {
  // Fetch ALL existing deals for this release
  const existingDeals = await this.getAllDeals(releaseId);
  // Merge with updates (missing = removed)
  const completeDealSet = this.mergeDealSets(existingDeals, deals);
  // Send complete set
  return this.sendERN({ ...release, dealList: completeDealSet });
}
```

### 4.3 Testing Protocol

```typescript
// src/services/ddex/DDEXTestMode.ts
interface TestDelivery {
  isTestFlag: true;  // CRITICAL: Set for testing
  testRecipient: string;
  validateOnly: boolean;
}

// Peer conformance testing before live delivery
async runConformanceTest(ern: ERNMessage): Promise<ConformanceResult> {
  return this.deliver({ ...ern, isTestFlag: true });
}
```

---

## Phase A: Distributor API Integration (IMMEDIATE PATH)

### A.1 Distributor API Services

Since we're starting with existing distributors before direct DSP connections:

```typescript
// src/services/distribution/
├── DistributorService.ts        # Main facade
├── adapters/
│   ├── BaseDistributorAdapter.ts
│   ├── DistroKidAdapter.ts      # DistroKid API
│   ├── TuneCoreAdapter.ts       # TuneCore API
│   ├── CDBabyAdapter.ts         # CD Baby API
│   └── DittoAdapter.ts          # Ditto Music API
└── types/
    └── distributor.ts
```

### A.2 Unified Distributor Interface

```typescript
// src/services/distribution/adapters/BaseDistributorAdapter.ts
interface DistributorAdapter {
  name: string;

  // Release Management
  createRelease(
    metadata: GoldenMetadata,
    assets: ReleaseAssets,
  ): Promise<ReleaseId>;
  updateRelease(
    releaseId: string,
    updates: Partial<GoldenMetadata>,
  ): Promise<void>;
  takedownRelease(releaseId: string): Promise<void>;

  // Status & Reporting
  getReleaseStatus(releaseId: string): Promise<ReleaseStatus>;
  getEarnings(releaseId: string, period: DateRange): Promise<Earnings>;

  // Validation
  validateMetadata(metadata: GoldenMetadata): Promise<ValidationResult>;
  getRequirements(): DistributorRequirements;
}
```

### A.3 DistroKid Integration (Primary)

```typescript
// src/services/distribution/adapters/DistroKidAdapter.ts
class DistroKidAdapter implements DistributorAdapter {
  // DistroKid API endpoints
  private readonly API_BASE = "https://distrokid.com/api/v1";

  async createRelease(metadata: GoldenMetadata, assets: ReleaseAssets) {
    // 1. Upload cover art (3000x3000 JPEG/PNG)
    // 2. Upload audio (WAV/FLAC, 44.1kHz+, 16/24-bit)
    // 3. Submit metadata
    // 4. Return release ID for tracking
  }

  async getEarnings(releaseId: string, period: DateRange) {
    // Fetch earnings from DistroKid bank/stats API
    // Map to unified Earnings interface
  }
}
```

### A.4 Multi-Distributor Release Flow

```typescript
// src/services/distribution/DistributorService.ts
class DistributorService {
  private adapters: Map<string, DistributorAdapter>;

  async releaseToMultiple(
    metadata: GoldenMetadata,
    assets: ReleaseAssets,
    distributors: string[],
  ): Promise<MultiReleaseResult> {
    const results = await Promise.allSettled(
      distributors.map((d) =>
        this.adapters.get(d)!.createRelease(metadata, assets),
      ),
    );

    // Track each distributor's release ID
    // Store mapping in Firestore for earnings aggregation
    return this.aggregateResults(results);
  }

  async aggregateEarnings(releaseId: string): Promise<TotalEarnings> {
    // Fetch from all distributors where this release exists
    // Sum and display unified earnings view
  }
}
```

---

## Phase 5: Backend Services

### 5.1 Cloud Functions Structure

```
functions/src/ddex/
├── delivery.ts           # ERN delivery to DSPs
├── ingest-dsr.ts         # DSR report processing
├── validate.ts           # Schema validation endpoint
├── inngest-workflows.ts  # Async processing
└── distributor-apis/
    ├── spotify.ts
    ├── apple-music.ts
    ├── amazon-music.ts
    └── base.ts           # Common interface
```

### 5.2 Inngest Workflows

```typescript
// Async release delivery workflow
const deliverReleaseFn = inngestClient.createFunction(
  { id: "ddex-deliver-release" },
  { event: "ddex/release.publish" },
  async ({ event, step }) => {
    // Step 1: Validate ERN
    const validation = await step.run("validate", () =>
      DDEXValidator.validateERN(event.data.ern),
    );

    // Step 2: Upload assets to DSP
    const assetDelivery = await step.run("upload-assets", () =>
      DDEXChoreography.uploadAssets(event.data.assets),
    );

    // Step 3: Send ERN message
    const delivery = await step.run("send-ern", () =>
      DDEXChoreography.deliverERN(event.data.ern),
    );

    // Step 4: Poll for acknowledgement
    const ack = await step.waitForEvent("ddex/ack.received", {
      timeout: "24h",
      match: "data.releaseId",
    });

    return { status: "published", deliveryId: delivery.id };
  },
);
```

---

## Phase 6: UI/UX Components

### 6.1 Release Workflow UI

```
src/modules/publishing/
├── PublishingDashboard.tsx    # Main dashboard (exists, expand)
├── components/
│   ├── ReleaseWizard.tsx      # Step-by-step release creation
│   ├── DDEXPreview.tsx        # Preview XML before send
│   ├── DeliveryStatus.tsx     # Track delivery progress
│   ├── DSRReportViewer.tsx    # View royalty reports
│   └── RightsManager.tsx      # Manage rights claims
└── hooks/
    └── useDDEXRelease.ts      # Release state management
```

### 6.2 Enhanced MetadataDrawer

Add DDEX-specific fields:

- Territory selection (worldwide, specific countries)
- Release type (single, EP, album, compilation)
- AI-generated content flag (ERN 4.3)
- Pre-order date
- Exclusive territories/deals

---

## Phase 7: Data Models

### 7.1 Firestore Collections

```typescript
// New collections
interface DDEXRelease {
  id: string;
  orgId: string;
  projectId: string;
  status: "draft" | "validating" | "delivering" | "published" | "failed";
  ernVersion: "4.3";
  metadata: ExtendedGoldenMetadata;
  assets: {
    audioUrl: string;
    coverArtUrl: string;
    additionalAssets?: string[];
  };
  delivery: {
    dpid: string;
    recipientDpid: string;
    deliveredAt?: Timestamp;
    acknowledgedAt?: Timestamp;
  };
  deals: Deal[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface DSRReport {
  id: string;
  orgId: string;
  releaseId: string;
  reportingPeriod: { start: Timestamp; end: Timestamp };
  totalStreams: number;
  totalRevenue: number;
  transactions: DSRTransaction[];
  processedAt: Timestamp;
}

interface RoyaltyPayment {
  id: string;
  orgId: string;
  releaseId: string;
  dsrReportId: string;
  recipient: RoyaltySplit;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
}
```

### 7.2 Extend GoldenMetadata

```typescript
// src/services/metadata/types.ts - Extensions
interface ExtendedGoldenMetadata extends GoldenMetadata {
  // DDEX-specific fields
  releaseType: "Single" | "EP" | "Album" | "Compilation";
  territories: string[]; // ISO country codes or 'Worldwide'
  preOrderDate?: string;
  releaseDate: string;

  // AI Content (ERN 4.3)
  aiGeneratedContent: {
    isFullyAIGenerated: boolean;
    isPartiallyAIGenerated: boolean;
    aiToolsUsed?: string[];
    humanContribution?: string;
  };

  // Additional identifiers
  upc?: string; // Universal Product Code (album)
  catalogNumber?: string;
  labelName: string;

  // Distribution
  distributionChannels: ("streaming" | "download" | "physical")[];
  exclusiveTerritory?: string;
  exclusiveEndDate?: string;
}
```

---

## Implementation Order

| Phase | Component            | Priority | Effort   | Dependencies          |
| ----- | -------------------- | -------- | -------- | --------------------- |
| 1.1   | DPID Registration    | P0       | External | None                  |
| 1.2   | DDEXIdentity.ts      | P0       | 2h       | DPID                  |
| 2.1   | Install npm packages | P0       | 30m      | None                  |
| 2.2   | DDEXParser.ts        | P0       | 4h       | npm packages          |
| 2.3   | DDEXValidator.ts     | P0       | 4h       | DDEXParser            |
| 3.1   | ERNService.ts        | P0       | 8h       | DDEXParser, Validator |
| 3.6   | DSRService.ts        | P0       | 6h       | DDEXParser            |
| 4.1   | DDEXChoreography.ts  | P1       | 6h       | ERNService            |
| 5.1   | Cloud Functions      | P1       | 8h       | All services          |
| 5.2   | Inngest workflows    | P1       | 4h       | Cloud Functions       |
| 6.1   | ReleaseWizard.tsx    | P1       | 8h       | Services              |
| 3.2   | MEADService.ts       | P2       | 4h       | ERNService            |
| 3.3   | RINService.ts        | P2       | 4h       | DDEXParser            |
| 3.4   | MWDRService.ts       | P2       | 6h       | DDEXParser            |
| 3.5   | RDRService.ts        | P2       | 4h       | DDEXParser            |

---

## File Summary

### New Files to Create

```
src/services/ddex/
├── index.ts                    # Main exports
├── DDEXIdentity.ts             # DPID management
├── DDEXParser.ts               # XML↔JSON conversion
├── DDEXValidator.ts            # Schema validation
├── DDEXChoreography.ts         # File exchange protocol
├── ERNService.ts               # Release notifications
├── ERNMapper.ts                # GoldenMetadata → ERN
├── DSRService.ts               # Sales report parsing
├── DSRProcessor.ts             # Royalty calculations
├── MEADService.ts              # Enhanced metadata
├── RINService.ts               # Recording info
├── MWDRService.ts              # Musical work rights
├── RDRService.ts               # Recording rights
├── types/
│   ├── common.ts               # Shared types
│   ├── ern.ts                  # ERN types
│   ├── dsr.ts                  # DSR types
│   └── mwdr.ts                 # MWDR types
└── schemas/                    # XSD files
    ├── ern-4.3.xsd
    ├── dsr-2.1.xsd
    └── ...

src/modules/publishing/
├── components/
│   ├── ReleaseWizard.tsx
│   ├── DDEXPreview.tsx
│   ├── DeliveryStatus.tsx
│   └── DSRReportViewer.tsx
└── hooks/
    └── useDDEXRelease.ts

functions/src/ddex/
├── delivery.ts
├── ingest-dsr.ts
├── validate.ts
└── inngest-workflows.ts
```

### Files to Modify

```
src/services/metadata/types.ts          # Extend GoldenMetadata
src/modules/music/components/MetadataDrawer.tsx  # Add DDEX fields
src/modules/publishing/PublishingDashboard.tsx   # Integrate release flow
src/services/agent/definitions/PublishingAgent.ts # DDEX tools
firestore.rules                         # Add ddexReleases, dsrReports
firestore.indexes.json                  # Add DDEX indexes
package.json                            # Add dependencies
```

---

## Success Metrics

1. **Autonomous Distribution:** Release to 3+ DSPs without human intervention
2. **Royalty Processing:** Automatically calculate and display per-contributor earnings
3. **Compliance:** Pass DDEX peer conformance testing
4. **AI Flagging:** Correctly flag AI-generated content per ERN 4.3
5. **Time Savings:** Reduce release process from days to hours

---

## Technical Warnings

1. **XML Element Order:** DDEX XML requires strict element ordering per XSD
2. **No Comma-Separated Lists:** Use multiple elements, never comma-separated values
3. **Namespace Handling:** Validate namespaces match XSD exactly
4. **Complete Set Semantics:** Missing deals = takedown (critical!)
5. **Test Flag:** Always use `IsTestFlag=true` until peer conformance passes

---

## Notes

- All DDEX features gated by membership tier (Pro/Enterprise)
- Each release counts toward monthly quota
- DSR processing may require premium tier for large catalogs
- AI-generated content flagging is optional but recommended for transparency

---

# Phase 8: UI Implementation Plan (QoL & Polish)

**Status:** PLANNING
**Date:** 2025-12-26
**Goal:** Build comprehensive UI for all DDEX distribution features using existing component libraries.

---

## 8.1 Available UI Framework Components

### Base Components (Already Available)

| Component                          | Location                                               | Purpose                                     |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `ModuleDashboard`                  | `src/components/layout/ModuleDashboard.tsx`            | Page layout with tabs, header, actions      |
| `PropertiesPanel` / `PanelSection` | `src/components/studio/PropertiesPanel.tsx`            | Collapsible sidebar panels                  |
| `PromptInput`                      | `src/components/ui/prompt-input.tsx`                   | Auto-sizing input with actions              |
| `ThreeDButton`                     | `src/components/ui/ThreeDButton.tsx`                   | Variants: primary, secondary, danger, ghost |
| `ThreeDCard`                       | `src/components/ui/ThreeDCard.tsx`                     | 3D hover effect cards                       |
| `FileUpload`                       | `src/components/kokonutui/file-upload.tsx`             | Drag-and-drop with progress                 |
| `AnimatedNumber`                   | `src/components/motion-primitives/animated-number.tsx` | Smooth number transitions                   |
| `TextEffect`                       | `src/components/motion-primitives/text-effect.tsx`     | Text reveal animations                      |
| `Tooltip`                          | `src/components/ui/tooltip.tsx`                        | Radix UI tooltip                            |

### Design System Constants

- **Dark backgrounds:** `#0f0f0f`, `#0d1117`, `#161b22`
- **Card styling:** `bg-[#161b22] border border-gray-800 rounded-xl p-4`
- **Focus rings:** `focus:border-blue-500 focus:ring-1 focus:ring-blue-500`
- **Status colors:** Red (error), Yellow (warning), Green (success), Blue (info)
- **Icons:** Lucide React throughout

---

## 8.2 UI Components to Build

### HIGH Priority (P0)

#### 8.2.1 ReleaseStatusCard Component

**File:** `src/modules/publishing/components/ReleaseStatusCard.tsx`
**Purpose:** Show per-release delivery status across distributors

```
┌────────────────────────────────────────────────────┐
│ 🎵 "Midnight City"                    ⚙️ Actions ▼ │
│ M83 • Single • 2024-01-15                          │
├────────────────────────────────────────────────────┤
│ Distributor    │ Status      │ Live Date │ Link   │
│ DistroKid      │ ● Live      │ Jan 15    │ [↗]    │
│ TuneCore       │ ◐ Review    │ ~Jan 20   │ -      │
│ Symphonic      │ ○ Pending   │ ~Jan 22   │ -      │
└────────────────────────────────────────────────────┘
```

**Data source:** `DistributionPersistenceService.getDeploymentsForRelease()`

#### 8.2.2 DistributorConnectionsPanel Component

**File:** `src/modules/publishing/components/DistributorConnectionsPanel.tsx`
**Purpose:** Manage distributor API connections

```
┌──────────────────────────────────────────────────────┐
│ Distributor Connections                    [+ Add]   │
├──────────────────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌───────────┐           │
│ │DistroKid │ │ TuneCore  │ │ CD Baby   │           │
│ │ ● Online │ │ ○ Offline │ │ ● Online  │           │
│ │ test@... │ │ [Connect] │ │ acct-123  │           │
│ └───────────┘ └───────────┘ └───────────┘           │
└──────────────────────────────────────────────────────┘
```

**Data source:** `CredentialService.getCredentials()`, adapter `.isConnected()`

#### 8.2.3 EarningsDashboard Component

**File:** `src/modules/publishing/components/EarningsDashboard.tsx`
**Purpose:** Display royalties with breakdowns

```
┌──────────────────────────────────────────────────────┐
│ Earnings                    [Q4 2024 ▼] [Export CSV] │
├──────────────────────────────────────────────────────┤
│  $12,450.32    45,230     1,204      $1,867.55      │
│  Net Revenue   Streams    Downloads  Fees           │
├────────────────┬─────────────────────────────────────┤
│ [By Platform]  │ ┌─────────────────────────────┐    │
│ [By Territory] │ │ Spotify      $5,200  (42%) │    │
│ [By Release]   │ │ Apple Music  $4,100  (33%) │    │
│                │ │ YouTube      $1,850  (15%) │    │
│                │ │ Other        $1,300  (10%) │    │
│                │ └─────────────────────────────┘    │
└────────────────┴─────────────────────────────────────┘
```

**Data source:** `DSRService.parseReport()`, aggregation helpers

### MEDIUM Priority (P1)

#### 8.2.4 DSRUploadModal Component

**File:** `src/modules/publishing/components/DSRUploadModal.tsx`
**Purpose:** Upload and parse DSR reports

```
┌────────────────────────────────────────────────────┐
│ Upload Sales Report                            [×] │
├────────────────────────────────────────────────────┤
│   ┌────────────────────────────────────────┐      │
│   │  📁 Drop DSR file here                 │      │
│   │     or click to browse                 │      │
│   │     (.xml, .tsv, .csv)                 │      │
│   └────────────────────────────────────────┘      │
├────────────────────────────────────────────────────┤
│ Preview (first 5 rows):                            │
│ ISRC        │ Title       │ Streams │ Revenue     │
│ US-DK1-... │ Track 1     │ 1,234   │ $4.93       │
│ ...                                                │
├────────────────────────────────────────────────────┤
│ [Cancel]                    [Process Report →]     │
└────────────────────────────────────────────────────┘
```

**Uses:** `FileUpload` component, `DSRService.parseReport()`

#### 8.2.5 ReleaseListView Component

**File:** `src/modules/publishing/components/ReleaseListView.tsx`
**Purpose:** Table of all releases with filters

```
┌──────────────────────────────────────────────────────────────────────┐
│ Releases                          [Search...] [Filter ▼] [+ New]     │
├────────┬────────┬──────────┬───────────┬──────────────┬─────────────┤
│ Cover  │ Title  │ Artist   │ Status    │ Distributors │ Actions     │
├────────┼────────┼──────────┼───────────┼──────────────┼─────────────┤
│ [IMG]  │ Track1 │ ArtistA  │ ● Live    │ 3 platforms  │ ⋮           │
│ [IMG]  │ Track2 │ ArtistB  │ ◐ Review  │ 2 platforms  │ ⋮           │
│ [IMG]  │ Track3 │ ArtistC  │ ✗ Failed  │ 0 platforms  │ ⋮ [Retry]   │
└────────┴────────┴──────────┴───────────┴──────────────┴─────────────┘
```

**Data source:** `DistributorService.getAllReleases()`, Firestore `ddexReleases`

#### 8.2.6 ValidationRequirementsModal Component

**File:** `src/modules/publishing/components/ValidationRequirementsModal.tsx`
**Purpose:** Show per-distributor requirements

```
┌────────────────────────────────────────────────────────────────┐
│ Distributor Requirements                                   [×] │
├────────────────────────────────────────────────────────────────┤
│             │ DistroKid  │ TuneCore   │ CD Baby    │ Symphonic│
├─────────────┼────────────┼────────────┼────────────┼──────────┤
│ Cover Art   │ 3000x3000  │ 1600x1600  │ 1400x1400  │ 3000x3000│
│ Audio       │ WAV/FLAC   │ WAV/FLAC   │ WAV/FLAC   │ WAV/FLAC │
│ ISRC Req    │ ✗          │ ✗          │ ✗          │ ✓        │
│ Lead Time   │ 2 days     │ 7 days     │ 5 days     │ 14 days  │
│ Payout      │ 100%       │ 100%       │ 91%        │ 85%      │
└─────────────┴────────────┴────────────┴────────────┴──────────┘
```

**Data source:** `adapter.requirements` from each adapter

#### 8.2.7 MultiDistributorProgress Component

**File:** `src/modules/publishing/components/MultiDistributorProgress.tsx`
**Purpose:** Real-time submission progress

```
┌────────────────────────────────────────────────────┐
│ Submitting to 3 Distributors...                    │
├────────────────────────────────────────────────────┤
│ DistroKid    [======●=====]  Uploading assets...   │
│ TuneCore     [✓ Complete]    Release ID: TC-12345  │
│ Symphonic    [○ Waiting]     Queued                │
├────────────────────────────────────────────────────┤
│ 1/3 Complete  •  Estimated: 2 min remaining        │
└────────────────────────────────────────────────────┘
```

**Data source:** Real-time from `DistributorService.releaseToMultiple()`

### LOW Priority (P2)

#### 8.2.8 AnalyticsCharts Component

**File:** `src/modules/publishing/components/AnalyticsCharts.tsx`
**Purpose:** Time-series earnings visualization

#### 8.2.9 ReleaseDetailPage Component

**File:** `src/modules/publishing/components/ReleaseDetailPage.tsx`
**Purpose:** Full release view with edit/takedown

#### 8.2.10 PayoutHistory Component

**File:** `src/modules/publishing/components/PayoutHistory.tsx`
**Purpose:** Historical payout timeline

---

## 8.3 Files to Create

```
src/modules/publishing/
├── components/
│   ├── ReleaseStatusCard.tsx        # P0 - Per-release status
│   ├── DistributorConnectionsPanel.tsx # P0 - Connection management
│   ├── EarningsDashboard.tsx        # P0 - Royalty display
│   ├── EarningsBreakdown.tsx        # P0 - Platform/territory tabs
│   ├── DSRUploadModal.tsx           # P1 - Report upload
│   ├── ReleaseListView.tsx          # P1 - Release table
│   ├── ValidationRequirementsModal.tsx # P1 - Requirements comparison
│   ├── MultiDistributorProgress.tsx # P1 - Submission progress
│   ├── AnalyticsCharts.tsx          # P2 - Time-series charts
│   ├── ReleaseDetailPage.tsx        # P2 - Full release view
│   └── PayoutHistory.tsx            # P2 - Payout timeline
└── hooks/
    ├── useDistributorConnections.ts # Connection state management
    ├── useEarnings.ts               # Earnings data fetching
    └── useReleaseList.ts            # Release list with filters
```

---

## 8.4 Files to Modify

```
src/modules/publishing/PublishingDashboard.tsx
  - Replace placeholder "No releases" with ReleaseListView
  - Add DistributorConnectionsPanel to sidebar
  - Integrate EarningsDashboard in stats section

src/modules/publishing/components/ReleaseWizard.tsx
  - Add asset upload using FileUpload component
  - Add live validation feedback panel
  - Add MultiDistributorProgress for submission step

src/core/store/slices/publishingSlice.ts (NEW)
  - Add earnings cache state
  - Add distributor connections state
  - Add release list with filters
```

---

## 8.5 Implementation Order

| Order | Component                                 | Effort | Dependencies                   |
| ----- | ----------------------------------------- | ------ | ------------------------------ |
| 1     | `DistributorConnectionsPanel`             | 4h     | CredentialService              |
| 2     | `ReleaseListView`                         | 6h     | Firestore queries              |
| 3     | `ReleaseStatusCard`                       | 4h     | DistributionPersistenceService |
| 4     | `EarningsDashboard` + `EarningsBreakdown` | 8h     | DSRService                     |
| 5     | `DSRUploadModal`                          | 4h     | FileUpload, DSRService         |
| 6     | `ValidationRequirementsModal`             | 3h     | Adapter requirements           |
| 7     | `MultiDistributorProgress`                | 4h     | DistributorService             |
| 8     | Integrate into `PublishingDashboard`      | 4h     | All above                      |
| 9     | `ReleaseDetailPage`                       | 6h     | ReleaseStatusCard              |
| 10    | `AnalyticsCharts`                         | 8h     | Charting library               |

**Total Estimated Effort:** ~51 hours

---

## 8.6 Styling Guidelines

All new components must follow:

1. **Dark theme colors:**
   - `bg-[#0f0f0f]` for module background
   - `bg-[#161b22]` for cards
   - `border-gray-800` for borders

2. **Status indicators:**
   - `●` Live/Success: `text-green-400 bg-green-500/20`
   - `◐` Processing/Review: `text-yellow-400 bg-yellow-500/20`
   - `○` Pending: `text-gray-400 bg-gray-500/20`
   - `✗` Failed: `text-red-400 bg-red-500/20`

3. **Form inputs:**

   ```tsx
   className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg
              text-white placeholder-gray-500 focus:border-blue-500
              focus:ring-1 focus:ring-blue-500 outline-none"
   ```

4. **Buttons:**
   - Primary: `bg-blue-500 hover:bg-blue-600 text-white rounded-lg`
   - Secondary: `bg-gray-800/50 text-gray-300 hover:bg-gray-800 rounded-lg`
   - Danger: `bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg`

5. **Use existing components:**
   - `ModuleDashboard` for page wrapper
   - `PanelSection` for collapsible sections
   - `ThreeDButton` for primary actions
   - `FileUpload` for file inputs
   - `AnimatedNumber` for stats counters
   - `Tooltip` for icon buttons

6. **Responsive design:**
   - Mobile-first with `md:` and `lg:` breakpoints
   - Stack layouts on small screens
   - `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

## 8.7 Quality of Life Features

### Auto-refresh

- Status cards auto-refresh every 30s
- Earnings dashboard caches with 5-min TTL

### Error handling

- Toast notifications for API errors
- Retry buttons for failed operations
- Graceful fallbacks for missing data

### Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader text for status icons

### Animations

- `AnimatedNumber` for counter updates
- `fade-in` for card appearances
- `slide-in-from-bottom` for modals

---

## 8.8 Success Criteria

1. ✅ User can connect/disconnect distributor accounts
2. ✅ User can see release status across all distributors
3. ✅ User can view earnings with platform/territory breakdowns
4. ✅ User can upload and process DSR reports
5. ✅ User can see real-time progress during multi-distributor release
6. ✅ User can compare distributor requirements before submitting
7. ✅ All components follow existing design system
8. ✅ Mobile-responsive layouts

---

## 8.9 What's Already Built (Backend Services)

These services exist and are ready for UI integration:

### Distribution Services (`src/services/distribution/`)

| File                                | Export               | Purpose                                                                       |
| ----------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `DistributorService.ts`             | `DistributorService` | Main facade - `connect()`, `createRelease()`, `getConnectionStatuses()`       |
| `DistributionPersistenceService.ts` | `distributionStore`  | Electron-store persistence - `getDeploymentsForRelease()`, `saveDeployment()` |
| `types/distributor.ts`              | Types                | `DistributorId`, `ReleaseStatus`, `ReleaseAssets`, `DistributorRequirements`  |

### Distributor Adapters (`src/services/distribution/adapters/`)

| Adapter               | ID            | Status      |
| --------------------- | ------------- | ----------- |
| `DistroKidAdapter.ts` | `'distrokid'` | ✅ Complete |
| `TuneCoreAdapter.ts`  | `'tunecore'`  | ✅ Complete |
| `CDBabyAdapter.ts`    | `'cdbaby'`    | ✅ Complete |
| `SymphonicAdapter.ts` | `'symphonic'` | ✅ Complete |

### Security Services (`src/services/security/`)

| File                   | Export              | Purpose                                                                                      |
| ---------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| `CredentialService.ts` | `credentialService` | Keytar-based secure storage - `getCredentials()`, `saveCredentials()`, `deleteCredentials()` |

### DDEX Services (`src/services/ddex/`)

| File            | Export       | Purpose                                                                                                 |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| `DSRService.ts` | `dsrService` | DSR parsing - `ingestFlatFile()`, `processReport()`, `getRevenueByTerritory()`, `getRevenueByService()` |
| `DDEXParser.ts` | `DDEXParser` | XML↔JSON - `parseDSR()`, `parseERN()`                                                                   |
| `ERNService.ts` | `ERNService` | Release notifications                                                                                   |
| `types/dsr.ts`  | Types        | `DSRReport`, `DSRTransaction`, `DSRSummary`                                                             |

### Existing UI (`src/modules/publishing/`)

| File                           | Status                                                   |
| ------------------------------ | -------------------------------------------------------- |
| `PublishingDashboard.tsx`      | ✅ Exists - placeholder "No releases" section to replace |
| `components/ReleaseWizard.tsx` | ✅ Exists - needs MultiDistributorProgress integration   |

---

## 8.10 Component Props Interfaces

Copy these interfaces directly into each component file:

### ReleaseStatusCard

```typescript
// src/modules/publishing/components/ReleaseStatusCard.tsx
import type {
  ReleaseStatus,
  DistributorId,
} from "@/services/distribution/types/distributor";

interface DistributorDeployment {
  distributorId: DistributorId;
  status: ReleaseStatus;
  distributorReleaseId?: string;
  liveUrl?: string;
  estimatedLiveDate?: string;
  lastUpdated: string;
}

interface ReleaseStatusCardProps {
  releaseId: string;
  title: string;
  artistName: string;
  coverArtUrl?: string;
  releaseDate: string;
  releaseType: "Single" | "EP" | "Album" | "Compilation";
  deployments: DistributorDeployment[];
  onRetry?: (distributorId: DistributorId) => void;
  onViewDetails?: () => void;
  className?: string;
}
```

### DistributorConnectionsPanel

```typescript
// src/modules/publishing/components/DistributorConnectionsPanel.tsx
import type {
  DistributorId,
  DistributorRequirements,
} from "@/services/distribution/types/distributor";

interface DistributorConnectionState {
  id: DistributorId;
  name: string;
  connected: boolean;
  accountIdentifier?: string; // e.g., email or account ID
  lastConnected?: string;
  requirements: DistributorRequirements;
}

interface DistributorConnectionsPanelProps {
  connections: DistributorConnectionState[];
  onConnect: (distributorId: DistributorId) => void;
  onDisconnect: (distributorId: DistributorId) => void;
  onShowRequirements: (distributorId: DistributorId) => void;
  loading?: boolean;
  className?: string;
}
```

### EarningsDashboard

```typescript
// src/modules/publishing/components/EarningsDashboard.tsx
interface EarningsSummary {
  totalRevenue: number;
  totalStreams: number;
  totalDownloads: number;
  totalFees: number;
  currencyCode: string;
}

interface EarningsBreakdownItem {
  label: string; // e.g., "Spotify", "US", "Track Title"
  revenue: number;
  percentage: number;
}

interface EarningsDashboardProps {
  summary: EarningsSummary;
  breakdownByPlatform: EarningsBreakdownItem[];
  breakdownByTerritory: EarningsBreakdownItem[];
  breakdownByRelease: EarningsBreakdownItem[];
  selectedPeriod: { start: string; end: string };
  onPeriodChange: (period: { start: string; end: string }) => void;
  onExportCSV: () => void;
  loading?: boolean;
  className?: string;
}
```

### DSRUploadModal

```typescript
// src/modules/publishing/components/DSRUploadModal.tsx
import type { DSRReport, DSRTransaction } from "@/services/ddex/types/dsr";

interface DSRUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcess: (report: DSRReport) => Promise<void>;
  className?: string;
}

// Internal state for preview
interface DSRPreviewState {
  fileName: string;
  parsedReport?: DSRReport;
  previewRows: DSRTransaction[];
  parseError?: string;
}
```

### ReleaseListView

```typescript
// src/modules/publishing/components/ReleaseListView.tsx
import type {
  ReleaseStatus,
  DistributorId,
} from "@/services/distribution/types/distributor";

interface ReleaseItem {
  id: string;
  title: string;
  artistName: string;
  coverArtUrl?: string;
  releaseDate: string;
  releaseType: "Single" | "EP" | "Album" | "Compilation";
  status: ReleaseStatus; // Aggregate status
  distributors: { id: DistributorId; status: ReleaseStatus }[];
  createdAt: string;
}

interface ReleaseListViewProps {
  releases: ReleaseItem[];
  loading?: boolean;
  onNewRelease?: () => void;
  onViewRelease?: (id: string) => void;
  onEditRelease?: (id: string) => void;
  onRetryRelease?: (id: string) => void;
  onDeleteRelease?: (id: string) => void;
  className?: string;
}
```

### ValidationRequirementsModal

```typescript
// src/modules/publishing/components/ValidationRequirementsModal.tsx
import type {
  DistributorId,
  DistributorRequirements,
} from "@/services/distribution/types/distributor";

interface ValidationRequirementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  distributors: {
    id: DistributorId;
    name: string;
    requirements: DistributorRequirements;
  }[];
  highlightDistributor?: DistributorId; // Scroll to / highlight specific one
  className?: string;
}
```

### MultiDistributorProgress

```typescript
// src/modules/publishing/components/MultiDistributorProgress.tsx
import type {
  DistributorId,
  ReleaseStatus,
} from "@/services/distribution/types/distributor";

interface DistributorProgress {
  distributorId: DistributorId;
  name: string;
  status: "queued" | "uploading" | "processing" | "complete" | "failed";
  progress?: number; // 0-100 for uploading
  message?: string;
  releaseId?: string; // Assigned on success
  error?: string;
}

interface MultiDistributorProgressProps {
  distributors: DistributorProgress[];
  totalComplete: number;
  totalCount: number;
  estimatedTimeRemaining?: string;
  onCancel?: () => void;
  onRetry?: (distributorId: DistributorId) => void;
  className?: string;
}
```

### ReleaseDetailPage

```typescript
// src/modules/publishing/components/ReleaseDetailPage.tsx
import type { ExtendedGoldenMetadata } from "@/services/metadata/types";
import type {
  ReleaseAssets,
  DistributorId,
  ReleaseStatus,
} from "@/services/distribution/types/distributor";

interface ReleaseDetailPageProps {
  releaseId: string;
  metadata: ExtendedGoldenMetadata;
  assets: ReleaseAssets;
  deployments: {
    distributorId: DistributorId;
    status: ReleaseStatus;
    distributorReleaseId?: string;
    liveUrl?: string;
  }[];
  onEdit?: () => void;
  onTakedown?: (distributorId: DistributorId) => void;
  onBack?: () => void;
  className?: string;
}
```

### AnalyticsCharts

```typescript
// src/modules/publishing/components/AnalyticsCharts.tsx
interface TimeSeriesDataPoint {
  date: string; // ISO date
  revenue: number;
  streams: number;
}

interface AnalyticsChartsProps {
  data: TimeSeriesDataPoint[];
  selectedMetric: "revenue" | "streams";
  onMetricChange: (metric: "revenue" | "streams") => void;
  dateRange: { start: string; end: string };
  loading?: boolean;
  className?: string;
}
```

### PayoutHistory

```typescript
// src/modules/publishing/components/PayoutHistory.tsx
interface PayoutRecord {
  id: string;
  date: string;
  amount: number;
  currencyCode: string;
  status: "pending" | "processing" | "paid" | "failed";
  method: string; // e.g., "PayPal", "Bank Transfer"
  releases: { id: string; title: string; amount: number }[];
}

interface PayoutHistoryProps {
  payouts: PayoutRecord[];
  loading?: boolean;
  onViewDetails?: (payoutId: string) => void;
  className?: string;
}
```

---

## 8.11 Import Cheatsheet

Standard imports for all publishing components:

```typescript
// React & Hooks
import React, { useState, useMemo, useCallback } from "react";

// Icons (Lucide)
import {
  Music,
  Search,
  Filter,
  Plus,
  MoreVertical,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  ExternalLink,
  DollarSign,
  Globe,
  Download,
  Upload,
} from "lucide-react";

// Services
import { DistributorService } from "@/services/distribution/DistributorService";
import { distributionStore } from "@/services/distribution/DistributionPersistenceService";
import { credentialService } from "@/services/security/CredentialService";
import { dsrService } from "@/services/ddex/DSRService";

// Types
import type {
  DistributorId,
  ReleaseStatus,
  ReleaseAssets,
  DistributorRequirements,
  DistributorCredentials,
} from "@/services/distribution/types/distributor";
import type { DSRReport, DSRTransaction } from "@/services/ddex/types/dsr";
import type { ExtendedGoldenMetadata } from "@/services/metadata/types";

// UI Components (Existing)
import { FileUpload } from "@/components/kokonutui/file-upload";
import { AnimatedNumber } from "@/components/motion-primitives/animated-number";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

---

## 8.12 Status Color Reference

```typescript
// Consistent status styling across all components
const STATUS_STYLES: Record<
  ReleaseStatus,
  { icon: LucideIcon; color: string; bgColor: string }
> = {
  draft: { icon: Edit, color: "text-gray-400", bgColor: "bg-gray-500/20" },
  validating: {
    icon: Clock,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  pending_review: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
  },
  in_review: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
  },
  approved: {
    icon: CheckCircle,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  processing: {
    icon: RefreshCw,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  delivering: {
    icon: RefreshCw,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  delivered: {
    icon: CheckCircle,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  live: {
    icon: CheckCircle,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  takedown_requested: {
    icon: AlertCircle,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
  },
  taken_down: {
    icon: XCircle,
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
  },
  failed: { icon: XCircle, color: "text-red-400", bgColor: "bg-red-500/20" },
  rejected: { icon: XCircle, color: "text-red-400", bgColor: "bg-red-500/20" },
};
```

---

## 8.13 Hooks to Create

### useDistributorConnections

```typescript
// src/modules/publishing/hooks/useDistributorConnections.ts
import { useState, useEffect, useCallback } from "react";
import { DistributorService } from "@/services/distribution/DistributorService";
import { credentialService } from "@/services/security/CredentialService";
import type { DistributorId } from "@/services/distribution/types/distributor";

export function useDistributorConnections() {
  const [connections, setConnections] = useState<DistributorConnectionState[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const statuses = await DistributorService.getConnectionStatuses();
    setConnections(statuses);
    setLoading(false);
  }, []);

  const connect = useCallback(
    async (id: DistributorId, credentials: DistributorCredentials) => {
      await DistributorService.connect(id, credentials);
      await refresh();
    },
    [refresh],
  );

  const disconnect = useCallback(
    async (id: DistributorId) => {
      await DistributorService.disconnect(id);
      await credentialService.deleteCredentials(id);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { connections, loading, connect, disconnect, refresh };
}
```

### useEarnings

```typescript
// src/modules/publishing/hooks/useEarnings.ts
import { useState, useEffect, useCallback } from "react";
import { DistributorService } from "@/services/distribution/DistributorService";
import type { AggregatedEarnings } from "@/services/distribution/types/distributor";

export function useEarnings(period: { start: string; end: string }) {
  const [earnings, setEarnings] = useState<AggregatedEarnings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await DistributorService.getAggregatedEarnings(period);
    setEarnings(data);
    setLoading(false);
  }, [period.start, period.end]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { earnings, loading, refresh };
}
```

### useReleaseList

```typescript
// src/modules/publishing/hooks/useReleaseList.ts
import { useState, useEffect, useMemo, useCallback } from "react";
import { distributionStore } from "@/services/distribution/DistributionPersistenceService";
import type { ReleaseStatus } from "@/services/distribution/types/distributor";

export function useReleaseList() {
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus | "all">(
    "all",
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const allReleases = distributionStore.getAllReleases();
    setReleases(allReleases);
    setLoading(false);
  }, []);

  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      const matchesSearch =
        searchQuery === "" ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.artistName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [releases, searchQuery, statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    releases: filteredReleases,
    allReleases: releases,
    loading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    refresh,
  };
}
```

---

## 8.14 Implementation Checklist

When starting implementation, follow this exact order:

- [ ] **Step 1:** Create `src/modules/publishing/hooks/useDistributorConnections.ts`
- [ ] **Step 2:** Create `src/modules/publishing/hooks/useEarnings.ts`
- [ ] **Step 3:** Create `src/modules/publishing/hooks/useReleaseList.ts`
- [ ] **Step 4:** Create `DistributorConnectionsPanel.tsx` using hook from Step 1
- [ ] **Step 5:** Create `ReleaseListView.tsx` using hook from Step 3
- [ ] **Step 6:** Create `ReleaseStatusCard.tsx`
- [ ] **Step 7:** Create `EarningsDashboard.tsx` + `EarningsBreakdown.tsx` using hook from Step 2
- [ ] **Step 8:** Create `DSRUploadModal.tsx`
- [ ] **Step 9:** Create `ValidationRequirementsModal.tsx`
- [ ] **Step 10:** Create `MultiDistributorProgress.tsx`
- [ ] **Step 11:** Update `PublishingDashboard.tsx` to integrate all components
- [ ] **Step 12:** Create `ReleaseDetailPage.tsx`
- [ ] **Step 13:** Create `AnalyticsCharts.tsx` (needs charting library - recommend recharts)
- [ ] **Step 14:** Create `PayoutHistory.tsx`
- [ ] **Step 15:** Run TypeScript check: `npx tsc --noEmit`
- [ ] **Step 16:** Test all components manually
