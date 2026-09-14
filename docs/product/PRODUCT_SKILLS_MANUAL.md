# indii.music Product Skills: The Official Manual & Architecture Guide

> **Document Version:** 1.0.0  
> **Audience:** Product Strategy, Marketing & Landing Page Copywriters, System Architects, Artist Experience Teams.  
> **Scope:** Shipped `indii.music` Application Runtime (React Studio Web & Electron Desktop). Excludes all developer tooling, coding assistants, and CI/CD harnesses.

---

## 0.1 What is a Product Skill? The Fundamental Definition

In `indii.music`, a **Product Skill** is the codified domain intelligence of the music industry. It is not an open-ended chatbot prompt, nor is it merely a raw programming function. 

A **Product Skill** is a **Standard Operating Procedure (SOP) married to deterministic execution**:
- **The Brain (Procedural Playbook):** Standard Operating Procedures, legal constraints, financial formulas, audio engineering targets, and distribution standards (authored in structured Markdown with YAML frontmatter).
- **The Hands (Deterministic Tooling):** Strongly typed, validated TypeScript/Python functions that execute file scans, generate XML payloads, calculate royalty waterfalls, and route data without hallucination.
- **The Governance (Approval Gate):** A non-negotiable safety perimeter requiring human artist authorization before any money is spent, music is delivered, or legal contracts are signed.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              ANATOMY OF A PRODUCT SKILL                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   1. FRONTMATTER METADATA (Discovery & Routing)                                         │
│      - Unique Skill ID (e.g., audio_engineering, digital_distribution, publishing)       │
│      - Department Owner (e.g., Music Director, Distribution Chief, Legal Counsel)       │
│      - Risk Tier (Read-Only, Safe Draft, Financial/Legal Approval Required)             │
│      - Trigger Intents & Domain Labels                                                  │
│                                                                                         │
│   2. PROCEDURAL PLAYBOOK (The "Law" of the Music Business)                              │
│      - Industry Constraints: -14 LUFS / -1.0 dB True Peak streaming loudness ceiling    │
│      - Metadata Rules: ISRC (Recording), UPC (Product), ISWC (Composition)              │
│      - Legal Imperatives: 100% split-sheet limit; ASCAP/BMI vs. The MLC mechanics       │
│      - Workflow Steps: Step-by-step diagnostic loops for the agent                      │
│                                                                                         │
│   3. DETERMINISTIC EXECUTION LAYER (The "Hands")                                        │
│      - Native TypeScript tool calls with Zod schema validation                          │
│      - Direct integration with Essentia.js, FFmpeg, DDEX XML builders, Stripe, Printful│
│      - Bounded execution time and strict error propagation                              │
│                                                                                         │
│   4. HUMAN-IN-THE-LOOP SOVEREIGNTY (The "Brake")                                        │
│      - ApprovalGateRegistry: Halts agent before external distribution or financial moves │
│      - Mandatory Artist Confirmation Modal: "Approve / Edit / Deny"                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 0.2 Why indii.music Requires Product Skills (The Product Problem & Solution)

### The Failure of Generic AI in the Music Industry
When independent artists use generic AI chatbots (ChatGPT, Claude, generic LLMs) to manage their careers, the results are dangerous:
1. **Loudness Hallucination:** Generic models often suggest mastering to `-8 LUFS` for streaming, which causes DSPs (Spotify, Apple Music) to aggressively compress or turn down the track, ruining dynamics.
2. **Royalty Erasure:** Generic models frequently tell artists that joining ASCAP or BMI is sufficient to collect all streaming royalties, ignoring **mechanical royalties** collected exclusively by The MLC in the US. Artists lose earned revenue permanently.
3. **Split Sheet Catastrophes:** Unconstrained models frequently approve collaborator splits that add up to 95% or 105%, rendering contracts legally unenforceable and triggering royalty freezes at distributors.
4. **Unregulated Actions:** Script bots without governance gates can accidentally deploy unmastered audio, charge credit cards, or send unilateral takedown notices.

### The indii Solution: Institutional Music Business Discipline
`indii.music` solves this by equipping every internal AI specialist with battle-tested Product Skills:
- **No Hallucinated Numbers:** Agents cite verified metrics, exact LUFS measurements from local audio analysis, and official rate schedules.
- **Closed-Garden Tooling:** The agent cannot touch external APIs or databases except through certified, audited tools.
- **Artist Sovereignty:** The AI acts as an executive advisor and paralegal; the artist remains the Chief Executive Officer.

---

## 0.3 The Catalog of 27 Core Product Skills

Every department in the indii Studio operates on specialized Product Skills located in the app bundle:

