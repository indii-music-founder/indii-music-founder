# Mobile Remote (indiiREMOTE) Hybrid Flowchart

This flowchart maps **indiiREMOTE**—a companion mobile app that lets artists control and monitor the Indii Studio remotely from phone/tablet. It utilizes a **Hybrid Architecture** communicating both via **Firestore Cloud Relay** (for robust command/state sync) and **Direct WebSocket/Ngrok** (for high-bandwidth edge tasks).

```mermaid
graph TD
    %% Mobile Layer
    subgraph Mobile ["Mobile App (React Native / Web)"]
        MobileAuth["Mobile Auth (Phone Session)"]
        RemoteUI["Remote Control UI"]
        StatusMonitor["Studio Status Monitor"]
        PlaybackControls["Playback Preview (Headless)"]
        TouchTargets["Large Touch Targets (Mobile UX)"]
    end

    %% Communication Transport Layer
    subgraph Transport ["Transport Layer (Hybrid)"]
        FirestoreRelay["Firestore Cloud Relay (Primary)"]
        SessionSync["Session Handoff Protocol"]
        EdgeServer["Edge Server (WebSocket / Ngrok)"]
    end

    %% Desktop Electron
    subgraph Desktop ["Desktop Studio (Electron)"]
        DesktopApp["indii Studio (Main App)"]
        ElectronMainProcess["Electron Main Process (Port 3333)"]
        PreloadBridge["Electron Preload Bridge (IPC)"]
        LocalListener["RemoteCommandListener (Firestore Poller)"]
        SharedState["Shared Zustand Store"]
    end

    %% Backend Cloud Services
    subgraph Cloud ["Cloud Sync & Functions"]
        FSState["Firestore (remote-relay-commands & state)"]
        RelayProcessor["Cloud Function (relayCommandProcessor)"]
    end

    %% Flow: Pairing & Setup
    MobileAuth -->|"Device Pairing Code"| SessionSync
    SessionSync -->|"Establish Relay"| FirestoreRelay
    SessionSync -->|"Establish Edge Channel"| EdgeServer

    %% Flow: Command Execution
    RemoteUI -->|"1. Send Command"| FirestoreRelay
    FirestoreRelay -->|"2. Write Doc"| FSState
    
    FSState -->|"3a. Listen (Atomic Claim)"| LocalListener
    LocalListener -->|"4a. Process Command"| DesktopApp
    
    FSState -->|"3b. Fallback (If Desktop Offline)"| RelayProcessor
    RelayProcessor -->|"4b. Execute Cloud Action"| FSState

    %% Flow: Desktop State & Heartbeat Sync
    DesktopApp -->|"Update State"| SharedState
    SharedState -->|"Push State & Heartbeat"| FSState
    FSState -->|"Real-time Status Feed"| FirestoreRelay
    FirestoreRelay -->|"Sync UI State"| StatusMonitor

    %% Flow: High-Bandwidth Edge Tunnel
    RemoteUI -->|"Send Control Command"| EdgeServer
    EdgeServer <-->|"Direct WebSocket Edge"| ElectronMainProcess
    ElectronMainProcess -->|"IPC Command"| PreloadBridge
    PreloadBridge -->|"Execute Audio Control"| DesktopApp
    DesktopApp -->|"Stream audio chunks"| EdgeServer
    EdgeServer -->|"Preview audio"| PlaybackControls

    %% Styling
    style MobileAuth fill:#00D4FF,color:#000
    style RemoteUI fill:#00D4FF,color:#000
    style StatusMonitor fill:#00D4FF,color:#000
    style PlaybackControls fill:#00D4FF,color:#000
    style TouchTargets fill:#8A2BE2,color:#FFF

    style FirestoreRelay fill:#FF00FF,color:#FFF
    style EdgeServer fill:#FF00FF,color:#FFF
    style SessionSync fill:#FF00FF,color:#FFF

    style DesktopApp fill:#00D4FF,color:#000
    style ElectronMainProcess fill:#8A2BE2,color:#FFF
    style PreloadBridge fill:#8A2BE2,color:#FFF
    style LocalListener fill:#8A2BE2,color:#FFF

    style FSState fill:#39FF14,color:#000
    style RelayProcessor fill:#39FF14,color:#000
```

## Transition Breakdown

1. **Hybrid Path:** The indiiREMOTE architecture uses **Firestore Cloud Relay** as the primary source of truth for command routing and state synchronization, while simultaneously maintaining a direct **WebSocket Edge Connection** (via Ngrok) for low-latency asset streaming.

2. **Device Pairing:** User opens **indiiREMOTE** on mobile and enters a **pairing code** from the desktop app. This initiates the **Session Handoff Protocol**.

3. **Secure Channel:** A **WebSocket connection** (direct or via Ngrok) or **Firestore Cloud Relay** is established between mobile and desktop, encrypted using standard secure protocols.

4. **Command Flow:** User taps a button on **Remote Control UI** (e.g., "Start Recording"). This sends a message via WebSocket to the **Electron Main Process**, which invokes handlers via the **Preload Bridge** (IPC).

5. **State Update:** The command executes in the desktop **Studio App**, updating the **Shared Zustand Store**. This change is automatically synced to **Firestore**.

6. **Live Feedback:** The **Status Monitor** subscribes to real-time updates. As the desktop app processes the command, status changes (e.g., "Recording in progress") are emitted back to the mobile app via WebSocket.

7. **Atomic Claim System:** Both the **LocalListener** on the active desktop app and the **RelayProcessor** (Cloud Function) listen to Firestore. The desktop app claims and processes the command if online; otherwise, the cloud function processes it.

8. **State Update & Feedback:** As commands execute, status changes (e.g., "Recording in progress") are updated in Firestore and pushed in real-time to the mobile **Status Monitor**.

9. **Edge Playback (WebSocket):** For high-bandwidth tasks like audio/video preview, the mobile app communicates directly with the **Electron Main Process** over the encrypted WebSocket tunnel, bypassing the database layer.
