# Agent Instructions

> This file is mirrored across **CLAUDE.md**, **AGENTS.md**, **GEMINI.md**, and **DROID.md** to ensure architectural consistency across all AI environments.
>
> **Important:** All these agents can be active and cooperate simultaneously within the same session.

You operate within a sophisticated 3-layer architecture designed to maximize reliability by separating deterministic logic from probabilistic reasoning.

## The 3-Layer Architecture

### Layer 1: Directive (The Blueprint)

- **Content:** Natural language Standard Operating Procedures (SOPs) stored in `directives/`.
- **Purpose:** Defines specific goals, required inputs, tool selection, expected outputs, and robust edge-case handling.
- **Role:** Provides the high-level strategy, much like a manager giving instructions to a specialized employee.

### Layer 2: Orchestration (Decision Making)

- **Content:** The AI agent's reasoning loop (You).
- **Purpose:** Performs intelligent task routing, sequences tool calls, handles runtime errors, and requests clarification when intent is ambiguous.
- **Role:** Acts as the "glue" between human intent and machine execution. You do not perform heavy lifting directly; you interpret a `directive/` (e.g., `scrape_website.md`) and orchestrate the necessary `execution/` scripts.

### Layer 3: Execution (The Action)

- **Content:** Deterministic Python/TypeScript scripts and tools stored in `execution/`.
- **Purpose:** Handles API interactions, complex data processing, file system operations, and database state changes.
- **Role:** Ensures reliable, testable, and high-performance outcomes. Complexity is pushed into code so that the agent can focus on high-level decision-making.

**The Multiplier Effect:** By pushing complexity into deterministic execution layers, we avoid the "compound error" trap (where 90% accuracy over 5 biological steps leads to failure). Determinism at the base allows for reliability at the peak.

### Operating Principles

**1. Check for tools first**
Never reinvent the wheel. Before writing a new script, audit `execution/` for existing tools that fulfill the directive.

**2. Self-anneal on failure**
When a script fails, analyze the stack trace, fix the deterministic code, and re-verify. If a fix involves external costs (tokens/credits), seek user approval before proceeding.

### 3. API SECURITY & CREDENTIALS POLICY

> [!WARNING]
> This is a core architectural policy. Violations are treated as terminal errors.

#### 3.1 Identifiers vs. Secrets

- **Firebase API Keys (`AIza*`):** These are **identifiers**, not secrets. They identify the project for billing and quotas but do not provide authorization. It is safe to include them in code or configuration files.
- **True Secrets:** Service Account JSONs, Stripe Secret Keys, GitHub Tokens (`ghp_*`), and private keys. These must **NEVER** be hardcoded or checked into version control.

#### 3.2 Firebase API Key Best Practices

1. **Security via Rules:** Authorization to backend resources (Firestore, Storage) is controlled via **Firebase Security Rules**, not by hiding the API key.
2. **API Restrictions:** Always apply restrictions in the GCP Console to limit keys to specific APIs (e.g., Identity Toolkit, Firestore).
3. **Service Separation:** Use separate keys for non-Firebase services (like Google Maps) to manage quotas and rotations independently.
4. **Environment Isolation:** Use environment-specific keys (Staging vs. Production) via `.env` files to prevent cross-project interference.
5. **No Client-Side Trust:** Never trust the client-side configuration. Always enforce logic on the server/security rule layer.

#### 3.3 Implementation Pattern

```typescript
// ✅ CORRECT - Use environment variables for isolation
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

// ❌ TERMINAL VIOLATION - Hardcoding a True Secret
const stripeSecret = "sk_live_..."; 
```

#### 3.4 Enforcement

1. **Scan:** Self-scan for sensitive secret patterns before completion.
2. **Verify:** Reference the [API Credentials Policy](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/docs/API_CREDENTIALS_POLICY.md) for all credential handling.

### 5. API Credentials Policy Compliance (STRICT)

All agents must adhere to the [API Credentials Policy](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/docs/API_CREDENTIALS_POLICY.md).

- NO modifications to `.env` or key rotations without explicit user approval.
- Follow the validation checklist before any credential changes.

**Post-Mortem Note (2025-01-17):** A hardcoded Firebase config was found in `scripts/send-reset.js`. This policy exists to prevent future occurrences. There are no exceptions.

### 6. ⛔ ERROR MEMORY PROTOCOL (MANDATORY)

> Never fix the same error twice. This protocol ensures institutional memory of debugging wins.

Before debugging ANY error, you MUST follow this workflow:

1. **STOP** – Do not immediately attempt a fix.
2. **CHECK LEDGER** – Open `.agent/skills/error_memory/ERROR_LEDGER.md` and search for matching patterns.
3. **CHECK MEM0** – Query `mcp_mem0_search-memories(query="<error message>", userId="indiiOS-errors")`.
4. **APPLY FIX** – If a match is found, apply the documented solution verbatim.
5. **DOCUMENT NEW** – If this is a genuinely new error, add it to the ledger AND mem0 after solving.

**Adding to mem0:**

```javascript
mcp_mem0_add-memory(
  content="ERROR: <pattern> | FIX: <solution> | FILE: <relevant file>",
  userId="indiiOS-errors"
)
```

**Failure to check the ledger first is a protocol violation.**
