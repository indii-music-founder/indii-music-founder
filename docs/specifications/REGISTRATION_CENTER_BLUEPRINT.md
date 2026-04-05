# Registration Center — Blueprint

> **Status:** Built — Phase 1–6 complete as of 2026-04-05
> **Branch to create when ready:** `feat/registration-center`
> **Spec author:** Claude (session 2026-04-05)
> **Pick up by reading:** This file top to bottom. Everything needed to build is here.

---

## The Vision (One Paragraph)

indiiOS is the last interface the artist ever needs. That means they should never have to visit
eco.copyright.gov, ASCAP.com, BMI.com, SoundExchange.org, or any other rights/registration
website — ever. indiiOS already holds their catalog, splits, metadata, and contributor info.
It knows enough to fill out ~85% of every registration form automatically. The Registration
Center is the module that does this: a single, AI-co-piloted panel where artists register their
works with every major organization through an indiiOS-native skin. The external sites are
invisible backend plumbing. The user experience is: "Here are the 2 things I need from you.
Everything else is done."

---

## What Already Exists (Do Not Rebuild)

These files are the foundation. Read them before touching anything.

| File | What it provides |
|------|-----------------|
| `src/modules/royalty/components/CopyrightSection.tsx` | eCO portal link, cost info ($45–65), timeline (3–9mo) |
| `src/modules/royalty/components/RegistrationChecklist.tsx` | Master checklist: PRO, SoundExchange, MLC, Copyright cards |
| `src/modules/royalty/components/ProRegistrationSection.tsx` | PRO comparison table (BMI/ASCAP/SESAC), IPI number tracking |
| `src/modules/royalty/components/SoundExchangeSection.tsx` | SoundExchange enrollment UI |
| `src/modules/royalty/types.ts` | `CopyrightRegistration` interface with status tracking |
| `src/services/rights/PRORightsService.ts` | Live API calls: ASCAP, BMI, SoundExchange, Music Reports |
| `python/tools/copyright_registration_prep.py` | Generates eCO submission payload + checklist JSON |
| `python/tools/pro_scraper.py` | Hardened CDP bridge for ASCAP/BMI repertory scraping |
| `src/services/agent/definitions/LegalAgent.ts` | Legal agent — copyright registration in scope |
| `src/services/agent/tools/LegalTools.ts` | Legal tools (needs `register_copyright` added — see Phase 3) |
| `src/services/agent/tools/NavigationTools.ts` | `switch_module` tool (needs deep-link extension — see Phase 1) |
| `src/services/agent/BrowserAgentService.ts` | Playwright + Gemini Computer Use — can pilot external sites headlessly |
| `src/services/agent/tools/BrowserTools.ts` | `browser_navigate`, `browser_action`, `browser_snapshot` |
| `src/services/agent/components/AgentOrchestrator.ts` | Intent routing hub (needs copyright/PRO intents — see Phase 2) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Registration Center                          │
│                    src/modules/registration/                     │
│                                                                  │
│  ┌──────────────┐  ┌─────────────────────┐  ┌───────────────┐  │
│  │ Catalog Rail │  │  Registration Sheet  │  │   AI Rail     │  │
│  │  (left)      │  │     (center)         │  │  (right)      │  │
│  │              │  │                      │  │               │  │
│  │ All tracks   │  │ Per-track status     │  │ Co-pilot AI   │  │
│  │ color-coded  │  │ cards per org:       │  │ always on     │  │
│  │              │  │  ○ Copyright (LoC)   │  │               │  │
│  │ 🔴 none      │  │  ○ PRO               │  │ Pre-fills     │  │
│  │ 🟡 partial   │  │  ○ SoundExchange     │  │ fields it     │  │
│  │ 🟢 complete  │  │  ○ MLC               │  │ knows.        │  │
│  │              │  │  ○ [extensible]      │  │               │  │
│  │ Click track  │  │                      │  │ Asks only     │  │
│  │ → loads its  │  │ Click card →         │  │ for gaps.     │  │
│  │ sheet        │  │ opens skinned form   │  │               │  │
│  └──────────────┘  └─────────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Org Adapter Layer
                              │
        ┌─────────┬───────────┼────────────┬──────────┐
        │         │           │            │          │
      LoC       ASCAP        BMI     SoundExchange   MLC
    Adapter   Adapter      Adapter    Adapter      Adapter
        │         │           │            │          │
        └─────────┴───────────┼────────────┴──────────┘
                              │
                    Submission Engine
                    (API or Playwright)
