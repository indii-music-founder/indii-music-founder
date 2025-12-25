
# ⚡ MAXIMUM EFFICIENCY ARTIFACT: The IndiiOS Dividend Protocol

> **Objective:** Systematically eliminate the "Artist Economy Leakage" identified in research (approx. $11k/yr lost).
> **Method:** 4-Pillar Implementation Strategy.

---

## 🏗️ Pillar 1: The "Black Box" Hunter (Metadata Fortress)

**Goal:** Recover the 10-15% of revenue lost to bad data.
**Target Module:** `src/modules/music/MusicStudio.tsx`

### 1.1 The "Golden File" Schema

We must define a strict metadata contract. No file leaves the studio without this.

```typescript
// src/services/metadata/types.ts
export interface GoldenMetadata {
    // 1. Core Identity (The "Who")
    trackTitle: string;
    artistName: string;
    isrc: string; // The License Plate
    iswc?: string; // Composition ID

    // 2. The Splits (The "Who Gets Paid")
    splits: {
        legalName: string;
        role: 'songwriter' | 'producer' | 'performer';
        percentage: number; // Must sum to 100%
        email: string;
    }[];

    // 3. Rights Admin (The "Who Collects")
    pro: 'ASCAP' | 'BMI' | 'SESAC' | 'None';
    publisher: string;
}
```

### 1.2 The Implementation Steps

1. [x] **Create Schema:** Create `src/services/metadata/types.ts`
2. [x] **Create UI:** Build `MetadataDrawer.tsx` component in `src/modules/music/components/`
    * Form fields for ISRC, Splits (with % validation).
    * "Golden Seal" visual indicator (Green Check = Ready for Release).
3. [x] **Integrate:** Add `MetadataDrawer` to `MusicStudio.tsx`.
4. [x] **Enforce:** Disable "Export" button until Golden Metadata is complete.

---

## 📉 Pillar 2: The Agent CFO (Manager Replacement)

**Goal:** Eliminate the 20% Agent/Manager tax.
**Target Agent:** `src/services/agent/definitions/FinanceAgent.ts`

### 2.1 The Logic Upgrade

The current `FinanceAgent` is passive. It must be **Proactive**.

### 2.2 The Implementation Steps

1. [x] **Inject Knowledge:** Give `FinanceAgent` access to `Artist_Economics_Deep_Dive.md` via system prompt override.
2. [x] **New Capabilities:**
    * `audit_metadata()`: Check recent tracks for "Golden File" status.
    * `forecast_revenue()`: Use the "Dividend" model to show saved fees (Gamification).
3. [ ] **Integration:** Display "Fees Saved: $XXXX" in `FinanceDashboard.tsx`.

---

## 📢 Pillar 3: The Hype Machine (PR Automation)

**Goal:** Eliminate the $3k-$5k/mo PR retainer.
**Target Agent:** `src/services/agent/definitions/PublicistAgent.ts`

### 3.1 The "Hype Engine" Workflow

1. **Input:** "Golden File" Metadata + Audio Analysis (Energy, Key).
2. **Process:**
    * Agent searches Knowledge Base for `Music_Industry_History_Deep_Dive` to find "hooks" (e.g., "This track channels the 1980s synth-pop resurgence...").
    * Generates 3 angles: "The Story", "The Industry Pitch", "The Fan Hook".
3. **Output:** Press Release PDF + 5 Social Post drafts.

### 3.2 The Implementation Steps

1. [ ] **Update Agent:** Add `generate_campaign_assets` tool to `PublicistAgent`.
2. [ ] **UI:** Add "Generate Release Kit" button in `MusicStudio` (only unlocking when Golden Metadata is present).

---

## 📦 Pillar 4: One-Click Release (Distribution)

**Goal:** Eliminate fragmentation fees.
**Target Module:** `src/modules/publishing`

*(Deferred for Phase 2 - Focus on Pillars 1-3 first)*

---

## 🚀 Execution Order (The "Right Now" Plan)

1. **Define Schema:** Create `src/services/metadata/types.ts`.
2. **Build UI:** Create `MetadataDrawer` (The "Form").
3. **Wire It Up:** Block exports in `MusicStudio` until the form is filled.
4. **Activate Agents:** Tell `FinanceAgent` to start tracking the savings.

*This artifact is your compass. Proceed efficiently.*
