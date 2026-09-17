# indii.music Role-Based Access Control (RBAC) Matrix

| System / Asset | Founder / Admin | Lead Engineer | Contributor / Contractor | Automated CI/CD | End Artist / User |
|---|---|---|---|---|---|
| **Google Cloud Production Console** | Full Admin (MFA) | Read / Deploy (MFA) | None | Deployment Service Account | None |
| **Google Secret Manager** | Admin / Rotate | Read / Access | None | Service Account (Read Only) | None |
| **GitHub Main Branch** | Admin (MFA) | Write / Review (MFA) | PR / Fork only | CI Status Check Pass | None |
| **Production Firestore** | Admin via Console | Read / Write via CLI | None | Admin SDK | Rule-Restricted Client SDK |
| **Cloud Storage Audio Vault** | Admin via Console | Read / Write via CLI | None | Storage Admin SDK | Rule-Restricted Signed URLs |
| **Stripe Billing Console** | Administrator | Developer (No PII) | None | Webhook API Key | Customer Portal Only |
| **Meta Developer Console** | Administrator | Developer / Tester | None | Server Token | End-User OAuth Link |
