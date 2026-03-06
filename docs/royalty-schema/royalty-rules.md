# Royalty Business Logic Rules & State Machines

**Document Version:** 1.0  
**Date:** 2026-03-05  
**For:** indiiOS Platform

---

## 1. Registration State Machines

### 1.1 PRO Registration State Machine

```
                    ┌─────────────────┐
                    │   NOT_STARTED   │
                    └────────┬────────┘
                             │ User initiates registration
                             ▼
                    ┌─────────────────┐
         ┌─────────│   IN_PROGRESS   │◄────────┐
         │         │ (gathering info) │         │
         │         └────────┬────────┘         │
         │                  │                  │
         │    Missing info  │  Ready to submit │
         └──────────────────┘                  │
                             │                 │
                             ▼                 │
                    ┌─────────────────┐       │
                    │    SUBMITTED    │       │
                    │ (awaiting conf) │       │
                    └────────┬────────┘       │
                             │                │
              Rejected       │  Confirmed     │
         ┌───────────────────┘                │
         │                  │                 │
         ▼                  ▼                 │
┌─────────────────┐  ┌─────────────────┐     │
│     BLOCKED     │  │     PENDING     │─────┘
│  (fix issues)   │  │ (awaiting IPI)  │
└────────┬────────┘  └────────┬────────┘
         │                    │
         │ Issues resolved    │ IPI assigned
         └────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     ACTIVE      │
                    │ (can collect)   │
                    └─────────────────┘
```

**State Transitions:**

| From | To | Trigger | Validation |
|------|-----|---------|------------|
| NOT_STARTED | IN_PROGRESS | User clicks "Start PRO Registration" | None |
| IN_PROGRESS | SUBMITTED | User submits application | All required fields filled |
| IN_PROGRESS | BLOCKED | Missing critical info | Issue marked as blocking |
| SUBMITTED | PENDING | Confirmation received from PRO | Confirmation number stored |
| SUBMITTED | BLOCKED | Application rejected | Rejection reason logged |
| PENDING | ACTIVE | IPI number assigned | IPI stored in profile |
| PENDING | IN_PROGRESS | Additional info requested | User notified |
| BLOCKED | IN_PROGRESS | Issues resolved | All blocking issues cleared |
| ACTIVE | * | * | Terminal state |

**Critical Business Rule:**
> **PRO Retroactive Payment = FALSE**
> Once a user enters ACTIVE state, they can ONLY collect royalties from that point forward. Any plays before ACTIVE state are permanently lost. This is why the "Sell Before You Stream" rule exists.

---

### 1.2 MLC Registration State Machine

```
                    ┌─────────────────┐
                    │   NOT_STARTED   │
                    └────────┬────────┘
                             │ Check: Has IPI?
                             │
                    ┌────────┴────────┐
                    │                 │
         No IPI     ▼                 ▼ Has IPI
    ┌───────────────┐         ┌─────────────────┐
    │   BLOCKED     │         │   IN_PROGRESS   │
    │ (need PRO     │         │ (can proceed)   │
    │  first)       │         └────────┬────────┘
    └───────┬───────┘                  │
            │                          │
            │ User completes PRO       │ Submit application
            └──────────────────────────►
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │    SUBMITTED    │
                                  └────────┬────────┘
                                           │
                              Confirmed    │   IPI linked
                                           ▼
                                  ┌─────────────────┐
                                  │     ACTIVE      │
                                  │ (can collect    │
                                  │  mechanicals)   │
                                  └─────────────────┘
```

**Dependency Rule:**
> MLC registration REQUIRES an IPI number from PRO registration. The system must BLOCK MLC registration until PRO is ACTIVE.

---

### 1.3 SoundExchange State Machine

```
┌─────────────────┐
│   NOT_STARTED   │
└────────┬────────┘
         │ User initiates
         ▼
┌─────────────────┐     ┌─────────────────┐
│   IN_PROGRESS   │◄────│     BLOCKED     │
│ (can proceed    │     │ (missing ISRCs  │
│  without PRO)   │     │  or other info) │
└────────┬────────┘     └─────────────────┘
         │ Submit
         ▼
┌─────────────────┐
│     ACTIVE      │
│ (can collect    │
│  digital radio) │
└─────────────────┘
```

**Key Difference:**
> SoundExchange does NOT require PRO registration. It can be done in parallel or even before PRO.

---

## 2. Release Gating Logic

### 2.1 Can Release? Decision Tree

