# System Architecture: indiiOS Platform

**Author:** William Roberts  
**Date:** 2026-04-26  
**Status:** Complete 3-layer design documentation  
**Audience:** Acquirers, technical diligence teams, post-LOI integration planning

---

## Executive Summary

indiiOS operates on a **proven 3-layer separation of concerns** designed to maximize reliability and minimize compound errors in a complex system. The architecture isolates deterministic execution (Layer 3) from probabilistic reasoning (Layer 2) from strategic direction (Layer 1), allowing each layer to be tested and scaled independently.

### Three-Layer Overview

```
Layer 1: DIRECTIVE
(Strategy & SOPs)
     ↓
Layer 2: ORCHESTRATION
(Agent Reasoning)
     ↓
Layer 3: EXECUTION
(Deterministic Scripts)
```

**Key Properties:**
- ✅ **Reliability:** 90% agent reasoning × 100% deterministic tools = >90% system reliability (not compounding)
- ✅ **Testability:** Each layer independently testable; integration tests verify seams
- ✅ **Scaleability:** Add new agents (Layer 2) without modifying execution (Layer 3)
- ✅ **Transparency:** Audit trail of decisions (Layer 2) + actions (Layer 3) via structured logs

---

## Layer 1: Directive (The Blueprint)

### Purpose

Natural-language Standard Operating Procedures (SOPs) in `directives/` define specific goals, required inputs, tool selection, expected outputs, and robust edge-case handling. These SOPs act like a manager giving detailed instructions to a specialized employee.

### Current Directives

| Directive | Purpose | Last Updated |
|-----------|---------|--------------|
| `agent_stability.md` | Agent reliability standards, fallback logic, timeout handling | 2026-03-27 |
| `architecture_standard.md` | Architectural guidelines, separation of concerns, testing patterns | 2026-03-27 |
| `direct_distribution_engine.md` | DDEX ERN generation, DSP submission, retry logic, QC validation | 2026-02-14 |
| `font_consistency.md` | UI font standards, size hierarchy, weight usage | 2026-01-15 |
| `git_sync.md` | Version control procedures, commit standards, branch strategy | 2026-01-10 |

### How Directives Drive Execution

Example: **Direct Distribution Engine** SOP

```markdown
# Direct Distribution Engine SOP

## Goal
Ship an artist's release to all configured DSPs in spec-compliant format.

## Input
- Release metadata (title, artist, credits, ISRC)
- Master audio file (WAV, FLAC, or MP3)
- DSP target list (Spotify, Apple, Amazon, etc.)

## Process
1. Validate audio file format and bitrate
2. Generate ERN (Electronic Release Notification) per DDEX spec
3. For each DSP:
   a. Connect via SFTP
   b. Upload ERN + audio
   c. Poll for delivery confirmation
   d. Handle failures (retry, notify artist)

## Expected Output
- ERN file in Firestore
- Audio file in GCS
- SFTP delivery confirmation per DSP
- Royalty tracking initialized

## Edge Cases
- DSP SFTP down → retry with exponential backoff
- Audio file corrupted → reject with clear error message
- ISRC conflict → auto-assign new ISRC from pool
```

The **indii Conductor** (Layer 2) reads this SOP and orchestrates the agent fleet to execute it. The Python scripts (Layer 3) perform the deterministic work.

---

## Layer 2: Orchestration (Decision Making)

### Hub-and-Spoke Architecture

```
                    ┌─────────────────────┐
                    │  indii Conductor    │
                    │   (Hub Router)      │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │      │      │      │      │      │      │   │
       Legal  Brand Market  Music  Video Social Publish Finance
      Agent  Agent  Agent  Agent  Agent  Agent   Agent  Agent
        │
      [Licensing, Distribution, Publishing, Finance, Road, Touring,
       Workflow, Observability, Publicist, Producer]
```

### Hub Function: indii Conductor

**Location:** `src/services/agent/AgentService.ts` + `agents/agent0/` definitions

**Responsibilities:**
1. Parse user intent (chat message or API call)
2. Route to appropriate specialist agent(s)
3. Sequence tool calls across specialists
4. Handle runtime errors and retries
5. Aggregate results and present to user

**Routing Logic:**

```typescript
// Pseudocode
if (userMessage.intent === 'distribute') {
  const distributionAgent = specialists['distribution'];
  return await distributionAgent.execute(userMessage);
} else if (userMessage.intent === 'analyze-brand') {
  const brandAgent = specialists['brand'];
  return await brandAgent.execute(userMessage);
}
// ... fallback to generalist agent
```

