# Unfinished Work Investigation Handoff

## Status
**INVESTIGATION COMPLETE — NO CODE CHANGES YET.** Inventory of all unfinished work in indiiOS-Clean as of 2026-04-28. For other agents to triage and pick up. Companion to `PLAYWRIGHT_FAILURE_HANDOFF.md`.

**Date:** 2026-04-28
**Scope:** Source TODOs, roadmap checklists, skipped tests, disabled features, in-flight handoffs.

---

## TL;DR

The codebase is **surprisingly clean at the code level** — only 1 real `TODO:` comment in all of `packages/renderer/src/`. The unfinished work lives almost entirely in **roadmap/handoff markdown docs** (140+ unchecked checklist items across 4 docs) and in **defensive `test.skip()` calls** that silently mask broken UI flows.

**Three areas need attention:**

1. **Roadmap fragmentation.** `MASTER_WORKSHEET.md` (30 items), `WORKSHEET.md` (73 items), `ADVANCED_IMPROVEMENTS_ROADMAP.md` (32 items), and `task.md` overlap heavily — same `thoughtSignature` work appears in 3 docs. No single source of truth for "what's next."
2. **In-flight Phase 1 handoff stalled.** `PHASE_1_HANDOFF.md` says "3 of 9 core files created" for the LivingPlan substrate — 6 remaining files, with explicit list and file paths.
3. **Silent test coverage gaps.** ~50 `test.skip()` calls in `e2e/` that bail out when selectors aren't visible — masking broken module navigation (see `PLAYWRIGHT_FAILURE_HANDOFF.md` Fix 2).

---

## 1. Code-level TODOs (1 marker total)

After grepping with strict word-boundary regex (`(// | /* | *) (TODO|FIXME|HACK|WIP)\b`), the only real TODO comment in the source tree is:

| File | Line | Marker |
|---|---|---|
| `packages/renderer/src/services/memory/PersistentMemoryService.ts` | 149 | `// TODO: Implement vector embedding and semantic indexing` |

The earlier 197-match count from a looser regex was almost entirely false positives — `XXX` appearing in ISWC/ISRC format placeholders (`PA-DPIDA-XXXXXXXXXX-X`, `CC-XXX-YY-NNNNN`), the SSN-redaction regex, and Spanish/English locale string keys.

---

## 2. Roadmap docs — unchecked checklist items

| Doc | Unchecked | Done | Notes |
|---|---|---|---|
| `MASTER_WORKSHEET.md` | 30 | 0 | Dated 2026-04-24, "canonical execution worksheet, top-to-bottom" |
| `WORKSHEET.md` | 73 | 0 | More granular version of MASTER, heavy overlap |
| `ADVANCED_IMPROVEMENTS_ROADMAP.md` | 32 | 0 | PWA, observability, SDK rollout |
| `docs/BUILD_PLAN.md` | 5 | 1 | Almost done |
| `task.md` | ~10 (Phase 0–2) | 0 | "Indii Agent System v2" — Phase 0 cleanup → Phase 1 LivingPlan |
| `veo_3_1_execution_notepad.md` | many | 0 | Veo 3.1 platinum integration plan |

**Other docs with `[ ]` checklist items:** `CF_V2_MIGRATION_GUIDE.md`, `CONTRIBUTING.md`, `docs/API_CREDENTIALS_POLICY.md`, `docs/DATABASE_PLATINUM_PROTOCOL.md`, `docs/DDEX_IMPLEMENTATION_PLAN.md`, `docs/FIRESTORE_MIGRATION_STRATEGY.md`, `docs/DISASTER_RECOVERY_RUNBOOK.md`, `docs/FIREBASE_AUTH_MIGRATION_NOTES.md`, `docs/PLATINUM_POLISH_REPORT.md`, `docs/KNOWN_GAPS.md`, `docs/KEY_ROTATION_RUNBOOK.md`, `docs/LEGAL_REVIEW_CHECKLIST.md`, `docs/MOBILE_IMPROVEMENTS.md`, `docs/PUBLISHING_DASHBOARD_INTEGRATION.md` — these are runbooks/policy docs, not work backlogs.

