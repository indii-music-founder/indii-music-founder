# Privileged Account Master Registry

| Account Identifier | Role / Responsibility | Systems Accessible | MFA Mechanism | Last Audit Date |
|---|---|---|---|---|
| `founder@indii.music` | Organization Founder / Admin | GitHub Org Owner, GCP Project Owner, Stripe Admin, Meta Admin | Hardware FIDO2 Security Key | 2026-09-17 |
| `engineering-lead@indii.music` | Lead Software Engineer | GitHub Maintainer, GCP Editor, Secret Manager Access | TOTP / WebAuthn | 2026-09-17 |
| `sa-github-actions@indii-music-founder.iam.gserviceaccount.com` | CI/CD Deployer | Cloud Functions Deploy, Firebase Hosting Admin | Workload Identity Federation (No long-lived key) | 2026-09-17 |
| `sa-cloud-functions@indii-music-founder.iam.gserviceaccount.com` | Backend Runtime | Firestore Admin, Cloud Storage Admin, Secret Accessor | GCP Managed Runtime Identity | 2026-09-17 |