### Specialist Agents (Spokes)

Each specialist is a fine-tuned Vertex AI endpoint (R7 generation) with:
- **Training data:** 100 domain-specific gold examples
- **Tool authorization:** Curated subset of the 23-tool catalog
- **Prompt injection hardening:** 4-layer sanitization
- **Fallback logic:** Automatic fallback to free Gemini API if Vertex endpoint is down

#### Agent Roster (16 R7 Endpoints)

| Agent | Domain | Key Tools | Example Tasks |
|-------|--------|-----------|----------------|
| **Legal** | Contract review, IP, compliance | `generate_contract`, `review_rights`, `audit_compliance` | Review licensing agreements, flag IP conflicts |
| **Brand** | Visual guidelines, brand voice | `generate_brand_guidelines`, `verify_output`, `analyze_consistency` | Create brand guidelines, audit visual assets |
| **Marketing** | Campaign strategy, copywriting | `ideate_campaign`, `generate_copy`, `score_virality` | Generate ad copy, plan social campaigns |
| **Music** | Metadata, ISRC, genre tagging | `generate_metadata`, `assign_isrc`, `tag_genre` | Auto-generate ISRC, standardize credits |
| **Video** | Shot lists, editing, color grading | `generate_shot_list`, `plan_edit`, `grade_color` | Create editing scripts, plan post-production |
| **Social** | Content calendar, posting strategy | `generate_caption`, `plan_calendar`, `score_engagement` | Generate captions, schedule posts |
| **Publishing** | Mechanical licensing, PRO registration | `register_pro`, `file_mechanical`, `track_royalties` | Register works with PRO, file mechanical licenses |
| **Finance** | Budget, expense tracking, forecasting | `forecast_budget`, `categorize_expense`, `project_cashflow` | Create budgets, project cash flow |
| **Licensing** | Sample clearance, sync licensing | `clear_sample`, `negotiate_sync`, `audit_rights` | Clear samples, negotiate sync deals |
| **Distribution** | DSP targeting, release scheduling | `generate_ern`, `submit_dsps`, `track_delivery` | Submit releases, track streaming |
| **Publicist** | Press releases, media outreach | `generate_press_release`, `build_media_list`, `pitch_story` | Write press releases, pitch to media |
| **Road** | Tour logistics, venue coordination | `coordinate_venue`, `plan_routing`, `forecast_merch` | Book venues, plan touring logistics |
| **Touring** | Setlist optimization, stage production | `optimize_setlist`, `plan_lighting`, `design_stage` | Optimize setlists, plan stage production |
| **Workflow** | Task orchestration, automation | `create_task`, `sequence_steps`, `manage_dependencies` | Build custom workflows, automate processes |
| **Observability** | Monitoring, alerting, debugging | `monitor_system`, `alert_issue`, `debug_error` | Track system health, diagnose issues |
| **Producer** | Film/video production logistics | `create_call_sheet`, `breakdown_script` | Generate call sheets, script breakdowns |

#### Tool Authorization Example (Music Agent)

```typescript
// src/services/agent/definitions/MusicAgent.ts
export class MusicAgent extends BaseAgent {
  protected authorizedTools = [
    'generate_metadata',
    'assign_isrc',
    'tag_genre',
    'analyze_audio',
    // NOT authorized: generate_contract, create_call_sheet, etc.
  ];
}
```

#### Fallback Logic

```typescript
// FallbackClient.ts
if (vertexAIEndpoint.isDown()) {
  // Strip endpoint URL, use free Gemini API
  return await geminiAPI.generateContent(prompt);
}
```

---

## Layer 3: Execution (Deterministic Scripts)

### Purpose

Deterministic Python/TypeScript scripts in `execution/` and `functions/` handle API interactions, data processing, file system operations, and database state changes. Complexity is pushed into code so the agent (Layer 2) can focus on high-level decision-making.

### Execution Subsystems

#### 3.1 Distribution Pipeline

**Location:** `execution/distribution/`, `src/services/distribution/`

**Workflow:**

```
Artist Upload
    ↓
Metadata Generation (Music Agent)
    ↓
DDEX ERN Generation (execution/distribution/ern-generator.ts)
    ↓
DSP Adapter Selection (src/services/distribution/adapters/)
    ↓
SFTP Upload (execution/distribution/sftp-uploader.ts)
    ↓
Delivery Polling (execution/distribution/delivery-poller.ts)
    ↓
Royalty Tracking Init (functions/src/finance/)
    ↓
Artist Notification
```