### 1. Audio Intelligence & Sonic Direction
*   **`audio_engineering` (Sonic Director):**
    *   *Standard Targets:* Spotify & Apple Music streaming normalization (`-14 LUFS Integrated`, `-1.0 dB True Peak`); Club/DJ masters (`-8` to `-6 LUFS`, `-0.5 dB True Peak`).
    *   *The Car-Test EQ Protocol:* Diagnostic rules for frequency buildup (200Hz–500Hz mud scooping; 2kHz–5kHz harshness reduction; sub-bass 20Hz–60Hz phase cancellation checks).
    *   *Spatial Audio:* Dolby Atmos binaural rendering translation, center-channel phantom isolation, and LFE sub routing.
*   **`song_dna` (Creative Intake):**
    *   Extracts tempo, musical key, harmonic energy, structural transitions, and vocal presence via local Essentia.js and YAMNet machine intelligence.

### 2. Distribution & Global Supply Chain
*   **`digital_distribution` (Distribution Chief):**
    *   *The Metadata Holy Trinity:* ISRC (Master Recording barcode), UPC (Release barcode), ISWC (Underlying Composition identifier).
    *   *Ingestion Standards:* DDEX ERN 4.3 XML schema generation; 3000x3000px 24-bit RGB cover art verification; lossless WAV (44.1kHz/16-bit or higher) enforcement.
    *   *Pitch Windows:* Strict enforcement of the 3–4 week pre-release lead time for editorial playlist pitching.
*   **`release_strategy` (Release Manager):**
    *   Waterfall release timing, single-to-EP cadence, pre-save link setup, and multi-territory rollout scheduling.
*   **`direct_distribution` (Engine Covenant):**
    *   Direct-to-storefront transport verification, Aspera/SFTP batch uploading, and cryptographic package validation.

### 3. Publishing & Rights Administration
*   **`publishing` (Publishing Administrator):**
    *   *The Split Sheet Iron Rule:* Splits can never exceed or fall below 100.00%. Must capture writer names, PRO affiliations (ASCAP, BMI, PRS, SESAC), IPI/CAE numbers, and publisher shares.
    *   *Dual-Royalty Education:* Teaches artists that PROs only collect performance royalties; The MLC must be registered to collect digital mechanical streaming royalties in the US.
    *   *The "One-Stop" Advantage:* Verifying when an artist owns 100% of Master and Publishing to market their catalog as pre-cleared for rapid sync placements.
*   **`sync_licensing` (Sync Agent):**
    *   Prepares metadata-tagged MP3/WAV packages with embedded contact info, instrumental/acapella alternate mixes, mood/tempo tags, and MFN (Most Favored Nations) quote pricing.

### 4. Legal Affairs & Creator Protection
*   **`legal_affairs` (Legal Counsel):**
    *   Plain-language contract translation, redlining unfavorable clauses (perpetual assignment, predatory recoupment, packaging deductions), and Work-for-Hire verification.
*   **`creator_protection` (Creator Defense):**
    *   Detects and blocks unauthorized AI vocal cloning, non-consensual biometric training, digital likeness misappropriation, and sample infringement.
*   **`collaboration_splits` (Dispute Arbitrator):**
    *   Formalizes verbal producer agreements into legally binding digital contracts before release distribution.

### 5. Finance & Royalty Accounting
*   **`finance_royalties` (Chief Financial Officer):**
    *   360-deal breakeven simulation, advance recoupment schedules, DSP rate audit, foreign tax withholding reduction (Form W-8BEN/W-9 guidance).
*   **`activity_time_value` (Labor Capitalization):**
    *   Calculates and visualizes the economic sweat-equity investment artists pour into writing, producing, and rehearsing.

### 6. Touring, Hospitality & Live Events
*   **`tour_management` (Road Manager):**
    *   Day-sheet generation, routing mileage optimization, multi-state tax nexus monitoring ($250k threshold warnings), promoter settlement audits.
*   **`hospitality` & `event_production`:**
    *   Stage plot and input list generation, rider compliance, dressing room accommodations, and backline sound vendor coordination.

### 7. Marketing, Merchandising & Fan Engagement
*   **`music_marketing` & `public_relations`:**
    *   EPK (Electronic Press Kit) compilation, journalist pitch hooks, media angles, and pre-save ad campaign optimization.
*   **`merchandising` (Merch Director):**
    *   Print-on-Demand (Printful) margin calculations, SKU pricing, sample ordering, tour stock forecasting.
*   **`fan_crm` (Audience Intelligence):**
    *   Superfan segmentation, direct-to-consumer email/SMS broadcasts, and city-by-city touring ticket demand mapping.

### 8. Meta-Orchestration & Governance
*   **`business_harness_system` (Boardroom Orchestrator):**
    *   Detects cross-department conflicts (e.g., Marketing wants to run ads, but Finance flags a negative tour balance) and calls an automated multi-agent Boardroom conference to reconcile tradeoffs.

---

## 0.4 Landing Page & Website Copy Snippets

Use these copy blocks directly across marketing pages, product feature matrices, and investor presentations:

