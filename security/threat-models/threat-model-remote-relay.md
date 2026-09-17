# STRIDE Threat Model: Remote Relay & Studio Executor

| Threat Category (STRIDE) | Threat Description | Attack Vector | Mitigating Controls |
|---|---|---|---|
| **Spoofing** | Attacker impersonates an artist's Studio Executor | Rogue WebSocket connection with forged client identity | Mutual authentication with short-lived JWTs tied to user UID. |
| **Tampering** | Intermediary modifies DAW render command in flight | MITM attack on command transmission | TLS 1.3 encryption and HMAC payload signature verification. |
| **Repudiation** | User denies dispatching an expensive audio render | Command execution logs missing or ambiguous | Cryptographic audit logging with actor UID, timestamp, and request ID. |
| **Information Disclosure** | Unreleased audio track metadata leaked through relay | Snooping on cleartext WebSocket messages | Strict end-to-end TLS encryption; payload obfuscation. |
| **Denial of Service** | Flooding Studio Executor with infinite commands | Replay of valid past execution payloads | Nonce replay protection; 60s TTL; token rate limiting. |
| **Elevation of Privilege** | Remote command executes arbitrary OS shell scripts | Malicious command injection in payload | Whitelist of allowed DAW commands; non-root user execution sandbox. |
