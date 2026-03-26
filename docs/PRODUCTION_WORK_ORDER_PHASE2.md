# indiiOS Production Work Order — Phase 2 (Ongoing Improvements)

**Generated:** 2026-03-26 | **Source:** CEO Deep-Dive Review | **For:** Execution Agents

> All items are **equal value**. Execute in the order listed below — this order is intentional.
>
> **Phase 1** (ship blockers + critical quality) is in: [PRODUCTION_WORK_ORDER.md](./PRODUCTION_WORK_ORDER.md)

---

## WO-11: Type Safety Sprint (568 `as any` casts)

**Target:** Eliminate 50 per sprint across the service layer.

**Priority order by impact:**

1. **Agent service files** — type errors propagate into AI responses and tool calls
   - `src/services/agent/` (253 files — largest service directory)
2. **Distribution/DDEX** — type errors corrupt industry-standard XML
   - `src/services/distribution/` (43 files)
   - `src/services/ddex/` (31 files)
3. **Payment/subscription** — type errors affect billing
   - `src/services/payment/` (3 files)
   - `src/services/subscription/` (10 files)
4. **AI service files** — type errors affect model calls
   - `src/services/ai/` (53 files)

**How to find them:**

```bash
grep -rn "as any" src/services/ --include="*.ts" | grep -v ".test."
```

**Replacement strategy:** Use specific types from `src/types/`, create new types where needed, use `unknown` + type guards for truly dynamic data.

---

## WO-12: Structured Logging Expansion

**Current state:** 11 core files migrated from `console.*` to `logger.*` (via `@/core/logger/Logger`).

**Remaining:** All other service and module files still use raw `console.log`, `console.error`, etc.

**Action:**

1. Run `grep -rl "console\.\(log\|error\|warn\|info\)" src/services/ --include="*.ts" | grep -v ".test." | wc -l` to count remaining files
2. Replace `console.log` → `Logger.info(category, message, ...data)`
3. Replace `console.error` → `Logger.error(category, message, ...data)`
4. Replace `console.warn` → `Logger.warn(category, message, ...data)`
5. Import: `import { Logger } from '@/core/logger/Logger';`
6. Use meaningful category strings (e.g., `'Distribution'`, `'Agent'`, `'Payment'`)

**Priority order:**

1. `src/services/distribution/` — revenue-critical path
2. `src/services/agent/` — agent debugging visibility
3. `src/services/payment/` + `src/services/subscription/` — billing audit trail
4. `src/services/ai/` — model call tracing
5. Everything else

---

## WO-13: i18n Coverage Expansion

**Current state:** `react-i18next` framework wired. Only Sidebar component is translated.

**Action:**

1. Audit all user-facing strings in each module's root component and key subcomponents
2. Extract strings into locale files under `src/locales/` (or wherever the i18n config points)
3. Replace hardcoded strings with `t('key')` calls
4. Set up at least `en` as the base locale

**Priority order:**

1. Onboarding flow — first impression for new users
2. Agent workspace (main hub) — daily-use surface
3. Distribution module — revenue-critical
4. Dashboard — home screen
5. Settings — account management
6. All other modules

---

## WO-14: Bundle Size Audit

**Context:** 260K LOC across 1,481 files with 34 lazy-loaded modules. Vite builds with terser minification (console/debugger stripped).

**Action:**

1. Run `npm run build` and record output bundle sizes
2. Use `npx vite-bundle-visualizer` to generate a treemap
3. Identify:
   - Largest chunks (> 500KB)
   - Duplicate dependencies across chunks
   - Libraries that aren't properly tree-shaken (Three.js, Fabric.js, Remotion, Recharts)
4. Set chunk size budgets in `vite.config.ts`
5. Verify lazy loading is working — no module code should appear in the initial bundle

**Risk areas:**

- `three` (Three.js) + `@react-three/fiber` — large 3D library, only used by some modules
- `remotion` — video rendering library, should be lazy-loaded
- `fabric` — canvas library, only used by creative module
- `wavesurfer.js` + `essentia.js` — audio libraries, only used by tools/analysis

---

## WO-15: Creative Studio + Video E2E Tests

**Context:** Creative (48 files) and Video (67 files) are the two largest modules but have minimal E2E test coverage.

**Action:**

### Creative Studio E2E

- Test image generation flow: prompt → generate → display in canvas
- Test outpainting: upload image → extend → save
- Test asset management: create → rename → delete
- Test brand kit integration: brand colors applied to generation

### Video Studio E2E

- Test idea-to-brief flow: describe idea → generate brief → review
- Test Director's Cut QA flow: generate → review frames → approve/reject
- Test Veo 3.1 integration: verify API calls are made correctly
- Test video export/download

