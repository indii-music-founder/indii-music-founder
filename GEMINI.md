# Agent Instructions

> This file is mirrored across **CLAUDE.md**, **AGENTS.md**, **GEMINI.md**, and **DROID.md** to ensure architectural consistency across all AI environments.
>
> **Important:** All these agents can be active and cooperate simultaneously within the same session.

You operate within a sophisticated 3-layer architecture designed to maximize reliability by separating deterministic logic from probabilistic reasoning.

### The 3-Layer Architecture

#### Layer 1: Directive (The Blueprint)

- **Content:** Natural language Standard Operating Procedures (SOPs) stored in `directives/`.
- **Purpose:** Defines specific goals, required inputs, tool selection, expected outputs, and robust edge-case handling.
- **Role:** Provides the high-level strategy, much like a manager giving instructions to a specialized employee.

#### Layer 2: Orchestration (Decision Making)

- **Content:** The AI agent's reasoning loop (You).
- **Purpose:** Performs intelligent task routing, sequences tool calls, handles runtime errors, and requests clarification when intent is ambiguous.
- **Role:** Acts as the "glue" between human intent and machine execution. You do not perform heavy lifting directly; you interpret a `directive/` (e.g., `scrape_website.md`) and orchestrate the necessary `execution/` scripts.

#### Layer 3: Execution (The Action)

- **Content:** Deterministic Python/TypeScript scripts and tools stored in `execution/`.
- **Purpose:** Handles API interactions, complex data processing, file system operations, and database state changes.
- **Role:** Ensures reliable, testable, and high-performance outcomes. Complexity is pushed into code so that the agent can focus on high-level decision-making.

**The Multiplier Effect:** By pushing complexity into deterministic execution layers, we avoid the "compound error" trap (where 90% accuracy over 5 biological steps leads to failure). Determinism at the base allows for reliability at the peak.

### Operating Principles

**1. Check for tools first**
Never reinvent the wheel. Before writing a new script, audit `execution/` for existing tools that fulfill the directive.

**2. Self-anneal on failure**
When a script fails, analyze the stack trace, fix the deterministic code, and re-verify. If a fix involves external costs (tokens/credits), seek user approval before proceeding.

**3. ⛔ ZERO-TOLERANCE API KEY POLICY (TERMINAL VIOLATION)**

> This is an absolute, non-negotiable rule. Violation is treated as a system crash.

**NEVER HARDCODE:**

- Firebase API keys, project IDs, or configuration objects
- Google Cloud / Vertex AI API keys
- Stripe secret keys or publishable keys
- GitHub tokens (`ghp_*`), OpenAI keys (`sk-*`), or any third-party API credentials
- Database connection strings, passwords, or authentication tokens

**REQUIRED PATTERN:**

```typescript
// ✅ CORRECT - Always load from environment
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
  // ...
};

// ✅ CORRECT - For Vite frontend
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// ❌ TERMINAL VIOLATION - Hardcoded credentials
const firebaseConfig = {
  apiKey: "AIzaSy...",  // ABSOLUTELY FORBIDDEN
  projectId: "my-project",  // FORBIDDEN IF SENSITIVE
};
```

**ENFORCEMENT:**

1. Before completing ANY script, you MUST self-scan for patterns matching API key formats.
2. If a key is detected, STOP immediately and refactor to use environment variables.
3. Add any new required keys to `.env.example` with placeholder documentation.
4. Add explicit runtime validation that fails gracefully when env vars are missing.

**Post-Mortem Note (2025-01-17):** A hardcoded Firebase config was found in `scripts/send-reset.js`. This policy exists to prevent future occurrences. There are no exceptions.
