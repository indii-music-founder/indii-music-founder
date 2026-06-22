# Remote Connection & Presence Relay Flowchart

This flowchart documents the architecture of the `indiiCONTROLLER` (Mobile PWA remote) presence detection, resilient pairing, and structured desktop command execution system.

---

## Mermaid Diagram

```mermaid
graph TD
    %% System Layers & Color Coding
    subgraph MobileRemoteLayer["Mobile Remote (PWA)"]
        UserInteraction["User UI Action"]
        VisibilityListener["Visibility Listener (on focus)"]
        SoftStandby["Soft Standby State (UI Active)"]
        LocalWS["Local P2P WebSocket (Exponential Backoff)"]
    end

    subgraph FirebaseLayer["Cloud Relay & Firestore"]
        FirestoreRelay["Firestore presence doc (Estimate Timestamps)"]
        FirestoreCommands["Firestore remote-relay-commands collection"]
    end

    subgraph DesktopRelayLayer["Desktop Studio App"]
        Listener["useRemoteCommandListener (onSnapshot)"]
        TransactionClaim["Transaction Claim Gate (status = pending -> processing)"]
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
    UserInteraction -->|Sends command| LocalWS
    UserInteraction -->|Sends command| FirestoreCommands
    VisibilityListener -->|Foregrounded| SoftStandby
    VisibilityListener -->|Defer presence check 15s| SoftStandby
    
    LocalWS -->|Auth Code / Backoff| Listener
    FirestoreCommands -->|Listen onSnapshot| Listener
    
    Listener --> TransactionClaim
    TransactionClaim -->|Success| Parser
    
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
    style LocalWS fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
    
    style FirestoreRelay fill:#FF8C00,stroke:#d84315,stroke-width:2px,color:#000
    style FirestoreCommands fill:#FF8C00,stroke:#d84315,stroke-width:2px,color:#000
    
    style Listener fill:#8A2BE2,stroke:#4a148c,stroke-width:2px,color:#fff
    style TransactionClaim fill:#FF00FF,stroke:#880e4f,stroke-width:2px,color:#fff
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
   
2. **Exponential P2P Backoff & Auth:**
   The `LocalWS` connection helper targets localhost or private network subnets. If closed, it backs up progressively (exponentially) to prevent connection storms. If it receives a `4001` close code (authentication failed), it stops retrying to prevent resource starvation.

3. **Atomic Transaction Claim:**
   The desktop `Listener` queries pending commands from Firestore. To prevent multiple desktop instances or delayed processes from double-executing the same command, it wraps the state update in a Firestore `runTransaction` to atomically transition the command status from `pending` to `processing`.

4. **Structured Parse and Allowlist validation:**
   Untrusted text from the phone is parsed by `parseRemoteCommand`. It validates parameters against an allowlist (e.g. navigation targets must be valid `ModuleId`s). Invalid commands return `rejected` and are safely completed with an error message without hitting internal engines.

5. **Direct DAW & Media Transport Routing:**
   `DAW_CONTROL` and `MEDIA_PLAYBACK` actions bypass the heavy Generalist Agent pipeline entirely. They route straight to the Zustand `audioPlayerSlice` store, triggering fast, deterministic audio track control (Play, Pause, Stop, Toggle) on the desktop.
