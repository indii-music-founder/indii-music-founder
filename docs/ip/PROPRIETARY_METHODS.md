# Proprietary Processes & Methods Specification

**Entity:** New Detroit Music LLC  
**Product:** indii.music (indiiOS)  
**Classification:** Confidential — Proprietary Operating Processes, Trade Secrets & Patent Candidates  
**Canonical Location:** `docs/ip/PROPRIETARY_METHODS.md`  
**Cross-References:** `docs/ip/13_IP_ASSET_REGISTER.md`, `docs/ip/IP_ASSIGNMENT.md`, `directives/`

---

## 1. Executive Summary

This document specifies the proprietary technical processes, system architectures, and mathematical methods developed for the **indii.music** platform. These assets represent the core technical defensibility and intellectual property of **New Detroit Music LLC**, designed to pick up where music mastering ends and provide independent music artists with enterprise-grade label operations.

---

## 2. Inventory of Proprietary Methods

### Method 1: Industrial Direct Distribution Engine & Audio Forensics (IP-PROCESS-001)

- **Technical Moat:** Displaces third-party white-label aggregators (e.g., SonoSuite, LabelGrid) by implementing direct DSP delivery pipelines qualifying for Merlin membership and direct DSP partner status.
- **Architectural Implementation:**
  - `directives/direct_distribution_engine.md`
  - `execution/distribution/ingestion_generator.py`
  - `execution/distribution/audio_forensics.py`
  - `packages/renderer/src/services/distribution/DeliveryService.ts`
  - `packages/renderer/src/services/distribution/ERNService.ts`
- **Key Algorithmic & Workflow Innovations:**
  1. **"Spectral Cutoff Gate" (Upsampled Fraud Detection):** Prior to ingestion, audio undergoes automated spectral frequency analysis. Files exhibiting sharp cutoff frequencies characteristic of lossy MP3 compression transcoded to lossless WAV/FLAC are rejected at the gate (`HARD GATE`), preventing DSP strike penalties.
  2. **Transporter Packaging Pipeline:** Automates compilation of media, artwork, and metadata into Apple Music `.itmsp` packages and canonical DDEX ERN 4.3 XML envelopes.
  3. **High-Speed Direct DSP Transport:** Executes high-throughput media transport using Aspera (`ascp` over UDP port 33001) and private SFTP connections directly to DSP ingestion endpoints.
  4. **Automated Metadata QC & SEO Stripper:** Real-time regex and semantic filters enforce DSP style guides (e.g., Apple Music, Spotify), actively stripping search-engine gaming keywords ("Lofi", "Chill", "Sleep") that trigger DSP catalog rejection.
- **Legal Protection Strategy:**
  - **Patent Candidate:** Automated pre-ingestion spectral cutoff forensics combined with multi-DSP direct package assembler.
  - **Trade Secret:** Proprietary spectral cutoff thresholds, DSP packaging configurations, and validation matrices.

---

### Method 2: Connected Intelligence© Cross-Agent Context Propagation & Memory Compaction Protocol (IP-PROCESS-002)

- **Technical Moat:** Eliminates human-in-the-loop briefing between specialist domains. When the artist interacts with one department (e.g., Brand Manager setting visual direction), all downstream specialists (Art Department, Creative Director, Marketing, Merch) immediately inherit and obey those constraints.
- **Architectural Implementation:**
  - `directives/secure_ai_os_architecture.md`
  - `packages/renderer/src/services/agent/a2a/` (`A2AClient.ts`, `AgentCard.ts`)
  - `packages/renderer/src/services/agent/memory/BigBrainEngine.ts`
  - `packages/renderer/src/services/agent/orchestration/AgentGraphService.ts`
  - `packages/renderer/src/services/agent/tools/ToolPoolAssembler.ts`
