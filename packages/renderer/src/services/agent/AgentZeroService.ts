/**
 * AgentZeroService — RETIRED (External Dependency Tombstone)
 *
 * This service previously proxied all agent requests to an external "Agent Zero"
 * Docker container (localhost:50080). It has been removed as of indiiOS 1.23.0.
 *
 * indiiOS is now a fully self-contained AI operating system:
 *   - Orchestration  → AgentService + HybridOrchestrator (Gemini native)
 *   - Identity/DNA   → IndiiNucleus (spliceDNA via LivingFileService + GenAI)
 *   - Image editing  → Firebase Cloud Functions (editImage)
 *   - Video gen      → Firebase Cloud Functions (triggerVideoJob)
 *   - Browser tools  → Electron IPC (navigateAndExtract, performAction, captureState)
 *   - Session routing→ WebSocketControlPlane + SessionTools
 *
 * If you are seeing an import of this file, trace the caller and redirect it to
 * the appropriate native service above.
 *
 * @deprecated — do not use. This file will be deleted in a future cleanup pass.
 */

export const agentZeroService = null as never;
