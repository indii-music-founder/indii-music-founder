# indiiOS — Roadmap

> **Current release:** v1.55.3 (2026-04-23)
> **Next milestone:** Investor-weekend handoff to 10 potential founders

## Phase 0 — Shipped (demo-weekend ready)

Every item below is verified against the codebase at v1.55.3. Nothing aspirational.

### Platform

- [x] **Hub-and-spoke agent architecture** — 21 specialist agents routed by `indii Conductor` (generalist hub)
- [x] **5-layer memory system** — CaptainsLog → CORE Vault → DeepHive → UserAlignment → BigBrain; all layers live at `packages/renderer/src/services/agent/memory/`
- [x] **Cryptographic Agent Identity (GEAP Phase 1)** — SHA-256 fingerprint + base64 attestation per instance at `packages/renderer/src/services/agent/governance/AgentIdentity.ts`
- [x] **Digital Handshake governance** + **Tool Risk Registry** — ~165 tools classified as read / write / destructive
- [x] **Python sidecar** at `localhost:50080` — Docker runtime, 92 custom tools, MCP client, auto-restart on failure
- [x] **Electron desktop (v41.1.1)** — keytar credential vault, SFTP client, code signing, hardened runtime
- [x] **Firebase backend** — Functions 7.0.5 (Node 22 Gen 2), Firestore custom-claims auth, BigQuery analytics, Inngest 3.22 workflows, Stripe 20.1 payments

### Ship-complete feature modules

- [x] **agent** — GenAI routing, warmup system, streaming, message redaction, CircuitBreaker + retry
- [x] **analytics** — dashboard + Firestore event tracking + stream / revenue metrics
- [x] **creative** — canvas editor (Fabric.js), image gen (Direct SDK pipeline, v1.52.2), video producer
- [x] **dashboard** — 3-panel org / project navigation with KPI cards
- [x] **distribution** — 7 real distributor adapters (DistroKid, TuneCore, CDBaby, Symphonic, Believe, OneRPM, UnitedMasters) + DDEX ERN generation + QC checklist + YouTube Content ID
- [x] **finance** — revenue ledger, cost predictor, waterfall payout, subscription quotas
- [x] **marketing** — campaign AI + content calendar + social media integration
- [x] **merchandise** — shop builder + inventory + fulfillment workflow
- [x] **publishing** — release wizard, DSR upload, distributor connections, earnings dashboard
- [x] **video** — Remotion 4.0.445 timeline + VEO API + 682-line workflow
- [x] **workflow** — Genkit orchestration + agent routing + task execution
- [x] **founders** — Stripe-wired founders checkout (`packages/renderer/src/modules/founders/`, 211 lines) — ready for this weekend's 10-investor distribution

### Known external-environment blockers (disclose to investors, not code bugs)

- **SFTP distribution is desktop-only** — web tier returns a hard error at `packages/renderer/src/services/distribution/DeliveryService.ts:315`. Demo on desktop build.
- **YouTube Content ID requires user OAuth2 token** — not automatically populated.
- **End-to-end Spotify submission is untested** — no live Spotify-for-Artists account yet. See Phase 1 "fake / future artist persona."

---

## Phase 1 — Pre-Weekend Hardening (current sprint, ends Saturday 2026-04-25)

### Must-pass before investor handoff

- [ ] **API cascade audit** — systematically test every API-dependent path (Gemini, Vertex, Firestore, Stripe, 7 distributor adapters, Python sidecar health). User observation: "anything API-related almost always affects everything API-related." Document each cascade failure mode.

- [ ] **Partial-module QA sweep** — these 8 modules have UI shells and partial service wiring; each must pass a full investor-demo flow:
  - `capture` — audio ingest pipeline elements
  - `files` — localStorage fallback when FileSystem API unavailable
  - `licensing` — license validation against real mechanical / sync templates
  - `onboarding` — Stripe checkout + org-less signup recovery edge case
  - `registration` — ISRC / UPC + SoundExchange adapters
  - `royalty` — splits editor + waterfall edge cases
  - `social` — Twitter v2 API drift + scheduled retrieval rate limits
  - `touring` — event + day-sheet flow with real venue data

- [ ] **Fake / future artist persona** — set up a test Spotify-for-Artists account + distributor sandbox credentials so distribution can be exercised end-to-end in demos. User is considering this becoming their personal artist identity when they return to music production.

- [ ] **Founders checkout dry run** — full Stripe test-mode transaction through `packages/renderer/src/modules/founders/` before handing codes to 10 investors.

### Concurrent platform work (GEAP Phases 2–4)

Source: `docs/GEMINI_ENTERPRISE_AGENT_PLATFORM.md`

- [ ] **Model Armor (GEAP Phase 2)** — inline prompt-injection defense in `DigitalHandshake.require()` + output DLP scanning for API keys / PII / internal paths.
- [ ] **Memory Bank integration (GEAP Phase 3)** — migrate episodic layers (CaptainsLog, DeepHive) to Google Memory Bank; keep CORE Vault local as our moat.
- [ ] **Graph-based orchestration (GEAP Phase 4)** — replace sequential `OrchestrationService.runSteps()` with ADK-style parallel branching + conditional edges + cycle detection.

---

## Phase 2 — Post-Investor Feedback

Driven by what the 10 founders actually touch and break:

- Promote any Phase 1 partial modules that hit production usage to Phase 0 once QA confirms ship-ready.
- Address investor feature requests that align with the "independents only, pick up where mastering ends" scope — reject anything outside that boundary.
- **SFTP web-tier workaround** — evaluate whether to build a cloud-relay service so web-tier users can initiate SFTP deliveries via a trusted proxy, or keep it desktop-only as a deliberate product boundary.

---

## Phase 3 — Stubs and utility modules

The following 18 modules currently exist as stubs, utility views, or minimal shells. Most do not need to be complete for the investor weekend. Prioritize based on post-demo feedback:

`boardroom`, `debug`, `design`, `desktop`, `history`, `investor`, `knowledge`, `legal`, `marketplace`, `memory`, `mobile-remote`, `observability`, `publicist`, `select-org`, `settings`, `tools`, `web3`, `video-popout`.

Some of these (`debug`, `select-org`, `settings`) are intentionally small utility views and may never need more than they have. Others (`publicist`, `marketplace`, `observability`) have meaningful product roadmaps attached.

---

## Phase 4 — GEAP completion + Agent Security Dashboard

Remaining gaps from `docs/GEMINI_ENTERPRISE_AGENT_PLATFORM.md:56-60`:

- [ ] **Multi-turn autoraters** — automated conversation-quality scoring for every agent interaction.
- [ ] **Agent Security Dashboard** — unified threat-detection view combining Model Armor events, identity audit trail, tool-execution logs.
- [ ] **Auto-extracted Memory Profiles** — implicit preference extraction from conversations (complement to explicit `UserMemoryService`).
- [ ] **Agent Optimizer** — Google-side model tuning feedback loop.

---

## Release discipline

- Conventional commits → `release-please` automation on `main`
- Every PR must pass `/plat` pre-flight (platinum quality standards)
- Error Ledger lookup mandatory before debugging any reported bug (`.agent/skills/error_memory/ERROR_LEDGER.md`)
- Pre-demo QA uses Google Antigravity for live browser verification; CI uses Playwright (chromium only, 1 worker, `e2e/` directory)
