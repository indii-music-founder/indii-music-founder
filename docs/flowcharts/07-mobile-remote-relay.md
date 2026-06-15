---
description: Architecture of the indiiCONTROLLER mobile-to-desktop WebSocket relay, detailing the connection lifecycle, state overrides, and infinite-spinner safety timeouts.
---

# Mobile Remote Relay Architecture (indiiCONTROLLER)

This flowchart maps the bidirectional WebSocket relay that powers indiiCONTROLLER. It traces how commands from the mobile PWA are routed through Cloud Functions, safely overriding the desktop's native UI state to execute remote tasks, while protecting against infinite connection spinners through robust timeout fallbacks.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        MOBILE CLIENT (PWA)               ║
    %% ╚══════════════════════════════════════════╝
    subgraph MOBILE ["📱 indiiCONTROLLER (Mobile PWA)"]
        direction TB
        MOUNT["MobileRemote.tsx Mount"]
        AUTH_CHK{"isAuth ready?"}
        PAIRING["State: 'pairing'<br/>(Locating Desktop...)"]
        TIMEOUT["10s Safety Timeout"]
        IDLE["State: 'idle'<br/>(Connected)"]
        BTN["User Taps 'Send Command'"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        RELAY INFRASTRUCTURE              ║
    %% ╚══════════════════════════════════════════╝
    subgraph RELAY ["☁️ Firebase Relay Layer"]
        DB_DOC["Firestore: users/{uid}/relay/desktopState"]
        CF_RELAY["Cloud Function: relayCommand"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        DESKTOP LISTENER & OVERRIDE       ║
    %% ╚══════════════════════════════════════════╝
    subgraph DESKTOP ["💻 Desktop Client (Renderer)"]
        direction TB
        LISTENER["useRemoteCommandListener"]
        SAVE_STATE["1. Save current UI State<br/>(Mode, Dept, Agent)"]
        OVERRIDE["2. Override State<br/>(Force Direct Mode + forcedAgentId)"]
        EXECUTE["3. AgentService.sendMessage()"]
        RESTORE["4. Restore original UI State"]
    end

    %% Connection lifecycle
    MOUNT --> AUTH_CHK
    AUTH_CHK -->|Wait| AUTH_CHK
    AUTH_CHK -->|Yes| PAIRING
    
    PAIRING --> DB_DOC
    DB_DOC -.->|onSnapshot Desktop active| IDLE
    PAIRING --> TIMEOUT
    TIMEOUT -->|No response in 10s| IDLE

    %% Execution lifecycle
    BTN --> CF_RELAY
    CF_RELAY --> LISTENER
    LISTENER --> SAVE_STATE
    SAVE_STATE --> OVERRIDE
    OVERRIDE --> EXECUTE
    EXECUTE --> RESTORE

    classDef mobile fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef relay fill:#FF8C00,stroke:#AA5500,stroke-width:2px,color:#001018
    classDef desktop fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018
    classDef error fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#FFFFFF

    class MOUNT,AUTH_CHK,PAIRING,IDLE,BTN mobile
    class DB_DOC,CF_RELAY relay
    class LISTENER,SAVE_STATE,OVERRIDE,EXECUTE,RESTORE desktop
    class TIMEOUT error
```

## Transition Breakdown

1. **Mobile Mount & Auth Verification**: The PWA mounts the `MobileRemote` component. A `useEffect` hook waits on `remoteRelayService.isAuthenticated()` before attempting to connect. This prevents null references when Firebase Auth hasn't fully initialized.
2. **Pairing & Fallback Timeout**: The mobile UI enters a `'pairing'` state (showing a spinner) and attaches an `onSnapshot` listener to the desktop state document in Firestore. Concurrently, a 10-second safety timeout begins. If the desktop document doesn't respond within 10s (desktop asleep/closed), the state gracefully falls back to `'idle'` instead of trapping the user in an infinite loading spinner.
3. **Command Dispatch**: Once connected, the user taps a command button on their phone. The payload hits the `relayCommand` Cloud Function.
4. **Desktop Listener**: The desktop app's `useRemoteCommandListener` receives the relayed command.
5. **State Override Pattern**: Because the desktop UI might currently be in a completely different mode (e.g., Boardroom Mode viewing the Distribution Department), executing the mobile command natively would drop the `forcedAgentId` parameters and execute in the wrong context. To solve this, the listener executes a rigid pattern:
    - **Save**: Captures the current `conversationMode`, `selectedDept`, and `activeAgentProvider`.
    - **Override**: Temporarily forces Zustand into `conversationMode: 'direct'` and `activeAgentProvider: 'native'` (bypassing visual UI limitations).
    - **Execute**: Dispatches the payload through `AgentService.sendMessage()`, guaranteeing correct LLM routing based on the mobile intent.
    - **Restore**: Synchronously reverts the UI state back to what the user was looking at on their desktop monitor before the command finished executing.
