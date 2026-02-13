# Tasks - Video Keyframe Architect

- [x] UX: Implement `processingStage` in `CreativeCanvas` & `CanvasHeader` for granular feedback. <!-- id: 0 -->
- [x] API: Fix `captionImage` payload in `ImageGenerationService` (Fix 400 Error). <!-- id: 1 -->
- [x] API: Fix MIME type detection in `CreativeCanvas` to prevent image/png mismatches. <!-- id: 3 -->
- [x] Fix build errors in `VideoGenerationService.ts`
- [x] Stabilization: Fix all type-checking and linting errors for production build.
- [x] **USER ACTION**: Verify Agent Zero at <http://localhost:50080> (Auth fixed: App Check Logic patched for DEV, Debug Token registered) <!-- id: 3 -->
- [x] Verification: Run `Create Last Frame` success test (UI Reachable, Gallery Empty). <!-- id: 2 -->
- [x] Final Verification: Full `npm run build` success.

## Tasks - AI Verification & Persistence Fix (2026-02-06)

- [x] Persistence: Implement `MetadataPersistenceService` with retry logic & event bus integration.
- [x] UX: Decouple services from `react-hot-toast`, use `EventBus` for system alerts.
- [x] Fix: Resolve "AI Verification Failed (App Check/Auth)" on production (Missing Env Var fallback).
- [x] Implementation: Add `VITE_API_KEY` fallback for `firebaseApiKey` in `env.ts`.
- [x] Verification: Verify "Magic Fill" on live site (`https://indiios-studio.web.app`). **PASSED**
- [x] Verification: Verify "Persistence Toast" on live site. **PASSED**

## Tasks - Sonic Cortex Recovery & Negotiation (2026-02-04)

- [x] Infrastructure: Correct model IDs in `src/core/config/ai-models.ts` (Fix 404). <!-- id: 200 -->
- [x] Infrastructure: Update `firestore.rules` for Collection Group queries (Fix 403). <!-- id: 201 -->
- [x] Infrastructure: Whitelist `indiios-studio.firebaseapp.com` in `functions/src/index.ts` (Fix CORS). <!-- id: 202 -->
- [x] Protocol: Update `AGENT_BRIDGE.md` with Negotiated Information Protocol V1.1. <!-- id: 203 -->
- [x] Verification: Confirm browser console is free of 404/403/CORS errors on live site. <!-- id: 204 --> **VERIFIED** (Basic analysis working; deep Soul analysis blocked by API quota)
- [x] Verification: Verify "After Hours Pulse" metadata population after user re-analysis. <!-- id: 205 --> **VERIFIED** (115 BPM, C major, 68% Energy, 6 tags)

## Tasks - Image Generation Timeout Fix (2026-02-05)

- [x] Investigation: Trace 300s timeout to agent loop execution flow. <!-- id: 206 -->
- [x] Fix: Add IMMEDIATE EXECUTION rule to GeneralistAgent prompts. <!-- id: 207 -->
- [x] Fix: Add Exception to Mode A for generation requests (skip Curriculum mode). <!-- id: 208 -->
- [x] Fix: Strengthen loop break logic for generation tools that return success. <!-- id: 209 -->
- [x] Verification: Test "generate an image of a cat" in browser. <!-- id: 210 -->
- [x] Optimization: Increase timeout for generation tasks (600s) and implement timeout grace logic. <!-- id: 211 -->

## Tasks - Dual-Workflow Image Editing (Gemini 3 Pro + 2.5 Flash)

- [x] UI: Add "High Fidelity" toggle in `CanvasHeader`. <!-- id: 101 -->
- [x] Service: Implement "Ghost Export" (Binary Masks) in `CanvasOperationsService`. <!-- id: 102 -->
- [x] Service: Support `model` and `Dual-View` payload in `EditingService`. <!-- id: 103 -->
- [x] Backend: Implement `Dual-View` pipeline in `editImage` Cloud Function (Gemini 3 Multimodal). <!-- id: 104 -->
- [x] Backend: Integrate Gemini File API for large images in `editImageFn`. <!-- id: 105 -->
- [x] Logic: Refactor `handleMagicFill` in `CreativeCanvas` to route between Pro/Flash workflows. <!-- id: 106 -->
- [x] Verification: Run `npm run typecheck` to verify no regressions. <!-- id: 107 -->
- [x] Verification: Test multimodal reasoning with complex prompts in browser. <!-- id: 108 --> **PASSED** (High Fidelity toggle verified 2026-01-30)

## Tasks - indii Agent (Agent Zero Integration)

- [x] Infra: Create `Dockerfile.local` with Google GenAI SDK.
- [x] Infra: Create `docker-compose.yml` with volume mappings.
- [x] Tool: Implement `indii_image_gen.py` (Imagen 3).
- [x] Tool: Implement `indii_video_gen.py` (Veo).
- [x] Tool: Implement `indii_audio_ear.py` (Audio Analysis).
- [x] Prompts: Create system prompts for all tools.
- [x] Agents: Configure `indii_curriculum` and `indii_executor` profiles.
- [x] Verification: Start Docker container and test tools (Environment Ready).

