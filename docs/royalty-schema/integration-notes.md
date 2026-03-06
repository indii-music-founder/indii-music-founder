# Royalty Schema Integration Notes

**Document Version:** 1.0  
**Date:** 2026-03-05  
**For:** indiiOS Platform Integration

---

## Overview

This document describes how the royalty collection schema fits into the existing indiiOS architecture, including agent responsibilities, data flow, and implementation priorities.

---

## 1. Current indiiOS Architecture

### 1.1 Existing Agents

| Agent | Current Role | Royalty Integration |
|-------|--------------|---------------------|
| **Publishing Agent** | PRO registration, ISWC codes, split sheets, DDEX | **Primary owner** of royalty registration workflows |
| **Finance Agent** | Budget analysis, metadata auditing, receipt scanning | **Primary owner** of royalty tracking, payments, statements |
| **Legal Agent** | Contract review, rights management | Copyright registration, sync licensing |
| **Marketing Agent** | Campaigns, release coordination | Release gating, "sell before you stream" enforcement |
| **Agent Zero** | Hub coordination, task routing | Orchestrates cross-agent royalty workflows |

### 1.2 Existing Data Models

From codebase analysis:
- **Publishing Agent:** Already handles PRO registration concepts
- **Finance Module:** Has expense tracking, earnings summaries
- **Tax Treaties:** International withholding data in `resources/finance/`

---

## 2. Integration Points

### 2.1 Publishing Agent Enhancements

**Current State:**
- Handles PRO registration
- Manages ISWC codes
- Creates split sheets
- DDEX integration

**Additions Needed:**

```typescript
// Extend existing publishing agent types
interface PublishingAgentCapabilities {
  // Existing
  registerWithPro: (artistId: string, pro: 'BMI' | 'ASCAP' | 'SESAC') => Promise<ProRegistration>;
  generateIswc: (workId: string) => Promise<string>;
  createSplitSheet: (workId: string, contributors: Contributor[]) => Promise<SplitSheet>;
  
  // NEW: Royalty registration workflows
  checkRegistrationStatus: (artistId: string) => Promise<RoyaltyProfile>;
  guideMlcRegistration: (artistId: string) => Promise<MlcStatus>;
  guideSoundExchangeRegistration: (artistId: string) => Promise<SoundExchangeStatus>;
  
  // NEW: Release gating
  validateReleaseReadiness: (workId: string) => Promise<ReleaseGate>;
  getRegistrationChecklist: (artistId: string) => Promise<RegistrationChecklist>;
}
```

**New UI Components:**
- Registration checklist widget
- PRO comparison tool (BMI vs ASCAP vs SESAC)
- Split sheet signature tracker
- Release gate status indicator

### 2.2 Finance Agent Enhancements

**Current State:**
- Budget analysis
- Metadata auditing
- Receipt scanning
- Basic earnings summaries

**Additions Needed:**

```typescript
// Extend existing finance agent types
interface FinanceAgentCapabilities {
  // Existing
  analyzeBudget: (projectId: string) => Promise<BudgetAnalysis>;
  auditMetadata: (releaseId: string) => Promise<MetadataAudit>;
  scanReceipt: (image: File) => Promise<Expense>;
  
  // NEW: Royalty tracking
  aggregateRoyalties: (artistId: string, period: DateRange) => Promise<RoyaltySummary>;
  trackDistributorStatements: (artistId: string) => Promise<Statement[]>;
  reconcilePayments: (artistId: string) => Promise<ReconciliationReport>;
  
  // NEW: Distributor management
  initiateDistributorMigration: (from: string, to: string) => Promise<MigrationRecord>;
  monitorTrailingRoyalties: (migrationId: string) => Promise<TrailingStatus>;
  
  // NEW: Tax handling
  calculateWithholding: (payment: RoyaltyPayment) => Promise<TaxCalculation>;
  generateTaxReport: (artistId: string, year: number) => Promise<TaxReport>;
}
```

**New UI Components:**
- Royalty dashboard (by source, by period)
- Distributor statement uploader/aggregator
- Tax withholding calculator
- Trailing royalties tracker

### 2.3 Legal Agent Integration

**Current State:**
- Contract review
- Rights management

**Additions Needed:**

```typescript
interface LegalAgentCapabilities {
  // Existing
  reviewContract: (contract: File) => Promise<ContractReview>;
  manageRights: (workId: string) => Promise<RightsProfile>;
  
  // NEW: Copyright registration
  initiateCopyrightRegistration: (workId: string) => Promise<CopyrightRegistration>;
  trackCopyrightStatus: (registrationId: string) => Promise<CopyrightStatus>;
  
  // NEW: Sync licensing
  reviewSyncLicense: (offer: SyncOffer) => Promise<SyncReview>;
  negotiateSyncTerms: (offer: SyncOffer, counter: Terms) => Promise<NegotiationResult>;
}
```

### 2.4 Marketing Agent Integration

**Current State:**
- Campaign management
- Release coordination

