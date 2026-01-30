# Tasks - Video Keyframe Architect

- [x] UX: Implement `processingStage` in `CreativeCanvas` & `CanvasHeader` for granular feedback. <!-- id: 0 -->
- [x] API: Fix `captionImage` payload in `ImageGenerationService` (Fix 400 Error). <!-- id: 1 -->
- [x] API: Fix MIME type detection in `CreativeCanvas` to prevent image/png mismatches. <!-- id: 3 -->
- [x] Fix build errors in `VideoGenerationService.ts`
- [x] Stabilization: Fix all type-checking and linting errors for production build.
- [x] **USER ACTION**: Verify Agent Zero at <http://localhost:50080> (Auth fixed: App Check Logic patched for DEV, Debug Token registered) <!-- id: 3 -->
- [x] Verification: Run `Create Last Frame` success test (UI Reachable, Gallery Empty). <!-- id: 2 -->
- [x] Final Verification: Full `npm run build` success.

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
- [ ] Feature: Add UI for Agent Zero Tool Execution feedback. (Deferred - requires backend fork).

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
- [ ] Integration: Re-enable middleware routes (`/mcp`, `/a2a`) and verify stability.
- [ ] UI: Add tool execution progress feedback in ChatOverlay.
- [ ] Testing: Run full regression test suite with Electron app.
- [x] Deployment: Update README with Agent Zero setup instructions. **COMPLETED**