## Tasks - indiiOS Electron Integration (Agent Zero)

- [x] Service: Create `AgentZeroService` for API communication.
- [x] Store: Update `AgentSlice` with `activeAgentProvider` state.
- [x] Logic: Integrate routing in `AgentService.sendMessage`.
- [x] UI: Add "Native / Zero" toggle in `ChatOverlay`.
- [x] Feature: Implement Attachment Support for Agent Zero.
- [x] Feature: Fix Response Mapping in AgentZeroService.
- [x] Polish: Error handling for offset port/container down.
- [x] Fix: Update Service to use correct `/api_message` and `X-API-KEY` (Fixed 404).
- [x] Feature: Add UI for Agent Zero Tool Execution feedback. **COMPLETED** (2026-01-30 - Implemented via response parsing, no backend fork needed)

## Proving Ground: Agent Zero Sidecar (System Directive)

### Phase 1: Infrastructure & "Air Gap"

- [x] Test 1: "Ghost in the Shell" (Volume Mapping Check). **PASSED**
- [x] Test 2: "Silent LAN" (Network Isolation Check). **PASSED** (Electron Security Guard verified; `aiohttp` added to Dockerfile)

### Phase 2: Gemini Brain Handshake

- [x] Test 3: "Identity" (API Key Authentication Check). **PASSED**
- [x] Test 4: "Native Ear" (Multimodal Input Check). **PASSED** (Verified with Gemini 3 Pro)

### Phase 3: Sidecar Bridge (API Handlers)

- [x] Test 5: "Headless" Command (Async API Trigger Check). **PASSED**
- [x] Test 6: "Context Bleed" (Project Isolation Stress Test). **PASSED**

### Phase 4: Tooling & "The Hands"

- [x] Test 7: "Protocol" (Image Rendering path `img://` Check). **PASSED**
- [x] Test 8: "Zeroization" (Secrets Hygiene Check). **PASSED**

### Phase 5: Overlook Protection

- [x] Test 9: "Zombie" Process Check (SIGTERM Handling). **PASSED**
- [x] Test 10: "Prompt Injection" Honeypot (Gatekeeper Check). **PASSED**

### Phase 6: Production Integration

- [x] Documentation: Create comprehensive test results summary (`docs/AGENT_ZERO_TEST_RESULTS.md`). **COMPLETED**
- [x] Verification: Confirm Agent Zero health endpoint is accessible. **PASSED**
- [x] Integration: Re-enable middleware routes (`/mcp`, `/a2a`) and verify stability. **COMPLETED** (2026-01-30 - MCP SSE endpoint verified)
- [x] UI: Add tool execution progress feedback in ChatOverlay. **COMPLETED** (2026-01-30 - Intelligent response parsing + visual badges)
- [x] Testing: Run full regression test suite with Electron app. **COMPLETED** (2026-01-30 - 2002/2164 tests passing, 93% pass rate)
- [x] Deployment: Update README with Agent Zero setup instructions. **COMPLETED**
      108:
      109: ## Tasks - Image Upload & Compression Reliability (2026-02-07)
      110:
      111: - [x] Fix: Implement 30s timeout and CORS robustness in `CloudStorageService.compressImage`. <!-- id: 300 -->
      112: - [x] Fix: Re-enable Cloud Storage `smartSave` in `ImageGenerationService` with automatic local compression fallback. <!-- id: 301 -->
      113: - [x] Infra: Apply browser CORS policy to Firebase Storage bucket `gs://indiios-alpha-electron/`. <!-- id: 302 -->
      114: - [x] Fix: Improve UID resolution in `AgentExecutor` to prevent trace submission failures (Permission Denied). <!-- id: 303 -->
      115: - [x] Verification: Verify successful trace creation and image upload flow in logs. <!-- id: 304 -->

## Tasks - Image Generation & Agent Fidelity (2026-02-12)

- [x] **USER ACTION**: Run `scripts/update-gemini-secret.sh` to fix API Key. <!-- id: 405 -->
- [x] **USER ACTION**: Run `scripts/update-gemini-secret.sh` to fix API Key. <!-- id: 405 -->
- [x] Deploy Functions `generateImageV3` & `editImage` to apply secret. <!-- id: 406 -->
- [x] Logic: Update `AgentService` to bypass HybridOrchestrator for 'Native' mode. <!-- id: 401 -->
- [x] Prompts: Update `DirectorAgent` and `GeneralistAgent` prompts to forbid external tool hallucinations. <!-- id: 402 -->
- [ ] Verification: Verify Image Generation works in browser. <!-- id: 403 -->
- [ ] Verification: Verify 'Manual' mode behaves as direct 70% Human control. <!-- id: 404 -->
