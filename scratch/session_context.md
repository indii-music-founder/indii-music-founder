# Antigravity Session Context & Memory

## 1. Environment & Workspace
- **Operating System:** macOS
- **Workspace:** `/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indiiOS-Clean` (indiiOS-Clean)
- **App Data Directory:** `/Volumes/X SSD 2025/Users/narrowchannel/.gemini/antigravity`
- **Current Conversation ID:** 56ae9916-4222-41c8-9e4a-4346202d523f

## 2. Project Overview: indiiOS
**indiiOS** is a multi-tenant, AI-native creative platform for independent music producers, visual artists, and creators.
- **Version:** 0.1.0-beta.2
- **Architecture:** 3-Layer Architecture (Directive -> Orchestration -> Execution)
- **Tech Stack:**
  - **Frontend:** React 18, Vite 6.4, TailwindCSS 4.1, Zustand 5.0, Framer Motion, Fabric.js, React Flow
  - **Backend:** Firebase Functions (Gen 2, Node.js 22), Genkit AI, Inngest, Stripe, Firestore, Cloud Storage
  - **Desktop:** Electron 33 (Forge/Builder), Keytar, SSH2/SFTP, FFmpeg
  - **Testing:** Vitest, Playwright
- **Agent Integration:** Hub-and-Spoke Architecture (`indii Conductor` routing to specialists like Legal, Brand, Marketing, etc., alongside a Dockerized Python Sidecar).

## 3. Operational Directives & Agent Charter
- **Prime Directives:** No Token Saving, Full Implementation (no placeholders), Active Security Scanning.
- **AI Model Policy:**
  - Approved: `gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-3-pro-image-preview`.
  - Temperature strictly maintained at **1.0** (or **0.0** for factuality/RAG).
- **Security:** Strict API Credentials Policy. API Keys are identifiers, True Secrets (Service Accounts, Stripe, Git tokens) must never be hardcoded or logged.
- **Error Memory Protocol:** Always consult `.agent/skills/error_memory/ERROR_LEDGER.md` or `mcp_mem0_search-memories` before resolving errors.

## 4. Current Session State
**Open Documents:**
- `packages/renderer/src/services/agent/tools/BugReportTools.ts`
- `packages/renderer/src/core/store/slices/agent/agentUISlice.ts`
- `packages/firebase/src/legal/mechanicalLicense.ts`
- `packages/firebase/src/lib/touring.ts`
- `packages/renderer/src/hooks/useAuthHealth.ts`

**Running Background Tasks:**
- `[Scheduler] Firing task: "Neural Sync"`

**Model Selection:**
- Upgraded to: **Gemini 3.1 Pro (High)**

**Recent Context:**
- Addressed CI Pipeline stabilization, Vitest Monorepo config errors, QA execution, and Gemini Vision integration. Master focus has been on driving the `v1.50.0` / `v1.51` releases to production.

## 5. Available Integrations & Capabilities
- **MCP Servers:** cloudrun, exa, firebase-mcp-server, genkit-mcp-server, google-developer-knowledge, index, index-shared-memory, jcodemunch, mem0.
- **Workflows:** extensive workflows for QA (`/auto_qa`), testing (`/test`, `/10k-click-test`), agent creation (`/better_agents_workflow`), deployment, and session prep (`/opp`, `/newchat`).
- **Skills:** Dozens of specialized skills covering UI/UX, AWS/Azure, frontend patterns, state management, python/golang/TS protocols, security, game dev, and structural project execution. The model uses the `view_file` tool to ingest specific skill definitions before task execution.
