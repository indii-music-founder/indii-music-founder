---
name: agent-capability-wiring
description: Audit, wire, and verify end-to-end tool exposure, capability declarations, and system prompt awareness across all indii specialist agents and the Conductor. Use whenever a new capability, MCP server, tool, engine, or system is added, or when agents say they "cannot find" or don't know about tools built into the platform.
---

# Agent Capability Wiring & Tool Alignment Protocol

When engineers build features, tools, or MCP servers into the indii platform, agents can only see, route, and execute them if all 5 layers of the **Capability Wire Contract** are complete. If any layer is missing, the capability is dead or invisible in product conversations.

---

## The 5-Layer Capability Wire Contract

Whenever a new tool, engine (e.g. Blender MCP, Format Foundry, Essentia, Remotion), or capability is created, check all 5 layers:

```
[Layer 1: Tool Implementation] (tools/*Tools.ts)
           │
           ▼
[Layer 2: Agent Triad Binding] (*Agent.ts)
   ├── A. functions: { [toolName]: Implementation }
   ├── B. authorizedTools: [ ...toolName ]
   └── C. tools[0].functionDeclarations: [ { name: toolName, ... } ]
           │
           ▼
[Layer 3: System Prompt & Instruction] (agents/*/prompt.md)
   ├── Role responsibilities
   ├── Explicit tool invocation examples
   └── Multi-step workflow guidance
           │
           ▼
[Layer 4: Capability Truth & Registry] (capabilityTruth.ts & capability_registry.json)
   ├── Conductor capability inspection
   └── Swarm A2A delegation mappings
           │
           ▼
[Layer 5: Deterministic Unit & Contract Tests] (*Agent.test.ts)
   ├── Assert authorizedTools contains toolName
   ├── Assert functions[toolName] is defined
   └── Test-driven invocation verification
```

---

## Layer Breakdown & Verification Rules

### Layer 1: Tool Implementation (`packages/renderer/src/services/agent/tools/`)
- Ensure the tool function is exported, cleanly typed, and returns `{ success: boolean, data?: any, error?: string }`.
- Ensure renderer/Electron IPC boundary rules are respected (no raw Node.js fs/child_process imports directly in renderer modules).

### Layer 2: The Agent Triad Contract (`packages/renderer/src/services/agent/definitions/*Agent.ts`)
For an agent to invoke a tool, all three must exist and match exactly:
1. `functions[toolName]`: The runtime mapping executing the tool.
2. `authorizedTools.includes(toolName)`: The security allowlist checked by the agent runner.
3. `tools[0].functionDeclarations`: The Gemini function schema (name, description, parameters) exposed to the model.

*Failure Modes:*
- In `functions` & `authorizedTools`, but missing from `functionDeclarations` -> **Agent is blind** to the tool.
- In `functionDeclarations`, but missing from `authorizedTools` -> **Security error** on invocation ("Unauthorized tool").
- In `functionDeclarations` & `authorizedTools`, but missing from `functions` -> **Runtime crash** ("Tool function not found").

### Layer 3: System Prompt Awareness (`agents/<department>/prompt.md`)
- Add the capability under "Core Responsibilities" or "Available Tools".
- Describe *when* and *why* to reach for the tool.
- Provide clear workflow recipes (e.g., "Step 1: Inspect format, Step 2: Validate hypotheses, Step 3: Normalize to graph").

### Layer 4: Conductor & Swarm Registry
- **`packages/renderer/src/services/agent/capabilityTruth.ts`**:
  Update query pattern matchers and capability sets so the Conductor truthfully answers artist questions about platform abilities.
- **`agents/capability_registry.json`**:
  Register the department and tool mapping for A2A swarm delegation.

### Layer 5: Automated Verification
- Run Vitest: `npx vitest run packages/renderer/src/services/agent/definitions/<Agent>.test.ts`
- Run Monorepo Typecheck: `npm run typecheck`
- Assert that both `authorizedTools` and `functions` test suites reflect all new capabilities.

---

## Quick Audit Script

Run this command to inspect any agent's alignment between `authorizedTools` and `functions`:

```bash
node -e '
const fs = require("fs");
const file = process.argv[1];
const content = fs.readFileSync(file, "utf8");
console.log("Auditing:", file);
' <path-to-agent-definition>
```
