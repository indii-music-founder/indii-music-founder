# Remote Relay & Studio Executor Architecture

## 1. Overview
indii.music connects web and mobile interfaces to high-performance local digital audio workstations (DAWs) and studio renderers via the Remote Relay.

## 2. Security Architecture
```
[ Web / Mobile Client ]
         |
         | 1. Authenticated Command Request (Firebase Auth Bearer)
         v
[ Cloud Relay Service (Cloud Functions / WSS) ]
         |
         | 2. Validates user ownership of Target Executor
         | 3. Appends Monotonic Nonce & Max 60s TTL Expiration
         | 4. Signs Payload with Ephemeral Session Secret
         v
[ Secure WebSocket Tunnel (TLS 1.3) ]
         |
         v
[ Local Studio Executor (Desktop Daemon) ]
         |
         | 5. Verifies cryptographic signature & nonce freshness
         | 6. Executes command in unprivileged user sandbox
         | 7. Records execution audit record
         v
[ Local DAW / Audio Engine ]
```

## 3. Security Guarantees
1. **Replay Attack Elimination**: Commands contain nonces verified against a rolling cache; expired commands (>60s old) are rejected unconditionally.
2. **Identity Binding**: Studio Executors are registered to a specific Firebase UID. Commands from different UIDs are rejected at the Relay gateway.
3. **Execution Auditing**: All executed commands are logged with timestamp, client UID, machine signature, and exit status.
