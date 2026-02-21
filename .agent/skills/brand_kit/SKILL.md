---
name: brand_kit
description: Implementation reference for the Brand Kit and Onboarding System — the Artist Identity subsystem that collects brand assets, style preferences, and release metadata via an AI-driven chat interface.
---

# @brand_kit — Brand Kit & Onboarding System

## Purpose

The Brand Kit is the artist's identity layer in indiiOS. It's populated via a conversational AI onboarding flow ("indii" agent) and feeds into every downstream feature — Creative Studio, Marketing, Distribution metadata, Social posts, etc.

## When to Invoke

- Debugging the onboarding flow or brand kit modal
- Adding new fields to the artist profile / brand kit
- Investigating why generated content doesn't match the artist's identity
- Extending the onboarding conversation with new questions

---

## Architecture

```
UI Layer:
  src/modules/onboarding/OnboardingModal.tsx   ← Chat interface, "indii" persona

Logic Layer:
  src/services/onboarding/onboardingService.ts  ← Gemini 3 Pro orchestration,
                                                   file processing, function calls

State Layer:
  src/core/store/slices/profileSlice.ts         ← userProfile.brandKit
  src/core/store.ts                             ← Root Zustand store
```

---

## Usage Flow

1. **Dashboard** → Click **Brand Kit** (Sparkles icon in sidebar)
2. `OnboardingModal` opens → chat UI with "indii" AI persona
3. User answers questions, uploads assets
4. AI calls function tools → updates `UserProfile` store
5. `calculateProfileStatus()` tracks % completion

---

## Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `runOnboardingConversation` | `onboardingService.ts` | Main chat loop — sends messages to Gemini, handles streaming |
| `processFunctionCalls` | `onboardingService.ts` | Dispatches AI function calls: `updateProfile`, `addImageAsset` |
| `calculateProfileStatus` | `onboardingService.ts` | Returns 0-100% completion score for the brand kit |
| `updateProfile` | `profileSlice.ts` | Zustand action that merges new profile data |
| `addImageAsset` | `profileSlice.ts` | Appends uploaded brand asset to profile |

---

## Extending the Brand Kit

To add a new field to the brand kit:

1. **Type** — Add field to `UserProfile` type in `src/types/`
2. **Store** — Update `profileSlice.ts` to handle the new field
3. **Onboarding** — Add a question to the system prompt in `onboardingService.ts`
4. **Function Call** — Add a new function tool definition so the AI can set the field
5. **UI** — Update the Profile/BrandKit display component

---

## Debugging

```bash
# Check if onboarding function calls are being processed
grep -n "processFunctionCalls\|updateProfile\|addImageAsset" src/services/onboarding/onboardingService.ts

# Verify store shape
grep -n "brandKit\|UserProfile" src/core/store/slices/profileSlice.ts

# Watch for Gemini API issues during onboarding
# → Check Cloud Functions logs for generateContentStream errors
firebase functions:log --project indiios-v-1-1 --only generateContentStream
```

---

## Access Entry Points

| Entry Point | Path |
|-------------|------|
| Modal trigger | Dashboard → Sparkles icon |
| URL direct | `/onboarding` (standalone module) |
| Zustand state | `useStore(s => s.userProfile.brandKit)` |
| Completion % | `onboardingService.calculateProfileStatus(profile)` |
