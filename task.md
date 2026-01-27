# Tasks - Video Keyframe Architect

- [x] UX: Implement `processingStage` in `CreativeCanvas` & `CanvasHeader` for granular feedback. <!-- id: 0 -->
- [x] API: Fix `captionImage` payload in `ImageGenerationService` (Fix 400 Error). <!-- id: 1 -->
- [x] API: Fix MIME type detection in `CreativeCanvas` to prevent image/png mismatches. <!-- id: 3 -->
- [x] Fix build errors in `VideoGenerationService.ts`
- [x] Stabilization: Fix all type-checking and linting errors for production build.
- [ ] **USER ACTION**: Verify Agent Zero at <http://localhost:50080> (Auth fixed: Default & Agent0 profiles forced to Gemini 3) <!-- id: 3 -->
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