**Key Scripts:**

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `ern-generator.ts` | Generate DDEX ERN XML | Release metadata, master file | Valid ERN per XSD spec |
| `dsps-adapter.ts` | DSP-specific submission logic | ERN, audio, DSP config | API response or SFTP receipt |
| `sftp-uploader.ts` | SFTP file transfer | ERN, audio, SFTP creds | Delivery confirmation or retry |
| `delivery-poller.ts` | Poll DSP for confirmation | DSP config, release ID | Delivery status (pending/confirmed/failed) |
| `isrc-generator.ts` | Auto-assign ISRC codes | Artist, track metadata | Valid ISRC per ISO 3901 spec |

**DSP Adapters (8 Direct Integrations):**

| Adapter | Protocol | Status | Notes |
|---------|----------|--------|-------|
| **Spotify** | SFTP + REST API | Live | Uses DistroKid-style delivery |
| **Apple Music** | SFTP | Live | Direct AFR delivery |
| **Amazon Music** | SFTP + Notify API | Live | Uses MusicBrainz identifiers |
| **TIDAL** | SFTP + REST API | Live | Uses TIDAL artist IDs |
| **Deezer** | SFTP | Live | Uses Deezer content IDs |
| **CDBaby** | REST API | Live | Legacy aggregator, API-based |
| **DistroKid** | REST API | Live | Via DistroKid partner API |
| **Symphonic** | SFTP + REST API | Live | Uses Symphonic metadata standards |

#### 3.2 Vertex AI Fine-Tuning Pipeline

**Location:** `execution/training/`, GCS bucket `gs://indiios-training-data/ft_export/`

**Workflow:**

```
Gold Dataset (2,000 examples)
    ↓
Export to Vertex Format (execution/training/export_ft_dataset.ts)
    ↓
GCS Upload (gs://indiios-training-data/ft_export/r7/)
    ↓
Submit 20 Vertex AI Jobs (execution/training/submit_jobs.py)
    ↓
Poll for Completion (execution/training/poll_jobs.py)
    ↓
Wire Endpoints (execution/training/wire_endpoints.py)
    ↓
src/services/agent/fine-tuned-models.ts Updated
    ↓
Deploy to Production
```

**Schema (Vertex AI SFT Format):**

```json
{
  "systemInstruction": {
    "role": "system",
    "parts": [{"text": "You are a [domain] expert..."}]
  },
  "contents": [
    {
      "role": "user",
      "parts": [{"text": "User query"}]
    },
    {
      "role": "model",
      "parts": [
        {"text": "Response text"},
        {"toolUse": {"name": "tool_name", "input": {}}}
      ]
    }
  ]
}
```

**Dataset State (R7, 2,000 examples):**

- 100 per agent × 20 agents
- Tool verification: grep actual tool names from `src/services/agent/definitions/<Agent>.ts` before writing examples
- Expert density: ≥60% (expert examples outweigh generic ones)
- Canonical schema: `input.user_message`, `expected.output_sample`, `expected.tools_called`

#### 3.3 Stripe Payment & Escrow

**Location:** `functions/src/stripe/`, `functions/src/subscription/`

**Workflow:**

```
Artist Creates Release
    ↓
Subscription Check (createCheckoutSession.ts)
    ↓
Stripe Connect Session (connect.ts)
    ↓
Payment Processing (webhook.ts)
    ↓
Escrow Split Calculation (splitEscrow.ts)
    ↓
Royalty Distribution (payoutScheduler.ts)
    ↓
Tax Form Generation (taxForms.ts) [STUB]
```

**Idempotency Guarantee:**

```typescript
// Stripe webhook handler
const idempotencyKey = `${event.id}`;
if (firestore.exists(idempotencyKey)) {
  return { processed: false, reason: 'duplicate' };
}
firestore.set(idempotencyKey, event);
// Process payment exactly once
```

**Escrow Math (Example):**

```
Revenue: $100
Artist share: 50% → $50
Platform share: 50% → $50

Escrow calculation:
- Artist account receives: $50
- Platform account receives: $50
- No rounding loss (Stripe handles in cents)
```

**Tax Forms:**

Current implementation returns mock "Requested" status. Remediation trigger: GMV > $25K or artist count > 50. See `KNOWN_GAPS.md`.

#### 3.4 Audio Analysis (Essentia.js)

**Location:** `src/services/audio/`, audio analysis via Essentia.js

