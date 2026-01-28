# Tasks - Video Keyframe Architect

- [x] UX: Implement `processingStage` in `CreativeCanvas` & `CanvasHeader` for granular feedback. <!-- id: 0 -->
- [x] API: Fix `captionImage` payload in `ImageGenerationService` (Fix 400 Error). <!-- id: 1 -->
- [x] API: Fix MIME type detection in `CreativeCanvas` to prevent image/png mismatches. <!-- id: 3 -->
- [x] Fix build errors in `VideoGenerationService.ts`
- [x] Stabilization: Fix all type-checking and linting errors for production build.
- [x] **USER ACTION**: Verify Agent Zero at <http://localhost:50080> (Auth fixed: App Check Logic patched for DEV, Debug Token registered) <!-- id: 3 -->
- [x] Verification: Run `Create Last Frame` success test (UI Reachable, Gallery Empty). <!-- id: 2 -->
- [x] Final Verification: Full `npm run build` success.

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
- [ ] Test 2: "Silent LAN" (Network Isolation Check). **Retrying after dependency fix (aiohttp)**

### Phase 2: Gemini Brain Handshake

- [ ] Test 3: "Identity" (ADC Authentication Check).
- [ ] Test 4: "Native Ear" (Multimodal Input Check).

### Phase 3: Sidecar Bridge (API Handlers)

- [ ] Test 5: "Headless" Command (Async API Trigger Check).
- [ ] Test 6: "Context Bleed" (Project Isolation Stress Test).

### Phase 4: Tooling & "The Hands"

- [ ] Test 7: "Protocol" (Image Rendering path `img://` Check).
- [ ] Test 8: "Zeroization" (Secrets Hygiene Check).

### Phase 5: Overlook Protection

- [ ] Test 9: "Zombie" Process Check (SIGTERM Handling).
- [ ] Test 10: "Prompt Injection" Honeypot (Gatekeeper Check).
