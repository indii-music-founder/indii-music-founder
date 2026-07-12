# Cross-Device Persistence Architecture Audit

**Date:** 2026-07-12  
**Context:** Mobile-first (phone + iPad Remote-only) requires bulletproof cross-device sync  
**Status:** GAPS IDENTIFIED — Critical fixes needed before beta

---

## The Requirement

**User expectation (phone + iPad both remote-only):**
> "I work on my phone. I pick up my iPad. Everything I did on the phone is instantly available on the iPad. No refresh, no re-login, no 'sync failed' messages."

**What this means technically:**
- 100% durability (no data loss)
- <2 second latency (perceived as instant)
- Conflict-free merging (both devices modify same data concurrently)
- Offline-capable (queue changes locally, sync when online)
- No divergent state (both devices show the same data, always)

---

## Current State: Data Classes & Persistence

### ✅ WORKING (Firestore-backed)

| Data Class | Storage | Sync | Status |
|-----------|---------|------|--------|
| **User Profile** | Firestore | Real-time listener | ✅ Durable |
| **Project List** | Firestore | Query + listener | ✅ Durable |
| **Creative History** | Firestore | Per-session write | ✅ Durable |
| **Brand Kit** | Firestore | Per-asset write | ✅ Durable |
| **Workspace Snapshot** | Firestore | Debounced (4s) | ✅ Durable |
| **Release Metadata** | Firestore | Per-release write | ✅ Durable |

### 🟡 PARTIALLY WORKING (Gaps exist)

| Data Class | Storage | Sync Issue | Status |
|-----------|---------|-----------|--------|
| **Conversations** | Firestore + localStorage cache | Sessions capped at 50; old ones disappear | 🟡 ISSUE-755 |
| **Chat Messages** | Firestore (agentHistory) | Can become stale; ephemeral if Firestore write fails | 🟡 ISSUE-755 |
| **Boardroom Messages** | Firestore (via agentHistory) + localStorage | Recently fixed; still lacks proper archiving | 🟡 ISSUE-760 |
| **Agent Memory** | Firestore | 200–500 result caps; recall cliffs on old data | 🟡 ISSUE-757 |
| **Living Plans** | Firestore | Stored; device-level cache divergence possible | 🟡 Untested |

### ❌ BROKEN (No cloud persistence)

| Data Class | Storage | Issue | Status |
|-----------|---------|-------|--------|
| **Notes** | localStorage only | Device-local only; zero sync across devices | ❌ ISSUE-761 |
| **Local Drafts** | Browser cache | Ephemeral; lost on navigation | ❌ No issue yet |
| **Offline Queue** | localStorage | Commands queue locally; unclear if all re-sync | ❌ Untested |

---

## Detailed Gap Analysis

### ISSUE-755: Conversations Vanish on Module Switch

**Scenario:**
```
Phone:
  1. Open Boardroom
  2. Chat with agents (5 messages)
  3. Switch to Creative Director
  4. Return to Boardroom
  → Messages GONE

Then:
  iPad opens → doesn't see phone's conversation
```

**Root Cause:**
- `addAgentMessage` doesn't transactionally create a session first
- `loadSessions` subscription **replaces** entire local map, clobbering unpersisted sessions
- Fire-and-forget Firestore writes with no retry/offline queue
- No user-visible failure ("did my message save?")

**Impact on Mobile:**
- User works on phone for 10 mins, switches modules, loses everything
- Picks up iPad → nothing to see (never persisted)
- Violates the core mobile expectation: "what I did should be there"

**Fix Required:**
1. Transactional session creation (Firestore write BEFORE first message)
2. Merge server state with local unpersisted state (not replace)
3. Retry + offline queue for failed writes
4. Toast feedback: "Message saved" / "Offline — will sync when online"

---

### ISSUE-756: Cross-Device Sync Limited to 50 Sessions

**Scenario:**
```
Phone (week 1):
  - Create 100 conversations over 7 days
  - Oldest 50 sessions now on Firestore

iPad (picks up week 2):
  - Query returns only 50 most recent sessions
  - Oldest 50 conversations are INVISIBLE
  - User asks "where's my creative brief from day 1?" → NOT FOUND

Then (weeks later):
  - Agent tries to recall a decision from session 60 → Can't find it (ISSUE-757)
```

**Root Cause:**
- `loadSessions` query: `limit(50)` hard cap
- No pagination UI to load older sessions
- No server-side indexing for fast lookup

