# Sprint 3 — Architectural Hardening & UX Implementation Plan

## User Review Required

> [!IMPORTANT]
> This sprint involves merging `AIService` into `FirebaseAIService` and introducing a unified `GenAI` facade. Existing `import { AI }` will still work via an alias, but new code should transition to `GenAI`.

---

## Proposed Changes

### 1 — AI Service Consolidation

Unify redundant AI services into a single high-performance engine.

#### [MODIFY] [FirebaseAIService.ts](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/services/ai/FirebaseAIService.ts)

- absorb `RateLimiter` logic from `AIService`.
- absorb `AIResponseCache` integration.
- Standardize on `rawGenerateContent` as the core primitive.
- Ensure all legacy `AIService` methods have equivalent or better implementations here.

#### [NEW] [GenAI.ts](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/services/ai/GenAI.ts)

- Export `GenAI` as the canonical instance of `FirebaseAIService`.
- Provide a unified interface for text, image captioning, and structured data.

#### [MODIFY] [AIService.ts](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/services/ai/AIService.ts)

- Mark class as `@deprecated`.
- Refactor to be a thin wrapper around `GenAI`.
- Maintain public API for backward compatibility.

---

### 2 — Sidecar Health Monitor (Electron)

#### [NEW] [sidecarSlice.ts](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/core/store/slices/sidecarSlice.ts)

- State for `status: 'online' | 'offline' | 'checking'`.
- Actions for `setStatus` and `triggerRestart`.

#### [NEW] [SidecarStatus.tsx](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/core/components/SidecarStatus.tsx)

- Visual badge (Online: Green, Offline: Red).
- "Restart Sidecar" button that triggers IPC.

#### [MODIFY] [main.ts](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/electron/main.ts)

- Add 30s interval `fetch('http://localhost:50080/health')`.
- Notify renderer via IPC on status change.
- Add `sidecar:restart` IPC handler to spawn/check Docker.

---

### 3 — Offline Persistence Queue UX

#### [NEW] [syncSlice.ts](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/core/store/slices/syncSlice.ts)

- Track `pendingCount` and `lastSyncError`.

#### [NEW] [SyncStatus.tsx](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/core/components/SyncStatus.tsx)

- Render in footer bar.
- Show "Synced", "Syncing (N)", or "Sync Error".

#### [MODIFY] [MetadataPersistenceService.ts](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/src/services/persistence/MetadataPersistenceService.ts)

- Emit events to `EventBus` when queue changes.
- Sync these events to `syncSlice`.

---

## Verification Plan

### Automated Tests

- `npm test src/services/ai/FirebaseAIService.test.ts`
- `npm run test:e2e e2e/sidecar-health.spec.ts` (Mocked IPC)

### Manual Verification

- Stop Docker container → Verify Red badge in sidebar.
- Start Docker → Verify badge turns Green.
- Go offline → Simulate persistence failure → Verify sync counter increases.
