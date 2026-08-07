# Evolas Build Plan

Adaptive persona system for indii's agent swarm. Music-industry role personas
(Manager, Contract Reader, A&R, Publicist, Distributor, Business Manager,
Producer, Publisher) with dial-based personality control, style-only
adaptation from user ratings, and a measurement harness that proves the dials
do something instead of assuming it.

Source: full research pass, 2026-08-06 (persona engineering, sycophancy/failure
modes, Gemini/Vertex stack specifics, music-industry archetype grounding,
competitive landscape). This file is the actionable distillation — build
against this, not the chat history.

## Non-negotiables (product rule for this system — every phase, every fix)

1. **Ratings move style, never substance.** A rating can change verbosity,
   directness, warmth, jargon level. It can never change a verdict, a risk
   assessment, a number, or a caveat. Enforce this structurally: substance is
   generated once by a frozen, non-personalized call as a typed object
   (`{verdict, risk_level, caveats[], escalate}`); a separate style layer
   renders it. The style layer never sees the raw question — it can't delete
   what it never had.
2. **No per-user weight tuning.** Not now, not at T3. Personalization is
   retrieval + bounded typed parameters + (later) a bandit over fixed fader
   positions. Never fine-tune a model on one user's approval data — narrow
   finetuning on sycophancy-shaped data is documented to produce broad
   misalignment.
