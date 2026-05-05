# Open Issues — Real-Life Test Findings

> This file is written by the /real test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-05-05T14:57:00Z
> **Current UX Score:** TBD — Target: 30/30

---

### ISSUE-001: generate_image tool fails when count > 1
- **Status:** ✅ FIXED (2026-05-05)
- **Severity:** 🔴 HIGH
- **Fix:** Removed `count` field from `generate_image` tool declaration in `GeneralistAgent.ts`. Agents can no longer request multiple candidates. Added explicit instruction "do NOT set count" to rule #2 in the execution rules.
- **Files:** `packages/renderer/src/services/agent/specialists/GeneralistAgent.ts`

---

### ISSUE-002: Boardroom Conductor delegates to agents that are NOT seated
- **Status:** ✅ FIXED (2026-05-05)
- **Severity:** 🔴 HIGH
- **Fix 1:** `AgentService.ts` now injects `[SEATED_AGENTS]` manifest into every Boardroom system context, listing the names of currently seated agents by name.
- **Fix 2:** `GeneralistAgent.ts` system prompt now has Rule #8: "BOARDROOM SEATING AWARENESS — CRITICAL: Only address agents in the SEATED_AGENTS list. If a needed specialist is absent, tell the user to seat them."
- **Files:** `packages/renderer/src/services/agent/AgentService.ts`, `packages/renderer/src/services/agent/specialists/GeneralistAgent.ts`

---

### ISSUE-003: Raw JSON tool output rendered in chat bubble
- **Status:** 🟡 OPEN — Needs ToolOutputRenderer fix
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Error Communication
- **Module:** Boardroom → Chat → ToolOutputRenderer / ChatMessage
- **Steps to Reproduce:**
  1. Any tool call result is rendered verbatim in the Boardroom chat
  2. User sees raw JSON: `{"success":true,"data":{"bugId":"bug-177...`
- **User Impact:** Deeply confusing raw JSON in user-facing messages.
- **Notes:** `BoardroomConversationPanel` renders `msg.text` raw. The agent's message should only show the human-readable `message` field from tool results. Need to parse tool_result blocks out of the streamed text and either hide them or render them as a collapsed card.
- **Next Fix:** Strip `[Tool: tool_name] {...JSON...} [End Tool tool_name]` blocks from `msg.text` before rendering in `BoardroomConversationPanel`.

---

### ISSUE-004: Bug reports go to Firestore but have no human-visible inbox
- **Status:** 🟡 PARTIALLY FIXED (2026-05-05)
- **Severity:** 🟡 MEDIUM
- **Fix Applied:** `BugReportTools.ts` now supports GitHub Issues integration. Set `VITE_GITHUB_TOKEN` (fine-grained token with Issues write permission) and `VITE_GITHUB_REPO=new-detroit-music-llc/indiiOS-Alpha-Electron` in `.env` to activate.
- **Pending:** You (the founders) need to configure these env vars and create the GitHub labels (`severity:critical`, `severity:major`, `severity:minor`, `module:boardroom`, etc.) in the repo for clean triage.
- **Files:** `packages/renderer/src/services/agent/tools/BugReportTools.ts`, `.env.example`

---

### ISSUE-005: Scratchpad "malformed edit" error in browser subagent
- **Status:** 🔵 INTERNAL — Not a product bug
- **Severity:** 🔵 LOW
- **Notes:** The browser subagent (Antigravity's internal testing tool) sometimes produces malformed edits to its own scratchpad file. This does not affect the indiiOS product. It causes test sessions to stall. Workaround: browser subagent sessions are restarted. Root cause is likely model-level formatting variance in the scratchpad write tool. Track but do not prioritize over product issues.
