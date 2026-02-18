# indiiOS Deployment & Installation Strategy (The "One-Click" Vision)

## 1. The Current Architecture

- **Host:** Electron App (The Desktop Shell)
- **Engine:** Docker Containers (Agent Zero, indii-orchestrator)
- **Integration:** OpenClaw / indiiOS Hybrid Logic

## 2. The Challenge

Non-technical artists cannot be expected to install Docker, set up environment variables, or run CLI commands. We need a "Consumer-Grade" experience.

## 3. The "One-Click" Roadmap

### Step 1: The Bundled Installer (dmg/exe)

- Use **Electron Builder** to package the app into a single installer.
- **Embedded Docker:** Investigate "Docker Desktop" alternative or bundling lightweight container runtimes (like `colima` or `finch`) directly inside the installer.

### Step 2: The "Bootstrap" Onboarding

- Upon first launch, the app runs a "System Check."
- **Auto-Pull:** If Docker isn't present, the app offers to install a lightweight, managed version for the artist.
- **Identity Setup:** User enters their Name/Brand Kit once; indiiOS handles all `.env` and config generation in the background.

### Step 3: The "Ghost" Updates

- Use **Electron-Updater** for seamless, background updates.
- The artist should never see a terminal window.

## 4. Implementation Backlog

- [ ] Research **Docker Desktop**'s new "Extensions" and "Embedded" licensing for commercial apps.
- [ ] Prototype an Electron-based "Installer Wizard" that handles dependency checks.
- [ ] Build the "Initial Boot" diagnostic UI in the `indiiOS-Alpha-Electron` codebase.
