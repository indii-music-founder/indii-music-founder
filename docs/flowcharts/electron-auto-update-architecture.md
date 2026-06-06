# Electron Auto-Update System — Architecture Flowchart

> Generated for the Desktop & Updates settings section implementation.

## System Overview

```mermaid
graph TB
    subgraph "CI/CD Layer"
        A["GitHub Actions<br/>release.yml"] -->|"v*.*.* tag push"| B["Build Matrix<br/>macOS / Win / Linux"]
        B -->|"electron-builder<br/>--publish always"| C["GitHub Releases<br/>latest.yml + artifacts"]
        B -->|"gcloud storage cp"| D["Firebase Storage<br/>founders/releases/"]
    end

    subgraph "Main Process"
        E["updater.ts<br/>setupAutoUpdater()"] -->|"On launch + every 4h"| F["autoUpdater.checkForUpdatesAndNotify()"]
        F -->|"Checks"| C
        F -->|"Or checks"| D
        G["registerUpdaterHandlers()"] -->|"IPC handlers"| H["updater:check<br/>updater:install<br/>updater:set-channel<br/>updater:set-source<br/>updater:get-config"]
        E -->|"Events forwarded via IPC"| I["sendToRenderer()<br/>updater:checking<br/>updater:available<br/>updater:progress<br/>updater:downloaded<br/>updater:error"]
    end

    subgraph "Preload Bridge"
        J["preload.ts<br/>electronAPI.updater"] -->|"contextBridge"| K["check / install<br/>setChannel / setSource<br/>getConfig<br/>onChecking / onAvailable<br/>onNotAvailable / onProgress<br/>onDownloaded / onError"]
    end

    subgraph "Renderer Process"
        L["UpdaterMonitor.tsx<br/>Global toast in App.tsx"] -->|"Passive listener"| M["Shows toast on<br/>auto-triggered events"]
        N["DesktopSection.tsx<br/>Settings > Desktop"] -->|"Manual trigger"| O["Check for Updates button<br/>Channel selector<br/>Source selector<br/>Version display"]
    end

    H ---|"ipcMain.handle"| J
    I ---|"webContents.send"| J
    J ---|"window.electronAPI"| L
    J ---|"window.electronAPI"| N

    style A fill:#2d1b69,stroke:#7c3aed,color:#fff
    style C fill:#1a3a2a,stroke:#22c55e,color:#fff
    style D fill:#1a3a2a,stroke:#22c55e,color:#fff
    style E fill:#1e293b,stroke:#38bdf8,color:#fff
    style G fill:#1e293b,stroke:#38bdf8,color:#fff
    style L fill:#312e81,stroke:#818cf8,color:#fff
    style N fill:#312e81,stroke:#818cf8,color:#fff
```

## Update Lifecycle — State Machine

```mermaid
stateDiagram-v2
    [*] --> idle: Component mounts

    idle --> checking: User clicks "Check for Updates"
    idle --> checking: Auto-check on launch / 4h interval

    checking --> up_to_date: No update available
    checking --> available: New version found
    checking --> error: Network / server error

    available --> downloading: autoDownload = true
    downloading --> downloaded: Download complete
    downloading --> error: Download failed

    downloaded --> [*]: User clicks "Restart & Install"
    downloaded --> [*]: App quit (autoInstallOnAppQuit)

    up_to_date --> idle: After 3s timeout
    error --> idle: User retries

    note right of downloaded
        Both UpdaterMonitor (global toast)
        and DesktopSection (settings panel)
        listen to the same IPC events
    end note
```

## File Ownership Map

| Layer | File | Responsibility |
|-------|------|---------------|
| **CI/CD** | `.github/workflows/release.yml` | Builds all platforms, publishes to GitHub Releases + Firebase Storage |
| **Main** | `packages/main/src/updater.ts` | `electron-updater` config, auto-check scheduling, IPC handlers, system notifications |
| **Main** | `packages/main/src/main.ts` | Calls `registerUpdaterHandlers()` (unconditional) + `setupAutoUpdater()` (production only) |
| **Bridge** | `packages/main/src/preload.ts` | Exposes `electronAPI.updater` via `contextBridge` |
| **Types** | `packages/renderer/src/types/electron.d.ts` | TypeScript interface for `ElectronAPI.updater` |
| **UI (Passive)** | `packages/renderer/src/core/components/UpdaterMonitor.tsx` | Global floating toast — reacts to auto-triggered update events |
| **UI (Active)** | `packages/renderer/src/modules/settings/settings-panel/DesktopSection.tsx` | **NEW** — Manual check button, channel/source config, version display |
| **UI (Shell)** | `packages/renderer/src/modules/settings/SettingsPanel.tsx` | Routes to DesktopSection via sidebar nav |

## IPC Channel Reference

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `updater:check` | Renderer → Main | Manual update check (returns `{ available, version }`) |
| `updater:install` | Renderer → Main | Trigger `quitAndInstall()` |
| `updater:set-channel` | Renderer → Main | Switch stable ↔ beta (persisted in `electron-store`) |
| `updater:set-source` | Renderer → Main | Switch GitHub ↔ Firebase feed URL |
| `updater:get-config` | Renderer → Main | Get current channel + source + availability |
| `updater:checking` | Main → Renderer | Update check started |
| `updater:available` | Main → Renderer | New version found (includes version string) |
| `updater:not-available` | Main → Renderer | Already on latest |
| `updater:progress` | Main → Renderer | Download progress (percent, speed, transferred, total) |
| `updater:downloaded` | Main → Renderer | Download complete, ready to install |
| `updater:error` | Main → Renderer | Error during check or download |
