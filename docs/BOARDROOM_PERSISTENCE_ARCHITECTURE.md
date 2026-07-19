# Boardroom Persistence Architecture (ISSUE-760)

> ⚠️ **OBSOLETE / SUPERSEDED (2026-07-12).** ISSUE-760 is already FIXED in the codebase via a
> different, cleaner approach than this doc proposes. Boardroom rides the existing
> `ConversationSession` spine by switching `activeSessionId` to a `namespace:'boardroom'`
> session (`store/slices/agent/index.ts:65-76`); messages persist to Firestore through
> `addAgentMessage` → `sessionService.updateSession()` (`agentSessionSlice.ts:247-298`), and
> `boardroomMessages` is now an alias for `state.agentHistory` (`BoardroomModule.tsx:48`).
> **Do NOT implement the `source:'boardroom'` field or the "phases 2-4" migration below** —
> that would create the parallel persistence path the ISSUE-760 ledger entry explicitly forbids.
> This document is retained only as a record of the design that was considered and rejected in
> favor of namespace-based unification. See `.agent/test_ledger/OPEN_ISSUES.md` (ISSUE-760).

---

**Status:** ❌ Obsolete — superseded by namespace-based session unification (see banner above)
**Depends on:** ISSUE-755 (✅ Conversation durability)
**Blocked by:** N/A

---

## Problem Statement

**Current state:**
- Boardroom discussion lives in `boardroomSlice.ts` (in-memory only)
- `a2aMessages` persisted to localStorage via Zustand `partialize` (same-device only)
- NO Firestore writes → boardroom invisible to Archives, cross-device broken, agent can't recall

**User experience:** 
- Phone has boardroom discussion
- Switch to iPad → empty boardroom (data lost)
- Reload phone → discussion vanished (localStorage cleared)
- Agent can't recall boardroom decisions from memory

---

## Proposed Solution: Unify Boardroom onto ConversationSession

A boardroom IS a multi-participant conversation. Instead of a parallel storage system, migrate:

```
boardroomSlice.a2aMessages
    ↓ (migrate to)
ConversationSession.messages with metadata
```

### Architecture

**New Session Type:**
```typescript
interface ConversationSession {
    id: string;
    title: string;           // e.g. "Boardroom: Creative Review"
    participants: string[];  // Agent IDs: ['creative', 'legal', 'music']
    messages: AgentMessage[];
    source?: 'desktop' | 'mobile-remote' | 'boardroom'; // NEW
    isArchived?: boolean;
    namespace?: string;       // Keep for background jobs
    // ... existing fields
}
```

**Key changes:**
1. **Message source field:** Mark boardroom messages with `source: 'boardroom'`
2. **Participant tracking:** `participants` array lists active agents
3. **Firestore persistence:** Use SessionService (already handles sync)
4. **Archive visibility:** Boardroom sessions appear in Archives with participant strip

### Implementation Checklist

**Phase 1: Data Model (30 min)**
- [ ] Update ConversationSession interface to add `source` field
- [ ] Update SessionDocument (Firestore) to support source
- [ ] No breaking changes (source is optional, defaults to undefined)

**Phase 2: Migration (1 hour)**
- [ ] When boardroom first loads, check `boardroomSlice.a2aMessages`
- [ ] If non-empty, migrate to a new session: `createSession('Boardroom: <timestamp>', ['active-agents'])`
- [ ] Push all a2aMessages as session.messages with `source: 'boardroom'`
- [ ] Clear `boardroomSlice.a2aMessages` after successful migration
- [ ] On future boardroom operations, create new session (don't append to old one)

**Phase 3: UI Updates (30 min)**
- [ ] BoardroomModule: detect active boardroom session by `source: 'boardroom'`
- [ ] Display session participant strip (already in Archives)
- [ ] Keep existing boardroom UI but wire to session messages instead of `a2aMessages`
- [ ] Reuse existing SessionService for add/update/delete

**Phase 4: Testing (1 hour)**
- [ ] E2E: create boardroom on phone → see on iPad instantly
- [ ] Reload phone → messages persist
- [ ] Boardroom appears in Archives with participant strip
- [ ] Agent can recall boardroom decisions (memory pipeline integration)

---

## Benefits

| Requirement | Current State | After ISSUE-760 |
|-------------|---------------|-----------------|
| **Cross-device sync** | None | ✅ Real-time Firestore |
| **Persistence** | localStorage only (same device) | ✅ Firestore (all devices) |
| **Archive visibility** | Hidden | ✅ Visible with participants |
| **Agent recall** | Can't | ✅ Full history accessible |
| **Reload survival** | Vanishes | ✅ Persists |

---

## No Breaking Changes

- `boardroomSlice` can coexist during migration
- Old `a2aMessages` automatically migrated to session on first load
- No API changes for agent tools (messages still flow through session system)
- Existing E2E tests continue to pass (new assertions added for boarding sync)

---

## Code Locations

- **Session model:** `packages/renderer/src/core/store/slices/agent/agentSessionSlice.ts` (add `source` field)
- **Firestore:** `packages/firebase/firestore.rules` (already permits sessions)
- **Boardroom UI:** `packages/renderer/src/modules/boardroom/BoardroomModule.tsx` (wire to session)
- **Tests:** `e2e/cross-device-persistence.spec.ts` (extend with boardroom scenario)

---

## Estimated Effort

- Implementation: 3-4 hours (design + coding + testing)
- Risk: Low (sessions already proven for conversations)
- Blockers: None (ISSUE-755 ✅)

---

## Next Steps

1. **If continuing:** Implement phases 1-4 in sequence
2. **If review:** Send architecture to team for feedback before coding
3. **If deferring:** Document in ISSUE-760 ledger; ready to pick up next session

