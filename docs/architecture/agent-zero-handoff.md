# Agent Zero Handoff Architecture

**Date:** 2026-03-06  
**Status:** Partially Implemented (Bug: Missing UI Switch)  
**Related:** indiiOS Agent System, DNA Hybridization

---

## Overview

The indiiOS agent system uses a two-phase approach:

1. **Planning Mode (Conversational)** — Human + AI collaborate to refine ideas
2. **Execution Mode (Agent Mode)** — AI uses tools to execute the finalized plan

The "switch" is the handoff trigger from planning to execution.

---

## Current State

### What's Working
- Conversational agents respond to user queries
- Agents can detect when execution is needed
- Agents reference "Agent mode" in responses

### What's Broken
- Agents tell users to "switch to Agent mode" 
- **No actual UI element exists to perform this switch**
- Users hit a dead end — promised feature doesn't exist

---

## Intended Flow

```
User: "I want to create an album cover with dogs"
  ↓
Planning Agent: "Great! Let's plan it. What style? How many dogs?"
  ↓
[Back-and-forth planning conversation]
  ↓
Planning Agent: "Perfect! Ready to generate? Click 'Execute' to proceed"
  ↓
USER CLICKS EXECUTE SWITCH (UI element in chat entry area)
  ↓
Agent Zero: Handoff to Execution Agent with full context
  ↓
Execution Agent: Uses image generation tools, returns results
  ↓
User: Sees generated images, can iterate or finalize
```

---

## The Missing Component

**A visible, obvious toggle/switch in the chat entry area that:**

- Default state: Planning Mode (conversational)
- Activated state: Execute Mode (tools enabled)
- Visual indicator shows which mode is active
- Clicking it triggers Agent Zero handoff
- Execution agent takes over with full conversation context

---

## UI Requirements

### Location
- Inside the chat message input area
- Near send button
- Always visible during conversation

### Visual Design
- Toggle switch or button
- Clear labels: "Plan" / "Execute" or "Chat" / "Do"
- State change is obvious (color, position, icon)

### Behavior
- **Planning Mode:** Agent responds conversationally, no tools
- **Execute Mode:** Agent uses available tools, executes plan
- Context from entire conversation passed to execution agent
- Results displayed in same chat thread

---

## Technical Implementation

### Agent Zero Handoff
```
1. User toggles switch to Execute Mode
2. UI sends signal to Agent Zero
3. Agent Zero packages conversation context
4. Agent Zero routes to appropriate execution agent
5. Execution agent performs task using tools
6. Results returned to UI, displayed to user
7. Mode automatically resets to Planning
```

### Execution Agents Available
- Image Generation Agent (Nano Banana Pro)
- Research Agent (web search, data gathering)
- Publishing Agent (royalty registration, etc.)
- Finance Agent (calculations, reporting)
- [Future agents as built]

---

## Fix Required

**Immediate:** Add the missing UI switch to chat entry area
**Connect:** Wire the switch to Agent Zero handoff logic
**Test:** Verify execution agents receive context and return results

---

## Related Documentation
- DNA Hybridization notes (Agent Zero architecture)
- Agent capability matrix
- Tool integration specs

---

**Note:** This system existed in earlier versions. Recent changes removed or obscured the switch. Fix should restore this functionality without major architectural changes.