### Hero Headline & Subhead
> **Headline:** "The First AI Studio Powered by Institutional Music Business Skills."  
> **Subhead:** "Don't trust your career to generic chatbots. indii embeds 27 specialized music executive playbooks—from -14 LUFS mastering audits to DDEX global distribution and 100% split-sheet legal compliance."

### Value Proposition Matrix (Landing Page Feature Section)

| What Generic AI Does | What indii Product Skills Do |
| :--- | :--- |
| Gives generic advice about "getting louder masters." | **Enforces strict -14 LUFS & -1.0 dB True Peak specs** with spectral car-test EQ analysis. |
| Tells you to sign up for ASCAP and assumes you're done. | **Registers compositions with PROs AND The MLC**, unlocking unclaimed digital mechanical royalties. |
| Hallucinates percentages and allows 105% split totals. | **Enforces mathematical 100% split integrity** and issues formal digital split agreements. |
| Guesses distribution metadata. | **Compiles DDEX ERN 4.3 XML manifests** with validated ISRC, UPC, and territory codes. |
| Takes unmonitored automated actions. | **Protected by Approval Gates:** Not a single dollar moves or track goes live without your explicit approval. |

### Feature Card Highlights
1. **The Sonic Director Skill:** *"Mastering that never gets turned down by Spotify."* Ingests your tracks, scans technical audio DNA, and flags phase cancellation or harsh mid-frequencies before you upload.
2. **The Publishing Administrator Skill:** *"Never leave black-box royalties on the table."* Guides you through performance vs. mechanical splits, acapella stem organization, and one-stop sync licensing packages.
3. **The Distribution Chief Skill:** *"Direct DDEX packaging at enterprise scale."* Turns album artwork, high-res WAVs, and track credits into commercial XML packages ready for global DSP ingestion.
4. **The Boardroom Meta-Skill:** *"Your virtual executive board."* When marketing opportunities conflict with tour budgets, indii convenes your 23 specialist directors to present balanced options with clear risk scores.

---

## 0.5 Runtime Lifecycle: How a Product Skill Executes

```
   [Artist Prompt / Studio Action]
                 │
                 ▼
  [1. Conductor Orchestrator] ──► Classifies request domain (e.g., "publishing")
                 │
                 ▼
  [2. ProductSkillRegistry]   ──► Fetches embedded publishing/SKILL.md from app bundle
                 │
                 ▼
  [3. ContextPipeline]        ──► Slices <active_product_skill> into Gemini 3 Pro prompt
                 │
                 ▼
  [4. Deterministic Tools]    ──► Executes verified TypeScript tools (e.g., register_work)
                 │
                 ▼
  [5. ApprovalGateRegistry]   ──► Is action irreversible?
                 │
        ┌────────┴────────┐
     [YES]              [NO]
        │                 │
        ▼                 │
 [Artist Modal]           │
 (Approve / Deny)         │
        │                 │
        └────────┬────────┘
                 │
                 ▼
  [6. Certified Output to UI] ──► Living Plan updated with exact run IDs and metrics
```

1. **Intake:** The artist issues a natural instruction in the studio command bar or clicks a workflow card.
2. **Intent Matching:** The Conductor maps the request to its primary domain specialist.
3. **Progressive Disclosure:** The app retrieves the corresponding `SKILL.md` from the in-memory `ProductSkillRegistry` and injects the SOP into the prompt context.
4. **Tool Execution:** The AI model emits typed tool calls into `TOOL_REGISTRY`.
5. **Governance Check:** If the tool modifies external assets, registers copyrights, or spends capital, `ApprovalGateRegistry` halts execution and presents an interactive confirmation modal.
6. **Reconciliation:** The validated output is saved directly into the artist’s Living Plan and project dashboard.

---

## 0.6 Technical Standards & Implementation Architecture

To ensure product skills are **exclusive to the production app** and cannot be tampered with or broken by external developer tools:

1. **Hermetic Vite Raw Glob:**
   Skills must be bundled into production via `import.meta.glob('@agents/conductor/skills/*/SKILL.md', { query: '?raw', eager: true })`. This packages the markdown files directly into the compiled JavaScript bundle (`dist/` or Electron `app.asar`), requiring zero disk access at runtime and functioning 100% offline.
2. **Zod Schema Validation:**
   Every product skill must conform to a strict schema:
   ```typescript
   export interface ProductSkill {
     id: string;
     name: string;
     domain: string;
     description: string;
     ownerAgentId: string;
     triggerLabels: string[];
     approvalRequired: boolean;
     content: string; // The markdown SOP
   }
   ```
3. **No Developer Path Leakage:**
   The client-side UI (`PromptArea.tsx`) must never reference `.agent/` or developer workflow directories. All slash commands resolve to internal product skills or native studio commands.
4. **Deterministic Base:**
   Skills guide the *reasoning*; typed TypeScript tools in `packages/renderer/src/services/agent/tools/` perform the *actions*. High-risk actions must always enforce the `ApprovalGateRegistry` pattern.
