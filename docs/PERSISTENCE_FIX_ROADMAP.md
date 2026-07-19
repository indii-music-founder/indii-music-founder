# Cross-Device Persistence Fix Roadmap

**Created:** 2026-07-12  
**Target:** Beta-ready backend for phone + iPad mobile-first  
**Scope:** 4 critical issues blocking durability guarantee  
**Token Budget:** ~73k over 9 hours  

---

## Critical Path Dependencies

```
ISSUE-755 (Conversation Durability)
  ↓ [BLOCKS]
ISSUE-761 (Notes Cloud Sync)
  ↓ [BLOCKS]
ISSUE-756 (Session Pagination)
  ↓ [BLOCKS]
ISSUE-757 (Memory Recall Without Caps)
```

**Translation:** Cannot start 761 until 755 works. Cannot verify 756 until 761 works. Cannot complete 757 without 756.

---

## Phase 1: Conversation Durability (ISSUE-755)

**Time:** 2–3 hours  
**Tokens:** 15k  
**Status:** 🟡 NOT STARTED  

### Problem
- User creates conversation → navigates away → returns → conversation gone
- Chat messages never persisted (fire-and-forget writes)
- No offline queue, no retry logic

### Root Causes
1. **Line 197 in agentSessionSlice.ts:** `addAgentMessage` fabricates a session locally but never calls `sessionService.createSession()`
2. **Line 343:** `loadSessions` subscription **replaces** entire map; unpersisted sessions are clobbered
3. **Fire-and-forget writes:** Every Firestore write is `.catch(logger.error)` with no retry

### Implementation Checklist

- [ ] **Step 1: Transactional Session Creation**
  - File: `packages/renderer/src/services/agent/SessionService.ts`
  - Add method: `createSessionIfNotExists(sessionId, metadata)`
  - Firestore transaction: create session doc BEFORE first message
  - Returns: `{ sessionId, createdAt }`
  - Acceptance: Session exists in Firestore immediately after call (no delay)

- [ ] **Step 2: Add Offline Queue**
  - File: `packages/renderer/src/services/agent/SessionService.ts`
  - Add: `pendingWrites` queue (localStorage-backed)
  - Queue all failed writes + retry on reconnect
  - Acceptance: Offline message queued; syncs when online

- [ ] **Step 3: Update agentSessionSlice**
  - File: `packages/renderer/src/core/store/slices/agent/agentSessionSlice.ts`
  - Line 197: Change `addAgentMessage` to call `sessionService.createSessionIfNotExists()`
  - Line 343: Merge server state with local unpersisted (not replace)
  - Add toast feedback: "Message saved" / "Offline — will sync"
  - Acceptance: No messages disappear on navigation

- [ ] **Step 4: Write Tests**
  - File: `packages/renderer/src/services/agent/SessionService.test.ts`
  - Test: Session creates before first message
  - Test: Failed write queues + retries
  - Test: Conversation survives navigation + reload
  - Acceptance: 3/3 tests pass, `npm run typecheck` green

- [ ] **Step 5: Manual Verification**
  - Scenario: Phone → create conversation → switch modules → return → messages still there
  - Scenario: Phone offline → send message → message queues → go online → syncs
  - Acceptance: Both scenarios work end-to-end

---

## Phase 2: Notes Cloud Sync (ISSUE-761)

**Time:** 1–2 hours  
**Tokens:** 12k  
**Depends on:** ISSUE-755 (uses same patterns)  
**Status:** 🟡 NOT STARTED

### Problem
- Notes stored in localStorage only
- Zero Firestore calls
- iPad sees blank notes (different localStorage)

### Root Causes
1. **Line 1-end in notesSlice.ts:** Zero Firestore writes
2. No `NotesService` exists
3. No migration path for existing localStorage notes

### Implementation Checklist

- [ ] **Step 1: Create NotesService**
  - File: `packages/renderer/src/services/notes/NotesService.ts`
  - Methods:
    - `pushNote(note)` → Firestore write (debounced, retry on fail)
    - `pullNotes()` → Firestore query (one-shot pull)
    - `subscribe(callback)` → Realtime listener (Phase 2)
  - Acceptance: Service can write/read notes to Firestore

- [ ] **Step 2: Migration (localStorage → Firestore)**
  - File: `packages/renderer/src/core/store/slices/notesSlice.ts`
  - On first load: detect localStorage notes → migrate to Firestore
  - Delete localStorage.notes after successful sync
  - Acceptance: Existing notes survive migration (zero loss)