**Files:** Add to `e2e/` directory following existing spec patterns (see `e2e/distribution-workflow.spec.ts` for reference).

---

## WO-16: Desktop Auto-Update Channel

**Context:** Electron packaging works for macOS (DMG/ZIP), Windows (NSIS), Linux (AppImage). Auto-update channel is not configured.

**Action:**

1. Configure `electron-updater` in `electron/main.ts`
2. Set up a release channel (GitHub Releases or Firebase Hosting)
3. Add update notification UI in the desktop wrapper
4. Test update flow: v1.0 installed → v1.1 published → app detects and prompts
5. Support differential updates if possible (minimize download size)

**Files:**

- `electron/main.ts` — add auto-update initialization
- `electron-builder.json` — configure publish/release target
- New: `electron/autoUpdater.ts` — update checking and notification logic

---

## WO-17: Music Training Data Review

**Context:** `docs/agent-training/datasets/music.jsonl` contains 122 training examples. Some may contain production-focused scenarios (mix feedback, production coaching) that conflict with indiiOS's scope.

**Action:**

1. Read every example in `music.jsonl`
2. Flag any scenario that involves:
   - Mix feedback or production coaching
   - DAW-specific guidance (Logic, Ableton, FL Studio)
   - Sound design or synthesis advice
   - Mixing/mastering technique recommendations
3. Rewrite flagged scenarios to focus on:
   - Audio DNA interpretation (BPM, key, mood, energy)
   - Distribution metadata recommendations
   - Marketing angle suggestions based on track DNA
   - DSP compliance checking
4. Maintain the 100-example minimum target

---

## WO-18: Analytics Real Data Wiring

**Context:** Analytics module (11 files in `src/modules/analytics/`) exists but likely uses mock or placeholder data.

**Action:**

1. Audit current data sources in analytics components
2. Wire to real data:
   - Firestore queries for user activity metrics
   - Stripe API for revenue/subscription metrics
   - Distribution service for delivery/streaming stats
   - Agent usage patterns from memory/logging services
3. If BigQuery pipeline exists, connect analytics views to it
4. Replace any hardcoded sample data with live queries

**Files:** `src/modules/analytics/`, `src/services/analytics/` (10 files)

---

## WO-19: DAW Onramp Integration

**Context:** `DAWIntegrationService.ts` exists but needs connections to real DAW export formats.

**Action:**

1. Support importing finished tracks from common export formats:
   - WAV/AIFF (standard lossless from any DAW)
   - FLAC (common archival format)
   - MP3/AAC (compressed delivery)
2. Parse DAW project metadata if available:
   - Logic Pro: `.logicx` project metadata (BPM, key, markers)
   - Ableton Live: `.als` project metadata
   - FL Studio: `.flp` project metadata
3. Auto-populate distribution metadata from DAW project files when possible
4. Validate audio specs against DSP requirements on import

**Note:** indiiOS does NOT open DAW projects for editing — it only reads metadata from exported files to streamline the distribution pipeline.

---

## WO-20: indiiREMOTE UX Polish

**Context:** Firestore relay works (migrated from WebSocket in recent sprint). Needs expanded command vocabulary and UX refinement.

**Action:**

1. Expand command vocabulary:
   - Navigation: switch modules, open specific views
   - Agent: trigger agent actions, send prompts
   - Creative: start/stop generation, approve/reject
   - Playback: control audio preview, skip tracks
   - Quick actions: mirror the 10 action cards from the main hub
2. Add haptic feedback on mobile (vibration API)
3. Add connection status indicator (connected/reconnecting/offline)
4. Add session persistence (reconnect after app background/resume)
5. Polish touch targets for mobile (minimum 44x44px)

**Files:**

- `src/modules/mobile-remote/` (7 files)
- `src/services/pod/` (4 files — relay service)

---

## Summary

| WO | Description | Scope |
|----|-------------|-------|
| WO-11 | Type safety sprint | 568 `as any` casts, 50/sprint |
| WO-12 | Structured logging expansion | All service files |
| WO-13 | i18n coverage | All user-facing strings |
| WO-14 | Bundle size audit | 260K LOC, tree-shaking verification |
| WO-15 | Creative + Video E2E tests | 2 major modules |
| WO-16 | Desktop auto-update | Electron updater config |
| WO-17 | Music training data review | 122 JSONL examples |
| WO-18 | Analytics real data wiring | 11 module + 10 service files |
| WO-19 | DAW onramp integration | Import format support |
| WO-20 | indiiREMOTE UX polish | 7 module + 4 service files |