```

---

## The Org Adapter Interface

Every organization must implement this contract. This is the single most important architectural
decision. Get this right and every new org is just a new file.

```typescript
// src/modules/registration/types/OrgAdapter.ts

export interface RegistrationField {
  id: string;                          // internal field key
  label: string;                       // artist-friendly label (NOT the org's label)
  orgLabel: string;                    // what the org actually calls it (for mapping)
  type: 'text' | 'date' | 'select' | 'boolean' | 'multiselect';
  options?: string[];                  // for select/multiselect
  required: boolean;
  helpText?: string;                   // plain English explanation
  autoFillFrom?: keyof CatalogTrack;   // field in catalog data to pull from
}

export interface OrgAdapter {
  id: OrgId;                           // 'loc' | 'ascap' | 'bmi' | 'soundexchange' | 'mlc'
  name: string;                        // display name: "Library of Congress"
  shortName: string;                   // "LoC"
  category: 'copyright' | 'pro' | 'digital' | 'mechanical';
  fields: RegistrationField[];         // the full form schema, in indiiOS language
  fee?: { amount: number; currency: string; notes?: string };
  timeline?: string;                   // "3–9 months"
  submit: (data: FormData, track: CatalogTrack) => Promise<SubmissionResult>;
  getStatus: (trackId: string) => Promise<RegistrationStatus>;
}

export type OrgId = 'loc' | 'ascap' | 'bmi' | 'sesac' | 'soundexchange' | 'mlc';

export type RegistrationStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'confirmed'
  | 'error';

export interface SubmissionResult {
  success: boolean;
  confirmationNumber?: string;
  errorMessage?: string;
  submittedAt: Date;
}
```

---

## Org Adapters to Build (One File Each)

### 1. Library of Congress (eCO)
- **File:** `src/modules/registration/adapters/LocAdapter.ts`
- **Submission:** BrowserAgentService (no public API — Playwright pilots eco.copyright.gov)
- **Fee:** $45 single work / $65 group of unpublished works
- **Fields indiiOS auto-fills:** Title, year of creation, author names, copyright claimant, nature of authorship, publication status, nation of first publication
- **Fields user must provide:** Claimant's legal name (if different from profile), date of birth (for copyright term calculation), work-for-hire status
- **Estimated user input:** 2–3 fields

### 2. ASCAP
- **File:** `src/modules/registration/adapters/AscapAdapter.ts`
- **Submission:** REST API — `api.ascap.com/v1/works/register` (already stubbed in PRORightsService)
- **Fee:** None (free to register works once member)
- **Fields indiiOS auto-fills:** Title, ISWC, contributors + roles, shares, ISRC
- **Fields user must provide:** IPI number (if not in profile), co-writer IPI numbers
- **Estimated user input:** 0–2 fields (if profile is complete, zero)

### 3. BMI
- **File:** `src/modules/registration/adapters/BmiAdapter.ts`
- **Submission:** Works Express API — `worksexpress.bmi.com/api` (already stubbed in PRORightsService)
- **Fee:** None
- **Fields indiiOS auto-fills:** Same as ASCAP
- **Fields user must provide:** Publisher number (if applicable)
- **Estimated user input:** 0–1 fields

### 4. SESAC
- **File:** `src/modules/registration/adapters/SesacAdapter.ts`
- **Submission:** BrowserAgentService (no public API — member portal only)
- **Note:** Only relevant if user chose SESAC as their PRO. Check profile before showing.

### 5. SoundExchange
- **File:** `src/modules/registration/adapters/SoundExchangeAdapter.ts`
- **Submission:** REST API — `api.soundexchange.com/v1/enrollments` (already stubbed)
- **Fee:** None
- **Fields indiiOS auto-fills:** ISRC, performer name, recording title
- **Fields user must provide:** Sound Recording copyright ownership percentage

### 6. MLC (The Mechanical Licensing Collective)
- **File:** `src/modules/registration/adapters/MlcAdapter.ts`
- **Submission:** MLC portal (BrowserAgentService fallback, API if available)
- **Fee:** None
- **Fields indiiOS auto-fills:** ISWC, title, contributors, shares

---

## Firestore Schema

```
/registrations/{userId}/tracks/{trackId}/orgs/{orgId}
  {
    status: RegistrationStatus,
    submittedAt: Timestamp | null,
    confirmedAt: Timestamp | null,
    confirmationNumber: string | null,
    formSnapshot: object,              // what was submitted (for audit)
    errorMessage: string | null,
    lastUpdated: Timestamp
  }

