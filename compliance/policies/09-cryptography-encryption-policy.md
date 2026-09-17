# Cryptography and Encryption Policy (POL-009)

## 1. Purpose
To specify encryption requirements for data at rest and data in transit across all indii.music environments, services, and client applications.

## 2. Encryption in Transit
- All public and private network communications must utilize **TLS 1.3** (or TLS 1.2 minimum). Insecure HTTP connections are prohibited and must redirect automatically to HTTPS.
- Modern cipher suites with forward secrecy (ECDHE-RSA-AES128-GCM-SHA256, ECDHE-ECDSA-AES256-GCM-SHA384) are required.
- WebSocket connections for the Remote Relay must use secure WebSockets (`wss://`).

## 3. Encryption at Rest
- All customer records, catalog metadata, and user identities stored in Google Cloud Firestore are encrypted at rest using Google-managed or customer-managed AES-256 keys.
- All artist audio files, stems, album art, and video renders stored in Cloud Storage buckets are encrypted at rest using AES-256.

## 4. Key & Secret Management
- API credentials, OAuth tokens, private keys, and service account keys must reside exclusively in Google Cloud Secret Manager or encrypted CI environment secrets.
- Hardcoding secrets, private keys, or API tokens in source code or committing `.env` files with production secrets is strictly forbidden and actively checked by CI boundary guards (`scripts/guard-frontend-api-boundary.mjs`).

*Approved by Leadership: 2026-09-17*
