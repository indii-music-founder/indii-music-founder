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
        WebSocket["WebSocket Connection (Ngrok Edge)"]
        CloudRelay["Firestore Cloud Relay (Primary)"]
    %% Communication
    subgraph Transport ["Real-time Transport Layer"]
        WebSocket["WebSocket Connection (Electron/Ngrok)"]
        FirestoreRelay["Firestore Cloud Relay (Fallback/Primary)"]
        CloudRelay["Firestore Cloud Relay (Ubiquitous)"]
        WebSocket["Edge Server (WebSocket / Ngrok)"]
        SessionSync["Session Handoff Protocol"]
    end

    %% Desktop Electron
    subgraph Desktop ["Desktop Studio (Electron)"]
        DesktopApp["indii Studio (Main App)"]
        ElectronMainProcess["Electron Main Process (Port 3333)"]
        PreloadBridge["Electron Preload Bridge (IPC)"]
        LocalListener["RemoteCommandListener (Firestore Poller)"]
    end

    %% Backend Cloud Services
    subgraph Cloud ["Cloud Sync & Functions"]
        FirestoreSync["Firestore Real-time Listener"]
        FSState["Firestore (`remote_sessions` & `projects`)"]
        RelayProcessor["Cloud Function (relayCommandProcessor)"]
    end

    %% Flow: Edge WebSocket Path
    MobileAuth -->|"Device Pairing Code"| SessionSync
    SessionSync -->|"Establish Secure Channel"| WebSocket
    WebSocket <-->|"Direct Edge Connection"| ElectronMainProcess
    SessionSync -->|"Establish Relay"| FirestoreRelay
    WebSocket <-->|"A2A Encrypted Messages"| Encryption
    FirestoreRelay <-->|"A2A Encrypted Messages"| Encryption
    Encryption <-->|"Duplex Communication"| ElectronMainProcess
    
    RemoteUI -->|"Send Command"| WebSocket
    RemoteUI -->|"Send Command"| FirestoreRelay
    SessionSync -->|"Fallback/Primary Channel"| CloudRelay
    WebSocket <-->|"A2A Encrypted Messages"| Encryption
    CloudRelay <-->|"A2A Encrypted Messages"| Encryption
    Encryption <-->|"Duplex Communication"| ElectronMainProcess
    
    RemoteUI -->|"Send Command (Start/Stop)"| WebSocket
    RemoteUI -->|"Send Command"| CloudRelay
    WebSocket -->|"IPC Message"| PreloadBridge
    CloudRelay -->|"Sync via Firestore"| DesktopApp
    PreloadBridge -->|"Invoke Handler"| DesktopApp
    DesktopApp -->|"Update State"| SharedState
    SharedState -->|"Persist to Firestore"| FSState
    
    StatusMonitor -->|"Subscribe to updates"| WebSocket
    ElectronMainProcess -->|"Emit status changes"| WebSocket
    WebSocket -->|"Push to Mobile"| StatusMonitor
    
    PlaybackControls -->|"Stream audio (headless)"| WebSocket
    DesktopApp -->|"Send audio chunk"| WebSocket
    WebSocket -->|"Decode & Play"| PlaybackControls
    
    %% Flow: Primary Cloud Relay Path
    RemoteUI -->|"Send Command (Start/Stop)"| CloudRelay
    CloudRelay -->|"Write to Firestore"| FSState
    
    FSState -->|"Listen for New Commands"| LocalListener
    LocalListener -->|"Invoke Handler"| DesktopApp
    
    FSState -->|"Listen for Unclaimed Commands"| RelayProcessor
    RelayProcessor -->|"Execute Headless Action"| FSState
    
    StatusMonitor -->|"Subscribe to updates"| CloudRelay
    DesktopApp -->|"Emit status changes"| CloudRelay
    CloudRelay -->|"Push to Mobile"| StatusMonitor

    %% Styling
    style MobileAuth fill:#00D4FF,color:#000
    style RemoteUI fill:#00D4FF,color:#000
    style StatusMonitor fill:#00D4FF,color:#000
    style PlaybackControls fill:#00D4FF,color:#000
    style TouchTargets fill:#8A2BE2,color:#FFF

    style WebSocket fill:#FF00FF,color:#FFF
    style CloudRelay fill:#FF00FF,color:#FFF
    style FirestoreRelay fill:#FF00FF,color:#FFF
    style SessionSync fill:#FF00FF,color:#FFF

    style DesktopApp fill:#00D4FF,color:#000
    style ElectronMainProcess fill:#8A2BE2,color:#FFF
    style PreloadBridge fill:#8A2BE2,color:#FFF
    style LocalListener fill:#8A2BE2,color:#FFF

    style FirestoreSync fill:#39FF14,color:#000
    style FSState fill:#39FF14,color:#000
    style RelayProcessor fill:#39FF14,color:#000
```

## Transition Breakdown

1. **Hybrid Path:** The indiiREMOTE architecture uses **Firestore Cloud Relay** as the primary source of truth for command routing and state synchronization, while simultaneously maintaining a direct **WebSocket Edge Connection** (via Ngrok) for low-latency asset streaming.
1. **Device Pairing:** User opens **indiiREMOTE** on mobile and enters a **pairing code** from the desktop app. This initiates the **Session Handoff Protocol**.

2. **Secure Channel:** A **WebSocket connection** (direct or via Ngrok) or **Firestore Cloud Relay** is established between mobile and desktop, encrypted using the **A2A Encryption Protocol** (shared keying via AgentCard identity).

3. **Command Flow:** User taps a button on **Remote Control UI** (e.g., "Start Recording"). This sends a message via WebSocket to the **Electron Main Process**, which invokes handlers via the **Preload Bridge** (IPC).

4. **State Update:** The command executes in the desktop **Studio App**, updating the **Shared Zustand Store**. This change is automatically synced to **Firestore**.

5. **Live Feedback:** The **Status Monitor** subscribes to real-time updates. As the desktop app processes the command, status changes (e.g., "Recording in progress") are emitted back to the mobile app via WebSocket.

2. **Primary Command Flow:** User taps a button on **Remote Control UI**. This writes a command to the **Firestore Cloud Relay**.

3. **Atomic Claim System:** Both the **LocalListener** on the active desktop app and the **RelayProcessor** (Cloud Function) listen to Firestore. The desktop app claims and processes the command if online; otherwise, the cloud function processes it.

4. **State Update & Feedback:** As commands execute, status changes (e.g., "Recording in progress") are updated in Firestore and pushed in real-time to the mobile **Status Monitor**.

5. **Edge Playback (WebSocket):** For high-bandwidth tasks like audio/video preview, the mobile app communicates directly with the **Electron Main Process** over the encrypted WebSocket tunnel, bypassing the database layer.
