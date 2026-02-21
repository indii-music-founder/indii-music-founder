---
name: better_agents
description: How to use Better Agents (LangWatch) to scaffold and test new specialist agents for the indiiOS hub-and-spoke architecture.
---

# @better_agents — Build New Agents Fast

## Purpose

Scaffold, configure, and test new specialist agents using the `@langwatch/better-agents` CLI. Use this when the indiiOS agent roster needs a new domain expert (e.g. a Sync Licensing agent, a Merchandise agent, etc.).

## When to Invoke

- When a new specialist domain emerges that no existing agent covers
- When refactoring an existing monolithic agent into a focused specialist
- When the user asks "can you build me an agent that does X"

---

## Step 1 — Install & Init

```bash
npm install -g @langwatch/better-agents

# Scaffold the new agent (replace [name] with snake_case agent name)
npx @langwatch/better-agents init [agent-name]
# Example: npx @langwatch/better-agents init sync-licensing-agent
```

---

## Step 2 — Configure via Wizard

When the CLI wizard runs, answer:

| Prompt | indiiOS Standard Answer |
|--------|------------------------|
| Language | TypeScript |
| Stack | Mastra or Agno |
| Goal | Clear one-line objective (e.g. "Manage sync licensing deals and pitch placements") |

This generates:

- `AGENTS.md` — agent system prompt and tool definitions
- `.mcp.json` — MCP server configuration for tool access

---

## Step 3 — Integrate with Agent Zero Hub

After scaffolding, register the new agent in the hub-and-spoke:

```typescript
// agents/agent0/index.ts — add to specialist registry
import { SyncLicensingAgent } from '../sync-licensing';

const specialists = {
  // ... existing specialists
  sync_licensing: new SyncLicensingAgent(),
};
```

Place agent definition files at:

```
agents/[agent-name]/
  ├── index.ts          # Agent class + tool definitions
  ├── AGENTS.md         # System prompt (from Better Agents wizard)
  └── .mcp.json         # MCP tool bindings
```

---

## Step 4 — Build & Verify

```bash
# Run the agent's test scenarios
cd agents/[agent-name]
npx @langwatch/better-agents test

# If failure: CLI outputs specific fix instructions — apply them
# Then re-run until all scenarios pass
```

Manual verification:

1. Open `tests/scenarios/` — review test conversations
2. Run specific scenario: `npx @langwatch/better-agents test --scenario "scenario_name"`
3. Confirm no hallucinated tools (agent must only call registered tools)

---

## indiiOS Agent Architecture Reference

```
agents/
├── agent0/             # Hub orchestrator — routes to specialists
├── creative-director/  # Image/video creative decisions
├── finance/            # Revenue, royalties, payouts
├── legal/              # Contract review, rights
├── licensing/          # Sync + master licensing
├── marketing/          # Campaigns, copywriting
├── music/              # Music analysis, metadata
├── publicist/          # PR, press releases
├── publishing/         # Publishing admin
├── road/               # Tour logistics
├── social/             # Social media management
└── video/              # Video production pipeline
```

New agents follow the same pattern. Always register with `agent0` after creation.
