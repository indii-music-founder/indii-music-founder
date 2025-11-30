---
description: How to use Better Agents to build and test new agents
---

# How to Use Better Agents

You can use this workflow to build any type of agent (e.g., a data analyst, a shopping assistant, a creative writer) without getting bogged down in manual setup.

## 1. Prerequisites

- **Node.js**: Ensure you have Node.js (version 22 or higher) installed.
- **Coding Assistant**: Have your preferred AI coding tool ready (e.g., Cursor, Claude Code CLI, or Kilo Code).
- **API Keys**:
  - LLM Provider Key (Anthropic, OpenAI, etc.)
  - LangWatch Key (free observability dashboard)

## 2. Installation

Install the tool globally (or use `npx` as recommended in RULES.md):

```bash
npm install -g @langwatch/better-agents
```

## 3. Initialize Your Project

Navigate to the folder where you want your new agent to live, or create a new one:

```bash
npx @langwatch/better-agents init my-new-agent
```

## 4. Configuration Wizard

The CLI will walk you through a setup wizard. Make the following choices:

- **Language**: TypeScript or Python.
- **Framework**: Mastra (TS) or Agno (Python).
- **Coding Assistant**: Select your tool (e.g., Claude Code, Cursor).
- **LLM Provider**: Select your provider.
- **Agent Goal**: Define what your agent does.
  - *Example*: "Create an inventory management agent that tracks stock levels, predicts reorder dates based on sales velocity, and alerts me when items are low."

## 5. Autonomous Build & Testing

Once initialized, the tool automatically:

1. **Scaffolding**: Generates `AGENTS.md` (best practices) and `.mcp.json` (tools).
2. **Hand-off**: Launches your coding assistant to read instructions and start building.

## 6. Verify & Iterate

Better Agents sets up a `tests/scenarios` folder.

1. **Inspect**: Open generated test files to see the test plan.
2. **Run**: Execute tests to watch a simulated conversation.
3. **Fix**: If tests fail, the CLI uses failure data to instruct the assistant to fix bugs automatically.
