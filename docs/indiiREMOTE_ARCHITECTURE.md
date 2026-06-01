# indiiREMOTE Hybrid Architecture

The indiiREMOTE feature transforms your mobile device into a companion controller for the indii studio.

## Architectural Model: Hybrid Cloud Relay + Edge

We currently operate a **Hybrid** remote architecture that leverages the best of both cloud reliability and edge performance. The documentation previously stated that the Edge model replaced the Cloud Relay entirely, but in reality, both paths are active and serve different necessary functions.

### 1. Firestore Cloud Relay (Primary Command & State Path)
The primary method for state synchronization and command delivery is the **Cloud Relay** (via Firebase Firestore). 
- **Atomic Execution**: Commands are processed using a first-wins atomic claim system. The desktop studio claims the command if online; otherwise, the cloud function processes it.
- **Persistence**: Ensures that commands and state updates are never lost, even if the mobile device temporarily drops connection or the desktop is offline.
- **Text & Metadata**: Handles text generation commands, agent chat, and status dashboard syncing.
- **Desktop-Only Commands Partition**: Desktop-only operations (e.g. `[GENERATE_IMAGE]`) are routed through Firestore but are ignored by the Cloud Function, allowing the desktop to claim and execute them locally.

### 2. Global Edge Computing (High-Bandwidth / Low-Latency Path)
In parallel, the indii Electron app can silently boot a native Node.js Express server on port `3333`, mapped directly to the global internet via an encrypted **Ngrok Tunnel**.
- **Headless Playback**: Designed for streaming audio/video chunks directly to the mobile device for preview without relying on slow database reads/writes.
- **Direct Edge Access**: Provides a zero-install Thin Client React SPA served directly from the Mac.
- **Desktop-Only Commands**: Provides an alternative fast-path for commands that require immediate desktop execution.

## Core Components

1. **RemoteRelayService (`packages/renderer/src/services/agent/RemoteRelayService.ts`)**: The primary React-side service that subscribes to Firestore for state sync and sends commands.
2. **IndiiRemoteService (`packages/main/src/services/IndiiRemoteService.ts`)**: Manages the Express server, WebSocket lifecycle, and Ngrok tunnel bridging for the Edge path.
3. **IPC Handler (`packages/main/src/handlers/mobile_remote.ts`)**: Translates Desktop UI requests to the background service and fetches the live HTTPS tunnel URL.
4. **Cloud Relay Processor (`packages/firebase/src/relay/relayCommandProcessor.ts`)**: Backend cloud function ensuring command execution if the desktop is disconnected.

## Security Model

- **Cloud Relay Rules**: Protected by strict Firestore security rules requiring proper authentication.
- **Edge Encryption**: The direct Ngrok tunnel path uses end-to-end encryption via Ngrok TLS.
- **Passcode Auth**: The IPC bridge generates a 6-digit Session Passcode (`sessionPasscode`) unique to each edge boot.