**Additions Needed:**

```typescript
interface MarketingAgentCapabilities {
  // Existing
  createCampaign: (params: CampaignParams) => Promise<Campaign>;
  coordinateRelease: (releaseId: string) => Promise<ReleasePlan>;
  
  // NEW: Release gating
  checkReleaseGates: (releaseId: string) => Promise<ReleaseGate>;
  enforceSellBeforeStream: (releaseId: string) => Promise<boolean>;
  getOptimalReleaseDate: (artistId: string) => Promise<DateRecommendation>;
  
  // NEW: Pre-release workflows
  createPreSaveCampaign: (releaseId: string) => Promise<PreSaveCampaign>;
  coordinateRegistrationDeadline: (releaseId: string, targetDate: Date) => Promise<DeadlineReminder>;
}
```

---

## 3. Data Flow Architecture

### 3.1 Registration Workflow

```
Artist Onboarding
│
├─► Publishing Agent
│   ├─► Check: Has PRO registration?
│   │   ├─► NO → Guide through PRO selection & application
│   │   └─► YES → Verify status, get IPI
│   │
│   ├─► Check: Has MLC registration?
│   │   ├─► NO + has IPI → Guide MLC registration
│   │   └─► NO + no IPI → Block, explain dependency
│   │
│   └─► Check: Has SoundExchange?
│       └─► Optional, guide if interested
│
├─► Finance Agent
│   └─► Set up distributor tracking
│       ├─► Current distributor
│       ├─► Historical distributors
│       └─► Trailing royalties monitoring
│
└─► Legal Agent
    └─► Optional: Copyright registration guidance
```

### 3.2 Release Workflow

```
Artist Schedules Release
│
├─► Marketing Agent
│   └─► Run Release Gate Check
│       │
│       ├─► Publishing Agent: PRO registered?
│       ├─► Publishing Agent: Split sheet signed?
│       ├─► Publishing Agent: MLC registered?
│       └─► Finance Agent: Distributor configured?
│
├─► Gate Results
│   ├─► ALL PASS → Schedule release
│   ├─► WARNINGS → Show warnings, allow override with acknowledgment
│   └─► BLOCKS → Deny scheduling, show required actions
│
└─► Post-Release
    ├─► Finance Agent: Begin royalty tracking
    ├─► Publishing Agent: Monitor PRO registration for new works
    └─► Legal Agent: Monitor for sync opportunities
```

### 3.3 Royalty Collection Workflow

```
Royalty Payment Received
│
├─► Finance Agent
│   ├─► Parse statement (distributor, PRO, MLC, etc.)
│   ├─► Categorize by source type
│   ├─► Calculate tax withholding
│   ├─► Reconcile against expected payments
│   └─► Flag anomalies
│
├─► Publishing Agent
│   └─► If split sheet exists
│       ├─► Calculate per-contributor share
│       └─► Log for split payment tracking
│
├─► Dashboard Update
│   ├─► Update total royalties
│   ├─► Update by-source breakdown
│   └─► Update "expected payments" forecast
│
└─► Notifications
    ├─► Payment received alert
    ├─► Anomaly warning (if applicable)
    └─► Quarterly summary (if applicable)
```

---

## 4. Database Schema Additions

### 4.1 New Collections/Tables

```typescript
// Primary collections to add
interface DatabaseSchema {
  royalty_profiles: RoyaltyProfile;
  pro_registrations: ProRegistrationStatus;
  soundexchange_accounts: SoundExchangeStatus;
  mlc_accounts: MlcStatus;
  copyright_registrations: CopyrightRegistration;
  distributor_records: DistributorRecord;
  distributor_migrations: DistributorMigration;
  royalty_streams: RoyaltyStream;
  split_sheets: SplitSheet;
  split_contributors: SplitContributor;
  release_gates: ReleaseGate;
}
```

### 4.2 Existing Collection Updates

```typescript
// Add to users collection
interface UserExtension {
  royaltyProfileId: string | null;
  defaultPro: 'BMI' | 'ASCAP' | 'SESAC' | null;
  taxTreatyCountry: string | null;
}

// Add to works/releases collection
interface WorkExtension {
  splitSheetId: string | null;
  iswcCode: string | null;
  isrcCode: string | null;
  releaseGateId: string | null;
  copyrightRegistrationId: string | null;
}

// Add to payments/earnings collection
interface PaymentExtension {
  royaltyStreamId: string | null;
  sourceType: RoyaltySourceType;
  distributorId: string | null;
}
```

---

## 5. Implementation Priorities

### Phase 1: Foundation (Week 1-2)
- [ ] Create database collections
- [ ] Implement RoyaltyProfile data model
- [ ] Build registration status tracking
- [ ] Basic dashboard UI

### Phase 2: Publishing Integration (Week 3-4)
- [ ] Enhance Publishing Agent with registration workflows
- [ ] PRO registration guidance
- [ ] Split sheet creation & signatures
- [ ] Release gating logic

