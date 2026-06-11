# Mobile Remote Pairing & Handoff Authentication Architecture

This flowchart illustrates the end-to-end flow for secure pairing of the mobile remote companion device with the desktop app, including the passwordless custom token handoff and the secure exponential backoff persistence mechanism.

```mermaid
sequenceDiagram
    autonumber
    actor User as Artist (User)
    participant Desktop as Desktop App
    participant CF as Cloud Functions (Firebase Admin)
    participant FS as Firestore
    participant Mobile as Mobile App (Companion)

    %% Pairing & Code Creation
    Note over User, CF: 1. Pairing Code Generation (Desktop)
    User->>Desktop: Clicks "Link" to pair device
    Desktop->>CF: POST /createHandoffCode { idToken } (Rate Limited)
    CF->>CF: Verify idToken (validates authenticity)
    CF->>CF: Generate random 64-hex code
    CF->>FS: Save code details (userId, expiresAt: now + 5m)
    CF-->>Desktop: Return { code }
    Desktop->>Desktop: Build QR code URL: ?code=...
    Desktop-->>User: Renders Pairing QR Code

    %% Handoff Redemption & Sign-in
    Note over User, Mobile: 2. Scanning & Auto-Sign-In (Mobile)
    User->>Mobile: Scans QR code / opens URL
    Mobile->>Mobile: Extract & format-validate 64-hex 'code'
    Mobile->>CF: POST /redeemHandoffCode { code } (Rate Limited)
    CF->>CF: Validate 64-hex format (prevent path traversal)
    CF->>FS: Lookup code doc
    FS-->>CF: Code metadata (userId, expiresAt)
    CF->>CF: Verify expiration & delete doc (one-time use)
    CF->>CF: admin.auth().createCustomToken(userId)
    CF-->>Mobile: Return { customToken }
    Mobile->>Mobile: signInWithCustomToken(auth, customToken)
    Mobile-->>User: Instant login complete!

    %% Connection State & Commands
    Note over Desktop, Mobile: 3. Session Connection & Commands
    Mobile->>FS: Listen to desktop state doc (users/{uid}/remote-relay/state)
    Desktop->>FS: Periodically updates state doc (online: true, every 5s)
    Mobile->>FS: Write command (users/{uid}/remote-relay-commands)
    Desktop->>FS: Read command & set status to 'processing'
    Desktop->>CF: (Execute command and stream responses)
    Desktop->>FS: Mark command 'completed'
```

### Key Security & Reliability Measures
1. **Endpoint Rate Limiting**: Both `/createHandoffCode` and `/redeemHandoffCode` implement a transaction-locked rate limiter in Cloud Functions (max 10 requests/minute per client IP) to block brute-force attempts.
2. **Format Sanitization**: Handoff code parameter is validated to match a strict 64-character hexadecimal regex (`/^[a-fA-F0-9]{64}$/`) server-side to prevent malicious directory traversal or injections.
3. **Reactive Auth Check**: The mobile remote subscribes to Firebase auth state changes via `onAuthStateChanged` and transitions from `idle` to `pairing` state as soon as credentials resolve, preventing race conditions or permanent loading spinners on cold loads.
4. **Heartbeat Presence**: The desktop's online presence threshold (`DESKTOP_HEARTBEAT_STALE_MS`) is configured to 15 seconds to ensure quick detection of desktop app crashes or sudden network drops.
5. **Robust Storage Sync**: Critical state writes (`persistQueueToFirestore` and `saveProfileToStorage`) utilize a recursive exponential backoff retry loop (up to 3 attempts) to survive transient cloud database synchronization failures.