- [ ] **Step 3: Update notesSlice**
  - Remove localStorage persistence
  - Add Firestore sync (push on create/edit, pull on load)
  - Add offline queue (queue note changes locally)
  - Acceptance: New notes sync to Firestore within 2 seconds

- [ ] **Step 4: Write Tests**
  - Test: Note pushes to Firestore
  - Test: Note pulls from Firestore on load
  - Test: localStorage notes migrate without loss
  - Test: Offline note queueing works
  - Acceptance: 4/4 tests pass

- [ ] **Step 5: Manual Verification**
  - Scenario: Phone create note → iPad load → note visible
  - Scenario: Phone offline → create note → go online → syncs
  - Acceptance: Both work end-to-end

---

## Phase 3: Session Pagination (ISSUE-756)

**Time:** 2–3 hours  
**Tokens:** 15k  
**Depends on:** ISSUE-755, 761  
**Status:** 🟡 NOT STARTED

### Problem
- Only 50 most recent sessions sync to new device
- Older sessions are invisible (no pagination UI)
- Agent can't recall old conversations (ISSUE-757 blocker)

### Root Causes
1. **Line: loadSessions query** has `limit(50)` hard cap
2. No cursor-based pagination
3. No UI to load more sessions

### Implementation Checklist

- [ ] **Step 1: Add Server-Side Cursor**
  - File: `packages/renderer/src/services/agent/SessionService.ts`
  - Modify `loadSessions()` to accept optional `lastSeenTimestamp` cursor
  - Query: `where('createdAt', '<', cursor)` + `orderBy('createdAt', desc)` + `limit(50)`
  - Acceptance: Returns 50 sessions before the cursor

- [ ] **Step 2: Pagination State in Slice**
  - File: `packages/renderer/src/core/store/slices/agent/agentSessionSlice.ts`
  - Add: `sessionsPaginationCursor`, `hasMoreSessions`, `sessionsLoading`
  - Add action: `loadMoreSessions()` → calls service with cursor
  - Acceptance: Slice can track pagination state

- [ ] **Step 3: UI (Load More Button)**
  - File: `packages/renderer/src/modules/boardroom/BoardroomConversationPanel.tsx` or archive component
  - Add button: "Load More Sessions" (if `hasMoreSessions === true`)
  - On click: dispatch `loadMoreSessions()`
  - Shows loading state while fetching
  - Acceptance: Button appears, clicking loads older sessions

- [ ] **Step 4: Sync All Sessions on Fresh Login**
  - On first auth, paginate through ALL sessions (no cap)
  - Store full list in localStorage cache
  - Offline: use cache; online: keep cursor in sync
  - Acceptance: iPad on first login gets all sessions, not just 50

- [ ] **Step 5: Write Tests**
  - Test: Cursor pagination returns next 50
  - Test: Load More button appears when `hasMoreSessions`
  - Test: Fresh device loads all sessions progressively
  - Acceptance: 3/3 tests pass

- [ ] **Step 6: Manual Verification**
  - Scenario: Create 100 conversations on phone → iPad loads all progressively
  - Scenario: Scroll to oldest conversation on iPad → can access day-1 session
  - Acceptance: Both work

---

## Phase 4: Memory Recall Without Caps (ISSUE-757)

**Time:** 2–3 hours  
**Tokens:** 15k  
**Depends on:** ISSUE-755, 756  
**Status:** 🟡 NOT STARTED

### Problem
- Agent can only recall from 200-item memory limit
- Session search limited to 50 sessions
- Old decisions (> 50 sessions ago) are unrecallable
- Agent doesn't say what it searched ("I checked 50 sessions, found nothing" vs. "I don't know")

### Root Causes
1. **Line: MemoryIngestionPipeline.ts** hard-caps results at 200
2. **Line: SessionTools.ts** search limited to 50 sessions
3. No honest messaging about search scope

### Implementation Checklist

- [ ] **Step 1: Remove Hard Caps (or Implement Exponential Search)**
  - File: `packages/renderer/src/services/agent/memory/MemoryIngestionPipeline.ts`
  - Change `limit(200)` to `limit(1000)` (Firestore batch limit)
  - Add pagination support (resume from cursor)
  - Acceptance: Ingestion returns up to 1000 items

