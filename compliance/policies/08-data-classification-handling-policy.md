# Data Classification and Handling Policy (POL-008)

## 1. Purpose
To classify data processed, stored, or transmitted by indii.music and specify handling controls for each classification level.

## 2. Classification Levels

| Level | Definition | Examples at indii.music |
|---|---|---|
| **Public** | Information intended for public consumption. | Marketing website content, public landing pages, published release announcements. |
| **Internal** | Non-sensitive internal operational data. | Internal technical documentation, project roadmap, contributor guides. |
| **Confidential** | Proprietary customer or business information requiring protection against unauthorized disclosure. | Artist project records, catalog metadata, unreleased lyrics, collaboration contracts, financial splits. |
| **Restricted** | Highly sensitive assets whose exposure would cause severe operational, legal, or reputational damage. | **Unreleased audio master files/stems**, API keys, OAuth access tokens, database credentials, user password hashes. |

## 3. Handling Rules for Restricted & Confidential Data
- **Storage**: Must be encrypted at rest (AES-256) in authorized Google Cloud Storage / Firestore buckets.
- **Audio Files**: Unreleased artist recordings must never be stored on unencrypted local drives or public CDNs. Signed URLs for audio access must have an expiration not exceeding 15 minutes.
- **Transmission**: Must only be transmitted over TLS 1.3 / TLS 1.2 encrypted channels.
- **Logging**: Restricted credentials, secrets, and raw audio files must never be written to application logs.

*Approved by Leadership: 2026-09-17*
