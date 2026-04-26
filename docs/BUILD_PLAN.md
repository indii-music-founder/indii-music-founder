# indiiOS Build Plan

**Date:** 2026-03-15
**Scope:** Distribution Execution Layer + Docker-Free Desktop Sidecar

---

## Task 1: Wire the Distribution Execution Layer

The UI and agent definitions are complete. The Python DDEX generator exists. Nothing is connected. This task closes that gap.

### 1a. Create execution/distribution/ scripts

| Script | Purpose |
| --- | --- |
| `isrc_assign.py` | Generate/assign ISRC codes, write to Firestore |
| `qc_runner.py` | Audio QC checks (sample rate, bit depth, loudness, clipping) |
| `sftp_upload.py` | Authenticate and upload assets + DDEX XML to distributor SFTP |
| `ddex_build.py` | Orchestrator — calls ddex_generator.py → qc_runner.py → sftp_upload.py in sequence |

**Credential Management:** Use Keytar to securely store SFTP distributor credentials in the OS keychain. Pass credentials securely from Electron to the Python script at runtime, and handle credential refresh/rotation if needed.

### 1b. Wire Electron handlers

File: `electron/handlers/distributionHandlers.ts`

- `runQC(filePath)` → spawns `qc_runner.py`, returns pass/fail + report
- `assignISRC(metadata)` → spawns `isrc_assign.py`, returns ISRC string
- `buildAndUploadDDEX(releaseData)` → spawns `ddex_build.py` end-to-end
- All handlers stream stdout back as progress events to renderer

### 1c. Connect DistributionService.ts

File: `src/services/distribution/DistributionService.ts`

- Replace `window.electronAPI.distribution.runForensics()` placeholder with real `runQC()` call
- Add `submitRelease()` that calls `buildAndUploadDDEX()` and updates Firestore task doc
- Surface progress events to the Distribution Dashboard via Zustand `distributionSlice`

### 1d. Hook the QC Panel in the UI

File: `src/modules/distribution/` (QCPanel component)

- Wire "Run QC" button to `DistributionService.runQC()`
- Show per-check results (lufs, clipping, format, metadata completeness)
- Gate the "Submit" button behind a passing QC

---

## Task 2: Python Sidecar Removal (Completed)

Agent Zero previously required Docker or a bundled Python sidecar. This architectural dependency was formally removed. The application now uses the native TypeScript `AgentGraphService` as the undisputed "OpenClaw" orchestrator.

### Details of Removal
- The `/python/` directory and all Python-based sidecar scripts were removed.
- Electron no longer attempts to bundle or spawn a Python process.
- All orchestration logic is now handled in `packages/renderer/src/services/agent/`.
- `CodeExecutionTools` and its related `execute_code` endpoints were explicitly disabled, as arbitrary code execution is now handled differently or planned for native WASM support.

---

## Execution Order

```text
Phase 1 — Distribution (no external build deps, purely Python + TypeScript)
  1a → 1b → 1c → 1d
```

Phase 1 can be done entirely in this repo without any new tooling.

---

## Definition of Done

- [ ] Distribution: "Submit Release" button triggers real DDEX XML build → QC check → SFTP upload
- [ ] Distribution: ISRC is assigned and written back to the release record
- [ ] Distribution: QC panel shows real per-check results from the audio file
- [x] Sidecar Removal: The Python sidecar was completely ripped out, and the UI successfully interacts with the native `AgentGraphService`.
- [ ] Testing: Unit tests cover Python handler scripts and distribution logic
- [ ] Testing: Integration tests verify the DDEX end-to-end flow with a mock distributor
