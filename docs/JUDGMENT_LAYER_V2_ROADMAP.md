# Judgment Layer v2 Roadmap — Suggestion Chips UI

**Status:** Documented. v1.5 (consent-based dial) complete. v2 deferred.

**Why this matters:** v1.5 ensures agents ask permission before expanding scope. v2 makes offered ideas a first-class UI feature: tappable chips that users can instantly accept or dismiss, instead of buried text.

## v2 Architecture (Deferred)

### Offered Ideas → Suggestion Chips

**Current (v1.5):**
- Agent includes offered ideas in conversational text: "If you want, I could also X or Y"
- No UI affordance; requires user to type a follow-up
- Detection of "user picked up idea" is implicit/heuristic

**Target (v2):**
- Agent calls `park_idea(text, reason)` tool to explicitly offer ideas (metadata-carrying)
- Chat UI renders each idea as a tappable chip below the agent message
- Chips carry:
  - Idea text
  - Context: why agent suggested it
  - Action: "Try this" (one-click execution or message re-send)
  - Dismiss: "Not now" or "Parked" (moves to idea vault)

### Components Needed

1. **Tool: `park_idea(text, reason)`** (in BaseAgent or SwarmTools)
   - Registers the idea with `IdeaParkingService.offerIdea()`
   - Returns `{ id, text, reason, timestamp }`
   - Emits as structured data in agent response (not prose)

2. **Schema: `Idea` (types/Agent.ts)**
   ```ts
   export interface ParkedIdea {
       id: string;                // unique, sortable
       text: string;              // the idea itself
       reason?: string;           // why agent thinks it's useful
       source: string;            // agent ID that offered it
       timestamp: number;
       accepted?: boolean;        // user acted on it
       archivedAt?: number;       // user dismissed it
   }
   ```

3. **Chat UI: Idea Chips (ChatMessage.tsx or new component)**
   - Render each `<IdeaChip id={id} text={text} reason={reason} />`
   - Click → `IdeaParkingService.acceptIdea()` → re-send message with idea text
   - Dismiss → `IdeaParkingService.parkIdea(id)` → move to vault (no counter increment)

4. **IdeaVault (sidebar or modal)**
   - View all parked ideas (dismissed, not acted on)
   - Filter by: agent, time range, topic
   - Re-activate: drag chip back into chat
   - Export: save parked ideas as a list (future: email, save to notes)

### Idea Acceptance Loop (Full)

```
1. Agent calls park_idea("Refactor X")
2. UI renders chip below message
3. User clicks chip → "Try this" action
4. IdeaParkingService.acceptIdea() increments counter
5. At threshold (5), agent asks for dial upgrade
6. User says "yes" → dial → 'ideas' (4 ideas/message)
7. Agent offers more ideas per message
8. Dismissed ideas go to vault (don't increment counter)
```

### Not in Scope (v2)

- **Auto-detect acceptance:** Heuristic detection of "user picked up idea" (too brittle)
- **Idea curation:** Agent filtering which ideas are worth parking (adds complexity)
- **Collaborative idea pools:** Multi-user idea sharing (future product feature, not v2)
- **Idea history search:** Full-text search over all parked ideas (Phase 3)

## Implementation Checklist (Future)

- [ ] Create `park_idea` tool in SwarmTools.ts
- [ ] Add to agent declarations (all specialist agents)
- [ ] Update `Idea` schema in types/Agent.ts
- [ ] Build `<IdeaChip />` component (ChatMessage children)
- [ ] Build `<IdeaVault />` modal (Sidebar → "Parked Ideas")
- [ ] Wire `acceptIdea()` to chip click handlers
- [ ] Test: offer idea → render chip → click → counter increments
- [ ] Test: E2E flow from threshold → dial upgrade prompt → acceptance
- [ ] Docs: User guide (Settings → Ambition dial controls idea volume)

## Testing v1.5 (Now)

Users are ready to test the consent-based dial promotion:

1. **Trigger the dial upgrade:**
   - Set `agentAmbition: 'balanced'` in Settings
   - Act on 5+ offered ideas (requires manual tracking or `IdeaParkingService.acceptIdea()` calls)
   - Next agent message should include the dial upgrade prompt

2. **Verify behavior:**
   - Agent asks: "Want me to bring more ideas by default?"
   - User says "Yes" → dial moves to 'ideas' in Settings
   - Agent now offers 4 ideas/message (was 2)
   - Dial upgrade never asked again (24h cooldown enforced)

3. **Verify "hands off" principle:**
   - User says "No" → dial stays 'balanced'
   - Agent respects the answer (no nagging)
   - Ideas still offered but at 2/message pace

## References

- **ISSUE-1048:** Judgment Layer — behavioral constraints + ambition dial
- **Parent Plan:** `.claude/plans/so-here-is-the-cryptic-rocket.md`
- **Code:** `packages/renderer/src/services/agent/tools/IdeaParking.ts`
- **Founder Direction:** "These are mine, hands off." → User-owned growth, explicit consent only.
