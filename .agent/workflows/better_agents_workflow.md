---
description: How to use Better Agents to build and test new agents
---

# Workflow: Better Agents

**Use to build new agents quickly.**

## 1. Init

* **Install:** `npm install -g @langwatch/better-agents`
* **Create:** `npx @langwatch/better-agents init [agent-name]`

## 2. Configure (Wizard)

* **Lang:** TypeScript / Python
* **Stack:** Mastra / Agno
* **Goal:** Define clear objective (e.g. "Inventory Agent").

## 3. Build & Verify

* **Auto-Build:** Tool generates `AGENTS.md` & `.mcp.json`.
* **Test:**
    1. Open `tests/scenarios`.
    2. Run tests to simulate convo.
    3. Failure? CLI instructs assistant to fix.
