# AGENT BRIDGE PROTOCOL (ABP) v1.0

This file serves as the **Synchronization Bus** between **Antigravity** (Visual QA / Strategist) and **OpenClaw** (Builder / Fixer).

## 📡 CURRENT STATE

**STATUS:** `ROADMAP_LOCKED`
**ACTIVE AGENT:** Antigravity / OpenClaw (Parallel)
**LAST UPDATE:** 2026-02-03 T17:15:00 EST

---

## 🏆 THE GOLDEN 20 (PRODUCTION ROADMAP)

**Target:** v1.0.0 Sovereign Release | **Status:** PRIORITIZED

### 🚨 PHASE 1: THE CORE STABILITY (Must Fix Immediately)

*Items that prevent the app from functioning reliability or crashing.*

1. **Strict Type Safety (Zero `any`)** [Antigravity #1]
    - **Why:** Prevents "Shape Mismatch" crashes (like Cycle 10).
    - **Action:** Compile with `noImplicitAny: true`.

2. **Graceful HMR & State Recovery** [Antigravity #2]
    - **Why:** Development velocity is killed by "Hard Refresh" requirements.
    - **Action:** Fix Vite/Electron HMR configuration.

3. **CDP Hardening & Rate Limiting** [OpenClaw #1 + #6]
    - **Why:** Prevents browser automation from timing out or getting banned.
    - **Action:** Implement "Cooling Periods" and robust session recovery.

4. **Universal Error Boundaries** [Antigravity #3]
    - **Why:** A single bad node shouldn't crash the entire Canvas.
    - **Action:** Wrap all Node types in granular boundaries.

5. **Real-Time State Sync (Chat <-> Canvas)** [Antigravity #5]
    - **Why:** The Chat needs to know *instantly* when the Canvas changes (and vice-versa).
    - **Action:** Firestore `onSnapshot` or Shared Memory Store.

### 🔒 PHASE 2: SECURITY & TRUST (Must Have for Money/Identity)

*Items related to credentials, payments, and data integrity.*

1. **Unified Biometric Security Vault** [Merged: Antigravity #6 + OpenClaw #2]
    - **Why:** Route guards (`/payouts`) and Agent Credentials must be locked behind TouchID/FaceID.
    - **Action:** Hardware-backed credential encryption.

2. **DDEX ERN 4.3 Certification** [Merged: Antigravity #7 + OpenClaw #3]
    - **Why:** Spotify/Apple will reject deliveries if the XML is slightly off.
    - **Action:** Validate generated XML against official XSD schemas.

3. **Audit Log Encryption** [OpenClaw #7]
    - **Why:** User data (agent logs) must be private and encrypted at rest.
    - **Action:** Local encryption for SQLite/Log files.

4. **Human-in-the-Loop Payment Bridge** [OpenClaw #10]
    - **Why:** Agents cannot spend money without explicit user approval.
    - **Action:** Secure "Approve Transaction" UI modal.

### 📦 PHASE 3: THE CONSUMER PRODUCT (Must Have for Launch)

*Items that make the app feel like a polished product, not a dev tool.*

1. **One-Click Installer (Electron Builder)** [OpenClaw #9]
    - **Why:** Users won't install Docker/Python manually.
    - **Action:** Bundle *everything* into a single `.dmg` / `.exe`.

2. **Asset Logic Hardening (Blob vs Base64)** [Antigravity #4]
    - **Why:** Performance. Base64 strings lag the UI.
    - **Action:** Migrate to `URL.createObjectURL`.

3. **Offline-First Capability** [Antigravity #8]
    - **Why:** The app must work on an airplane.
    - **Action:** Local-first checks before API calls.

4. **Responsive & Mobile Polish** [Antigravity #10]
    - **Why:** Window resizing shouldn't break the layout.
    - **Action:** CSS Media Queries and Flexbox hardening.

5. **Hybrid Orchestrator Self-Correction** [OpenClaw #4]
    - **Why:** If "Flash" models fail, the system should auto-upgrade to "Pro".
    - **Action:** Automatic Model Fallback logic.

6. **Distribution State Machine** [OpenClaw #5]
    - **Why:** Tracking the status of an album delivery across 50 DSPs needs a persistent ledger.
    - **Action:** SQLite/Firestore state machine for Releases.

### 🧪 PHASE 4: AUTOMATION & SCALING

*Items that ensure we can maintain the app long-term.*

1. **Automated E2E Testing (CI/CD)** [Antigravity #9]
    - **Why:** "It works on my machine" isn't good enough.
    - **Action:** Playwright pipeline on GitHub Actions.

2. **Universal Node Extensibility** [OpenClaw #8]
    - **Why:** Future-proofing for new node types (Streaming Data).
    - **Action:** Plugin architecture for the Node Engine.

---

## 🚨 IMMEDIATE TASKS (PHASE 1 - CORE STABILITY)

### [ACTIVE] Antigravity

1. **Strict Type Safety**: Audit `src/modules/workflow` for `any` types.
2. **Graceful HMR**: Investigate `vite.config.ts` for HMR persistence settings.

### [ACTIVE] OpenClaw

1. **CDP Hardening**: Strengthen the `puppeteer` / `playwright` bridge.
2. **Real-Time Sync**: Draft the Firestore `onSnapshot` architecture.

---

## 🤖 SYSTEM LOG

- **[Antigravity]**: REFACTOR COMPLETE. "Golden 20" Consolidated into Single Source of Truth (`AGENT_BRIDGE.md`).
- **[Action]**: Proceeding to Phase 1 Execution.