### 2a. Highest-priority cluster: `thoughtSignature` propagation

This single theme appears in `MASTER_WORKSHEET.md` (Step 1), `WORKSHEET.md` (Step 1), and is sourced from `docs/implementation_plan_ai_refinement.md`. Concrete items:

- Update `src/types/ai.dto.ts` to include `thoughtSignature` in all content parts and streaming chunks
- Modify `src/services/ai/AIService.ts` and `src/services/ai/FirebaseAIService.ts` to inject/extract it
- Update `src/services/agent/BaseAgent.ts` to preserve it across multi-turn function calls
- Fix `vite-env.d.ts` env-var typings, harmonize `Project` interface, resolve IPC payload typings
- Goal: `npm run typecheck` returns 0 errors

**Why prioritize:** 3 docs reference it; type-safety blocker for downstream Veo/agent work.

### 2b. Phase 0 cleanup (from `task.md`)

Three small concrete items, half-day:

- [ ] Fix the 5 `FoundersPortal` typecheck errors → file at `packages/renderer/src/modules/founders/FoundersPortal.tsx`
- [ ] Pin the `RateLimiter.test.ts:59` flake → `packages/renderer/src/services/ai/RateLimiter.test.ts:59`
- [ ] Document `HybridOrchestrator` deprecation → already removed from runtime; only referenced in `CHANGELOG.md`, `docs/specifications/DNA_BLUEPRINT.md`, and one memory log. Just need a note.

### 2c. Agent function declarations (`WORKSHEET.md` Step 2)

Several agents have tools declared but not implemented in their `functions` execution block:

- **Publicist Agent** — `create_campaign`, structured returns for `write_press_release`, `generate_crisis_response`, `pitch_story`
- **Brand Agent** — `analyze_brand_consistency`, `generate_brand_guidelines`, `audit_visual_assets`
- **Marketing Agent** — `create_campaign_brief`, `analyze_audience`, `schedule_content`
- **Road Agent** — `plan_tour_route`, `calculate_tour_budget`, `generate_itinerary`
- **Security Agent** — `audit_permissions`, `scan_for_vulnerabilities`

### 2d. Veo 3.1 integration

Sprawling cross-document plan. Canonical source: `veo_3_1_execution_notepad.md` (Phase 1–4). Includes:

- Backend: `generateVideoFn` in `functions/src/index.ts` connecting Vertex AI Veo-3.1, `VideoJobs` Firestore collection
- UI: `VideoPromptBuilder`, `IngredientDropZone` (up to 3 images / 1 base video), `VideoGenerationControls`, `VideoGenerationProgress` non-blocking task card
- Editor: Transitions, VFX, audio waveform via `@remotion/media-utils`, basic keyframing
- Export: `/api/video/render` endpoint via `@remotion/renderer`, "Download MP4" wiring

### 2e. PWA / SDK / observability (`ADVANCED_IMPROVEMENTS_ROADMAP.md`)

Verification-style checklist — service worker, offline mutation queue, IndexedDB media cache, Cloud Functions v2 SSE streaming, RUM metrics, bundle analysis, REST API + webhooks, TypeScript SDK to npm, OpenAPI docs. None of the boxes are checked, so unclear what's actually done vs not.

---

## 3. In-flight handoff: LivingPlan Phase 1 (3 of 9 done)

`PHASE_1_HANDOFF.md` says:

> 3 of 9 core files created. Ready for next agent to continue.

**✅ Done:**
- `packages/renderer/src/services/agent/LivingPlanService.ts`
- `packages/renderer/src/core/store/slices/livingPlanSlice.ts`
- `packages/renderer/src/services/project/ProjectService.ts`

