# Model Usage Policy

> **CRITICAL: READ THIS ENTIRE DOCUMENT BEFORE WRITING ANY AI-RELATED CODE**
>
> Violations of this policy are **IMMEDIATE GROUNDS FOR REJECTION**.
> This policy is **NON-NEGOTIABLE** and applies to ALL AI coding agents.

---

## TL;DR - The Golden Rule

```text
USE THE APPROVED ARGON / FLASH / TRAINED-SPECIALIST HIERARCHY. NEVER USE GEMINI 1.5 OR 2.0.
```

---

## Core Directive

The founder-approved text architecture is **Argon Conductor → Flash 3.8 agent intelligence → specialty-scoped trained models**.

- Conductor uses `gemini-4-argon` for direction and reasoning.
- Other agents use `gemini-3.8-flash` for reasoning and coordination.
- Preserve trained Vertex endpoints as specialist workers. Delegate only bounded tasks matching their trained domains; return their results and execution evidence to the coordinating intelligence layer.
- Preserve the separate fast Nano Banana and Pro image paths, video, speech, and other authorized agent capabilities.

These are target routing requirements. A model appearing in configuration does not prove it is selected at runtime, accessible to the project, correctly priced, or live-verified. Do not replace every trained endpoint with a base model or describe a configured model as deployed without evidence.

Legacy models are **STRICTLY PROHIBITED** under **ALL CIRCUMSTANCES**, including:

- Debugging
- Testing
- "Temporary" fixes
- Performance optimization attempts
- Cost reduction attempts
- ANY other justification

**There are NO exceptions.**

---

## Approved Models (ONLY THESE ARE ALLOWED)

| Purpose                      | Model ID                        | Notes                                  |
| ---------------------------- | ------------------------------- | -------------------------------------- |
| **Text/Reasoning (Workhorse / Fast)** | `gemini-3.8-flash`     | Agents, reasoning, coding, high-throughput (GA Sept 2026) |
| **Conductor direction and reasoning** | `gemini-4-argon` | Founder-approved intelligence apex |
| **Existing complex-model compatibility** | `gemini-3.1-pro-preview` | Existing call sites pending migration; not the Conductor target |
| **Text/Reasoning (Legacy Fast)** | `gemini-3-flash-preview`    | Legacy preview tasks                   |
| **Image Generation (Pro)** | `gemini-3-pro-image` | Nano Banana Pro |
| **Image Generation (Fast)** | `gemini-3.1-flash-image` | Nano Banana fast path |
| **Audio Generation (TTS)**   | `gemini-3.1-flash-tts-preview`  | Controllable low-latency speech synthesis |
| **Audio Generation (Fast)**  | `gemini-2.5-flash-tts`          | Low-latency speech synthesis           |
| **Video Generation**         | `veo-3.1-generate-preview`      | Standard video generation              |
| **Video Generation (Fast)**  | `veo-3.1-fast-generate-preview` | Draft/preview videos only               |
| **Local Utility (DMR)**      | `llama3:8b` (or similar)         | Local processing via Docker Model Runner|

---

## FORBIDDEN MODELS (NEVER USE THESE)

The following patterns are **BANNED**. Using them will **BREAK THE APPLICATION**:

```typescript
// FORBIDDEN - WILL CAUSE IMMEDIATE REJECTION
'gemini-1.5-flash'        // BANNED
'gemini-1.5-pro'          // BANNED
'gemini-1.5-flash-001'    // BANNED
'gemini-1.5-flash-002'    // BANNED
'gemini-1.5-pro-001'      // BANNED
'gemini-1.5-pro-002'      // BANNED
'gemini-1.0-pro'          // BANNED
'gemini-2.0-flash'        // BANNED
'gemini-2.0-pro'          // BANNED
'gemini-pro'              // BANNED (legacy)
'gemini-pro-vision'       // BANNED (legacy)

// ANY model matching these patterns:
/gemini-1\./              // ALL 1.x versions BANNED
/gemini-2\.0/             // ALL 2.0 versions BANNED
```

---

## Why This Policy Exists

1. **Use the approved hierarchy** - Argon directs, Flash coordinates, and trained models execute their specialties
2. **API compatibility** - Gemini 3 has different API features (thinking levels, thought signatures)
3. **Quality requirements** - This is a premium creative application
4. **Future-proofing** - Legacy models will be deprecated

---

## How to Use Models Correctly

### ALWAYS import from the central config

```typescript
// CORRECT - Use the central config
import { INTELLIGENCE_MODELS, INTELLIGENCE_CONFIG } from '@/core/config/intelligence-models';

const response = await AI.generateContent({
    model: INTELLIGENCE_MODELS.TEXT.AGENT,  // central complex-reasoning selection; see migration status below
    contents: [...],
    config: INTELLIGENCE_CONFIG.THINKING.HIGH
});
```

### NEVER hardcode model strings

```typescript
// WRONG - Hardcoded model strings are FORBIDDEN
const response = await AI.generateContent({
    model: 'gemini-1.5-flash',  // BANNED - WILL BE REJECTED
    contents: [...]
});
```

---

## Model Selection Guide

