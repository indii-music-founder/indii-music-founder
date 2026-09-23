# TypeSafe Opportunities — Intelligent Judgment for Fragile Code

**Status:** Opportunity map (analysis only — nothing integrated). Produced per the TypeSafe agent-skill brainstorming prompt; grounded in live docs (docs.typesafe.ai, fetched 2026-09-23: System One, JS SDK v0.6.0, intent-routing/skill-suggestion/guardrails/pre-parsed-extraction cookbooks) and a code survey of `packages/renderer/src`.

**Model:** Jev (System One) = text in → typed answers out. Three primitives: **Choice** (one of a defined set, with probability distribution), **Score** (degree on described levels), **Noul** (probability of yes). Answers carry **confidence**; code owns workflow, thresholds, and escalation.

**Hard repo constraints for any integration:**
1. `TYPESAFE_API_KEY` is a true secret → server-side only (Cloud Functions), never `VITE_*` (API Credentials Policy). Renderer consumers go through a callable proxy (the `ragProxy`/`generateContentStream` pattern already exists).
2. Jev is **text-only** today (no images/audio). Vision-dependent judgments need upstream text/labels first (e.g. vision-model object labels) — TypeSafe then judges over those labels.
3. Deterministic code stays: exact lookups, money math, redaction regexes, ID parsing. TypeSafe only replaces steps that need semantic understanding.
4. Questions, options, and thresholds go in **one reviewable constants file** (per agent-skill "good vibe coding" #3).

---

## Tier 1 — direct cookbook matches, high fragility today

### 1. Skill intent routing — `ProductSkillRegistry.searchProductSkillByIntent`
**Today:** trigger-label word-boundary regexes over 27 bundled playbooks; first keyword hit wins ("distribute" inside an unrelated sentence misroutes); no ranking, no "none apply" outcome.
**Judgment:** Choice over the skill catalog (or two-stage: Noul "does any skill apply?" → Choice among top candidates), state = user query + skill id/name/description/trigger labels.
**Keep in code:** exact `/slash-command` match (deterministic lookup stays first).
**Precedent:** `skill_suggestion` cookbook (rank → re-check over a 182-skill catalog), `intent-routing` pattern. Confidence-gate: low confidence → Conductor generalist (existing fallback).
**Files:** `services/agent/skills/ProductSkillRegistry.ts:309`, consumed by `services/agent/tools/SwarmTools.ts` (consult_product_skill).

### 2. Prompt-injection screening — `intelligence/utils/InputSanitizer.ts`
**Today:** static keyword list with hand-assigned severities ("jailbreak", "ignore previous instructions", …), self-described as *"a heuristic and not a complete firewall"*. Trivially evaded by paraphrase, and presumably false-positives on legit lyrics about "control"/"override".
**Judgment:** guardrails pattern (llm_guardrails cookbook): parallel Nouls over hazard classes (instruction override, credential exfiltration, role hijack) + a severity Score; thresholds in code decide pass / review / block. Existing keyword list stays as the cheap first pass — Jev becomes the second opinion on everything not confidently clean.
**Files:** `services/intelligence/utils/InputSanitizer.ts` (analyzeInjectionRisk), sync-coupled to `python/api/indii_task.py`.
**Note:** this guards the Conductor path — blast radius is the whole agent surface; evaluate on real injection corpora before tightening any block threshold.

### 3. Transient vs logical failure classification — `AgentLoopService.isTransientError`
**Today:** substring list (`'timeout' | '429' | 'network' | …`). A logical agent error containing the word "network" burns retries; a transient error phrased unusually halts the run.
**Judgment:** Noul — "is this failure transient infrastructure (retry with backoff) vs a logical/persistent failure (stop)?" State = error message, error name, HTTP/status codes present, action attempted, retry count.
**Keep in code:** the backoff math and retry-count policy.
**Files:** `services/agent/orchestration/AgentLoopService.ts:156`; sibling heuristic in `services/agent/memory/MemorySummarizer.ts` (429 → fast-path model routing).

### 4. Royalty statement column semantics — foundry adapters
**Today:** distributor statement parsing judges columns by substring: `includes('itunes') || includes('download')` → download sale; `includes('isrc')` / `includes('earning') || includes('total')` → column-loss detection. Every new distributor template is new hand-tuned substrings; "Total Earnings (USD)" vs "Units" distinctions are exactly where mis-mapping corrupts royalty math.
**Judgment:** pre-parsed extraction pattern — deterministic scan proposes candidate columns (name + sample values + position), Jev selects which column is `net_earnings` / `unit_downloads` / `store_name` per statement (Choice with confidence), and Noul checks "did this migration lose earnings data?" for CompatibilityDriftMonitor.
**Guardrail:** money-adjacent → confidence-gated; below threshold surfaces to the artist for confirmation (sovereignty principle) instead of silently mapping.
**Files:** `services/foundry/adapters/DistroKidStatementAdapter.ts:97`, `TuneCoreStatementAdapter.ts:82`, `services/foundry/CompatibilityDriftMonitor.ts:37`; consumed by `FormatForensicsEngine` (Finance forensics tab).

## Tier 2 — real wins, smaller blast radius

### 5. Memory importance scoring — `MemorySummarizer.scoreImportance`
**Today:** keyword bumps (+0.15 for 'deadline', 'isrc'…) layered on an LLM re-rate prompt. The keyword pass double-counts and can't rank "release moved to March 3" vs "likes analog synths".
**Judgment:** composite scoring — parallel atomic Scores (actionability, business criticality, correction signal, permanence), combined by code weights the product can tune without re-prompting. The existing LLM prompt stays as the escalation tier for high-stakes memories.
**Files:** `services/agent/memory/MemorySummarizer.ts:250`.

### 6. Viral-potential estimate — `AnalyticsTools`
**Today:** self-labeled *"static tempo/genre/mood rubric … not a historical-data prediction"*, score /100 with an honesty disclaimer baked into output.
**Judgment:** Score with concretely described levels (rubric-in, calibrated probability out) + a Noul "does this track's profile resemble documented breakout patterns?" so the UI can show estimate vs evidence honestly. Disclosure text stays (truthful capability).

### 7. Collaboration role semantics — `CollaborationSplitsCompiler`
**Today:** `roles.some(r => r.includes('producer'))` — "co-producer", "executive producer" (non-royalty role), "producer/manager" all collapse to one thing; splits correctness depends on it.
**Judgment:** Choice over the split-relevant role taxonomy (producer / co-producer / featured artist / writer / engineer / other), state = raw role strings + collaborator context. Noul "is this role royalty-bearing?" where it matters.
**Files:** `services/collaboration/CollaborationSplitsCompiler.ts:78`.

### 8. Brand compliance logo selection — `BrandComplianceService`
**Today:** first vision object whose label `includes('logo')` wins.
**Judgment:** Choice over the detected object labels + bbox descriptions ("which object is the artist's logo mark?") — text-only works because upstream vision already emitted labels. Confidence below threshold → ask the artist once, cache the answer.
**Files:** `services/brand/BrandComplianceService.ts:111`.

### 9. Event retention tier — `memory/EventLogger.ts`
**Today:** "tier assigned by age heuristic". A Score/Noul over event content (is this a business record vs ambient telemetry?) prevents silently demoting receipts/contract events.
**Files:** `services/memory/EventLogger.ts:70`.

## Keep in code (audited, deliberately not candidates)
- `utils/moduleDeepLink.ts` — already deterministic + validated (URLSearchParams + isValidModule).
- `functions/api/router.ts` `sendHttpErrorResponse` HttpsError→HTTP mapping — pure table.
- `InputSanitizer` secret-redaction regexes — deterministic redaction must never be probabilistic.
- Stripe/royalty arithmetic, `normalizePagination`, cost reservation math.
- Anything whose input is images/audio only (Jev constraint #2).

## Suggested first slice (if pursued)
1. Server-side `typesafeProxy` callable in `packages/firebase/src` (key stays server-side), thin JS SDK call, typed response passthrough.
2. One reviewable constants file `src/config/typesafeJudgments.ts` (questions, options, thresholds) — per agent-skill review principle.
3. Pilot = #3 (transient-error Noul): tiny state, clear ground truth from existing loop outcomes, measurable win (fewer burned iterations), no user-visible surface.
4. Evaluate with historical error/outcome pairs before widening; threshold constants live in the constants file.