3. **Every persona names its own conflict of interest.** Manager is paid on
   gross. Lawyer-equivalent persona is not called "Lawyer" (regulatory —
   see #4) and must be able to say "I am not neutral here" or "I can't tell
   you that."
4. **No persona named "Lawyer," "Attorney," or equivalent.** Call it
   "Contract Reader" / "Deal Literacy." Never claim or imply substitution for
   counsel. Hard-refuse "should I sign this," "will I win," jurisdiction-
   specific conclusions.
5. **Faders are professional posture, not personality trait.** Label axes
   "risk tolerance," "brevity," "how hard it advocates its own position" —
   not "aggressive," "friendly." The latter is a proven mechanism for
   stereotyped/degraded reasoning and caricature; the former is defensible
   and evaluable.
6. **No genre-based dialect switching.** A persona's *knowledge* can flex by
   genre (Nashville vs. LA norms). Its *register* never code-switches by
   genre or user identity. Documented mechanism for degraded advice
   delivered to the users least served by the industry.
7. **A frozen canary suite gates every persona-prompt promotion.** Includes:
   sycophancy pushback probes, style-invariance checks (substance identical
   across all style renders), disclaimer-retention checks, off-domain
   alignment probes. A version that improves ratings but regresses canary
   does not ship.

## Phase T1 — ship in weeks, prompt + retrieval only, no new infra beyond Firestore

Target: fader system exists, produces measurably different output, ratings
adjust style only, nothing fine-tuned, nothing self-hosted.

### T1.1 — Fader data model
- New Firestore collection: `users/{uid}/personaFaders/{personaId}` —
  5 axes, 0–100 each, per persona, per user. Default = population midpoint.
- Axes (v1, pick from music-archetype research): risk tolerance, brevity,
  directness, formality, how much it explains reasoning.
- File target: `packages/shared/src/types/PersonaFaders.ts` (schema),
  `packages/firebase/firestore.rules` (owner-only read/write).

### T1.2 — Prompt compiler (fader value → language, never raw numbers)
- Pure function: `compilePersonaPrompt(personaId, faderValues) → string`.
- Quantize each axis to 5 bands internally (0–20/21–40/41–60/61–80/81–100).
  Map each band to a calibrated adjective/qualifier phrase, not the number.
  Numbers appear only as a secondary ordinal cue, never as the sole signal.
- Hand-author reconciliation clauses for fighting pairs (e.g., high-directness
  + high-formality needs an explicit "direct in substance, professional in
  delivery" clause) — traits are not orthogonal, this is empirically
  documented, don't skip it.
- File target: `packages/renderer/src/services/persona/PersonaPromptCompiler.ts`

### T1.3 — Style/substance split (the load-bearing piece)
- Two-call pattern per persona response:
  1. Non-personalized call → structured verdict object (`responseSchema`
     constrained JSON via Gemini).
  2. Personalized call → renders the verdict object in the compiled persona
     voice. This call cannot alter `verdict`/`risk_level`/`caveats`/`escalate`
     fields, only prose around them.
- CI check: for every canary prompt, render at all 5 band positions on all
  axes, assert extracted verdict fields are byte-identical across renders.
- File target: `packages/renderer/src/services/persona/PersonaResponseService.ts`

### T1.4 — Context caching (cost control, not optional at any real volume)
- Shared persona system prompt → `CachedContent` with `systemInstruction`,
  one cache per persona (not per user). Per-user fader block goes in
  `contents`, after the cache reference — never inside the cached prefix.
- Minimum cacheable size on Flash: 1024 tokens — persona prompts should
  clear this comfortably once archetype grounding is included.
- File target: `packages/firebase/src/lib/PersonaCacheManager.ts` — **not**
  `packages/renderer` (corrected 2026-08-07, see ISSUE-1314). This repo
  enforces a hard backend-only AI architecture
  (`docs/BACKEND_ONLY_API_DECLARATION.md`, CI-checked): no Gemini/Vertex
  client, key, or endpoint may exist in the renderer bundle. Caching uses
  the existing `getVertexAIClient()` ADC singleton from
  `packages/firebase/src/lib/vertexClient.ts` — the same pattern every other
  backend AI call in this repo already follows. Genkit 1.26 still has no
  explicit-cache API, so this remains the documented escape hatch — just
  correctly scoped to where raw `@google/genai` usage already legitimately
  lives in this codebase.

### T1.5 — Measurement harness (build this before trusting any fader)
- Semantic Similarity Rating pattern: 5 human-written anchor texts per axis
  per band. Embed responses for similarity, not retrieval. Score = closest
  anchor band by average cosine similarity across that band's anchors.
- Store `{setPosition, measuredPosition}` per response for telemetry — this
  is what proves a fader does something instead of assuming it.
- File target: `packages/firebase/src/lib/PersonaMeasurement.ts` — **not**
  `packages/renderer` (corrected 2026-08-07, same reason as T1.4: embedding
  is a Gemini/Vertex call, backend-only per
  `docs/BACKEND_ONLY_API_DECLARATION.md`). Also uses this repo's own
  existing embedding model (`text-embedding-004`, 768-dim, already
  configured in `packages/shared/src/schemas/knowledge.ts` for the
  knowledge/RAG feature) rather than introducing a second embedding model —
  "Gemini Embedding 2" in the original plan text was carried over from
  generic research and was never verified against what this repo actually
  has configured.
- **This is the single highest-leverage item in T1.** Without it nothing
  downstream is verifiable.

### T1.6 — Implicit feedback instrumentation (higher-signal than star ratings)
- Log, per response: copied?, acted-on (exported/saved/sent)?, immediately
  re-asked same question (failure signal)?, switched persona mid-thread
  (misrouted)?, thread abandoned?
- File targets: `packages/shared/src/types/PersonaInteractionSignal.ts`,
  `packages/renderer/src/services/persona/PersonaInteractionRecorder.ts`,
  plus a `users/{userId}/personaInteractionSignals/{signalId}` Firestore
  rule (immutable — create-only, no update/delete, same posture as
  `visualVerifications`).
- **PLAN CORRECTION (2026-08-07, see ISSUE ledger):** this section
  originally said to extend `AgentFeedbackEvent`
  (`packages/renderer/src/types/agent-feedback.ts`). On actually reading
  that file (not assuming — the file itself says to verify, and this is
  the case where that instruction paid off), it turned out to be EXPLICIT
  rating feedback only (`rating: 'positive' | 'negative' | 'neutral'`,
  fired once when a user rates something) — a different shape and
  trigger from implicit signals, which fire passively on every
  interaction regardless of whether a rating ever happens. Conflating them
  would work against the very separation this line's last sentence asks
  for. Built as a new, parallel type instead — `AgentFeedbackEvent` is
  untouched.
- Explicit thumbs remain a low-recall, high-precision label used to validate
  the implicit signal, not the primary training input.

### T1.7 — Randomized control slice (do this from day one or the offline
metrics are unfalsifiable)
- ~5% of responses generated with population-default fader position instead
  of the user's learned/set position. Tag in telemetry. This is what makes
  "did personalization help" answerable later instead of assumed.

## Phase T2 — worth building at ~1k active users

- Collapse each fader to 5 discrete detented positions in the UI (matches
  the actual achievable resolution on a hosted API — don't promise a smooth
  100-point dial, it isn't one).
- Contextual bandit (hybrid LinUCB-style) selects fader position per user
  per persona from implicit + explicit signal. Shared coefficients across
  arms = new users start at population-optimal position, cold start solved
  without a separate cold-start system.
- Best-of-3 re-ranking against the measurement harness on first-turn/
  high-stakes responses only (Tier 0/1 personas).
- Full canary suite as an automated CI gate, not a manual check.

## Phase T3 — only past ~10k reqs/month or with a concrete latency complaint

- Distillation (Pro → Flash-tier) if latency becomes the blocker, not
  before. Tuning break-even on Vertex is ~180k requests/month at 1.5x
  inference + $430–800/mo dedicated endpoint — a trap below that.
- Aggregate (never per-user) preference tuning on thumbs-shaped data, if a
  large enough labeled set exists (hundreds of pairs minimum). Tier-2
  (Marketing/Creative) personas only — never Tier-0/1.
- Self-hosted Gemma + Gemma Scope SAE steering is the only path to a real
  continuous activation-level dial. Speculative, not planned, not scoped
  until T1/T2 prove the prompt-level dial is the actual bottleneck.

## Consequence tiers (apply from T1.1 onward)

| Tier | Personas | Substance personalization | Style personalization |
|---|---|---|---|
| 0 | Contract Reader, Finance | None, ever | Verbosity + jargon only; hedging/caveats locked |
| 1 | Manager, career strategy | None; mandatory alternative-option slot | Bounded |
| 2 | Marketing, creative copy | Allowed | Full |

## What this build plan deliberately excludes

- No named "Evolas" service as a single monolith — it's the sum of
  PersonaPromptCompiler + PersonaResponseService + PersonaMeasurement +
  the bandit layer (T2). Don't build a god-service.
- No per-user fine-tuning path, ever, per non-negotiable #2.
- No Access Control / permission backend — unrelated system, already logged
  separately as ISSUE-1306.
