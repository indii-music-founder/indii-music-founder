# Flowchart: indiiREMOTE "Show Me" Visual Return Channel (Micro Architecture)

Micro-architecture flow of the on-demand `[SHOW]` command (ISSUE-REMOTE-SHOW-20260622 Phase 1): the phone asks "show me" and the desktop surfaces the most-recent visual artifact back to the phone, reusing the same Firestore `imageUrls` channel that `[GENERATE_IMAGE]` already proves.

```mermaid
graph TD
    %% Phone Trigger
    A["Phone: CommandPad 'Show Me' quick action"] -->|sendCommand('[SHOW]')| B["RemoteRelayService.sendCommand"]
    B -->|writes command doc| C["Firestore: users/{uid}/remote-relay-commands/{id} (status: pending)"]

    %% Desktop Pickup
    C -->|onSnapshot status==pending| D["Desktop: useRemoteCommandListener (onCommand)"]
    D --> E["Atomic claim: pending → processing (runTransaction)"]
    E --> F{"command.text prefix?"}
    F -->|'[SHOW]'| G["Show Me Route"]

    %% Decision Logic (pure helper)
    G --> H["useStore.getState().generatedHistory"]
    H --> I["resolveShowMeResponse(history)"]
    I --> J{"find item.type==='image' && item.url ?"}
    J -->|Image found| K["text = caption, imageUrls = [thumbnailUrl || url], agentId='creative'"]
    J -->|None / empty| L["text = honest fallback, imageUrls = undefined, agentId='creative'"]

    %% Return Channel
    K --> M["sendResponse(id, text, 'creative', false, imageUrls)"]
    L --> M
    M -->|writes response doc| N["Firestore: users/{uid}/remote-relay-responses/{id}"]
    M --> O["markCommandCompleted(id) (status: completed)"]

    %% Phone Render
    N -->|onResponse(commandId)| P["Phone: render response inline"]
    P --> Q{"response.imageUrls present?"}
    Q -->|Yes| R["Render image thumbnail in remote feed"]
    Q -->|No| S["Render honest text-only message"]
```

## State Transitions & Lifecycles

### 1. Phone → Firestore Command Emission
- **Trigger:** The `Show Me` quick action in `mobile-remote/components/CommandPad.tsx` calls `remoteRelayService.sendCommand('[SHOW]')`.
- **Write:** Creates a command doc under `users/{uid}/remote-relay-commands/{id}` with `status: 'pending'`. The phone is remote-only by design; it never inspects desktop state directly.

### 2. Desktop Claim & Prefix Routing
- **Listener:** `useRemoteCommandListener.ts` (`onCommand`) fires on the pending-command snapshot.
- **Atomic claim:** `runTransaction` flips `pending → processing` so only one desktop tab processes a given command (no double-send).
- **Prefix dispatch:** `command.text.startsWith('[SHOW]')` selects the Show Me Route, sibling to `[GENERATE_IMAGE]`, `[NAVIGATE]`, `[WAKE]`, `[AGENT_ACTION]`.

### 3. Pure Decision — `resolveShowMeResponse(history)`
- **Why extracted:** The branch logic is unit-tested deterministically (`useRemoteCommandListener.showme.test.ts`) without the live phone↔desktop round-trip. The helper is behaviorally identical to the prior inline route.
- **Happy path:** Returns the first `type === 'image' && url` item (history is sorted most-recent-first), preferring `thumbnailUrl` over the full `url`, with a prompt-aware caption, `agentId: 'creative'`.
- **Empty state:** Returns an honest text fallback ("Nothing to show yet…") with **no** `imageUrls` — never a silent no-op or a raw error.

### 4. Firestore Return Channel & Phone Render
- **Reused channel:** `sendResponse(commandId, text, 'creative', false, imageUrls)` — the same `imageUrls` field `[GENERATE_IMAGE]` already broadcasts over Firestore (plus the P2P WebSocket fallback).
- **Completion:** `markCommandCompleted(id)` flips the command to `completed`.
- **Render fork:** The phone's response listener renders an inline image thumbnail when `imageUrls` is present, otherwise the text-only message.

### 5. Verification Boundary (Phase 1)
- **Proven in CI:** The decision logic for both branches (`resolveShowMeResponse`) via unit tests — the exact text/agentId/imageUrls the phone would receive.
- **UNPROVEN (out of environment reach):** The full live phone→Firestore→desktop→Firestore→phone device round-trip and the on-device image render. No physical device pairing is available in this environment.
