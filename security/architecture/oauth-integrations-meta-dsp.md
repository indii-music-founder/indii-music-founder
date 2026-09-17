# Third-Party OAuth Integration Architecture (Meta / Instagram / DSPs)

## 1. Token Isolation Principle
indii.music strictly isolates third-party credentials so that browser bundles, mobile clients, and unprivileged processes never observe master secrets or long-lived refresh tokens.

```
[ User Browser ]
       |
       | 1. Initiates OAuth Flow
       v
[ indii.music Backend ]
       | 
       | 2. Issues CSRF state token with HMAC-SHA256 signature
       v
[ Provider OAuth Consent (Meta / Spotify / Apple) ]
       |
       | 3. User Approves -> Callback with Auth Code & State
       v
[ Backend Callback Handler (Cloud Function) ]
       |
       | 4. Validates state signature (prevents CSRF)
       | 5. Exchanges Auth Code for Long-Lived Token via Secret Manager App Secret
       | 6. Encrypts token (AES-256) into private Firestore vault
       v
[ Token Vault (Firestore Private Subcollection) ]
```

## 2. Webhook Security (e.g. Instagram / Meta Webhook)
- **Validation**: Incoming webhooks are validated via `X-Hub-Signature-256` HMAC validation against the App Secret stored in Secret Manager.
- **Verification Token**: Endpoint registration uses `META_WEBHOOK_VERIFY_TOKEN` stored in Secret Manager.
- **Payload Redaction**: Personal messages are processed in-memory; sensitive payload contents are never written to application logs.
