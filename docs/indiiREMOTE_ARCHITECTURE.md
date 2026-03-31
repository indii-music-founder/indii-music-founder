# indiiREMOTE Global Edge Architecture

The indiiREMOTE feature transforms your desktop into a globally accessible, private edge server.

## Architectural Transition

We previously relied on a "Cloud Relay" model (via Firebase) and a localized Wi-Fi WebSocket model. Both are slow or restrictive. We have now moved to **Global Edge Computing**.

Instead of relying on cloud databases to relay commands, the indiiOS Electron app silently boots a native Node.js Express server on port `3333` and maps it directly to the global internet via an encrypted **Ngrok Tunnel**.

## Core Components

1. **IndiiRemoteService (`electron/services/IndiiRemoteService.ts`)**: Manages the Express server, WebSocket lifecycle, and Ngrok tunnel bridging.
2. **IPC Handler (`electron/handlers/mobile_remote.ts`)**: Translates Desktop UI requests to the background service and fetches the live HTTPS tunnel URL.
3. **The Edge Client (`public/remote/index.html`)**: A zero-install Thin Client React SPA served directly from your Mac, handling the WebSocket handshake and displaying the live mainframe status.

## Security Model

- **End-to-End Encryption**: Managed via Ngrok TLS.
- **Passcode Auth**: The IPC bridge generates a 6-digit Session Passcode (`sessionPasscode`) unique to each boot.
- **No Third-Party Middlemen**: Data never touches a Firebase instance, protecting unreleased visual and audio assets.