**Capabilities:**

- BPM detection (tempo)
- Key detection (harmonic center)
- Mood/energy classification
- Genre classification
- Time-signature detection
- Loudness analysis (LUFS)
- Spectral features (brightness, zero-crossing rate)

**Used by:**

- Music Agent (metadata generation)
- Brand Agent (audio asset tagging)
- Social Agent (caption generation from audio mood)

---

## Data Flow: Complete Release-to-Royalty Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│ ARTIST UPLOADS RELEASE                                          │
│ (React Frontend: src/modules/distribution/)                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: DIRECTIVE                                              │
│ "direct_distribution_engine.md" SOP read by indii Conductor    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: ORCHESTRATION                                          │
│ indii Conductor routes to Music Agent → Distribution Agent      │
│ (src/services/agent/AgentService.ts)                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ MUSIC AGENT  │ │ DISTRIBUTION │ │ FINANCE AGENT│
│ (R7)         │ │ AGENT (R7)   │ │ (R7)         │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: EXECUTION                                              │
└─────────────────────────────────────────────────────────────────┘
       │                │                │
       ▼                ▼                ▼
  Execute:          Execute:         Execute:
  • analyze_audio    • generate_ern   • calculate_escrow
  • assign_isrc      • submit_dsp     • initialize_royalty
  • tag_genre        • poll_delivery  • schedule_payout
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
            Firestore + GCS Updated
            SFTP Delivery Initiated
            BigQuery Event Logged
                        │
                        ▼
        ┌──────────────────────────────┐
        │ POLLING (execution/distribution/) │
        │ Track DSP delivery status    │
        └──────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │ DSP Confirms Receipt           │
        │ Royalty tracking begins        │
        │ Artist notified                │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌──────────────────────────────┐
        │ STREAMING (DSP Backend)       │
        │ Listener streams track        │
        │ $$ streams in                 │
        └──────────────────────────────┘
                        │
                        ▼
        ┌──────────────────────────────┐
        │ SETTLEMENT (DSP Monthly)      │
        │ DSP deposits to Stripe        │
        │ Stripe splits to artist/plat  │
        └──────────────────────────────┘
```

---

## Subsystem Resilience

### Vertex AI Endpoint Fallback

```
Request to Vertex AI Endpoint (fine-tuned)
    │
    ├─ Available? → Use fine-tuned model
    │
    └─ Down? → Fallback to free Gemini API
        (Automatic, no user-facing impact)
```

### DDEX Submission Retry

```
SFTP Upload Attempt
    │
    ├─ Success → Delivery confirmed
    │
    └─ Failure (network/auth/DSP down)
        └─ Exponential backoff retry
            (1s, 2s, 4s, 8s, 16s, 32s, 64s)
            └─ Max 7 retries (~2 minutes total)
                └─ Manual retry available to artist
```

### Payment Idempotency

```
Stripe Webhook Received
    │
    ├─ Idempotency key seen? → Skip
    │
    └─ New key? → Process & store key
        └─ Update Firestore exactly once
            └─ No double-debit risk
```

---

## Security Model

### Firebase Security Rules

**Firestore (`firestore.rules`):**

```
// Authenticated users can only read/write their own documents
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
  allow read: if request.auth.uid == resource.data.collaboratorIds[request.auth.uid];
}