- **Key Algorithmic & Workflow Innovations:**
  1. **Deterministic Hub-and-Spoke Conductor:** A central Conductor (`generalist` agent) decomposes user goals into execution graphs and routes tasks to 21+ domain specialists without allowing chaotic spoke-to-spoke hallucinations.
  2. **Dynamic ToolPool Assembly:** Restricts the active tool scope at runtime per specialist, optimizing token budgets and eliminating unauthorized tool calls.
  3. **4-Tier Memory Hierarchy with Entity Compaction:**
     - *Working Memory:* In-memory ring buffer (1-hour window).
     - *Short-Term Memory:* 7-day JSONL event log in persistent local storage.
     - *Long-Term Memory:* Firestore document store synchronized with Gemini vector embedding index.
     - *Cold Storage:* Immutable Firestore archive.
     - *Entity Compaction:* At 200 event records, the buffer automatically triggers compaction, extracting proper nouns and brand constraints into a unified Entity Graph.
  4. **Cross-Domain Context Propagation:** Department heads share a synchronized context blackboard. Modifying a brand color or release date automatically updates the legal delivery checklist, visual canvas prompts, and budget allocations.
- **Legal Protection Strategy:**
  - **Patent Candidate:** System and method for autonomous multi-agent contextual synchronization and entity compaction in domain-specialized creative business workflows.
  - **Trademark:** `Connected Intelligence™` / `Connected Intelligence©`.
  - **Copyright:** Agent system prompts, behavioral rubrics, and orchestration graphs.

---

### Method 3: Brand Guard© Multi-Modal Autonomous Safety & Write-Only Marketing Swarm (IP-PROCESS-003)

- **Technical Moat:** Allows autonomous AI agents to buy digital advertising on behalf of a solo independent artist with cryptographic financial and brand safety.
- **Architectural Implementation:**
  - `directives/autonomous_marketing_swarm.md`
  - `packages/renderer/src/services/agent/governance/BrandVisionQC.ts`
  - `packages/firebase/src/marketing/facebookAdsExecutor.ts`
- **Key Algorithmic & Workflow Innovations:**
  1. **Fail-Closed Brand Vision QC Gate:** Every generated visual asset must pass `runCreativeVisionCheck` before entering an ad queue. Evaluates brand palette conformity, logo placement, typography rules, and content safety. If the vision model is unreachable, the gate fails closed (`no publish`).
  2. **Write-Only Meta Graph API Isolation:** The advertising executor exposes write-only endpoints (POST for publish/pause), strictly forbidding read/polling traffic to protect artist ad accounts from platform bans. Analytics are ingested via Airbyte and ClickHouse rollups.
  3. **Single-Tick Hardware Halt Switch:** A Firestore document switch (`users/{uid}/settings/marketingSwarm.isActive = false`) halts all spend-increasing operations server-side within a single agent cycle without relying on agent compliance.
  4. **Dual Audit Ledger:** Concurrently logs every marketing transaction to an artist-facing live log (`marketingAgentLogs`) and an immutable operator ledger (`timelineExecutionLogs`).
- **Legal Protection Strategy:**
  - **Trade Secret:** Fail-closed ad executor architecture and vision-inspection heuristic chains.
  - **Trademark:** `Brand Guard™` / `Brand Guard©`.

---

### Method 4: 3-Tier Automated Royalty Settlement Waterfall & Statutory Tax Lockdown (IP-PROCESS-004)

- **Technical Moat:** Automated music business settlement engine that calculates multi-party royalty splits and complies with IRS statutory tax withholding without manual accounting overhead.
- **Architectural Implementation:**
  - `directives/direct_distribution_engine.md`
  - `execution/distribution/tax_withholding_engine.py`
  - `execution/distribution/waterfall_payout.py`
  - `packages/renderer/src/services/finance/RevenueService.ts`
- **Key Algorithmic & Workflow Innovations:**
  1. **3-Tier Settlement Waterfall:** Incoming gross DSP revenues are settled in strict order:
     - *Tier 1 (Platform Fee):* Deduct platform operational costs (0% distribution cut, transaction fees only).
     - *Tier 2 (Recoupment):* Direct funds toward outstanding production/mastering advances until 100% recouped.
     - *Tier 3 (Split Sheets):* Distribute remaining net revenue to rights holders based on Digital Handshake© split agreements.
  2. **Automated Tax Wizard & TIN Verification:** Validates Taxpayer Identification Numbers against US Person (W-9), International Individual (W-8BEN), and International Entity (W-8BEN-E) structures.
  3. **Mandatory 30% Statutory Lockdown:** If a payee lacks a certified perjury signature or fails TIN matching, the engine automatically locks 30% of their disbursement into a statutory escrow ledger until tax certification is complete.
