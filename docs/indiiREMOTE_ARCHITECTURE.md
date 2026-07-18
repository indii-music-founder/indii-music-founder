# indiiREMOTE Architecture

## Supported production path

Mobile Remote uses one supported transport: the authenticated Firestore cloud relay.

1. Electron stores a Studio enrollment credential in the operating-system credential vault.
2. `issueStudioExecutorLease` validates that enrollment and returns a short-lived lease.
3. Studio calls `publishStudioPresence`; the server validates the lease and expiry, then writes a sanitized presence projection.
4. A same-account controller may read presence and create a Studio-targeted command.
5. The leased Studio atomically claims the command, executes it once, publishes correlated responses, and completes it through server callables.

The public state projection contains `protocolVersion`, readiness, Studio identity, and timestamps. It never contains the lease token. Firestore rules deny every client write to trusted Studio presence and all client reads/writes of executor lease documents.

## Pairing

Settings creates a single-use handoff code with a five-minute expiry and embeds it in the hosted Mobile Remote URL. Redemption exchanges the code for a Firebase custom token for the same account. The current implementation does not create a durable controller-device record or require a second desktop acceptance step.

## Connection compatibility

Remote protocol version 1 is published with Studio presence. A callable rejects explicitly unsupported protocol versions with `failed-precondition`. Releases must deploy backward-compatible Functions and rules before clients, run a connection canary, then remove obsolete compatibility only after supported clients have migrated.

## Legacy edge transport

`IndiiRemoteService` is retained for development and future protocol work, but it is unsupported and disabled by default. Electron does not open its listener, broadcast to it, or create an Ngrok tunnel unless the operator explicitly sets:

```text
INDII_ENABLE_LEGACY_EDGE_REMOTE=true
```

Enabling that flag is not a production recommendation. The legacy client authentication and message contracts require dedicated end-to-end repair before the edge transport can be advertised to users.

## Failure semantics

- Authentication establishes controller identity; it does not prove Studio is online.
- Pairing/handoff redemption, Studio discovery, executor readiness, and Active connection are distinct states.
- Retry recreates the Firestore state listener; it does not merely animate a counter.
- Permission denial, backend unavailability, and protocol mismatch must remain distinct typed errors as observability is expanded.