/registrations/{userId}/summary
  {
    totalTracks: number,
    fullyRegistered: number,           // all orgs complete
    partiallyRegistered: number,       // some orgs complete
    unregistered: number
  }
```

---

## AI Co-Pilot Behavior (Registration Rail)

The AI is not a chatbot in this context. It is a form-filling co-pilot.

**On panel open for a track:**
1. Load catalog data for the selected track
2. Run `autoFillFrom` mappings across all fields for the target org
3. Identify unfilled required fields
4. Present to user: *"I can complete the [LoC / ASCAP / BMI] registration for '[Track Title]'. I just need [N] things from you:"* followed by only the gap fields
5. User fills gaps → AI populates form → user confirms → AI submits

**During submission (desktop):**
- BrowserAgentService runs headlessly
- AI provides status updates: *"Navigating to eCO portal… Filling form… Submitting…"*
- On success: updates Firestore status, shows confirmation number
- On failure: surfaces specific error, asks user to resolve

**During submission (web):**
- API submission where available (ASCAP, BMI, SoundExchange)
- For LoC/SESAC/MLC where no API exists: generate a pre-filled PDF checklist the user can download and submit manually. Show a "Desktop app required for automatic submission" notice.

---

## Chat Intent Detection (Entry Points)

Add these intent clusters to `AgentOrchestrator.ts`:

```typescript
const REGISTRATION_INTENTS = {
  loc: [
    'library of congress', 'copyright office', 'eco portal', 'register copyright',
    'register my songs', 'copyright registration', 'copyright my music',
    'protect my music', 'file with the library', 'USCO'
  ],
  ascap: [
    'ascap', 'register with ascap', 'ascap registration', 'performing rights ascap'
  ],
  bmi: [
    'bmi', 'register with bmi', 'bmi registration', 'performing rights bmi'
  ],
  pro: [
    'performing rights', 'PRO registration', 'register my songs with a PRO',
    'performance royalties', 'sign up for royalties'
  ],
  soundexchange: [
    'soundexchange', 'digital performance', 'satellite radio royalties', 'streaming royalties'
  ],
  mlc: [
    'mechanical licensing', 'mlc', 'mechanical royalties', 'streaming mechanicals'
  ],
  general: [
    'register my music', 'register my catalog', 'rights registration',
    'music registration', 'sign up for royalties', 'protect my work'
  ]
};
```

**Routing:** Any match → `navigate_to({ module: 'registration', focus?: orgId })` → AI co-pilot activates for the focused org (or shows overview if general).

---

## Navigation Tool Extension

Extend `NavigationTools.ts` to support deep-linking into panels, not just modules:

```typescript
// New tool: navigate_to
// Replaces the current switch_module for registration flows
{
  name: 'navigate_to',
  description: 'Navigate to a module and optionally focus a specific panel or tab',
  parameters: {
    module: AppSlice['currentModule'],
    panel?: string,     // e.g. 'copyright', 'pro', 'soundexchange'
    trackId?: string,   // pre-select a specific track
    orgId?: OrgId       // pre-open a specific org's form
  }
}
```

---

## Build Phases

### Phase 1 — Foundation (no UI yet)
- [ ] Create `src/modules/registration/` directory structure
- [ ] Define `OrgAdapter` interface + all types (`OrgAdapter.ts`, `types.ts`)
- [ ] Extend `NavigationTools.ts` with `navigate_to` deep-link tool
- [ ] Create Firestore schema + security rules for `/registrations/`
- [ ] Write `RegistrationStore` Zustand slice (`registrationSlice.ts`)

### Phase 2 — Intent Wiring
- [ ] Add `REGISTRATION_INTENTS` clusters to `AgentOrchestrator.ts`
- [ ] Wire intent matches to `navigate_to({ module: 'registration', orgId })`
- [ ] Test all intent phrases in chat panel

### Phase 3 — Org Adapters (one at a time, test each)
- [ ] `LocAdapter.ts` — BrowserAgentService submission
- [ ] `AscapAdapter.ts` — REST API (wrap existing PRORightsService)
- [ ] `BmiAdapter.ts` — REST API (wrap existing PRORightsService)
- [ ] `SoundExchangeAdapter.ts` — REST API (wrap existing PRORightsService)
- [ ] `SesacAdapter.ts` — BrowserAgentService submission
- [ ] `MlcAdapter.ts` — BrowserAgentService submission

### Phase 4 — Skinned Form Renderer
- [ ] `RegistrationForm.tsx` — generic form component
  - Renders only unfilled required fields
  - Artist-friendly labels
  - Help tooltips from `helpText`
  - Pre-filled fields shown as read-only (tap to edit)
- [ ] `OrgStatusCard.tsx` — status card for each org (🔴🟡🟢)

### Phase 5 — Registration Center Module UI
- [ ] `RegistrationCenter.tsx` — main module shell
- [ ] `CatalogRail.tsx` — left track list with color-coded completeness
- [ ] `RegistrationSheet.tsx` — center panel with org cards
- [ ] `RegistrationAIRail.tsx` — right AI co-pilot panel
- [ ] Wire into `App.tsx` module registry + `constants.ts`
- [ ] Add to sidebar navigation

### Phase 6 — AI Co-Pilot Logic
- [ ] Add `register_copyright` tool to `LegalTools.ts`
- [ ] Add `start_pro_registration` tool to `LegalTools.ts`
- [ ] Build co-pilot prompt: form-filling mode (not chat mode)
- [ ] Auto-fill logic: map `CatalogTrack` fields → `RegistrationField.autoFillFrom`
- [ ] Gap detection: surface only unfilled required fields to user

### Phase 7 — Submission Engine
- [ ] API path: wrap existing `PRORightsService` calls
- [ ] Playwright path: BrowserAgentService task scripts per org
- [ ] Web fallback: pre-filled PDF checklist generator
- [ ] Status polling + Firestore write-back
- [ ] Success/error handling in AI Rail

### Phase 8 — Polish
- [ ] Registration completeness score per track (0–100%)
- [ ] Bulk registration: select multiple tracks, register all with one org
- [ ] Notification when registration is confirmed by org
- [ ] Export registration records (PDF audit trail)

---

## File Structure (When Complete)

```
src/modules/registration/
├── RegistrationCenter.tsx          # Main module shell
├── components/
│   ├── CatalogRail.tsx             # Left track list
│   ├── RegistrationSheet.tsx       # Center org cards
│   ├── RegistrationAIRail.tsx      # Right AI co-pilot
│   ├── OrgStatusCard.tsx           # Per-org status card
│   └── RegistrationForm.tsx        # Generic skinned form renderer
├── adapters/
│   ├── index.ts                    # Registry: OrgId → Adapter
│   ├── LocAdapter.ts
│   ├── AscapAdapter.ts
│   ├── BmiAdapter.ts
│   ├── SesacAdapter.ts
│   ├── SoundExchangeAdapter.ts
│   └── MlcAdapter.ts
├── hooks/
│   ├── useRegistrationStatus.ts    # Firestore subscription for track status
│   └── useRegistrationForm.ts      # Form state + auto-fill logic
├── services/
│   └── RegistrationSubmissionService.ts  # Routes to API or Playwright per org
└── types/
    ├── OrgAdapter.ts               # The interface contract
    └── index.ts                    # All exported types
```

---

## Dependencies / Notes

- **Desktop-only orgs (Playwright required):** LoC, SESAC, MLC. Web sessions show pre-filled PDF fallback.
- **PRORightsService:** Do not rewrite it. Wrap it inside the ASCAP/BMI/SoundExchange adapters.
- **User must have chosen a PRO** (stored in profile) before ASCAP/BMI/SESAC card is shown. If no PRO selected, show PRO selection step first.
- **Copyright registration is per-work**, not per-release. A 12-track album = 12 separate eCO submissions (or one group registration if unpublished — adapter handles this logic).
- **IPI numbers** are stored in `src/core/store/slices/profileSlice.ts`. Pull from there.
- **ISRC + ISWC** are stored in distribution/catalog metadata. Pull from there.

---

## When You Come Back

1. Read this file
2. Scan "What Already Exists" table — confirm nothing's changed
3. Check which Phase items are already checked off
4. Create branch: `git checkout -b feat/registration-center`
5. Start at the first unchecked item in the current phase
6. The AI co-pilot is the differentiator — do not ship without Phase 6

---

*Blueprint locked 2026-04-05. Build when ready.*