- **Legal Protection Strategy:**
  - **Trade Secret:** Automated tax withholding algorithm, waterfall calculation engine, and split-sheet smart contract schemas.
  - **Trademark:** `Digital Handshake™` / `Digital Handshake©`.

---

### Method 5: Local-First Sovereign Vault & Ephemeral Remote Pairing Architecture (IP-PROCESS-005)

- **Technical Moat:** Provides "vault-grade" security for unreleased masters and distributor credentials on the artist's local machine, preventing cloud breaches while enabling secure mobile control.
- **Architectural Implementation:**
  - `directives/secure_ai_os_architecture.md`
  - `packages/main/src/security/`
  - `packages/renderer/src/modules/mobile-remote/MobileRemote.tsx`
  - Electron `keytar` OS keychain integration
- **Key Algorithmic & Workflow Innovations:**
  1. **OS Keychain Vault Storage:** Master audio files, distributor SFTP passwords, and private API keys are encrypted and stored via the native operating system keychain (`keytar`), completely isolated from web browsers or remote cloud leaks.
  2. **Window Content Protection:** Electron windows containing unreleased master tracks enforce `setContentProtection(true)` to prevent screen recording and DRM bypass.
  3. **Ephemeral LAN WebSocket Mobile Pairing:** The desktop app spins up a local WebSocket server on an ephemeral port. A 6-digit one-time passcode is generated in volatile RAM (never written to disk or database) and encoded into a QR code. Mobile devices connect directly over the local Wi-Fi network without third-party cloud relays.
- **Legal Protection Strategy:**
  - **Trade Secret:** Volatile-pairing protocol and keychain credential distribution architecture.
  - **Trademark:** `The Freedom Principle™` / `The Freedom Principle©`.

---

### Method 6: Hermetic Progressive Disclosure & Compile-Time Playbook Bundling Protocol (IP-PROCESS-006)

- **Technical Moat:** Solves context window bloat and runtime file access vulnerabilities by compiling modular domain SOP playbooks directly into the client binary, progressively disclosing instructions to runtime LLMs on-demand.
- **Architectural Implementation:**
  - `docs/product/PRODUCT_SKILLS_MANUAL.md`
  - `docs/flowcharts/product-skill-runtime-architecture.md`
  - `packages/renderer/src/services/agent/skills/ProductSkillRegistry.ts`
  - `packages/renderer/src/services/agent/components/ContextPipeline.ts`
- **Key Algorithmic & Workflow Innovations:**
  1. **Build-Time Static Glob Compilation:** Utilizes compile-time static raw imports to package external domain playbooks (`SKILL.md`) into immutable in-memory records within the web and Electron application binaries, operating 100% offline without filesystem traversal.
  2. **Three-Tier Progressive Disclosure:**
     - *Level 1 (Discovery):* Lightweight metadata extraction (name, domain, trigger labels, description) pre-cached in memory (~50 tokens per skill).
     - *Level 2 (Activation):* Intent-driven context injection that dynamically injects the active domain SOP into the system prompt context only when triggered.
     - *Level 3 (Execution):* Sandboxed execution of deterministic TypeScript tools, returning only structured outputs to the LLM context.
  3. **Zero Host-Leak Isolation:** Fully severs in-app agent reasoning from developer environments, preventing hallucinated local file reads or token leaks.
- **Legal Protection Strategy:**
  - **Patent Candidate:** System and method for hermetic progressive disclosure and compile-time domain playbook injection in multi-agent client applications.
  - **Trademark:** `indii Product Skills™` / `Studio Skills™`.
  - **Copyright:** Form TX registration for the 27 Conductor Domain Playbook Corpus.

---

### Method 7: Dual-State Dynamic Invocability & Approval-Gated Tool Sandboxing Protocol (IP-PROCESS-007)

- **Technical Moat:** Enforces strict cryptographic and operational safety boundaries preventing autonomous AI agents from taking irreversible music business actions without explicit human artist consent.
- **Architectural Implementation:**
  - `agents/conductor/skills/`
  - `packages/renderer/src/services/business-harness/ApprovalGateRegistry.ts`
  - `packages/renderer/src/services/agent/tools/`
  - `packages/renderer/src/core/components/command-bar/PromptArea.tsx`
