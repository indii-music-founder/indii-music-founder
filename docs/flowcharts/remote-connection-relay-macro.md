# Remote Connection & Presence Relay Flowchart

This flowchart documents the architecture of the `indiiCONTROLLER` (Mobile PWA remote) presence detection, resilient pairing, and lease-backed desktop command execution system. The retired LAN WebSocket/P2P path is not part of the production architecture.

---

## Mermaid Diagram

```mermaid
graph TD
    %% System Layers & Color Coding
    subgraph MobileRemoteLayer["Mobile Remote (PWA)"]
        UserInteraction["User UI Action"]
        VisibilityListener["Visibility Listener (on focus)"]
        SoftStandby["Soft Standby State (UI Active)"]
    end

    subgraph FirebaseLayer["Cloud Relay & Firestore"]
        FirestoreRelay["Firestore presence doc (Estimate Timestamps)"]
        FirestoreCommands["Firestore remote-relay-commands collection"]
    end

    subgraph DesktopRelayLayer["Desktop Studio App"]
        Listener["StudioExecutorCore command listener"]
        QueueGuard["Synchronous local queue guard"]
        TransactionClaim["Lease-backed atomic claim (pending → processing)"]
        ReleaseGuard["Release guard; await later relay event"]
        Watchdog["Command-scoped diagnostic watchdog"]
        Parser["parseRemoteCommand (untrusted input validator)"]
        
        subgraph ActionHandlers["Action Routing & Execution"]
            WakeAction["Wake command (Show window)"]
            NavigateAction["Zustand setModule()"]
            ImageAction["ImageGenerationService"]
            DAWAction["AudioPlayerSlice (DAW Control)"]
            MediaAction["AudioPlayerSlice (Media Playback)"]
            ChatAction["AgentService (Generalist Swarm)"]
        end
    end

    %% Flow transitions
    UserInteraction -->|Sends command| FirestoreCommands
    VisibilityListener -->|Foregrounded| SoftStandby
    VisibilityListener -->|Defer presence check 15s| SoftStandby
    
    FirestoreCommands -->|Listen onSnapshot| Listener
    
    Listener --> QueueGuard
    QueueGuard --> TransactionClaim
    TransactionClaim -->|Success| Parser
    TransactionClaim -->|Lost / error| ReleaseGuard
    Parser --> Watchdog
    
    Parser -->|wake| WakeAction
    Parser -->|navigate| NavigateAction
    Parser -->|generate_image| ImageAction
    Parser -->|daw_control| DAWAction
    Parser -->|media_playback| MediaAction
    Parser -->|chat| ChatAction

    DAWAction -->|Play/Pause/Stop/Toggle| AudioPlayer["Zustand audioPlayerSlice"]
    MediaAction -->|Play/Pause/Stop| AudioPlayer

    %% Styles
    style UserInteraction fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
    style VisibilityListener fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
    style SoftStandby fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
    
    style FirestoreRelay fill:#FF8C00,stroke:#d84315,stroke-width:2px,color:#000
    style FirestoreCommands fill:#FF8C00,stroke:#d84315,stroke-width:2px,color:#000
    
    style Listener fill:#8A2BE2,stroke:#4a148c,stroke-width:2px,color:#fff
    style TransactionClaim fill:#FF00FF,stroke:#880e4f,stroke-width:2px,color:#fff
    style QueueGuard fill:#FF00FF,stroke:#880e4f,stroke-width:2px,color:#fff
    style ReleaseGuard fill:#FF00FF,stroke:#880e4f,stroke-width:2px,color:#fff
    style Watchdog fill:#FF00FF,stroke:#880e4f,stroke-width:2px,color:#fff
    style Parser fill:#8A2BE2,stroke:#4a148c,stroke-width:2px,color:#fff
    
    style WakeAction fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style NavigateAction fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style ImageAction fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style DAWAction fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style MediaAction fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style ChatAction fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
```

---

## Detailed Transitions & Lifecycle

1. **Visibility Focus Delay:**
   When the mobile remote app loses focus (phone lock / background tab), browser timers are aggressively throttled. Upon regaining visibility, `VisibilityListener` instantly clears any pending heartbeat timeout, schedules a deferred connection check in 15 seconds, and prevents aggressive UI offline blocker lockouts.
   
2. **One cloud relay path:**
   Commands travel through the owner-scoped Firestore relay. Every command ID uses the same server lease claim; there is no local WebSocket transport or synthetic-ID bypass.

3. **Atomic Transaction Claim:**
   The desktop listener queries pending commands from Firestore. To prevent multiple desktop instances or delayed processes from double-executing the same command, the lease callable atomically transitions the command status from `pending` to `processing`. The local guard is acquired before awaiting that claim and released on every exit.

4. **Structured Parse and Allowlist validation:**
   Untrusted text from the phone is parsed by `parseRemoteCommand`. It validates parameters against an allowlist (e.g. navigation targets must be valid `ModuleId`s). Invalid commands return `rejected` and are safely completed with an error message without hitting internal engines.

5. **Direct DAW & Media Transport Routing:**
   `DAW_CONTROL` and `MEDIA_PLAYBACK` actions bypass the heavy Generalist Agent pipeline entirely. They route straight to the Zustand `audioPlayerSlice` store, triggering fast, deterministic audio track control (Play, Pause, Stop, Toggle) on the desktop.

6. **Command-scoped watchdog:**
   The watchdog records prolonged execution but never releases the queue while the route promise is unresolved. Its timer is cancelled when that exact command settles, so an older timer cannot unlock a newer command.
