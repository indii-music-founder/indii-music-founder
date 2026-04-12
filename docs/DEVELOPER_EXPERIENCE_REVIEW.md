# 🚀 Developer Experience (DX) Review: indiiOS-Clean

**Date:** April 12, 2026  
**Auditor:** Antigravity (Gemini 3 Pro)  
**Status:** Initial Audit Complete  
**Objective:** Reduce development friction, harden environment security, and streamline agentic workflows.

---

## 📊 Summary of Findings

| Category | Status | Friction Level | Key Issue |
| :--- | :---: | :---: | :--- |
| **Onboarding** | 🟡 | Medium | Global tool dependencies (npm -g) & manual auth steps. |
| **Security** | 🔴 | High | Hardcoded API keys and auth tokens in `mcp_config.json`. |
| **Workflows** | 🟡 | Medium | Undiscovered scripts (50+ files in `scripts/`) & manual MCP setup. |
| **Performance** | 🟢 | Low | Build system (`electron-vite`) is modern, but builds are sequential. |
| **Consistency** | 🟡 | Medium | Monorepo structure is solid, but `typecheck` is manual. |

---

## 🔍 Detailed Analysis

### 1. Secret Management & Security (CRITICAL)
The `mcp_config.json` file contains several plain-text secrets, including `EXA_API_KEY`, `SENTRY_AUTH_TOKEN`, and `MEM0_API_KEY`. 
- **Risk:** These keys could be accidentally committed or leaked through logs.
- **Friction:** Changing environments (e.g., from dev to staging) requires manual JSON editing.

### 2. Fragmentation of Automation
The `scripts/` directory contains 50+ scripts, ranging from `diagnose-stuck-agent.sh` to `the-auditor.ts`. 
- **Friction:** New developers have no central dictionary of available tools.
- **Opportunity:** Consolidate these into a task runner (e.g., `npm run help`) or a unified `indii-cli`.

### 3. Environment Stability
`env-guardian.sh` provides a good backup mechanism, but the validation schema in `scripts/validate-env.ts` hasn't kept pace with the growing number of agentic tools (MCP tokens).

---

## 🛠 Proposed DX Optimizations (Phase 1)

### [DX-01] MCP Secret Hardening
**Objective:** Move all secrets from `mcp_config.json` to `.env`.
- Use environment variable expansion in `mcp_config.json` (if supported by the runner) or create a pre-start script to inject them.
- Update `env-schema.json` and `validate-env.ts` to include all MCP-specific tokens.

### [DX-02] Unified Discovery Mode
**Objective:** Make automation discoverable.
- Implement a `the-conductors-manual.md` or update `README.md` with a categorization of the `scripts/` folder.
- Add a `help` script to `package.json` that parses JSDoc headers from script files to show their purpose.

### [DX-03] Smart Pre-flights
**Objective:** Catch issues before they hit CI.
- Integrate `scripts/validate-env.ts` into the `npm run dev` and `npm test` pre-flights.
- Setup `lint-staged` and `simple-git-hooks` to run fast checks on changed files only.

---

## 📈 Next Actions

1. [ ] **Action 1:** Migrate the `SENTRY_AUTH_TOKEN` and `MEM0_API_KEY` from `mcp_config.json` to `.env`.
2. [ ] **Action 2:** Update `scripts/validate-env.ts` to enforce presence of these tokens.
3. [ ] **Action 3:** Create a unified `indii` alias/shortcut for common developer tasks.

---
> [!TIP]
> **Proactive DX:** We can automate the injection of `.env` secrets into MCP configurations by creating a small wrapper around the MCP runner that performs string replacement.