- **Key Algorithmic & Workflow Innovations:**
  1. **Dual-State Model/User Decoupling:** Implements orthogonal control attributes (`disable-model-invocation: boolean` and `user-invocable: boolean`) to distinguish between interactive slash-command utilities and autonomous background reasoning heuristics.
  2. **Dynamic Tool Permission Whitelisting:** Enforces `allowed-tools` scoping derived from active skill frontmatter, physically preventing agents executing creative or audio skills from accessing financial, legal, or distribution endpoints.
  3. **Synchronous Cryptographic Gate Interception:** Intercepts high-risk operations (royalties, DSP transfers, copyright registrations) prior to tool execution, holding sidecar tasks in a suspended state until verified artist confirmation is provided via `ConfirmDialog`.
- **Legal Protection Strategy:**
  - **Patent Candidate:** Method and system for multi-state operational visibility, dynamic parameter autocompletion, and cryptographic approval gating in AI domain execution frameworks.
  - **Trade Secret:** Approval gate evaluation algorithms and risk tiering mapping tables.

---

### Method 8: Multi-Domain Business Harness Conflict Reconciliation & Meta-Arbitration Engine (IP-PROCESS-008)

- **Technical Moat:** Reconciles multi-disciplinary enterprise trade-offs across independent specialized agents without requiring human project management.
- **Architectural Implementation:**
  - `packages/renderer/src/services/business-harness/BoardroomMetaHarnessService.ts`
  - `packages/renderer/src/services/business-harness/HarnessCatalog.ts`
  - `agents/conductor/skills/business_harness_system/SKILL.md`
- **Key Algorithmic & Workflow Innovations:**
  1. **Deterministic Harness Run State Synthesis:** Collects structured run outputs (`HarnessRun`) across 22 business domains (Song DNA, Marketing, Finance, Legal, Tour, Merch).
  2. **Multi-Domain Conflict Arbitration:** Detects contradictions between specialist recommendations (e.g., Marketing budget expansion vs. Finance tour balance deficit) and executes an automated meta-decision matrix.
  3. **Risk-Weighted Strategic Output:** Renders an executive briefing to the artist with categorized severity scores, confidence metrics, and prioritized action paths.
- **Legal Protection Strategy:**
  - **Patent Candidate:** Automated cross-domain risk reconciliation and decision arbitration system in autonomous enterprise swarms.
  - **Trademark:** `The Boardroom™` / `Boardroom Meta-Harness™`.

---

### Method 9: Bi-Directional Co-Authored Dynamic Playbook Inheritance Protocol (IP-PROCESS-009)

- **Technical Moat:** Solves the rigid domain playbook limitation in autonomous multi-agent architectures by enabling a Tier 0 living artist directive that is bi-directionally co-authored in real time by both the human artist and the AI Conductor, possessing supreme override precedence over all compile-time domain playbooks.
- **Architectural Implementation:**
  - `packages/shared/src/schemas/artistMasterDirective.ts`
  - `packages/renderer/src/services/agent/skills/ArtistDirectiveService.ts`
  - `packages/renderer/src/services/agent/tools/ArtistDirectiveTools.ts`
  - `packages/renderer/src/services/agent/components/ContextPipeline.ts`
  - `packages/renderer/src/services/agent/builders/AgentPromptBuilder.ts`
  - `packages/renderer/src/modules/settings/settings-panel/MasterPlaybookSection.tsx`
- **Key Algorithmic & Workflow Innovations:**
  1. **Hierarchical 3-Tier Precedence Architecture:** Tier 0 (Artist Master Directive) strictly supersedes Tier 1 (27 Domain Product Skills), which parameterizes Tier 2 (Deterministic Execution Tools).
  2. **Bi-Directional Co-Authoring & Reflective Distillation:** Human artists edit visual rules or raw markdown in Studio Settings, while autonomous swarm agents continuously inspect (`read_artist_directive`) and reflectively distill implicit conversation preferences into codified rules (`refine_artist_directive`) with timestamped rationale.
  3. **Strict In-Memory Prompt Splicing with Override Framing:** Assembles real-time living directives directly into prompt context inside `<artist_master_directive priority="SUPREME_OVERRIDE">`, preventing generic LLM hallucinations from overriding user-declared mastering targets, legal red lines, or brand aesthetic bans.