**⏳ Still needed:**
- `packages/renderer/src/core/store/slices/projectSlice.ts`
- `packages/renderer/src/core/components/sidebar/ProjectList.tsx`
- Wire-up in `AgentService.ts` — detect `{ kind: 'plan', draft }` output
- Wire-up in `PromptArea.tsx` — inject `PlanCard` into chat
- Firestore schema migration — add `projects/{pid}/livingPlans/` subcollections
- E2E test — plan flows agent → card → approval

`AGENT_BRIDGE.md` shows a separate parallel track: `STATUS: QA_IN_PROGRESS` since 2026-04-15 (~2 weeks stale).

---

## 4. Skipped E2E tests (~50 calls)

Most are **conditional defensive skips** — bail out when an expected selector isn't visible. They silently mask broken UI flows rather than failing loudly. Files affected:

`brand`, `memory-agent`, `files`, `road-manager`, `workflow`, `history`, `publicist`, `marketplace`, `campaign`, `analytics`, `knowledge`, `merch`, `audio-analyzer`, `social`, `chaos`, `chat-interaction`, `observability`, `indii-growth-protocol`, `navigation`, `maestro-workflows`.

**Pattern:**
```ts
const isVisible = await locator.isVisible().catch(() => false);
if (!isVisible) { test.skip(); return; }
```

This is tightly coupled to the module-navigation issue documented in `PLAYWRIGHT_FAILURE_HANDOFF.md` Fix 2: if `page.goto('/<module>')` doesn't actually mount the module (because navigation is store-driven, not route-driven), every selector check fails and the test silently skips. **Fixing the navigation issue will turn many of these skips into either passes or real failures** — either is more useful than silent skips.

**Truly intentional skips (keep these):**
- `e2e/stress-test-new-user.spec.ts:381` — skipped when `TEST_EMAIL`/`TEST_PASSWORD` env vars absent
- `e2e/navigation.spec.ts` — `if (isMobile) test.skip()` for desktop-only assertions

---

## 5. Disabled / placeholder features (intentional or stub)

### From `docs/KNOWN_GAPS.md` (intentional, documented for diligence)

1. **Stripe Tax Forms** — `functions/src/stripe/taxForms.ts` (39 LOC) returns mock `{ status: "Requested", url: null, signedAt: null }`. Triggered by GMV > $25K/month or >50 active artists. Effort: 2–3 weeks.
2. **Blockchain Smart Contract Suite** — fully removed from runtime; config flags exist but no-op. Pursued only on explicit business decision.
3. **TBD by William** — placeholder section #3, never filled in.

### Found in code (lower-signal placeholders)

- `packages/renderer/src/services/analytics/AppleMusicService.ts:25` — "Placeholder for future Apple Music for Artists API when documented"
- `packages/renderer/src/services/analytics/PlatformDataService.ts:43-44` — `apple_music` and `instagram` flags marked "MusicKit OAuth TBD" / "Meta API TBD"
- `packages/renderer/src/modules/analytics/components/PlatformConnector.tsx:15` — "Apple Music (MusicKit — coming soon)"
- `packages/renderer/src/modules/onboarding/OnboardingModal.tsx:124` — "Convert files to base64 if needed (simplified for now, just passing empty array as placeholder)"
- `packages/renderer/src/components/shared/AudioWaveformViewer.tsx:6` — "If no url is provided, use a placeholder or silent dummy"

### From user memory (corroborated)

- Payment service intentionally disabled
- Blockchain service uses mock addresses/hashes
- ESLint `rules-of-hooks` and `exhaustive-deps` are OFF — recommended re-enable as a stretch goal

---

## 6. Uncommitted state

```
?? PLAYWRIGHT_FAILURE_HANDOFF.md
```

Just the playwright handoff from earlier in this session. Now `UNFINISHED_WORK_HANDOFF.md` will join it.

