# Open Issues — Real-Life Test Findings

> This file is written by the /real test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-05-05T15:05:00Z
> **Commit:** `ad903c25` — feature/chat-image-studio-handoff
> **Current UX Score:** In Progress

---

### ISSUE-001: generate_image tool fails when count > 1
- **Status:** ✅ FIXED (ad903c25)
- **Severity:** 🔴 HIGH
- **Fix:** Removed `count` field from `generate_image` tool declaration. Rule #2 updated: "do NOT set count."
- **Files:** `GeneralistAgent.ts`

---

### ISSUE-002: Boardroom Conductor delegates to agents NOT seated
- **Status:** ✅ FIXED (ad903c25)
- **Severity:** 🔴 HIGH
- **Fix 1:** `AgentService.ts` injects `[SEATED_AGENTS]` manifest listing seated agent names by their display names.
- **Fix 2:** `GeneralistAgent.ts` Rule #8: Only address agents in SEATED_AGENTS; if absent, tell user to seat them.
- **Files:** `AgentService.ts`, `GeneralistAgent.ts`

---

### ISSUE-003: Raw JSON [Tool:...][End Tool...] blocks visible in chat
- **Status:** ✅ FIXED (ad903c25)
- **Severity:** 🟡 MEDIUM
- **Fix 1:** `lastToolMessage` tracked per tool execution to capture human-readable output.
- **Fix 2:** When `shouldBreakAfterBatch` triggers (generation complete), `accumulatedResponse` is replaced with the clean `lastToolMessage` instead of the raw tool block.
- **Fix 3:** Final strip regex `/\[Tool: [^\]]+\][\s\S]*?\[End Tool [^\]]+\]\n?/g` applied to ALL exits from the execution loop.
- **Files:** `GeneralistAgent.ts`

---

### ISSUE-004: Bug reports had no human-visible inbox / GitHub integration
- **Status:** ✅ FIXED (ad903c25) + ⏳ AWAITING CONFIGURATION
- **Fix:** `BugReportTools.ts` creates GitHub Issues when `VITE_GITHUB_TOKEN` + `VITE_GITHUB_REPO` are set.
- **Action Required (founders):**
  1. Generate a GitHub fine-grained PAT with `Issues: Read & Write` on `new-detroit-music-llc/indiiOS-Alpha-Electron`
  2. Add to `.env`: `VITE_GITHUB_TOKEN=ghp_...` and `VITE_GITHUB_REPO=new-detroit-music-llc/indiiOS-Alpha-Electron`
  3. Create labels in the repo: `bug`, `severity:critical`, `severity:major`, `severity:minor`, `module:boardroom`, `module:creative`, `module:distribution`, etc.
- **Files:** `BugReportTools.ts`, `.env.example`

---

### ISSUE-005: Scratchpad "malformed edit" in browser subagent
- **Status:** 🔵 INTERNAL — Not a product bug
- **Notes:** Browser subagent model sometimes fails to write to its internal scratchpad. Does not affect the indiiOS product. Low priority.

---

## NEW ISSUES TO UNCOVER NEXT

_These will be populated by the next /real browser test session._

- [ ] Does the Conductor now correctly name agents who are NOT seated and tell the user to add them?
- [ ] Does image generation produce a clean message (not raw JSON) in the Boardroom chat?
- [ ] Does an inline annotation/edit on a generated image actually work end-to-end?
- [ ] Are there loading state issues (spinners hanging, blank panels)?
- [ ] Does the bug report confirmation in the agent chat show a clean card or still expose raw JSON?
