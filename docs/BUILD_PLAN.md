# indiiOS Build Plan
**Date:** 2026-03-15
**Scope:** Distribution Execution Layer + Docker-Free Desktop Sidecar

---

## Task 1: Wire the Distribution Execution Layer

The UI and agent definitions are complete. The Python DDEX generator exists. Nothing is connected. This task closes that gap.

### 1a. Create execution/distribution/ scripts

| Script | Purpose |
|--------|---------|
| `isrc_assign.py` | Generate/assign ISRC codes, write to Firestore |
| `qc_runner.py` | Audio QC checks (sample rate, bit depth, loudness, clipping) |
| `sftp_upload.py` | Authenticate and upload assets + DDEX XML to distributor SFTP |
| `ddex_build.py` | Orchestrator — calls ddex_generator.py → qc_runner.py → sftp_upload.py in sequence |

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

## Task 2: Docker-Free Python Sidecar for Desktop

Agent Zero currently requires Docker on the user's machine. This is a blocker for shipping a DMG or Windows exe. The solution: bundle the Python runtime as a standalone binary that Electron spawns as a child process.

### 2a. Create PyInstaller spec

File: `python/build/agent_sidecar.spec`

- Entry point: `python/helpers/mcp_server.py` (the HTTP server that listens on 50080)
- Bundle: all tools in `python/tools/`, all helpers, all agent definitions
- Output: single-file binary per platform (`agent_sidecar-mac`, `agent_sidecar-win.exe`, `agent_sidecar-linux`)
- Add `scripts/build_sidecar.sh` to produce the binary as part of the desktop build

### 2b. Update Electron main process

File: `electron/main.ts`

- Replace Docker health-check logic (current `fetch('http://localhost:50080/health')` with retry) with:
  1. Resolve sidecar binary path (bundled inside `resources/` in packaged app, dev path in dev)
  2. Spawn binary as `child_process.spawn()` with piped stdout/stderr
  3. Wait for `"Server running"` stdout signal before marking sidecar ready
  4. On app quit, kill the child process cleanly
- Keep the existing health-check loop — just point it at the spawned process instead of Docker

### 2c. Add sidecar to Electron packaging

File: `electron-builder.config.js` (or `package.json` builder section)

- Add `extraResources` entry to copy the platform-specific sidecar binary into the app bundle
- Ensure binary is marked executable on mac/linux post-install

### 2d. Dev mode fallback

- In dev mode (`!app.isPackaged`), keep existing Docker behavior as fallback so the dev loop is not broken
- Add a `VITE_FORCE_SIDECAR` env flag to test the bundled path locally without packaging

### 2e. Update preload / AgentZeroService

- No changes needed to `AgentZeroService.ts` — it already talks to `localhost:50080` regardless of what's running there
- Update `electron/preload.ts` `proxyZero` handler if needed to surface sidecar start errors to the UI

---

## Execution Order

```
Phase 1 — Distribution (no external build deps, purely Python + TypeScript)
  1a → 1b → 1c → 1d

Phase 2 — Sidecar (requires PyInstaller installed, platform-specific)
  2a → 2b → 2c → 2d → 2e
```

Phase 1 can be done entirely in this repo without any new tooling.
Phase 2 requires `pyinstaller` (`pip install pyinstaller`) and a Python environment with all deps installed.

---

## Definition of Done

- [ ] Distribution: "Submit Release" button triggers real DDEX XML build → QC check → SFTP upload
- [ ] Distribution: ISRC is assigned and written back to the release record
- [ ] Distribution: QC panel shows real per-check results from the audio file
- [ ] Sidecar: `npm run build:desktop` produces a DMG/exe with no Docker requirement
- [ ] Sidecar: Agent chat works in the packaged app on a machine with no Docker installed
- [ ] Dev mode: existing Docker workflow still works unchanged
