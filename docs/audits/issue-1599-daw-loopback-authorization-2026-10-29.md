# ISSUE-1599: DAW loopback authorization — 2026-10-29

Status: PARTIAL. Native transport regression evidence, not a DAW-product acceptance claim.

## Confirmed gap and protocol

The original WebSocket server bound port 8081 without a host, Origin policy or credential check, sent track state immediately on connection, and merged arbitrary `sync.state` values into its state. `daw:start` also returned success before asynchronous bind errors could arrive.

The listener binds IPv4 loopback only. Each start generates a 32-byte random in-memory pairing credential. A native companion must send `Authorization: Bearer <pairing credential>` in its WebSocket upgrade; every request carrying an Origin header is rejected, even with a correct credential. Query strings do not authorize a connection. Credential comparisons use fixed-size SHA-256 digests and `timingSafeEqual`; the whole request is not claimed constant-time. No state is delivered before a successful upgrade.

The app exposes `{url, token}` only through `daw:get-connection-info`, guarded by the existing IPC sender validator. Start resolves after binding; failed binds reject. Stop invalidates pairing immediately, clears state, terminates clients, and closes even a pending listener. Restart creates a new credential. Neither credentials nor project state are logged or persisted by this protocol.

A strict sync-message schema accepts only the known state fields with finite numeric values, positive tempo, boolean playback and bounded string track names. The socket payload limit is 64 KiB. State getters return copies. Obsolete socket callbacks cannot mutate a replacement server's state.

## Tests and acceptance boundary

Six tests start actual native WebSocket listeners on OS-assigned loopback ports. They exercise missing/incorrect credentials, browser Origins (including `null`), authorized initial-state delivery, invalid/valid sync messages, defensive state copies, stop/client closure, credential rotation, pending bind cancellation and a real EADDRINUSE conflict followed by recovery. Credentials come from each actual test listener; no Firebase/cloud account, auth response, DAW/plugin or service mocks were added. This tests a local component protocol, not an authenticated customer journey.

No port-8081 companion implementation or customer pairing UI was found in the repository. The renderer `DAWIntegrationService` exports/parses files and is a separate path. Existing external companions must implement this header protocol; unauthenticated clients now fail closed. The new IPC method is an integration surface, not proof that a released plugin can consume it.

No installed app, DAW plugin, real customer signup, actual plan or persisted customer session was exercised. Genuine native-plugin pairing and installed-platform acceptance remain required. Knowledge mutation is still unresolved; the separate file-write, render-input and packaged-artifact/catalog branches retain their own proof limits. ISSUE-1599 is not closed.