```
START: User attempts to schedule/release track
│
├─► Check: PRO Registration Status
│   ├─► ACTIVE → Continue
│   ├─► IN_PROGRESS/SUBMITTED/PENDING → WARNING
│   │   "Your PRO registration is pending. You may lose royalties."
│   └─► NOT_STARTED/BLOCKED → BLOCK
│       "PRO registration required before release"
│
├─► Check: Split Sheets Signed
│   ├─► All contributors signed → Continue
│   ├─► Pending signatures → BLOCK
│   │   "All contributors must sign split sheet"
│   └─► No split sheet created → WARNING
│       "No split sheet created. Create one to protect your rights."
│
├─► Check: MLC Registration (if applicable)
│   ├─► ACTIVE → Continue
│   ├─► IN_PROGRESS → WARNING
│   │   "MLC registration pending. Mechanical royalties may be delayed."
│   └─► NOT_STARTED → WARNING
│       "Consider MLC registration for streaming mechanicals"
│
├─► Check: SoundExchange (optional)
│   ├─► ACTIVE → Continue
│   └─► Any other status → INFO
│       "Register with SoundExchange to collect digital radio royalties"
│
└─► FINAL DECISION
    ├─► No BLOCK items → ALLOW RELEASE
    └─► Any BLOCK items → DENY RELEASE
```

### 2.2 Gating Configuration

```typescript
interface ReleaseGateConfig {
  // Hard blocks - cannot release without these
  required: {
    proRegistration: boolean;      // DEFAULT: true
    splitsSigned: boolean;         // DEFAULT: true
    copyrightRegistration: boolean; // DEFAULT: false (optional)
  };
  
  // Soft warnings - can release but warned
  recommended: {
    mlcRegistration: boolean;      // DEFAULT: true
    soundExchange: boolean;        // DEFAULT: true
    isrcCodes: boolean;            // DEFAULT: true
  };
  
  // Override permissions
  allowAdminOverride: boolean;     // DEFAULT: false
  allowArtistOverride: boolean;    // DEFAULT: true with acknowledgment
}
```

---

## 3. Distributor Migration Rules

### 3.1 Migration Workflow

```
PHASE 1: PREPARATION (Day 0)
├── Create migration record
├── Document all releases on current distributor
├── Download all historical statements
└── Note any pending royalties

PHASE 2: NOTIFICATION (Day 1)
├── Send notice to old distributor
├── Request final statement timeline
├── Confirm account will remain active for trailing royalties
└── Document confirmation

PHASE 3: TRANSITION (Day 2-7)
├── Set up new distributor account
├── Prepare releases for re-upload
├── Update banking/tax info on new distributor
└── DO NOT remove releases from old distributor yet

PHASE 4: OVERLAP (Day 7-30)
├── Upload to new distributor
├── Wait for first confirmation/report
├── Monitor both accounts
└── Verify new distributor is receiving streams

PHASE 5: CUTOFF (Day 30-90)
├── Remove releases from old distributor (if desired)
├── Request final statement from old distributor
├── Download all remaining statements
└── Close old account only after trailing period

PHASE 6: MONITORING (Day 90-180)
├── Watch for trailing royalty payments
├── Ensure no lost payments
└── Mark migration complete
```

### 3.2 Trailing Royalties Rules

| Distributor | Trailing Period | Notes |
|-------------|-----------------|-------|
| DistroKid | 6-12 months | Keep account active |
| TuneCore | 6 months | Download all statements before closing |
| CD Baby | 12 months | Physical sales trail longer |
| Amuse | 3-6 months | Varies by territory |

**Critical Rule:**
> **Never close a distributor account immediately after switching.** Royalties earned while you were with them continue to accrue for months. Closing the account early = lost money.

---

## 4. Split Sheet Rules

### 4.1 Validation Rules

```typescript
const SplitSheetRules = {
  // Mathematical validation
  totalMustEqual100: true,
  minContributorShare: 1,           // Minimum 1% per contributor
  maxContributorShare: 100,         // Maximum 100% (solo work)
  
  // Required fields per contributor
  requiredFields: [
    'name',
    'email',
    'role',
    'songwriterPercentage',
    'proAffiliation',               // If applicable
    'ipiNumber'                     // If known
  ],
  
  // Signature rules
  allMustSign: true,
  signatureOrder: 'any',            // Or 'sequential' if needed
  expirationDays: 30,               // Signature request expires
  
  // PRO registration
  mustRegisterWithPro: true,        // After all signatures
  registrationDeadline: '14_days_after_final_signature'
};
```

### 4.2 Standard Split Templates

| Scenario | Songwriter Split | Publisher Split | Notes |
|----------|------------------|-----------------|-------|
| Solo writer, self-published | 50% | 50% | Claims 100% total |
| Two writers, both self-published | 25% each | 25% each | Equal 4-way split |
| Writer + Producer (work for hire) | 50% writer | 50% writer | Producer paid flat fee |
| Writer + Producer (collaborator) | 25% each | 25% each | Producer gets share |
| Writer + External Publisher | 50% | 50% to publisher | Writer keeps songwriter half |