### Phase 3: Finance Integration (Week 5-6)
- [ ] Enhance Finance Agent with royalty tracking
- [ ] Distributor statement aggregation
- [ ] Payment reconciliation
- [ ] Tax withholding calculations

### Phase 4: Advanced Features (Week 7-8)
- [ ] Distributor migration workflows
- [ ] Trailing royalties monitoring
- [ ] Automated alerts & notifications
- [ ] Reporting & analytics

### Phase 5: Polish (Week 9-10)
- [ ] UI/UX refinement
- [ ] Edge case handling
- [ ] Documentation
- [ ] Testing & QA

---

## 6. API Endpoints Needed

### 6.1 Core Royalty API

```typescript
// GET /api/royalty/profile/:userId
// Returns: RoyaltyProfile + all registration statuses

// POST /api/royalty/pro/register
// Body: { userId, pro: 'BMI' | 'ASCAP' | 'SESAC' }
// Returns: ProRegistrationStatus

// POST /api/royalty/mlc/register
// Body: { userId }
// Returns: MlcStatus

// POST /api/royalty/soundexchange/register
// Body: { userId }
// Returns: SoundExchangeStatus

// GET /api/royalty/checklist/:userId
// Returns: RegistrationChecklist with progress

// POST /api/royalty/release-gate
// Body: { workId }
// Returns: ReleaseGate
```

### 6.2 Finance API

```typescript
// GET /api/finance/royalties/:userId
// Query: { period, source }
// Returns: RoyaltyStream[]

// POST /api/finance/distributor/migrate
// Body: { userId, fromDistributor, toDistributor }
// Returns: DistributorMigration

// GET /api/finance/statements/:userId
// Returns: Aggregated statement summary

// GET /api/finance/tax-report/:userId/:year
// Returns: TaxReport
```

### 6.3 Split Sheet API

```typescript
// POST /api/splits/create
// Body: { workId, contributors: SplitContributorInput[] }
// Returns: SplitSheet

// POST /api/splits/:id/sign
// Body: { contributorId, signature: string }
// Returns: Updated SplitSheet

// GET /api/splits/:id/status
// Returns: Signature status for all contributors
```

---

## 7. Third-Party Integrations

### 7.1 PRO APIs

| PRO | API Available | Data Available |
|-----|---------------|----------------|
| BMI | Limited | Catalog, some royalty data |
| ASCAP | Yes | Full catalog, royalty data |
| SESAC | Limited | Catalog only |

**Approach:** Start with manual registration guidance, add API integration where available.

### 7.2 SoundExchange

- **API:** Available for members
- **Data:** Full digital radio royalty data
- **Integration:** Statement ingestion, payment tracking

### 7.3 MLC

- **API:** Portal-based, limited API
- **Data:** Mechanical royalty statements
- **Integration:** Statement upload/parse

### 7.4 Distributors

| Distributor | API | Notes |
|-------------|-----|-------|
| DistroKid | Limited | CSV exports |
| TuneCore | Yes | Full API available |
| CD Baby | Limited | CSV/Excel exports |
| Amuse | No | Manual export only |

**Approach:** Build statement uploader that handles CSV/Excel from all distributors.

---

## 8. Testing Strategy

### 8.1 Unit Tests
- State machine transitions
- Validation rules
- Calculation logic

### 8.2 Integration Tests
- End-to-end registration workflow
- Release gating logic
- Payment reconciliation

### 8.3 User Testing Scenarios
1. New artist onboarding → complete registration
2. Artist with existing PRO → add MLC
3. Collaboration → create split sheet → release
4. Distributor switch → migration workflow
5. Release without registration → gate blocks

---

## 9. Documentation for Users

### 9.1 Help Articles Needed
- "Understanding Music Royalties: The Complete Guide"
- "How to Register with a PRO"
- "BMI vs ASCAP vs SESAC: Which is right for you?"
- "What is SoundExchange and do I need it?"
- "The MLC: Mechanical Royalties Explained"
- "Split Sheets: Protecting Your Collaborations"
- "Switching Distributors: The Right Way"
- "Sell Before You Stream: Why Timing Matters"

### 9.2 In-App Tooltips
- Registration checklist explanations
- Release gate warnings
- Royalty source breakdowns
- Split sheet guidance

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| % of users with PRO registration | 90% |
| % of releases passing all gates | 85% |
| Average time to complete registration | < 30 days |
| User-reported "lost royalty" incidents | < 5% |
| Distributor migration completion rate | 95% |
| Split sheet signature completion | 90% |

---

## Files Generated

This schema package includes:

1. `royalty-sources.md` — Complete mapping of all royalty streams
2. `royalty-models.ts` — TypeScript interfaces for all data structures
3. `royalty-rules.md` — State machines, business logic, validation rules
4. `integration-notes.md` — This file: integration guide

**Next Steps:**
1. Review with engineering team
2. Prioritize Phase 1 implementation
3. Create detailed tickets for database schema
4. Begin Publishing Agent enhancements
