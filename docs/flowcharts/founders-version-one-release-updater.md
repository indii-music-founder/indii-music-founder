# Founders Version One Release Updater Flowchart

Purpose: maps the desktop release identity and auto-update path for the Founders Version One launch. The public app label starts at Founders Version One, while the technical Electron semver remains monotonic so installed builds newer than `v1.50.0` can update without being treated as a downgrade.

```mermaid
graph TD
    UserSettings["User opens Settings Desktop Updates"] --> DesktopSection["DesktopSection release card"]
    DesktopSection --> ConfigIPC["electronAPI.updater.getConfig"]
    ConfigIPC --> UpdaterMain["updater.ts release identity and feed config"]
    UpdaterMain --> ReleaseLabel["Public label Founders Version One"]
    UpdaterMain --> TechnicalVersion["Technical build version from app.getVersion"]

    UserSettings --> ManualCheck["Check for Updates button"]
    ManualCheck --> CheckIPC["updater:check IPC"]
    CheckIPC --> GitHubFeed["GitHub Releases feed"]
    CheckIPC --> FirebaseFeed["Optional Firebase generic feed"]

    GitHubFeed --> ManifestGate["Updater manifest gate"]
    FirebaseFeed --> ManifestGate
    ManifestGate -->|Manifest exists| DownloadUpdate["Download platform installer"]
    ManifestGate -->|Manifest missing or 404| FriendlyError["Clear Founders Version One repair message"]
    DownloadUpdate --> InstallReady["Restart and Install"]

    ReleaseWorkflow["release.yml tag workflow"] --> Builder["electron-builder publish always"]
    Builder --> GitHubAssets["GitHub release assets"]
    Builder --> LocalManifestCheck["Verify local latest manifests"]
    GitHubAssets --> PublishedManifestCheck["Verify published manifest assets"]
    PublishedManifestCheck --> ManifestGate

    style UserSettings fill:#00D4FF,stroke:#0284c7,stroke-width:2px,color:#001018
    style DesktopSection fill:#00D4FF,stroke:#0284c7,stroke-width:2px,color:#001018
    style ConfigIPC fill:#8A2BE2,stroke:#5b21b6,stroke-width:2px,color:#fff
    style UpdaterMain fill:#8A2BE2,stroke:#5b21b6,stroke-width:2px,color:#fff
    style ReleaseLabel fill:#FF8C00,stroke:#b45309,stroke-width:2px,color:#111
    style TechnicalVersion fill:#FF8C00,stroke:#b45309,stroke-width:2px,color:#111
    style GitHubFeed fill:#39FF14,stroke:#15803d,stroke-width:2px,color:#001018
    style FirebaseFeed fill:#39FF14,stroke:#15803d,stroke-width:2px,color:#001018
    style ManifestGate fill:#FF00FF,stroke:#be185d,stroke-width:2px,color:#fff
    style FriendlyError fill:#FF00FF,stroke:#be185d,stroke-width:2px,color:#fff
    style ReleaseWorkflow fill:#8A2BE2,stroke:#5b21b6,stroke-width:2px,color:#fff
```

## Transition Breakdown

1. `DesktopSection.tsx` asks `electronAPI.updater.getConfig()` for the current channel, source, updater availability, public release label, founder release number, and technical build version.
2. `packages/main/src/updater.ts` returns `Founders Version One` as the human release identity and `app.getVersion()` as the semver value used by Electron updater. These must stay separate because Electron updater rejects lower versions when `allowDowngrade` is false.
3. Manual update checks call `updater:check`, which queries the active feed. GitHub Releases is the default source; Firebase remains selectable only when its generic feed is correctly published and public.
4. Missing manifest failures such as `latest-mac.yml` returning `404` are converted into a user-safe message explaining that the release needs repaired updater manifests.
5. `.github/workflows/release.yml` now blocks incomplete release jobs by verifying both the local manifest file and the published GitHub Release asset for each platform.
6. A release is not complete until the newer semver tag publishes platform artifacts and `latest-mac.yml`, `latest.yml`, and `latest-linux.yml` can be downloaded from the release asset URLs.
