# indii Branding Implementation Plan

**Date:** 2026-01-21
**Purpose:** Implement "indii" branding for the AI agent orchestration system within indiiOS
**Status:** Ready for implementation

---

## Overview

**Brand Name:** indii
**What It Represents:** The entire AI agent orchestration system including:
- AgentOrchestrator (router/traffic cop)
- Generalist agent (hub/Agent Zero)
- All specialist agents (spokes)

**Current State:** System is technically complete but lacks consistent branding
**Goal:** Add "indii" branding throughout codebase and user-facing components

---

## Task Breakdown

### Task 1: Create Branding Constants

**File:** `src/services/agent/constants.ts` (CREATE NEW)

**Content:**
```typescript
/**
 * indii - The AI Agent Orchestration System for indiiOS
 *
 * indii is the intelligent agent system that powers indiiOS, providing
 * AI-driven assistance through a hub-and-spoke architecture.
 */

export const AGENT_SYSTEM_BRANDING = {
  /** The brand name of the agent system */
  name: 'indii',

  /** Full descriptive name */
  fullName: 'indii AI Agent System',

  /** The hub agent in the hub-and-spoke architecture */
  hubName: 'Agent Zero',

  /** Short description for user-facing components */
  description: 'Your AI-powered assistant for independent artists',

  /** Version (should match package.json or be semantic versioned) */
  version: '1.0.0'
} as const;

/**
 * User-facing messages that reference the indii brand
 */
export const INDII_MESSAGES = {
  welcome: 'Welcome to indii, your AI assistant within indiiOS.',
  orchestrating: 'indii is coordinating specialists to help you...',
  error: 'indii encountered an issue:',
  hubSpokeViolation: (source: string, target: string) =>
    `indii architecture rule: Specialist '${source}' cannot communicate directly with '${target}'. All coordination goes through Agent Zero.`,
  loopDetected: 'indii detected a potential infinite loop and stopped execution.',
  routingToAgent: (agentName: string) => `indii is routing your request to ${agentName}...`
} as const;
```

---

### Task 2: Update Hub-and-Spoke Error Messages

**File:** `src/services/agent/types.ts`

**Current Location:** Line 132 (inside `validateHubAndSpoke` function)

**Current Code:**
```typescript
return `Hub-and-Spoke violation: Specialist agent '${sourceAgentId}' cannot delegate directly to '${targetAgentId}'. Specialists must delegate to '${HUB_AGENT_ID}' (Agent Zero), who will coordinate with other specialists as needed.`;
```

**New Code:**
```typescript
return `indii architecture rule: Specialist agent '${sourceAgentId}' cannot delegate directly to '${targetAgentId}'. Specialists must delegate to '${HUB_AGENT_ID}' (Agent Zero), who will coordinate with other specialists as needed.`;
```

**Or better yet, import from constants:**
```typescript
import { INDII_MESSAGES } from './constants';

// In validateHubAndSpoke function:
return INDII_MESSAGES.hubSpokeViolation(sourceAgentId, targetAgentId);
```

---

### Task 3: Update AgentOrchestrator Prompt

**File:** `src/services/agent/components/AgentOrchestrator.ts`

**Current Location:** Line 46-75 (prompt text)

**Changes Needed:**

**Line 46:** Change from:
```typescript
You are the Orchestrator for indiiOS, the operating system for independent artists.
```

To:
```typescript
You are indii, the AI agent orchestration system for indiiOS (the operating system for independent artists).
```

**Line 56:** Add context about indii brand after USER REQUEST:
```typescript
USER REQUEST: "${sanitizedQuery}"

ABOUT INDII:
You are part of indii, an intelligent hub-and-spoke agent system. The "generalist"
agent acts as the hub (Agent Zero), coordinating with specialist agents (spokes)
to provide comprehensive assistance to independent artists.
```

---

### Task 4: Update Documentation Files

**File 1:** `PHASE4_IMPLEMENTATION.md`

**Changes:**
- Line 1: Change title to "Phase 4: Hub-and-Spoke Architecture Enforcement (indii Architecture)"
- Line 7: Add subsection "## The indii Architecture"
- Update diagram to include indii branding:

```
┌─────────────────────────────────────┐
│             indii                    │  ← AI Agent System
│   (AI Orchestration for indiiOS)    │
│                                      │
│  ┌────────────────────────────────┐ │
│  │    AgentOrchestrator           │ │  (Router)
│  └───────────┬────────────────────┘ │
│              │                       │
│              ▼                       │
│       ┌─────────────┐               │
│       │ Generalist  │               │  (Hub / Agent Zero)
│       │ (Agent Zero)│               │
│       └──────┬──────┘               │
│              │                       │
│     ┌────────┴────────┐             │
│     ▼                 ▼             │
│  Finance          Marketing  ...    │  (Spokes)
│                                      │
└─────────────────────────────────────┘
```