| Task Type                 | Use This                       | Model ID                       |
| ------------------------- | ------------------------------ | ------------------------------ |
| Conductor reasoning target | `INTELLIGENCE_MODELS.TEXT.AGENT` after migration | `gemini-4-argon` |
| Trained specialty execution | Explicit matching trained endpoint registry | Preserve trained Vertex resources |
| Fast routing/agent workhorse | `INTELLIGENCE_MODELS.TEXT.FAST` | `gemini-3.8-flash`           |
| Image generation          | `INTELLIGENCE_MODELS.IMAGE.GENERATION`| `gemini-3-pro-image`   |
| Audio/TTS generation      | `INTELLIGENCE_MODELS.AUDIO.TTS` | `gemini-3.1-flash-tts-preview` |
| Video generation          | `INTELLIGENCE_MODELS.VIDEO.GENERATION`| `veo-3.1-generate-preview`     |

---

## Runtime Validation

The `intelligence-models.ts` file includes **runtime validation** that will:

1. Check all configured models on application startup
2. Throw an error if ANY forbidden model is detected
3. Prevent the application from running with invalid models

This means:

- If you introduce a forbidden model, **the app will crash on startup**
- This is **intentional** - it's better to fail fast than silently degrade

---

## For AI Coding Agents

### IF YOU ARE AN AI AGENT READING THIS

1. **DO NOT** suggest using Gemini 1.5 or 2.0 models
2. **DO NOT** change the `intelligence-models.ts` config to use legacy models
3. **DO NOT** hardcode legacy model IDs anywhere in the codebase
4. **DO NOT** use legacy models "temporarily" for debugging
5. **ALWAYS** use central model constants for base-model intelligence and the explicit trained endpoint registry for delegated specialty execution.
6. **ALWAYS** import from `@/core/config/intelligence-models`

### Common Mistakes to AVOID

```typescript
// MISTAKE 1: "I'll just use 1.5 Flash because it's faster"
model: 'gemini-1.5-flash'  // BANNED

// MISTAKE 2: "Let me try the older model to debug"
model: 'gemini-1.5-pro'    // BANNED

// MISTAKE 3: "The error says to use this model"
model: 'gemini-pro'        // BANNED

// CORRECT: Always use the approved models
model: AI_MODELS.TEXT.FAST  // gemini-3.8-flash
```

---

## Verification Checklist

Before submitting any code that uses AI models, verify:

- [x] All model references use `AI_MODELS.*` constants
- [x] No hardcoded model ID strings exist
- [x] No `gemini-1.` patterns exist in the code
- [x] No `gemini-2.0` patterns exist in the code
- [x] The code imports from `@/core/config/ai-models`

> Historical automated scan: 2026-01-31. This is not verification of the current migration.

---

## Incident History

| Date       | Issue                                | Cause                                         | Resolution                           |
| ---------- | ------------------------------------ | --------------------------------------------- | ------------------------------------ |
| 2025-12-24 | `gemini-1.5-flash` in `ai-models.ts` | AI agent "downgraded" for debugging reasoning | Reverted to `gemini-3-flash-preview` |

**Pattern:** AI agents often suggest using older models because their training data may be outdated. **ALWAYS REFUSE** such suggestions.

---

## Contact

If you believe this policy should be changed, contact the project owner. Do not make exceptions unilaterally.

## Migration evidence — source reconciled 2026-11-13

The founder explicitly authorizes Argon, superseding the previous Gemini-3-only restriction. Provider identifiers are documented in [Google’s model lifecycle catalog](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions).

| Boundary | Inspected source state | Remaining requirement |
| --- | --- | --- |
| Backend selection | `packages/firebase/src/config/models.ts` sets TEXT.PRO to Argon; `config/textStreamModels.ts` allows Argon | Verify actual project access and submitted model |
| Renderer selection | `packages/renderer/src/core/config/intelligence-models.ts` still sets TEXT_AGENT to 3.1 Pro | Coordinate migration with pricing and supported request configuration |
| Agent execution | `BaseAgent.ts` defaults to getFineTunedModel; `IndiiNucleus.ts` explicitly selects the generalist tuned endpoint | Add the intelligence layer and explicit specialty delegation without deleting trained workers |
| Cost admission | Renderer and backend now have explicit Argon admission rates | Verify current provider rates by location, actual usage, and settlement before switching traffic |
| Acceptance | Charts define the intended hierarchy | Verify genuine direct and Boardroom turns, specialty boundaries, approval continuation, artifacts, and retained media capabilities |

See [routing and hierarchy chart](docs/flowcharts/chat-model-routing-and-approval.md). These gaps are open work, not evidence of a completed migration.

### This policy was last updated: 2026-11-13


## November 2026 candidate evaluation and request compatibility

The user requested investigation of newer alternatives to Flash 3.8 and Argon.
Official [Hydrogen migration guidance](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-4-hydrogen)
and [Carbon guidance](https://aistudio.google.com/docs/whats-new-gemini-4-carbon)
identify Hydrogen as a fast agentic candidate and Carbon as a deeper-reasoning
candidate. This research does not approve a live default change.

`MODEL_THINKING_LEVELS` in renderer configuration records request compatibility:
Argon and Carbon accept LOW, MEDIUM, HIGH; Hydrogen additionally accepts XHIGH.
Unsupported explicit levels are rejected before transport. All three providers
reject legacy thinking budgets and MINIMAL, so the request adapter
removes budgets and maps disabled/minimal intent to LOW. Other nonzero legacy
budgets leave the provider default; choose a supported level explicitly when
latency or cost matters. Existing Gemini 3 request behavior is preserved.

This metadata does not extend `APPROVED_MODELS` or the server-owned text-stream
allowlist. Candidate rollout still requires model-aware input/output budgeting,
pricing, SDK/request validation, signature-safe tool turns and compaction,
project access, and genuine direct-chat/Boardroom/media acceptance. Trained
specialty endpoints remain a separate preserved part of the hierarchy.