No active feature branches diverged from `main` — only `release-please` automation branch and `main` itself.

---

## Proposed triage order (for next agent — no work yet)

The fastest path to a clean baseline:

### Tier 1 — Unblock everything else (≤ 1 day)
1. **Resolve `PLAYWRIGHT_FAILURE_HANDOFF.md` Fix 1** (dev-server stability). Without this, no test signal is reliable.
2. **Phase 0 cleanup from `task.md`**: 5 FoundersPortal typecheck errors, RateLimiter.test.ts:59 flake, HybridOrchestrator deprecation note. Half a day.
3. **Consolidate roadmap docs.** `MASTER_WORKSHEET`, `WORKSHEET`, and `task.md` overlap — pick one, mark the others "see X for canonical list". 1 hour of doc surgery saves agents from picking different docs and stepping on each other.

### Tier 2 — Highest-leverage code work (2–3 days)
4. **`thoughtSignature` propagation** — type-safety blocker referenced by 3 docs. Items 1.1–1.7 in `WORKSHEET.md`.
5. **Finish LivingPlan Phase 1** (per `PHASE_1_HANDOFF.md`) — concrete, scoped, 6 files left.
6. **Resolve `PLAYWRIGHT_FAILURE_HANDOFF.md` Fix 2** (`direct-view-btn` / module nav) — converts ~50 silent test.skip()s into real signal.

### Tier 3 — Feature work (≥ 1 week each)
7. Agent function declarations (Publicist, Brand, Marketing, Road, Security)
8. Veo 3.1 integration (per `veo_3_1_execution_notepad.md`)
9. PWA / observability / SDK rollout (`ADVANCED_IMPROVEMENTS_ROADMAP.md`) — verify what's actually done first; many checkboxes may already be true.

### Tier 4 — Deferred by design (don't touch unless triggered)
10. Stripe Tax Forms (`docs/KNOWN_GAPS.md` #1) — only when GMV/artist thresholds hit
11. Blockchain (`docs/KNOWN_GAPS.md` #2) — only on explicit business decision
12. Apple Music for Artists, MusicKit OAuth, Meta/Instagram API — pending external API access

---

## Verification (for agents auditing this report)

To confirm any finding above:

```bash
cd /Volumes/X\ SSD\ 2025/Users/narrowchannel/Desktop/indiiOS-Clean

# Confirm 1 real TODO
rg -n "(//|/\*|\*) *(TODO|FIXME|HACK|WIP)\b" packages/renderer/src/ src/ functions/ electron/

# Confirm checklist counts
for f in MASTER_WORKSHEET.md WORKSHEET.md ADVANCED_IMPROVEMENTS_ROADMAP.md task.md docs/BUILD_PLAN.md veo_3_1_execution_notepad.md; do
  echo "$f: $(grep -c '^\s*-\s*\[ \]' "$f") unchecked, $(grep -c '^\s*-\s*\[x\]' "$f") done"
done

# Confirm test.skip count
rg -c "test\.skip\(\)" e2e/

# Confirm KNOWN_GAPS sections
grep "^## " docs/KNOWN_GAPS.md
```

---

## Provenance

Investigation by Claude Opus 4.7 on 2026-04-28, parallel to `PLAYWRIGHT_FAILURE_HANDOFF.md`. No code was changed. Source docs read: `MASTER_WORKSHEET.md`, `WORKSHEET.md`, `ADVANCED_IMPROVEMENTS_ROADMAP.md`, `task.md`, `veo_3_1_execution_notepad.md`, `docs/BUILD_PLAN.md`, `PHASE_1_HANDOFF.md`, `AGENT_BRIDGE.md`, `docs/KNOWN_GAPS.md`. Source greps: TODO/FIXME word-boundary, `test.skip()`, `@ts-ignore`/`@ts-expect-error`, `placeholder`, `coming soon`, intentionally-disabled.