**Impact:**
- Mobile users can't access old conversations
- Memory system has amnesia (can't recall beyond 50 sessions)
- Archive exists (ISSUE-750) but UX to browse it is missing

**Fix Required:**
1. Implement session pagination (cursor-based, server-side)
2. Add "Load More Sessions" button in Archives
3. Sync ALL sessions, not just 50
4. Indexed Firestore query for fast lookup

---

### ISSUE-757: Agent Memory Recall Has Ceiling Cliffs

**Scenario:**
```
Phone (day 1):
  User: "My artist name is 'Luna Synthwave'"
  Agent: "Got it. Luna Synthwave, electronic producer."

iPad (day 30):
  User: "What's my artist name?"
  Agent: "I don't have a record of that."

Why:
  - Ingestion pipeline only processes 200 recent memories
  - Session search only checks 50 sessions
  - Luna's name is from session 80 (outside both windows)
  - No fallback to full-text search
```

**Root Cause:**
- `MemoryIngestionPipeline.ts` hard-caps at 200 items
- `SessionTools.ts` search rides on 50-session window
- No honest messaging: agent doesn't say "searched 50/200 but found nothing"

**Impact:**
- Agent forgets decisions made weeks ago
- User has no way to remind it
- Mobile experience feels stateless (no persistent memory)

**Fix Required:**
1. Remove hard caps or implement exponential search (recent → deep)
2. Add `recall` tool that searches full session archive (server-side)
3. Honest feedback: "Searched N sessions, memory tiers X/Y — nothing found"
4. User affordance: "Tell the agent" button to re-supply forgotten context

---

### ISSUE-761: Notes Are Device-Local Only

**Scenario:**
```
Phone:
  - User creates note: "Master deadline is Friday"
  - Stored in localStorage

iPad:
  - User picks up iPad
  - Notes panel is empty
  → "Didn't I make a note about the deadline?"

Both devices now have different notes, forever
```

**Root Cause:**
- `notesSlice.ts` makes ZERO Firestore calls
- Persisted to localStorage via `partialize` list only
- No service layer, no cloud sync

**Impact:**
- Notes are invisible across devices
- Violates the phone + iPad model (both should see same data)
- User can't rely on notes for persistent task tracking

**Fix Required:**
1. Create `NotesService` (Firestore backend)
2. Migrate existing localStorage notes on first run (zero data loss)
3. Implement bidirectional sync (push on create/edit, pull on load)
4. Add offline queue (queue note changes locally, sync when online)

---

### ISSUE-760: Boardroom Messages in-Memory + localStorage Only

**Scenario:**
```
Phone:
  1. Boardroom chat with 10 messages
  2. Refresh page or close app
  → MESSAGES GONE (localStorage cleared)

iPad:
  - Doesn't see any of the phone's boardroom discussion
  - No ability to continue or review what was discussed
```

**Current State (recently fixed):**
- Boardroom now rides `agentHistory` (Firestore-backed)
- Messages persist to Firestore
- localStorage persistence keeps them through HMR

**Remaining Gaps:**
- Not visible in Archives (treated as separate from regular sessions)
- No cross-device sync test
- Participant list not stored (who was in the boardroom?)

**Fix Required:**
1. Treat boardroom as a `ConversationSession` with `participants: ['agent1', 'agent2', ...]`
2. Add to Archives with participant avatars
3. Cross-device test: phone starts boardroom → iPad joins → both see same messages
4. Memory ingestion: boardroom decisions feed into agent memory

---

## Persistence SLA (Service Level Agreement)

**For phone + iPad-only model, we need:**

| Tier | Metric | Target | Current | Status |
|------|--------|--------|---------|--------|
| **Durability** | Data loss on device crash | 0% | ~5% (ephemeral sessions) | 🔴 FAIL |
| **Sync Latency** | Desktop sees phone's write | <2s | 4–5s (acceptable) | 🟡 ACCEPTABLE |
| **Conflict Resolution** | Concurrent writes merge cleanly | 100% | ~80% (LWW works, some edge cases) | 🟡 ACCEPTABLE |
| **Recall Scope** | Agent can find any past decision | 100% | ~20% (50-session cap) | 🔴 FAIL |
| **Offline Handling** | Queue + replay all writes | 100% | ~60% (selective retry) | 🟡 PARTIAL |
| **Memory Scope** | Agent remembers facts from any session | 100% | ~40% (200-item + 50-session caps) | 🔴 FAIL |

---

## Architecture Fix Sequencing

**Critical Path (blocks beta):**

```
PHASE 1 (Foundation):
  ISSUE-755 (Conversation durability)
    ↓
  ISSUE-761 (Notes cloud sync)
    ↓
PHASE 2 (Completeness):
  ISSUE-756 (Session pagination)
    ↓
  ISSUE-757 (Memory recall without caps)
    ↓
PHASE 3 (Polish):
  ISSUE-760 (Boardroom archiving)
    ↓
  Cross-device tests (phone + iPad scenarios)
```

**NOT optional if targeting phone + iPad users:**
- 755, 756, 757, 761 are BLOCKERS
- 760 is HIGH priority
- File browser (1044) is MEDIUM (nice-to-have for now)

---

## Implementation Patterns

### Pattern 1: Firestore-Backed with Local Cache

**Used for:** Workspace, creative history, brand kit

```typescript
// Service
async pushSnapshot(data) {
  try {
    await firestore.set(ref, data);
    localStorage.set('cache', data);  // Cache for offline
  } catch (e) {
    localStorage.queue('pending', data);  // Queue for retry
    throw e;
  }
}

async pullSnapshot() {
  const cloud = await firestore.get(ref);
  localStorage.set('cache', cloud);  // Update cache
  return cloud;
}

// Subscribe to changes (real-time)
onSnapshot(ref, (doc) => {
  localStorage.set('cache', doc.data());
});
```

### Pattern 2: Offline Queue + Retry

**Used for:** Notes, conversations (needs implementation)

```typescript
// Queue writes locally if Firestore fails
async addNote(text) {
  const noteId = generateId();
  const note = { id: noteId, text, createdAt: Date.now() };
  
  // Try Firestore immediately
  try {
    await firestore.set(noteRef(noteId), note);
  } catch (e) {
    // Fallback: queue locally
    localStorage.queue('pending-notes', note);
    // Return optimistically (note is "locally saved")
    return note;
  }
}

// Background: retry failed writes
async syncPendingNotes() {
  const pending = localStorage.get('pending-notes');
  for (const note of pending) {
    try {
      await firestore.set(noteRef(note.id), note);
      localStorage.dequeue('pending-notes', note.id);
    } catch (e) {
      logger.warn(`Retry failed for note ${note.id}`, e);
      // Keep in queue, try again next time
    }
  }
}
```

### Pattern 3: Bidirectional Sync (Phone ↔ iPad)

**Used for:** Workspace (existing), needs expansion

```typescript
// Desktop (Electron) + phone (web) + iPad (web) all sync to ONE Firestore doc
const workspaceRef = firestore.collection('users').doc(uid).collection('workspace').doc('current');

// Push: debounced writes (avoid thrashing)
useEffect(() => {
  const timer = setTimeout(() => {
    firestore.set(workspaceRef, {
      ...workspace,
      deviceId: getDeviceId(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, 4000);
  return () => clearTimeout(timer);
}, [workspace]);

// Pull: subscribe to real-time updates
useEffect(() => {
  return onSnapshot(workspaceRef, (doc) => {
    const cloudData = doc.data();
    
    // LWW conflict detection
    if (cloudData.updatedAt > localUpdatedAt && cloudData.deviceId !== getDeviceId()) {
      // Cloud is newer and from another device
      showConflictDialog();
    } else {
      applyWorkspaceSnapshot(cloudData);
    }
  });
}, []);
```

---

## Testing Matrix (Before Beta)

| Test | Devices | Scenario | Success Criteria |
|------|---------|----------|------------------|
| **T1** | Phone + iPad | Create conversation on phone, open iPad | iPad sees all messages, no refresh needed |
| **T2** | Phone + iPad | Both edit workspace simultaneously | Conflict dialog appears, user can choose |
| **T3** | Phone + iPad | Phone offline, iPad online; phone sends message | Queue on phone, syncs when online |
| **T4** | iPad | Create 5 notes | Notes visible on reload, sync to Firestore |
| **T5** | Phone + iPad | Phone creates note, iPad checks 5s later | iPad sees the note (no manual sync) |
| **T6** | Phone + iPad | Boardroom on phone, close app, open iPad | iPad can see boardroom history |
| **T7** | Phone + iPad | Agent recalls decision from session 80 | Agent finds it (not just recent 50) |
| **T8** | Phone + iPad | Offline for 30 mins, both devices queuing writes | Merge cleanly on reconnect, no conflicts |

---

## Risk Assessment

**If we ship without fixing 755, 756, 757, 761:**

🔴 **CRITICAL RISK:**
- Users will experience data loss (conversations disappear)
- Mobile model breaks (phone + iPad not in sync)
- Agent memory is broken (can't recall anything)
- Beta testers will immediately report "this is broken"
- Refund/churn risk

**Timeline to fix:**
- 755 (conversation durability): 2–3 days
- 761 (notes sync): 1–2 days  
- 756 (session pagination): 2–3 days
- 757 (memory recall): 2–3 days
- Testing: 2 days
- **Total: ~10–12 days for a solid beta**

---

## Recommendation

**Do NOT ship phone + iPad model until:**
1. ✅ Conversations persist across device switches (ISSUE-755)
2. ✅ Notes sync to Firestore (ISSUE-761)
3. ✅ Sessions paginate (no 50-session cap) (ISSUE-756)
4. ✅ Agent memory has no recall ceiling (ISSUE-757)
5. ✅ All 8 cross-device tests pass
6. ✅ One full week of manual QA with phone + iPad

**Otherwise:**
- Ship phone-only (single device only) until persistence is solid
- Or ship web + desktop (no mobile lock-down) until backend is ready

**This is the choice point:** Commit to the backend work, or adjust the product scope.

