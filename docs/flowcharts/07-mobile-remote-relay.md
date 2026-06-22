---
description: Architecture of the indiiCONTROLLER mobile-to-desktop WebSocket relay, detailing the connection lifecycle, soft standby state transitions, visibility change delays, and auto-wake command routing.
---

# Mobile Remote Relay Architecture (indiiCONTROLLER)

This flowchart maps the bidirectional Cloud Relay and presence engine that powers indiiCONTROLLER. It traces how pairing status is persistent based on authentication, how connection status uses soft standby indicators instead of locking out the user, and how mobile sleep/wake states are handled robustly via visibility listeners.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        MOBILE CLIENT STATE ENGINE        ║
    %% ╚══════════════════════════════════════════╝
    subgraph MOBILE ["📱 indiiCONTROLLER (Resilient Presence Engine)"]
        direction TB
        MOUNT["MobileRemote.tsx Mount"]
        AUTH_CHK{"Is authenticated?"}
        
        subgraph PAIRED_STATE ["Linked & Active Dashboard (isPaired = true)"]
            direction TB
            DASHBOARD["Dashboard UI & Actions Enabled"]
            WAKE_LSTN["visibilitychange Listener"]
            
            subgraph STATE_MACHINE ["Connection Status State Machine"]
                direction TB
                CONN_CONNECTED["'connected' Status<br/>(Active / Sleeping)"]
                CONN_PAIRING["'pairing' Status<br/>(Pulsing Standby)"]
                CONN_IDLE["'idle' Status<br/>(Pulsing Standby)"]
            end
            
            WAKE_EVT["Page Foregrounded / Wake"]
            DEFER_TIME["1. Clear timeouts<br/>2. Defer checks 15s"]
            STALE_TIMEOUT["120s Stale Heartbeat Timer"]
            MARK_OFFLINE["heartbeat went stale?"]
            RECONNECT_LOOP["Progressive Backoff Loop<br/>(Max 5 Attempts)"]
        end
        
        UNPAIRED_STATE["Blocked Screen:<br/>Studio Disconnected<br/>(isPaired = false)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        RELAY INFRASTRUCTURE              ║
    %% ╚══════════════════════════════════════════╝
    subgraph RELAY ["☁️ Firebase Relay Layer"]
        DB_DOC["Firestore: users/{uid}/remote-relay/state<br/>(serverTimestamps: 'estimate')"]
        CMD_QUEUE["Firestore: remote-relay-commands/{id}"]
    end

    %% Mount & Auth Check
    MOUNT --> AUTH_CHK
    AUTH_CHK -->|No / Logged Out| UNPAIRED_STATE
    AUTH_CHK -->|Yes / Logged In| PAIRED_STATE
    
    %% Dashboard and always-enabled state
    PAIRED_STATE --> DASHBOARD
    DASHBOARD -->|Send Command / Wake| CMD_QUEUE
    
    %% State snapshot logic
    DB_DOC -.->|onDesktopState snapshot| CONN_CONNECTED
    CONN_CONNECTED -->|Start| STALE_TIMEOUT
    STALE_TIMEOUT -->|Expires| MARK_OFFLINE
    
    %% Visibility change path
    WAKE_LSTN --> WAKE_EVT
    WAKE_EVT --> DEFER_TIME
    DEFER_TIME -->|Wait 15s| DB_DOC
    
    %% Standby / Retry loop path
    MARK_OFFLINE -->|Yes| RECONNECT_LOOP
    RECONNECT_LOOP -->|Active Retry| CONN_PAIRING
    RECONNECT_LOOP -->|Max Reached (5)| CONN_IDLE

    classDef mobile fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef relay fill:#FF8C00,stroke:#AA5500,stroke-width:2px,color:#001018
    classDef desktop fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018
    classDef error fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#FFFFFF

    class MOUNT,AUTH_CHK,PAIRED_STATE,CONN_CONNECTED,CONN_PAIRING,CONN_IDLE,UNPAIRED_STATE,DASHBOARD,WAKE_LSTN,WAKE_EVT,DEFER_TIME,STALE_TIMEOUT,MARK_OFFLINE,RECONNECT_LOOP mobile
    class DB_DOC,CMD_QUEUE relay
```

## Transition Breakdown

1. **Persistent Pairing via Auth**: The PWA treats Firebase Authentication as the single source of truth for the paired state (`isPaired`). As long as the user is authenticated, they remain on the active dashboard. No full-screen blocker can lock them out.
2. **Estimates for Server Timestamps**: Firestore `onDesktopState` listens with `{ serverTimestamps: 'estimate' }`. This ensures that when the desktop updates its state, the phone's snapshot immediately receives an estimated timestamp instead of a `null` value during write propagation, eliminating immediate stale transitions.
3. **visibilitychange Sleep/Wake Handler**: Waking the phone or unlocking it triggers a visibility listener that instantly cancels any pending timeouts and defers presence checks by **15 seconds**. This gives the network and Firestore websocket enough time to sync without throwing false-positive offline transitions due to transient mobile standby freezes.
4. **Soft Standby Connection Pills**: The header status pill transitions dynamically:
    - **Active (Green)**: Desktop is online and heartbeats are fresh.
    - **Sleeping (Amber)**: Desktop is in background sleep mode.
    - **Standby (Zinc)**: Desktop is backgrounded/throttled or offline.
5. **Always-Enabled Controls**: All dashboard actions (Voice Memo, Log Receipt, EPK, etc.) and chat inputs remain enabled during Standby. Sending a command writes to Firestore and auto-wakes the desktop in the background.
