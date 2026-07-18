# indii Mobile Remote Setup

**Version:** 1.64.6
**Last updated:** 2026-07-18
**Supported transport:** Authenticated Firestore cloud relay

Mobile Remote is a companion controller for the Electron Studio. It is not a second Studio and it does not currently provide general cross-device workspace or notes synchronization.

## Connect a phone or tablet

1. Open the Electron Studio and sign in.
2. Open **Settings → Mobile Remote**. You can also type `/connect-remote`, `/pair-remote`, or ask “Can you help me connect to the remote control?” in the command bar.
3. Select **Generate Pairing Code**.
4. Scan the QR code with the phone or tablet that will act as the controller.
5. Open the link before its five-minute expiration. The link is single-use.
6. The controller redeems the handoff and signs into the same indii account. There is no separate desktop Accept button in the current implementation.
7. Keep the Electron Studio open. When its fresh executor presence is discovered, the controller reports **Active** and Studio-targeted controls become available.

The pairing link contains a short-lived handoff code. Do not paste it into chat, logs, screenshots, or support messages.

## Connection states

- **Link:** The controller is not signed in. Generate a fresh pairing code in Studio.
- **Authenticated / Studio offline:** The controller is signed in, but no fresh Studio presence has been found. Open or wake the Electron Studio.
- **Recovering:** The controller is recreating its Firestore listener and checking for fresh Studio presence.
- **Standby:** This controller previously discovered Studio, but the latest heartbeat is stale. Durable controls may wake Studio; Standby is not the same as Active.
- **Active:** A fresh, lease-authorized Studio executor is listening.
- **Error:** Authentication, permissions, backend availability, or protocol compatibility prevented connection. Follow the displayed recovery action rather than generating commands repeatedly.

## What the remote currently synchronizes

- Studio presence and sleep/readiness state
- Studio-targeted commands and correlated responses
- Supported navigation, capture, agent-chat, and transport actions
- Ephemeral command status through the authenticated cloud relay

The following are not promised by this connection:

- Complete workspace, notes, or asset mirroring between arbitrary devices
- Offline agent execution or a guaranteed offline command queue
- Conflict-resolution dialogs for edits made on multiple devices
- A supported LAN, WebSocket, or Ngrok fallback

## Troubleshooting

### The pairing link expired

Return to **Settings → Mobile Remote** and generate a new link. Codes expire after five minutes and cannot be reused after redemption.

### The controller is authenticated but Studio is offline

1. Confirm the Electron Studio is open and signed into the same account.
2. Wake the computer and bring Studio to the foreground.
3. Select **Try Reconnecting Now**. Retry cancels and recreates the cloud-state subscription.
4. If an explicit permissions, backend, or version error appears, keep that error text and the Studio/controller build versions for support.

### The command remains pending

Studio-targeted commands require a fresh executor lease. Open or wake Studio and wait for **Active**. Do not assume an authenticated controller means the Studio executor is ready.

### The command bar says it cannot connect a remote

Use `/connect-remote`. In builds containing ISSUE-1109, the natural-language request also opens **Settings → Mobile Remote** directly without exposing the pairing code to the assistant.

## Security and device access

- Both surfaces use Firebase Authentication for the same account.
- Trusted Studio presence is written only by a Cloud Function after validating a short-lived Electron executor lease and expiry.
- The readable presence document never contains the executor lease token.
- Pairing codes and executor credentials must not be sent to an AI model.
- Device listing and explicit controller revocation remain future work; sign out of the controller to remove its current session.