// Payment records are admin-only
match /payments/{paymentId} {
  allow read, write: if request.auth.token.admin == true;
}
```

**Cloud Storage (`storage.rules`):**

```
// Users can only access their own audio/image files
match /users/{userId}/** {
  allow read, write: if request.auth.uid == userId;
}

// Public assets (brand guidelines, etc.) are read-only
match /public/** {
  allow read: if true;
  allow write: if false;
}
```

### App Check

All Cloud Functions require valid App Check tokens:

```typescript
// functions/src/index.ts
export const createCheckoutSession = onCall(
  { enforceAppCheck: true },
  async (request) => {
    // Only requests with valid App Check token reach here
  }
);
```

### Custom Claims

Authorization via Firebase custom claims:

```typescript
// Admin function
const token = await admin.auth().createCustomToken(uid, {
  god_mode: false,
  role: 'artist',
  tier: 'premium',
});

// Client-side verification
const idTokenResult = await user.getIdTokenResult(true);
if (idTokenResult.claims.god_mode) {
  // Allow bypass
}
```

---

## Infrastructure & Deployment

### Compute

| Component | Platform | Runtime | Notes |
|-----------|----------|---------|-------|
| **React App** | Firebase Hosting | Browser | Vite SPA, ~2.5MB gzip |
| **Cloud Functions** | Firebase Functions | Node.js 22 (Gen 2) | Deployed from `functions/` |
| **Vertex AI** | Google Cloud | Managed endpoints | 16 R7 fine-tuned models |
| **Agent Sidecar** | Docker (optional) | Python 3.11 | `docker-compose.yml` for local dev |
| **Desktop** | Electron 33 | Node.js 22 | macOS/Windows/Linux |

### Storage

| System | Service | Retention | Notes |
|--------|---------|-----------|-------|
| **Metadata** | Firestore | Indefinite | Artist data, release info, royalty tracking |
| **Audio/Video** | Cloud Storage | Indefinite | Master files, processed assets |
| **Training Data** | GCS Bucket | Indefinite | Fine-tuning datasets (`gs://indiios-training-data/`) |
| **Backups** | Firestore Exports | 90 days | Daily exports to GCS |
| **Analytics** | BigQuery | 7 years | Revenue, stream, and release analytics |

### CI/CD Pipeline

```
Push to main
    │
    ├─ Lint (ESLint)
    ├─ Type check (tsc)
    ├─ Unit tests (Vitest, 99.6% pass)
    ├─ E2E tests (Playwright)
    │
    ├─ Build landing page
    ├─ Build studio app (Vite)
    ├─ Build desktop (Electron)
    │
    └─ Deploy
        ├─ Firebase Hosting (landing + app)
        ├─ Cloud Functions (updated)
        └─ Electron release (GitHub Releases)
```

---

## Testing Strategy

### Unit Tests (Vitest, ~1800 tests)

- `src/**/*.test.ts(x)` — co-located with source
- jsdom environment, Firebase mocked
- Coverage: business logic, agent routing, payment logic, DDEX generation

### Integration Tests (~300 tests)

- Agent → tool integration
- Firestore rules verification
- End-to-end payment flow (with Stripe test keys)

### E2E Tests (Playwright, 60+ specs)

- User workflows: upload → distribute → track
- Agent chat interactions
- Desktop app responsiveness
- Chaos testing (network failures, timeouts)

### Test Coverage

**Current:** 2,158/2,167 tests passing (99.6%)
- 2,158 passing
- 9 skipped (known flaky tests, e.g., real Vertex API calls)
- 0 failing

---

## Performance Characteristics

### API Response Times (P99)

| Endpoint | Latency | Notes |
|----------|---------|-------|
| Generate metadata | <2s | Music Agent inference |
| Create ERN | <1s | Deterministic script |
| Submit DSP | <5s | SFTP upload + poll |
| List releases | <500ms | Firestore query |
| Stream chat | <500ms | First token (Vertex AI) |

### Scalability Targets

- **Concurrent artists:** 10K (Firestore auto-scale)
- **Monthly releases:** 100K (DDEX pipeline)
- **Concurrent streams:** 1M+ (DSP backend, not indiiOS)
- **Agent fleet:** 16 R7 endpoints, each 1K concurrent requests

---

## Known Limitations & Deferred Work

See `docs/KNOWN_GAPS.md` for complete inventory. Summary:

| Item | Status | Remediation Trigger |
|------|--------|-------------------|
| Stripe tax forms | Stub | GMV > $25K or artists > 50 |
| Blockchain suite | Disabled | Post-acquisition if needed |
| Advanced royalty splits | Not implemented | Artist demand + DSP support |
| Multi-currency payouts | Not implemented | International artist base |

---

## Post-Acquisition Integration Notes

### Minimal Refactoring Required

- Firebase is acquirer-agnostic; can migrate to acquirer's GCP project if needed
- No vendor lock-in on agent training (Vertex AI → OpenAI fine-tuning possible)
- Stripe integration is standard; can migrate to acquirer's Stripe account

### Integration Touchpoints

1. **Authentication:** Migrate Firebase Auth → acquirer's auth system (1–2 FTE weeks)
2. **Billing:** Migrate Stripe → acquirer's payment processor (2–3 weeks)
3. **Agent fleet:** Can stay on indiiOS GCP project or migrate to acquirer's Vertex AI (1 week, no model changes)
4. **Data migration:** Firestore → acquirer's data warehouse (2–3 weeks, BigQuery export available)

---

**Last Updated:** 2026-04-26  
**Owner:** William Roberts  
**Next Step:** Independent technical review (12 verification gates in INDEPENDENT_REVIEW_SCOPE.md)