- [ ] **Step 2: Add Recall Tool**
  - File: `packages/renderer/src/services/agent/SessionTools.ts`
  - New tool: `recall_decision(topic: string)` → searches full session archive
  - Server-side query (not 50-session window): `sessions` collection + FTS
  - Returns: Top 5 matching decisions with session citations
  - Acceptance: Tool exists and can be called by agent

- [ ] **Step 3: Update Agent Instructions**
  - File: `packages/firebase/src/relay/agentPrompts.ts`
  - Add to conductor prompt: "Use the `recall_decision` tool to find past decisions"
  - Example: "recall_decision('artist name')" → finds when user said their artist name
  - Acceptance: Agent knows how to use recall tool

- [ ] **Step 4: Honest Messaging**
  - If recall finds nothing: agent says: "Searched 50 sessions, memory tiers X/Y, found nothing"
  - If recall times out: agent says: "Recall took too long, try again"
  - Never silent "no record" — always explain what was searched
  - Acceptance: Agent output is transparent about scope

- [ ] **Step 5: Write Tests**
  - Test: Recall finds decision from session 80 (beyond 50-session cap)
  - Test: Recall returns exact citation (session ID, timestamp)
  - Test: Honest messaging when no match found
  - Acceptance: 3/3 tests pass

- [ ] **Step 6: Manual Verification**
  - Scenario: Phone day 1: "My artist name is Luna Synthwave"
  - Scenario: Phone day 30: "What's my artist name?" → Agent recalls correctly
  - Acceptance: Recall works across 30 days

---

## Testing Matrix (Before Beta Sign-Off)

| Test | Devices | Scenario | Acceptance |
|------|---------|----------|-----------|
| **T1** | Phone + iPad | Create conversation on phone, open iPad immediately | iPad shows all messages, no refresh |
| **T2** | Phone + iPad | Both edit workspace simultaneously, save on both | Conflict dialog; user chooses; no data loss |
| **T3** | Phone + iPad | Phone offline, iPad online; phone sends message | Message queues locally on phone, syncs when online |
| **T4** | iPad | Create 5 notes on phone | Reload iPad 5s later → all notes visible |
| **T5** | Phone + iPad | Phone offline 30 mins, queues 10 notes | Come online → all 10 sync, no conflicts |
| **T6** | Phone | Create 100 conversations over 2 weeks | Scroll to oldest → can access day-1 session |
| **T7** | Phone + iPad | Phone day 1: "Call me William", phone day 30: "What's my name?" | Agent recalls exactly from day 1 |
| **T8** | Phone + iPad | Boardroom: 3 agents respond | Both devices see all 3 responses, same order |

**Acceptance:** All 8/8 tests pass, no data loss, <2s sync latency.

---

## Commit Strategy

**Per-issue atomic commits:**
- ISSUE-755 fix + tests → 1 commit
- ISSUE-761 fix + tests → 1 commit
- ISSUE-756 fix + tests → 1 commit
- ISSUE-757 fix + tests → 1 commit

**Each commit:**
- Real behavior, never mock
- Tests must pass (`npm run typecheck` green)
- Manual verification before marking FIXED
- Evidence in ledger (exact file:line)

---

## Rollback Plan

If any phase fails verification:
1. Do NOT mark FIXED
2. Set status to `🟠 BLOCKED — <specific reason>`
3. Revert code (keep ledger entry for audit trail)
4. Handoff to next agent or human

---

## Success Criteria (Beta-Ready)

✅ ISSUE-755 implemented + verified + tests passing  
✅ ISSUE-761 implemented + verified + tests passing  
✅ ISSUE-756 implemented + verified + tests passing  
✅ ISSUE-757 implemented + verified + tests passing  
✅ All 8 cross-device tests passing  
✅ Phone + iPad both remote-only model works seamlessly  

**Ship date:** Once all above + 1 week manual QA

---

## Current Status

| Issue | Phase | Status | Next Owner |
|-------|-------|--------|-----------|
| 755 | 1 | 🟡 Ready to start | Claude (implementing now) |
| 761 | 2 | 🟡 Blocked on 755 | Claude (after 755 ✅) |
| 756 | 3 | 🟡 Blocked on 761 | Claude (after 761 ✅) |
| 757 | 4 | 🟡 Blocked on 756 | Claude (after 756 ✅) |

