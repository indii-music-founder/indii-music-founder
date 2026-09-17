# indii.music Enterprise Security Risk Register

| Risk ID | Threat Description | Inherent Risk (L x I) | Mitigating Controls | Residual Risk | Owner | Status |
|---|---|---|---|---|---|---|
| **RSK-001** | Leaked Meta/DSP OAuth tokens exposing artist accounts | 3 x 4 = 12 (Med) | INDII-CR-001, INDII-CR-005: Tokens encrypted at rest, stored in server-side Secret Manager, never exposed to renderer bundle. | 1 x 3 = 3 (Low) | Lead Engineer | Mitigated |
| **RSK-002** | Unreleased music exfiltration from Cloud Storage | 2 x 5 = 10 (Med) | INDII-DS-002, INDII-CR-003: Storage security rules isolate tenant paths; 15-minute signed URL expiration; AES-256 encryption. | 1 x 4 = 4 (Low) | Lead Engineer | Mitigated |
| **RSK-003** | Malicious command injection via Remote Relay to Studio Executor | 3 x 5 = 15 (High) | INDII-RR-001, INDII-RR-002, INDII-RR-003: Cryptographic JWT authentication, 60s nonce replay protection, schema validation. | 1 x 3 = 3 (Low) | Lead Engineer | Mitigated |
| **RSK-004** | Cloud service regional outage (Google Cloud / Firebase) | 2 x 4 = 8 (Med) | INDII-BC-001, INDII-BC-002: Multi-region Firestore, daily automated snapshots, automated failover Cloud Run containers. | 1 x 3 = 3 (Low) | Lead Engineer | Mitigated |
| **RSK-005** | Unauthorized administrative repository merge or bypass | 2 x 4 = 8 (Med) | INDII-CM-001, INDII-AC-001: GitHub protected main branch, mandatory PR reviews, hardware MFA on admin accounts. | 1 x 2 = 2 (Low) | Founder | Mitigated |
| **RSK-006** | Compromised third-party npm dependency | 4 x 4 = 16 (High) | INDII-VM-001, INDII-VM-002: Dependabot automated PRs, npm audit in CI, boundary linters blocking untrusted network calls. | 2 x 2 = 4 (Low) | Lead Engineer | Mitigated |
| **RSK-007** | Accidental commit of production API keys or credentials | 3 x 4 = 12 (Med) | INDII-CR-001, INDII-VM-002: scripts/guard-frontend-api-boundary.mjs in pre-commit and CI; GitHub secret scanning active. | 1 x 2 = 2 (Low) | Lead Engineer | Mitigated |
