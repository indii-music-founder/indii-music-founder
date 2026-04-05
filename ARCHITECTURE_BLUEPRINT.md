# indiiOS Architecture Blueprint (The Map)

This document is the "anti-bus-factor" map of indiiOS. It explains exactly how the 191K lines of code talk to each other so that any new engineer (or AI agent) can instantly understand the stack without reading every file.

## 1. The Core Data Flow

Every interaction in the app follows this exact cycle:
`User Action (React) -> Zustand Store -> Cloud Function -> Python Sidecar -> AI / External API`

### 1a. The Frontend Shell (Electron + React)

- **Entry Point:** `src/core/App.tsx`.
- **Modules (34 total):** Everything is lazy-loaded in `src/modules/*`. You never load what you don't use.
- **State Management:** Driven purely by `src/core/store.ts` (Zustand). Domain states (Finance, Licensing, Creative) are organized in `src/core/store/slices/*`.

### 1b. The Backend (Firebase Cloud Functions)

- **Location:** `functions/src/index.ts`
- **Purpose:** Securely execute tasks (Stripe payouts, distribution polling, metadata rendering) that shouldn't happen on the client.
- **Security:** App Check is enforced on all functions. Firestore rules dictate strict multi-tenant access.

### 1c. The Agentic Harness (indii Conductor) & Python Execution

- **Execution:** `python/tools/*.py` holds 103+ extremely specific scripts doing heavy lifting (e.g., `waterfall_calculator.py`, `ddex_build.py`, `andromeda_deploy.py`).
- **Safety & Resilience:** Orchestration is governed by a hardened harness. `WorkflowStateService` provides persistent, resumable multi-agent execution tracks backed by Firestore. The `ToolRiskRegistry` categorizes all tools into a 3-tier system (read/write/destructive), triggering automated Digital Handshakes for explicit user approval on sensitive actions.
- **Agents:** The 20 specialized models (Legal, Finance, Creative, etc.) are orchestrated via the `indii Conductor`. They analyze a user's prompt, select the right secure tool, execute it, and return the structured result back to the frontend.

## 2. The 5-Layer Memory Architecture

How indiiOS "remembers" context across sessions:

1. **L1 Scratchpad:** Transient state for rapid processing.
2. **L2 Session Memory:** Handled by Zustand across tabs during an active session.
3. **L3 CORE Vault:** Firestore-backed storage of an artist's entire career history.
4. **L4 Captain's Logs:** Immutable audit trails of every AI decision and transaction.
5. **L5 Big Brain Engine:** RAG (Retrieval-Augmented Generation) indexing that lets agents query a user's past work instantly.

## 3. How to Debug Without Going Insane

If something breaks, follow this path:

1. **Types:** Check TypeScript first (`npm run typecheck`). If types are broken, the seams are brittle.
2. **Logs:** The shell wraps `console.log` into a centralized `logger` utility. Read the Activity Feed (`HistoryDashboard.tsx`).
3. **Execution:** If an agent hallucinates, check if its associated Python tool in `python/tools/` is throwing an error. Agents don't fail; their tools fail.

---
*Created automatically to ensure the knowledge of how this system works lives independently of the Founder.*
