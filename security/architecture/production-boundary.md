# indii.music Production Architecture & Security Boundary Specification

## 1. Boundary Scope
The indii.music SOC 2 production boundary encompasses all components, data stores, code repositories, and execution environments that store, process, or route customer data, artist intellectual property, credentials, or billing information.

```
+-----------------------------------------------------------------------------------+
|                           PRODUCTION SECURITY BOUNDARY                            |
|                                                                                   |
|  [ End User / Web / Electron ]                                                    |
|            | TLS 1.3 / HTTPS                                                      |
|            v                                                                      |
|  [ Firebase Hosting / Cloud CDN ]                                                 |
|            |                                                                      |
|            +-------------------+--------------------+                             |
|            |                   |                    |                             |
|            v                   v                    v                             |
|    [ Cloud Functions ]   [ Cloud Storage ]    [ Cloud Firestore ]                 |
|    (Backend Logic)       (Audio Vault, Media) (Catalog, Splits, Users)            |
|            |                   |                    |                             |
|            |                   +--------------------+                             |
|            v                                                                      |
|    [ Google Secret Manager ]                                                      |
|    (API Keys, Private Tokens)                                                     |
|            |                                                                      |
|    +-------+-------+                                                              |
|    |               |                                                              |
|    v               v                                                              |
| [ Meta API ]   [ DSPs / AI ]                                                      |
|                                                                                   |
|                                                                                   |
|  [ Remote Relay Service ] <==== WSS / HMAC Signed ====> [ Studio Executor ]       |
|  (Task Queue / Session)                                 (Local Artist Host)       |
+-----------------------------------------------------------------------------------+
```

## 2. In-Scope Components
1. **Frontend Applications**: Next.js web application (`packages/renderer`, `packages/landing`) and Electron desktop client (`packages/main`).
2. **Identity & Access Management**: Firebase Authentication, Google Cloud IAM.
3. **Primary Database**: Google Cloud Firestore (multi-region database, rules-enforced).
4. **Media Vault**: Google Cloud Storage (artist audio tracks, stems, video sidecars).
5. **Compute & Backend**: Cloud Functions for Firebase / Google Cloud Run (`packages/firebase`).
6. **Secrets & Configurations**: Google Secret Manager (`indii-music-founder` project).
7. **CI/CD & Source Management**: GitHub repository `indii-music-founder/indii-music-founder` and GitHub Actions.
8. **Remote Execution Relay**: Cloud Functions / WebSocket relay bridging remote client commands to local DAW Studio Executors.
9. **External Integrations**: Meta Graph API, Spotify/Apple Music DSP APIs, Stripe.

## 3. Out-of-Scope Components
- Personal developer hardware not accessing production credentials.
- Test/mock emulator environments (`localhost:9099`, `localhost:8080`).
- Third-party social platforms' internal databases (governed by vendor contracts).
