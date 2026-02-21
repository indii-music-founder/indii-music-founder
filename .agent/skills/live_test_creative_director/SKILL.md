---
name: live_test_creative_director
description: Protocol for live stress-testing the Creative Director image generation module at localhost:4242. Validates the full generation pipeline from prompt to image display, checking for console errors and API failures.
---

# @live_test_creative_director — Creative Director Stress Test

## Purpose

Manually verify the Creative Director (image generation) module is fully functional end-to-end: prompt input → Gemini API → image display → persistence. Catches integration bugs that unit tests miss.

## When to Invoke

- After any change to `src/modules/creative/`
- After any change to `src/services/image/ImageGenerationService.ts`
- After deploying `generateImageV3` Cloud Function updates
- When a user reports image generation not working

---

## Step 1 — Pre-Flight Checks

```bash
# Verify dev server is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:4242
# Must return: 200

# Verify Cloud Function is deployed
curl -s -o /dev/null -w "%{http_code}" \
  https://us-west1-indiios-v-1-1.cloudfunctions.net/generateImageV3
# Must return: 405 (Method Not Allowed — correct, it's a POST-only onCall)
```

Navigation: `localhost:4242` → Sidebar → **Creative** (palette icon)

---

## Step 2 — Core Generation Test

1. Enter prompt: **"Futuristic neon city at night, cinematic"**
2. Select aspect ratio: **1:1** (default)
3. Click **Generate**

**Expected behavior:**

- Loading spinner / progress indicator appears
- Toast: `"Image generated!"` appears within ~15-30s
- Image renders in the canvas/preview area
- Image persists after navigating away and returning

---

## Step 3 — Verify (All Must Pass)

| Check | Pass Condition |
|-------|---------------|
| **Toast** | `"Image generated!"` appears without error |
| **Image** | Visible, not broken/blank |
| **Console** | Zero red errors, zero uncaught exceptions |
| **Network** | `generateImageV3` returns 200, no 4xx/5xx |
| **Persistence** | Image still visible after tab change |

Open DevTools → **Network** tab → filter `generateImageV3` → confirm `Status: 200`

---

## Step 4 — Extended Stress Tests

Run these after core test passes:

```
Test 2: Style variant
  Prompt: "Abstract watercolor portrait"
  Ratio: 9:16 (portrait)
  Expected: Different style, same success

Test 3: Batch generation
  Count: 4 images
  Expected: All 4 appear, quota decremented correctly

Test 4: Edit pipeline
  Select generated image → Edit
  Prompt: "Add rain and reflections"
  Expected: Edited version appears, original preserved

Test 5: Error resilience
  Enter empty prompt → Click Generate
  Expected: Validation error shown, no crash
```

---

## Step 5 — Debug Path (If Fail)

```bash
# Check Cloud Function logs
firebase functions:log --project indiios-v-1-1 \
  --only generateImageV3 --limit 20

# Check frontend service
cat src/services/image/ImageGenerationService.ts | grep -n "catch\|error\|403\|401\|429"

# Check quota system
cat src/services/subscription/SubscriptionService.ts | grep -n "canPerformAction\|imageGen"
```

**Common failure modes:**

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 403 on generateImageV3 | Quota exceeded or App Check | Check `VITE_FIREBASE_APP_CHECK_KEY` |
| 400 Bad Request | Invalid model ID | Verify `AI_MODELS.IMAGE.GENERATION` value |
| Spinner never stops | Silent JS crash | Check console for uncaught errors |
| Image blank/broken | Base64 decode issue | Check `ImageGenerationService.mapResult()` |
| Toast wrong text | State not updating | Check `creativeSlice` Zustand action |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/modules/creative/` | UI components |
| `src/services/image/ImageGenerationService.ts` | Generation orchestration |
| `src/core/store/slices/creativeSlice.ts` | State management |
| `functions/src/lib/image_generation.ts` | Cloud Function handler |
| `functions/src/config/models.ts` | Model IDs for functions |
