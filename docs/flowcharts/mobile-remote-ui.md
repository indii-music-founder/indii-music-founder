# Mobile Remote UI Architecture

This flowchart describes the new, simplified "Basic & Void-Styled" Mobile Remote UI, focusing on the high-level routing, data flow, and Cloud Relay synchronization.

```mermaid
flowchart TD
    subgraph Mobile Device
        MR[MobileRemote.tsx]
        MR --> T_Home[Home Tab]
        MR --> T_Cap[Capture Tab]
        MR --> T_Stream[Stream Tab]
        MR --> T_Set[Settings Tab]
        
        T_Home --> DB[StatusDashboard.tsx<br/>Basic Quick Actions]
        T_Cap --> QC[QuickCaptureView.tsx<br/>Voice Memo & Receipt Image]
        T_Stream --> TB[TransportBar.tsx<br/>Cloud Audio Stream]
        
        QC -->|audioUrl / imageUrl| DP[remoteRelayService.dispatchTask]
        DB -->|Command String| DP
    end

    subgraph Firebase Cloud
        DP -->|Write| FS[(Firestore: agent_dispatch_queue)]
        DP -->|Upload| ST[(Firebase Storage)]
    end

    subgraph Desktop Agent Executor
        FS -.->|onSnapshot Listener| EL[useFirestoreRelay.ts]
        EL --> AC[AgentConductor Switch]
        AC -->|voice_memo / quick_contact| AI[agentService.sendMessage]
        AI -->|Generate Audio URL| FS
        FS -.->|Sync URL| TB
    end
```

## Description
This architecture completely decouples the complex multi-metric system and focuses strictly on high-leverage mobile actions: quick notes (voice) and rapid tracking (receipt photos). The data is dispatched to the `agent_dispatch_queue` via Firestore, where the Desktop Executor (which is always running in the background) picks up the tasks and routes them through the AI agents. The response is synced back, creating a resilient Cloud Relay link that does not depend on immediate local network availability.