**File 2:** `AGENT_COLLABORATION_SUMMARY.md`

**Changes:**
- Add section at top explaining "indii" is the brand name for the agent system
- Update references to "agent system" with "indii agent system" where appropriate

**File 3:** `README.md` (if exists at project root)

**Add section:**
```markdown
## indii - The AI Agent System

indiiOS is powered by **indii**, an intelligent AI agent orchestration system
that provides AI-driven assistance through a hub-and-spoke architecture.

indii consists of:
- **Agent Zero (Hub)**: Central coordinator for all agent interactions
- **Specialist Agents (Spokes)**: Domain experts (Marketing, Finance, Video, etc.)
- **AgentOrchestrator**: Intelligent routing system

Learn more about indii's architecture in [PHASE4_IMPLEMENTATION.md](PHASE4_IMPLEMENTATION.md)
```

---

### Task 5: Update User-Facing Components (Optional)

**Priority:** Medium (nice to have, but not critical)

**Files to consider:**
- `src/core/components/ChatOverlay.tsx` - Add "Powered by indii" badge or mention
- `src/core/components/MobileNav.tsx` - Add indii branding if agent-related
- Any "About" or "Help" dialogs - Mention indii

**Example for ChatOverlay:**
```typescript
// Add to header or footer
<div className="indii-branding">
  <span className="text-xs text-muted-foreground">
    Powered by <span className="font-semibold">indii</span>
  </span>
</div>
```

---

### Task 6: Update Console Logs (Optional)

**Priority:** Low

**Files:** Various agent files (BaseAgent.ts, AgentService.ts, etc.)

**Change console logs from:**
```typescript
console.log('[BaseAgent] ...');
console.log('[AgentOrchestrator] ...');
```

**To:**
```typescript
console.log('[indii:BaseAgent] ...');
console.log('[indii:Orchestrator] ...');
```

**Benefit:** Makes it clear in logs that these are all part of the indii system

---

## Implementation Order

### Phase 1 (Essential - Do First):
1. ✅ Create `src/services/agent/constants.ts` with branding constants
2. ✅ Update `types.ts` hub-and-spoke error message
3. ✅ Update `AgentOrchestrator.ts` prompt

### Phase 2 (Important - Do Second):
4. ✅ Update `PHASE4_IMPLEMENTATION.md` with indii branding
5. ✅ Update `AGENT_COLLABORATION_SUMMARY.md`
6. ✅ Add/update README.md section

### Phase 3 (Optional - Do If Time):
7. ⏳ Update user-facing components
8. ⏳ Update console logs

---

## Testing Checklist

After implementation:

- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] No broken imports
- [ ] Hub-and-spoke violation messages reference "indii"
- [ ] AgentOrchestrator prompt mentions "indii"
- [ ] Documentation consistently uses "indii" branding
- [ ] User-facing components (if updated) display "indii" correctly

---

## Files to Modify Summary

| File | Task | Priority |
|------|------|----------|
| `src/services/agent/constants.ts` | CREATE NEW | High |
| `src/services/agent/types.ts` | Update error message | High |
| `src/services/agent/components/AgentOrchestrator.ts` | Update prompt | High |
| `PHASE4_IMPLEMENTATION.md` | Add branding section | High |
| `AGENT_COLLABORATION_SUMMARY.md` | Add branding explanation | Medium |
| `README.md` | Add indii section | Medium |
| `src/core/components/ChatOverlay.tsx` | Add branding badge | Low |
| Various agent files | Update console logs | Low |

---

## Branding Guidelines

When referencing the system:

✅ **Correct:**
- "indii" (lowercase, no special formatting in code)
- "indii AI agent system"
- "Powered by indii"
- "indii orchestration"

❌ **Incorrect:**
- "Indii" (capitalized - only at start of sentence)
- "INDII" (all caps)
- "IndiI" (mixed case)
- "agent system" (without indii reference in user-facing contexts)

**Exception:** In documentation titles and headings, capitalize as "Indii"

---

## Notes for Next Agent

- All Phase 1-4 implementation work is complete and pushed
- Branch: `claude/agent-system-troubleshooting-DHF29`
- Last commit: `7c7cd65` - Phase 4: Hub-and-Spoke Architecture Enforcement (COMPLETE)
- TypeScript type checking passes
- No breaking changes in this branding work

**This is pure additive branding work - no functional changes needed.**

---

## Contact/Questions

If unclear about any part of this implementation:
1. Check existing Phase 4 documentation for context
2. Review `src/services/agent/types.ts` for hub-and-spoke architecture
3. Look at `AgentOrchestrator.ts` for routing logic
4. All agents are listed in `types.ts` VALID_AGENT_IDS constant

**Key Concept:** indii = AgentOrchestrator + Generalist (hub) + All specialists (spokes)

---

**Ready for implementation!** 🚀
