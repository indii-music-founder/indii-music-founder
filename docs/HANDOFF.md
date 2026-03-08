# Session Handoff — 2026-03-08

## Active Branch
`claude/evaluate-app-value-rs0pB`

## Last Commit
`747c34f` — fix: add input validation and remove broken AI code from recoupment_calculator.py

---

## What Was Completed This Session

### P0 — Documentation & E2E Tests
- `CLAUDE.md` corrected (removed false "60+ spec files" claim)
- `playwright.config.ts` — mobile Chrome + Safari projects added
- 10 E2E spec files in `/e2e/`: navigation, chat, agent flows, creative persistence, mobile, distribution, finance, maestro, chaos
- Auth fixture for Firebase bypass in CI

### P1 — Agent Module (`src/modules/agent/`)
- `AgentDashboard` — Chat tab wired to `agentService.sendMessage()` + `PromptArea` + message history
- `SpecialistSelector` — dropdown pulling all 14+ registered agents from `agentRegistry.getAll()`
- `TaskTracker` — live Maestro batch queue board from `agentSlice.batchingTasks`
- `AgentSidebar` — extended from 4 to 6 tabs (`scout`, `browser`, `chat`, `tasks`, `campaigns`, `inbox`)

### P1 — Observability Module (`src/modules/observability/`)
- `ObservabilityDashboard` — 4 tabs: Traces / Metrics / Health / Circuit Breaker
- `MetricsDashboard` — real `MetricsService` data, time range selector, agent breakdown chart
- `HealthPanel` — live pings for Firestore, Agent Zero sidecar, Gemini API; auto-refresh every 30s
- `CircuitBreakerPanel` — surfaces `MembershipService.checkBudget()` state

### P2 — Merchandise (`src/modules/merchandise/`)
- `PODCredentialService` — Firestore-backed API key storage + live validation against Printful/Printify
- `PODIntegrationPanel` — replaced fake `setTimeout` with real modal + `PrintOnDemandService.getProducts()`
- `python/tools/pod_integration_tool.py` — real `httpx` calls to Printful/Printify REST APIs

### P2 — Marketplace Module
- Registered in `MODULE_IDS`, `MODULE_COMPONENTS` (lazy-loaded), and root store
- `marketplaceSlice` — cart state with `addToCart`, `removeFromCart`, `clearCart`, `cartTotal`

### P2 — Python Tools (all deterministic, zero AI calls)
- `isrc_upc_auto_assigner.py` — stdlib only; sequential ISRC counter + EAN-13 UPC check digit
- `waterfall_calculator.py` — input validation, currency normalization
- `recoupment_calculator.py` — full rewrite, deterministic calculation, no LLM calls
- `mechanical_royalties_projection.py` — input validation + bounds checks
- `metadata_qc_auditor.py` — 7-field rule engine (ISRC regex, UPC, genre whitelist, ISO 8601 dates); exits code 1 on failure

---

## What Still Needs Work (suggested next steps)

### High Priority
- [ ] `npm run typecheck` — likely has residual errors from agent module additions; run and fix
- [ ] `npm run lint:fix` — clean up any lint from new files
- [ ] Wire `AgentSidebar` `campaigns` and `inbox` tabs to real data (currently stubbed)
- [ ] Marketplace module needs a UI component (`src/modules/marketplace/index.tsx`) — only the slice exists

### Medium Priority
- [ ] `PODCredentialService` — needs unit tests
- [ ] E2E tests need a running dev server to validate (run `npm run dev` then `npm run test:e2e`)
- [ ] `HealthPanel` — Agent Zero sidecar URL is hardcoded to `localhost:50080`; make it configurable via env var

### Lower Priority
- [ ] `metadata_qc_auditor.py` — genre whitelist is 35 genres; expand to full DSP list
- [ ] `isrc_upc_auto_assigner.py` counter file is in `/tmp/`; make path configurable for production

---

## How to Resume

```bash
git fetch origin claude/evaluate-app-value-rs0pB
git checkout claude/evaluate-app-value-rs0pB
npm install
npm run typecheck   # check for errors first
npm run dev         # start dev server on :4242
```

Then continue from the "What Still Needs Work" list above.
