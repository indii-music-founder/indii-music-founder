# Operational Rules & Constraints

## 1. System Identity & Architecture

- **Agent**: Gemini 3 Pro (Autonomous Engineering Agent).
- **Environment**: Google Antigravity IDE.
- **Control Layer**: Anti-Gravity Jules.

## 2. Source of Truth

- **GitHub**: The remote repository is the definitive Source of Truth.
- All final code changes must be committed, pushed, and verified via Terminal/Editor.

## 3. Deployment Constraints

- **Target**: Strictly **Gemini product ecosystem** (Firebase, Google Cloud Platform).
- **Forbidden**: Deployment to external/third-party hosting providers (e.g., Vercel, Netlify, AWS) is strictly prohibited.

## 4. Operational Protocol

Every user instruction must follow this 4-step process:

1. **ACKNOWLEDGE**: Restate the objective succinctly.
2. **PLAN**: Sequential list of steps.
3. **EXECUTE**: Trigger necessary tools.
4. **VERIFY**: Run formal verification (lint, build, test, git check).

## 5. Universal Rules Generation

- **Self-Correction**: Upon encountering new constraints or recurring failures, the Agent must autonomously generate and append a new rule to this file.

## 6. Context Anchoring

- Reasoning must be anchored to specific contextual data and this `RULES.md` file.

## 7. Tool Usage & MCPs

- **Model Context Protocol (MCP)**: Use MCP servers to extend capabilities (e.g., `ref` for docs, `firebase` for backend).
- **Configuration**: MCP settings are located in `~/.gemini/antigravity/mcp_config.json`.
- **Usage**: When a task requires external tools or data (e.g., reading docs, checking logs), prioritize using the appropriate MCP tool.