---

## 5. Timing & Deadline Rules

### 5.1 Registration Timeline

```
Day -30: PRO Registration
    │
    │ (Wait for IPI)
    ▼
Day -14: MLC Registration (requires IPI)
    │
    │ (Can do in parallel)
    ▼
Day -7: SoundExchange Registration
    │
    │ (Prepare release)
    ▼
Day 0: RELEASE
    │
    │ (Royalties start accruing)
    ▼
Day +90: First PRO statement (estimated)
Day +30: First distributor payment
Day +45: First MLC statement
```

### 5.2 Quarterly Schedule

| Quarter | Period | PRO Payment Month |
|---------|--------|-------------------|
| Q1 | Jan-Mar | May |
| Q2 | Apr-Jun | Aug |
| Q3 | Jul-Sep | Nov |
| Q4 | Oct-Dec | Feb (next year) |

**Lag Time:** 6-9 months from play to payment for PROs.

---

## 6. Alert & Notification Rules

### 6.1 Critical Alerts (Immediate)

| Trigger | Action |
|---------|--------|
| User attempts release without PRO | Block + explain retroactive loss |
| Split sheet unsigned for 7 days | Email reminder to all parties |
| Distributor migration incomplete after 90 days | Warning about trailing royalties |
| MLC registration blocked (no IPI) | Explain PRO dependency |

### 6.2 Warning Alerts (Daily digest)

| Trigger | Action |
|---------|--------|
| PRO registration pending >14 days | Check status with PRO |
| SoundExchange not registered | Suggest registration |
| No split sheet for released track | Create retroactive split sheet |
| Distributor statement not downloaded | Reminder to download |

### 6.3 Opportunity Alerts (Weekly)

| Trigger | Action |
|---------|--------|
| Track has >1000 streams, no MLC | Suggest MLC registration |
| International play detected | Suggest neighboring rights |
| YouTube Content ID eligible | Suggest enrollment |
| Quarter end approaching | Remind to check registrations |

---

## 7. Integration Points with indiiOS Agents

### 7.1 Publishing Agent
- Creates split sheets
- Registers works with PROs
- Manages ISWC codes
- Tracks registration status

### 7.2 Finance Agent
- Tracks royalty payments
- Aggregates distributor statements
- Calculates tax withholding
- Flags missing payments

### 7.3 Legal Agent
- Reviews sync contracts
- Manages copyright registration
- Tracks contract terms
- Alerts on renewal dates

### 7.4 Marketing Agent
- Enforces release gating
- Coordinates release timing
- Tracks "sell before you stream" compliance
- Manages pre-save campaigns

---

## 8. Data Integrity Rules

### 8.1 Required Relationships

```
RoyaltyProfile
    ├── has one: ProRegistrationStatus (required)
    ├── has one: SoundExchangeStatus (optional)
    ├── has one: MlcStatus (optional)
    ├── has many: CopyrightRegistration
    ├── has many: DistributorRecord
    └── has many: RoyaltyStream

SplitSheet
    ├── belongs to: Work (indiiOS track)
    ├── has many: SplitContributor
    └── requires: All contributors signed before PRO registration

ReleaseGate
    ├── checks: RoyaltyProfile status
    ├── checks: SplitSheet status
    └── blocks: Release if critical checks fail
```

### 8.2 Cascade Rules

| Action | Cascade Effect |
|--------|----------------|
| PRO status → ACTIVE | Enable MLC registration, update dashboard |
| Split sheet signed | Trigger PRO registration reminder |
| Distributor added | Create migration record if switching |
| Release scheduled | Run all gate checks, block if needed |
| Royalty received | Update dashboard, flag anomalies |

---

## 9. Error Handling

### 9.1 Common Failure Modes

| Error | Cause | Resolution |
|-------|-------|------------|
| PRO application rejected | Name conflict, missing info | Fix issues, resubmit |
| MLC blocked | No IPI number | Complete PRO registration first |
| Split sheet unsigned | Contributor unresponsive | Escalation workflow, legal options |
| Distributor migration lost | Account closed too early | Contact distributor, may be unrecoverable |
| Missing royalty payment | Unregistered work | Register immediately (retroactive may not apply) |

### 9.2 Recovery Procedures

**Lost PRO Royalties:**
> Cannot recover. Log as lesson learned. Ensure all future works registered before release.

**Lost Distributor Royalties:**
> Contact distributor immediately. May be recoverable if within trailing period. Document for tax purposes.

**Split Sheet Dispute:**
> Freeze related royalties. Escalate to legal workflow. Mediation if needed.
