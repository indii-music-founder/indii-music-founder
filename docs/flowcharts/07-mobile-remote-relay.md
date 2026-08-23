---
description: Definitive architecture for indiiCONTROLLER pairing, lease freshness, standby recovery, secure relay commands, and Studio wake-up.
---

# Mobile Remote Relay Architecture (indiiCONTROLLER)

This flowchart documents the production state machine between the paired mobile controller, the Firebase relay, and Studio. Pairing is durable once established; desktop presence is a separate, time-bounded lease that may move the controller into Standby without disabling its controls.

```mermaid
graph TD
    subgraph MOBILE["Mobile controller"]
        AUTH["Firebase authentication is ready"]
        PAIRED{"Pairing has been established?"}
        LOCKED["Show pairing surface"]
        CONTROLS["Keep tabs, chat, and command controls enabled"]
        SNAPSHOT["Receive desktop-state fanout"]
        FRESH{"Lease is fresh within 120 s plus 30 s clock tolerance?"}
        ACTIVE["Show Active or Sleeping"]
        EDGE["Schedule the exact freshness-expiry edge"]
        GRACE["Allow transient heartbeat recovery"]
        STANDBY["Show Standby while retaining pairing and controls"]
        RETRY["Progressive retry, at most five attempts"]
        VISIBLE["Page becomes visible"]
        SETTLE["Clear deferred checks and allow 15 s to resynchronize"]
        MANUAL["Manual retry clears stale, grace, and retry timers"]
    end

    subgraph RELAY["Firebase relay"]
        STATE["users/{uid}/remote-relay/state"]
        LOCAL["Same-window desktop-state event"]
        FANOUT["Fan out to every local subscriber"]
        COMMAND["users/{uid}/remote-relay-commands/{id}"]
        RULES["Owner-only schema and transition validation; text at most 20,000 characters"]
        RESPONSE["users/{uid}/remote-relay-responses/{id}"]
    end

    subgraph STUDIO["Studio desktop"]
        GUARD["Acquire synchronous local queue guard"]
        CLAIM["Atomically claim one pending phone command"]
        RELEASE["Release guard; await a later relay event"]
        WAKE["Wake Studio after every successful claim"]
        PARSE["Parse and route the remote command"]
        EXECUTE["Execute the selected Studio action"]
        WATCHDOG["Retain lock while route promise is unresolved"]
        COMPLETE["Publish response and terminal command status"]
        IDENTITY["Ignore stale timer and async completions that no longer own the active request"]
    end

    AUTH --> PAIRED
    PAIRED -->|"No"| LOCKED
    PAIRED -->|"Yes"| CONTROLS

    STATE --> FANOUT
    LOCAL --> FANOUT
    FANOUT --> SNAPSHOT
    SNAPSHOT --> FRESH
    FRESH -->|"Yes"| ACTIVE
    ACTIVE --> EDGE
    EDGE --> FRESH
    FRESH -->|"No, pairing was established"| GRACE
    FRESH -->|"No, never paired"| LOCKED
    GRACE --> STANDBY
    STANDBY --> RETRY
    RETRY --> SNAPSHOT

    VISIBLE --> SETTLE
    SETTLE --> SNAPSHOT
    MANUAL --> SNAPSHOT

    CONTROLS --> COMMAND
    COMMAND --> RULES
    RULES --> GUARD
    GUARD --> CLAIM
    CLAIM -->|"Lost or failed"| RELEASE
    CLAIM --> WAKE
    WAKE --> PARSE
    PARSE --> EXECUTE
    EXECUTE --> WATCHDOG
    WATCHDOG --> IDENTITY
    IDENTITY --> COMPLETE
    COMPLETE --> RESPONSE
    RESPONSE --> CONTROLS

    classDef mobile fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef relay fill:#FF8C00,stroke:#AA5500,stroke-width:2px,color:#001018
    classDef studio fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018
    classDef guard fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#FFFFFF

    class AUTH,PAIRED,LOCKED,CONTROLS,SNAPSHOT,FRESH,ACTIVE,EDGE,GRACE,STANDBY,RETRY,VISIBLE,SETTLE,MANUAL mobile
    class STATE,LOCAL,FANOUT,COMMAND,RESPONSE relay
    class CLAIM,WAKE,PARSE,EXECUTE,COMPLETE studio
    class RULES,GUARD,RELEASE,WATCHDOG,IDENTITY guard
```

## Transition Breakdown

1. **Authentication and pairing are distinct.** Authentication permits relay access, but the controller only considers itself paired after it has observed a valid Studio state. A later stale or missing heartbeat changes connection status, not the established pairing.
2. **Presence is a bounded lease.** Desktop state is fresh for 120 seconds plus 30 seconds of clock-skew tolerance. The phone schedules the exact remaining freshness interval instead of polling on an arbitrary cadence.
3. **Standby is recoverable.** When an established lease expires, the controller enters Standby after a transient grace period. Progressive retries stop after five attempts without reverting the controller to an unpaired screen or disabling chat and command controls.
4. **Mobile wake-up gets a settle window.** On `visibilitychange`, deferred checks are cancelled and presence evaluation waits 15 seconds for Firestore and the network to resynchronize. Manual retry clears every competing stale, grace, and retry timer before evaluating again.
5. **Local state has true subscriber fanout.** A same-window desktop-state event is delivered to every active `onDesktopState` subscriber, matching Firestore snapshot behavior instead of replacing an earlier callback.
6. **Relay writes are narrow and owner-bound.** Firestore rules validate the command and settings schemas, reject oversized or polluted payloads, and allow cancellation to change status only. The desktop uses a lease-backed transaction so only one Studio can claim a pending command.
7. **Every successful phone claim wakes Studio.** Wake-up occurs before parsing and action routing, including commands recovered from backlog scans, so sleep does not silently strand valid work.
8. **Async completion preserves ownership.** Generation timers, cancellation, and media playback capture request identity. A completion updates UI state only while it still owns the active operation, preventing older work from erasing or overwriting a newer command.
9. **Queue ownership lasts until real settlement.** The local guard is released on every pre-execution exit, but a claimed route retains it until its execution promise settles. Watchdog timers are command-scoped diagnostics and cannot unlock unresolved or later work.
