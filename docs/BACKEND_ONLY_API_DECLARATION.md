# Backend-Only API Declaration

**Status:** Verified ✓  
**Date:** 2026-06-18  
**Scope:** Gemini AI / Google Cloud APIs

---

## Executive Summary

indii Studio operates under a **backend-only AI model**: all Gemini API access, including text generation, image generation, audio analysis, and video creation, flows exclusively through server-side Cloud Functions with Application Default Credentials (ADC) authentication. No Google Gemini API keys are present in the frontend bundle.

This architecture eliminates:
- API key expiration risk in the browser
- Unintended key leaks through bundle inspection or network traffic
- Direct client-to-Google-API surface area
- Compliance complexity around client-side API key management

---

## Architecture

```
┌─────────────────────────────┐
│   Studio (React SPA)        │  No Google API keys
│   - Firebase Auth only      │
│   - App Check validation    │
└──────────┬──────────────────┘
           │ HTTPS
           ▼
┌─────────────────────────────┐
│  Cloud Functions (Node 22)  │
│  - ADC auth (service acct) │
│  - Vertex AI SDK           │
│  - No API key needed       │
└──────────┬──────────────────┘
           │ ADC credentials
           ▼
┌─────────────────────────────┐
│  Vertex AI / Gemini APIs   │
│  (GCP-native, no keys)      │
└─────────────────────────────┘
```

---

## Verification Checklist

### 1. Frontend Bundle — No Gemini Keys ✓

**Command:**
```bash
grep -r "AIza\|gemini-\|VITE_API_KEY\|apiKey" dist/renderer/ | grep -v "firebase"
```

**Result:** Empty (no matches)

**Evidence:**
- `.env.example` line 24: `VITE_API_KEY` removed ✓
- `.github/workflows/deploy.yml`: No `VITE_API_KEY` secret passed to build ✓
- `packages/renderer/src/**`: No live code references to `VITE_API_KEY` ✓

### 2. Client-to-Backend Communication

All AI requests route through one of:

1. **Callable Functions** (HTTPSCallable)
   - `generateText()` → calls backend `generateContentStream`
   - Auth: Firebase ID token + App Check token
   - No API key in request headers

2. **Server-Sent Events (SSE)**
   - `agentStreamResponse` endpoint (`POST /api/agents/stream`)
   - Auth: Firebase ID token in Authorization header
   - Request structure: `{ userId, agentId, input, context }`
   - No API key anywhere

3. **REST Functions** (for specialized operations)
   - Image analysis, audio analysis, video generation
   - All routed through `packages/firebase/src/functions/*`
   - Authenticated via Firebase Auth context

### 3. Backend Credential Sources

**Cloud Functions Runtime:**
- `GCLOUD_PROJECT` — inferred from Cloud Run environment
- `VERTEX_LOCATION` — set in function configuration
- `VERTEX_IMAGE_LOCATION` — image model location
- `VERTEX_VIDEO_LOCATION` — video model location
- **ADC (Application Default Credentials):** Automatic, service-account-based

**SDK Initialization:**
```typescript
// packages/firebase/src/lib/vertexClient.ts
const genai = new GoogleGenAI({
  vertexai: true,
  project: projectId,
  location: location,
  // NO apiKey parameter — ADC auth only
});
```

**No external secrets:**
- `GEMINI_API_KEY` secret exists for backward compatibility (ragProxy only)
- Never used in main text/image/video/audio paths
- All new hot paths use Vertex + ADC

### 4. API Restriction Verification

**GCP Project Settings:**
- Vertex AI API: Enabled
- Service Account Credentials:
  - Role: `roles/aiplatform.user`
  - Workload Identity enabled
  - No raw API keys on service account
- Firebase Security Rules: Enforce `auth.uid` and App Check

---

## Evidence Artifacts

### Bundle Inspection

To verify at deployment:

```bash
# 1. Extract and inspect the compiled JS
unzip dist/renderer/*.js.gz
strings dist/renderer/*.js | grep -i "gemini\|AIza" | head -5
# Expected: No matches

# 2. Check network tab during live Conductor interaction
# Expected flows:
#   - POST to cloudfunctions.net (backend functions)
#   - GET/POST to firebaseapp.com (Firebase services)
# Expected NOT to see:
#   - generativelanguage.googleapis.com
#   - Any URL with ?key= parameter
```

### Source Code Proof

**Files with no `VITE_API_KEY` reference:**
```
packages/renderer/src/services/intelligence/FirebaseIntelligenceService.ts
packages/renderer/src/services/intelligence/generators/*.ts
packages/renderer/src/services/intelligence/appcheck.ts
packages/renderer/src/config/env.ts
packages/renderer/src/vite-env.d.ts
```

**Backend-only routing:**
```
packages/firebase/src/lib/vertexClient.ts          (ADC init)
packages/firebase/src/streaming/agentStream.ts    (text streaming)
packages/firebase/src/lib/audio.ts                (TTS)
packages/firebase/src/lib/image_generation.ts     (image generation)
```

---

## Threat Model Elimination

| Risk | Mitigation |
|------|-----------|
| **API key leak via source map** | No key in bundle; source maps can be public-safe |
| **API key in network traffic** | No client-to-Google API calls; all backend-routed |
| **Key expiration breaks prod** | Service account doesn't expire; ADC handles renewal |
| **Unintended key reuse** | Single Vertex + ADC path; no fallback with alternate key |
| **Browser dev tools inspection** | No key in LocalStorage, cookies, or window globals |
| **CDN/proxy inspection** | No key in response headers or payloads |

---

## Compliance Notes

- **SOC 2 / ISO 27001:** Backend-only architecture aligns with principle of least privilege (client has no credentials)
- **GDPR / Data Residency:** All processing stays within GCP cloud (region configurable via `VERTEX_LOCATION`, with media-specific overrides for image/video where needed)
- **PCI DSS (if applicable):** No payment processor keys in frontend

---

## How to Maintain This Declaration

1. **On every push to `main`:** Run `grep -r "VITE_API_KEY" packages/renderer/src` — should be empty
2. **In code review:** Flag any live code (not test) importing or using `VITE_API_KEY`
3. **Before release:** Verify `npm run build` succeeds and bundle contains no Gemini secrets

---

## Exceptions & Scope

**Files API (ragProxy):**
- Currently uses `GEMINI_API_KEY` secret (temporary)
- Backend-only; client never sees key
- Migration to Vertex Files API planned in Phase 4
- Does not violate "backend-only" principle (key is server-side)

---

**Signed:** indii AI Infrastructure Team  
**Version:** 1.0  
**Last Verified:** 2026-06-18
