# A2A (Agent-to-Agent) Protocol Implementation Plan

## 1. Architectural Objective
Transition the current `indiiOS` Hub-and-Spoke (broadcast) orchestration model to a decentralized, vendor-neutral Swarm architecture using the **A2A Protocol**. This will enable peer-to-peer (P2P) communication, allowing specialized agents (e.g., Node.js Creative Agent, Python sidecar agents) to autonomously discover, query, and collaborate with each other using JSON-RPC 2.0, Agent Cards, and SSE streaming.

## 2. Core Mechanics (The "Ultrathin" Architecture)

### 2.1 Agent Cards (Discovery)
Each specialist agent will expose an `Agent Card` (metadata schema) defining its capabilities, required inputs, and output formats.
*   **Implementation:** Create `packages/renderer/src/services/agent/a2a/cards/` containing JSON schemas for Marketing, Creative, Legal, etc.
*   **Python Sidecar:** Update `agents/_context.md` equivalents in the Python sidecar to expose an `/a2a/card` endpoint.

### 2.2 The A2A Transport Layer
Standardize all inter-agent communication to use JSON-RPC 2.0.
*   **Synchronous:** Standard HTTP POST for fast requests (e.g., requesting a quick tagline).
*   **Asynchronous:** Server-Sent Events (SSE) for long-running generations (e.g., waiting for Video rendering or heavy Python task execution).
*   **Security:** Enforce the existing E2E Encryption protocol (RSA-4096 + AES-256-GCM) defined in `docs/E2E_ENCRYPTION.md` to ensure sensitive A2A traffic remains opaque.

### 2.3 The Toolchain (`consult_specialist`)
Instead of the Conductor making decisions for everyone, agents will be given a universal A2A tool.
*   **Tool Signature:** `consult_specialist(agentId: string, payload: json)`
*   **Execution:** When the Creative Agent needs copy, it suspends, fires `consult_specialist(marketing, {...})`, and awaits the JSON-RPC response before continuing.

## 3. Implementation Phases

### Phase 1: Infrastructure & Middleware Re-activation
*   **Task 1.1:** Re-enable the `/a2a` ASGI middleware route in the Python sidecar (`run_ui.py`) which was temporarily disabled during the Agent Zero stabilization.
*   **Task 1.2:** Implement an `A2AClient.ts` in the frontend (`packages/renderer/src/services/agent/a2a/`) to handle JSON-RPC payload formatting and SSE connection management.

### Phase 2: Agent Card Registry
*   **Task 2.1:** Define the base `AgentCard` TypeScript interface.
*   **Task 2.2:** Refactor existing Node.js specialists to register their Agent Cards with the Conductor upon startup.
*   **Task 2.3:** Implement a `/discovery` endpoint in the Sidecar to sync Python-based tools.

### Phase 3: Swarm Orchestration Update
*   **Task 3.1:** Deprecate `handleBoardroomMultiDispatchFlow` (the blind broadcast approach).
*   **Task 3.2:** Introduce the A2A tool to the `GeneralistAgent` and all `SpecialistAgents`.
*   **Task 3.3:** Update `LivingPlanService.ts` to emit A2A JSON-RPC requests for inter-dependent Plan Steps (e.g., Step B awaits A2A response from Step A).

### Phase 4: E2E Encryption & Audit
*   **Task 4.1:** Hook into the existing encryption handlers so payload data in transit between Node and the Docker Sidecar is strictly encrypted per `docs/E2E_ENCRYPTION.md`.

## 4. Verification & QA
*   **Test Case 1:** The Creative Agent autonomously requests and receives ad copy from the Marketing Agent using the `consult_specialist` tool.
*   **Test Case 2:** Verify A2A traffic over the Python Sidecar uses SSE and does not block the Node.js main thread.

---
**Status:** Sync Mode Only. Awaiting user review before code execution.
