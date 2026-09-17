# STRIDE Threat Model: Meta & Social Media Integrations

| Threat Category (STRIDE) | Threat Description | Attack Vector | Mitigating Controls |
|---|---|---|---|
| **Spoofing** | Attacker sends fake Instagram webhook messages | HTTP POST to webhook endpoint | `X-Hub-Signature-256` HMAC validation against Secret Manager secret. |
| **Tampering** | Attacker intercepts OAuth code exchange | Insecure redirect URL | Strict OAuth 2.0 PKCE flow, HTTPS-only redirect URIs, CSRF state token. |
| **Repudiation** | User denies publishing an Instagram post | Audit trail absent | Backend audit log records author UID, timestamp, and Meta post ID. |
| **Information Disclosure** | Long-lived Meta access tokens exposed in frontend bundle | Token bundled in Vite client build | Boundary linter `scripts/guard-frontend-api-boundary.mjs` blocks client exposure. |
| **Denial of Service** | Webhook endpoint overwhelmed by forged event floods | HTTP DDoS on Cloud Run URL | Cloudflare DDoS filtering and Cloud Run concurrency auto-throttling. |
| **Elevation of Privilege** | Artist A posts using Artist B's linked Instagram page | Improper tenant check in backend | Firestore security checks verifying tenant ownership of connected page ID. |
