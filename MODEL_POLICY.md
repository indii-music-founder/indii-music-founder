# Model Usage Policy

> **CRITICAL: READ THIS ENTIRE DOCUMENT BEFORE WRITING ANY AI-RELATED CODE**
>
> Violations of this policy are **IMMEDIATE GROUNDS FOR REJECTION**.
> This policy is **NON-NEGOTIABLE** and applies to ALL AI coding agents.

---

## TL;DR - The Golden Rule

```
USE ONLY GEMINI 3.x MODELS. NEVER USE GEMINI 1.5 OR 2.0.
```

---

## Core Directive

This application **EXCLUSIVELY** uses the **Gemini 3** series models.

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

| Purpose | Model ID | Notes |
|---------|----------|-------|
| **Text/Reasoning (Complex)** | `gemini-3-pro-preview` | Agents, analysis, complex tasks |
| **Text/Reasoning (Fast)** | `gemini-3-flash-preview` | Routing, simple tasks, high-throughput |
| **Image Generation** | `gemini-3-pro-image-preview` | All image synthesis (Nano Banana Pro) |
| **Audio Generation (TTS)** | `gemini-2.5-pro-tts` | High-quality speech synthesis |
| **Audio Generation (Fast)** | `gemini-2.5-flash-tts` | Low-latency speech synthesis |
| **Video Generation** | `veo-3.1-generate-preview` | Standard video generation |
| **Video Generation (Fast)** | `veo-3.1-fast-generate-preview` | Draft/preview videos only |

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

1. **Gemini 3 is the current generation** - 1.5 and 2.0 are legacy
2. **API compatibility** - Gemini 3 has different API features (thinking levels, thought signatures)
3. **Quality requirements** - This is a premium creative application
4. **Future-proofing** - Legacy models will be deprecated

---

## How to Use Models Correctly

### ALWAYS import from the central config

```typescript
// CORRECT - Use the central config
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

const response = await AI.generateContent({
    model: AI_MODELS.TEXT.AGENT,  // gemini-3-pro-preview
    contents: [...],
    config: AI_CONFIG.THINKING.HIGH
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

| Task Type | Use This | Model ID |
|-----------|----------|----------|
| Agent reasoning | `AI_MODELS.TEXT.AGENT` | `gemini-3-pro-preview` |
| Fast routing/simple tasks | `AI_MODELS.TEXT.FAST` | `gemini-3-flash-preview` |
| Image generation | `AI_MODELS.IMAGE.GENERATION` | `gemini-3-pro-image-preview` |
| Audio/TTS generation | `AI_MODELS.AUDIO.PRO` | `gemini-2.5-pro-tts` |
| Video generation | `AI_MODELS.VIDEO.GENERATION` | `veo-3.1-generate-preview` |

---

## Runtime Validation

The `ai-models.ts` file includes **runtime validation** that will:

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
2. **DO NOT** change the `ai-models.ts` config to use legacy models
3. **DO NOT** hardcode legacy model IDs anywhere in the codebase
4. **DO NOT** use legacy models "temporarily" for debugging
5. **ALWAYS** use `AI_MODELS.TEXT.AGENT`, `AI_MODELS.TEXT.FAST`, etc.
6. **ALWAYS** import from `@/core/config/ai-models`

### Common Mistakes to AVOID

```typescript
// MISTAKE 1: "I'll just use 1.5 Flash because it's faster"
model: 'gemini-1.5-flash'  // BANNED

// MISTAKE 2: "Let me try the older model to debug"
model: 'gemini-1.5-pro'    // BANNED

// MISTAKE 3: "The error says to use this model"
model: 'gemini-pro'        // BANNED

// CORRECT: Always use the approved models
model: AI_MODELS.TEXT.FAST  // gemini-3-flash-preview
```

---

## Verification Checklist

Before submitting any code that uses AI models, verify:

- [ ] All model references use `AI_MODELS.*` constants
- [ ] No hardcoded model ID strings exist
- [ ] No `gemini-1.` patterns exist in the code
- [ ] No `gemini-2.0` patterns exist in the code
- [ ] The code imports from `@/core/config/ai-models`

---

## Incident History

| Date | Issue | Cause | Resolution |
|------|-------|-------|------------|
| 2025-12-24 | `gemini-1.5-flash` in ai-models.ts | AI agent "downgraded" for debugging | Reverted to `gemini-3-flash-preview` |

**Pattern:** AI agents often suggest using older models because their training data may be outdated. **ALWAYS REFUSE** such suggestions.

---

## Contact

If you believe this policy should be changed, contact the project owner. Do not make exceptions unilaterally.

**This policy was last updated: 2025-12-24**