- **Legal Protection Strategy:**
  - **Patent Candidate:** System and method for bi-directional co-authored dynamic playbook inheritance and multi-tier prompt precedence in autonomous multi-agent swarms.
  - **Trademarks:** `Artist Master Directive™`, `Living Skill Protocol™`, `Studio DNA Playbook™`.
  - **Trade Secret:** AST-merging and Conductor reflection/distillation algorithms for user preference extraction.

---

## 3. Intellectual Property Asset Classification Summary

| Asset Name | Legal Form | Status | Owning Entity |
|---|---|---|---|
| **indii / indii.music** | Trademark (Classes 009, 041) | Registered / In Use | New Detroit Music LLC |
| **Connected Intelligence©** | Trademark & Copyright | In Use / Documented | New Detroit Music LLC |
| **The Freedom Principle©** | Trademark & Copyright | In Use / Documented | New Detroit Music LLC |
| **Sonic DNA©** | Trademark & Copyright | In Use / Documented | New Detroit Music LLC |
| **Brand Guard©** | Trademark & Copyright | In Use / Documented | New Detroit Music LLC |
| **indii Conductor©** | Trademark & Copyright | In Use / Documented | New Detroit Music LLC |
| **Project White Glove©** | Service Mark & Copyright | In Use / Documented | New Detroit Music LLC |
| **Format Foundry©** | Trademark & Copyright | In Use / Documented | New Detroit Music LLC |
| **Digital Handshake©** | Trademark & Copyright | In Use / Documented | New Detroit Music LLC |
| **indii Product Skills© / Studio Skills™** | Trademark (Classes 009, 042) | In Use / Documented | New Detroit Music LLC |
| **The Sonic Director© / The Sonic Director™** | Trademark (Classes 009, 041, 042) | In Use / Documented | New Detroit Music LLC |
| **The Boardroom© / Boardroom Meta-Harness™** | Trademark (Classes 009, 042) | In Use / Documented | New Detroit Music LLC |
| **Artist Master Directive™ / Living Skill Protocol™** | Trademark (Classes 009, 042) | In Use / Documented | New Detroit Music LLC |
| **Spectral Cutoff Audio Fraud Gate** | Patent Candidate / Trade Secret | Implemented & Tested | New Detroit Music LLC |
| **Multi-Agent Context Propagation Protocol** | Patent Candidate / Trade Secret | Implemented & Tested | New Detroit Music LLC |
| **Write-Only Ad Executor & Halt Switch** | Trade Secret | Implemented & Tested | New Detroit Music LLC |
| **3-Tier Waterfall & Tax Lockdown Engine** | Trade Secret / Copyright | Implemented & Tested | New Detroit Music LLC |
| **Ephemeral LAN WebSocket Vault Pairing** | Trade Secret | Implemented & Tested | New Detroit Music LLC |
| **Hermetic Progressive Disclosure & Playbook Bundling** | Patent Candidate (IP-PROCESS-006) | Implemented & Documented | New Detroit Music LLC |
| **Dual-State Dynamic Invocability & Tool Sandboxing** | Patent Candidate (IP-PROCESS-007) | Implemented & Documented | New Detroit Music LLC |
| **Multi-Domain Harness Conflict Reconciliation** | Patent Candidate (IP-PROCESS-008) | Implemented & Documented | New Detroit Music LLC |
| **Bi-Directional Dynamic Playbook Inheritance Protocol** | Patent Candidate (IP-PROCESS-009) | Implemented & Documented | New Detroit Music LLC |
| **indii Conductor 27 Domain Playbook Corpus** | Copyright (Form TX: IP-COPYRIGHT-001) | Authored & Verified | New Detroit Music LLC |
| **Product Skills Manual & Runtime Architecture** | Copyright (Form TX: IP-COPYRIGHT-002) | Authored & Verified | New Detroit Music LLC |

---

**Certified & Maintained by:** New Detroit Music LLC  
**Founder:** William Roberts  
**Review Cadence:** Quarterly / Pre-Funding / Pre-Acquisition Diligence


