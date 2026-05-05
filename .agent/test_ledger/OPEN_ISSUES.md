# Open Issues — Real-Life Test Findings

> This file is written by the /real test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-05-05T14:45:00Z
> **Current UX Score:** TBD — Target: 30/30

---

### ISSUE-001: generate_image tool fails when count > 1
- **Status:** OPEN
- **Severity:** 🔴 HIGH
- **UX Dimension:** Error Communication / Action Discoverability
- **Module:** Boardroom → Agent Tools → generate_image
- **Found:** 2026-05-05 by Visual Artist persona
- **Steps to Reproduce:**
  1. Open Boardroom HQ
  2. Seat 1 agent (indii Conductor)
  3. Ask agent to make album artwork (or a flyer)
  4. Agent calls `generate_image` with `count > 1`
  5. Error: `Gemini API Request Error: {"error":{"code":400,"message":"Multiple candidates is not enabled for this model","status":"INVALID_ARGUMENT"}}`
- **User Impact:** Image generation is completely broken when agent tries to generate more than one image at a time. The agent recovers and tries `count=1`, but the first call always fails publicly in the chat with raw JSON error output.
- **Screenshot:** (See conversation screenshots — raw JSON error visible to user in chat bubble)
- **Notes:** The error is exposed raw to the user as `[Tool: generate_image] ... {"error":...}`. This should be a friendly message. Root cause: the model being used on the backend does not support `candidateCount > 1`. Agent should always call with `count: 1` as default, or the backend should reject and retry gracefully.

---

### ISSUE-002: Boardroom Conductor delegates to agents that are NOT seated
- **Status:** OPEN
- **Severity:** 🔴 HIGH
- **UX Dimension:** Cross-Module Asset Flow / Navigation Clarity
- **Module:** Boardroom → Swarm Orchestration
- **Found:** 2026-05-05 by Visual Artist persona
- **Steps to Reproduce:**
  1. Open Boardroom HQ
  2. Seat only 1 agent (indii Conductor)
  3. Ask Conductor to run a meeting ("proceed")
  4. Conductor gives a speech: "Marketing, give us the latest... Director, what's the status..."
  5. No response from Marketing or Director — they are not in the room
  6. Meeting hangs with no acknowledgment that agents are missing
- **User Impact:** The user sees the Conductor speaking to ghosts. The meeting stalls indefinitely. The user has no way to know that they need to seat MORE agents for the swarm to function. There is no guard rail or warning message.
- **Screenshot:** (See conversation screenshot 2 — "1 Agent Seated" shown while Conductor addresses Marketing and Director)
- **Notes:** The Conductor's system prompt or the Boardroom UI should validate that target agents are seated BEFORE delegating. If Marketing is not seated, Conductor should say: "Marketing Director is not in the room. Please seat them to continue." The circle UI shows 1 agent seated — this context is available and should be injected into the Conductor's prompt.

---

### ISSUE-003: Raw JSON tool output rendered in chat bubble
- **Status:** OPEN
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Error Communication
- **Module:** Boardroom → Chat → ToolOutputRenderer
- **Found:** 2026-05-05 by Visual Artist persona
- **Steps to Reproduce:**
  1. Any tool call that fails (see ISSUE-001)
  2. The raw JSON success/error payload from the tool is rendered verbatim in the chat message bubble
  3. User sees: `{"success":true,"data":{"bugId":"bug-177...","title":"Communication Failure...`
- **User Impact:** Deeply confusing. The user doesn't know what a `bugId` is or why they're seeing JSON. This feels like a debug log, not a product.
- **Screenshot:** (See conversation screenshot 2 — raw JSON visible in Conductor message)
- **Notes:** `ToolOutputRenderer` or `ChatMessage` should strip/transform raw tool result JSON before it reaches the user. Only the `message` field or a formatted card should be displayed. The full JSON payload should be hidden behind a developer toggle.
