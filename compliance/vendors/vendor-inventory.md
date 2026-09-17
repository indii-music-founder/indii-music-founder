# Third-Party Vendor Security Inventory

| Vendor Name | Purpose / Service | Data Accessible | Criticality Tier | SOC 2 / Security Status | Last Review Date |
|---|---|---|---|---|---|
| **Google Cloud Platform / Firebase** | Cloud infrastructure, Firestore database, Cloud Functions, Secret Manager, Cloud Storage | Customer data, credentials, unreleased audio files, logs | **Tier 1 (Critical)** | SOC 2 Type II, ISO 27001, HIPAA, FedRAMP High | 2026-09-01 |
| **GitHub** | Source code repositories, CI/CD Actions workflows, issue tracking | Proprietary source code, build logs, deployment configs | **Tier 1 (Critical)** | SOC 2 Type II, ISO 27001 | 2026-09-01 |
| **Meta (Facebook/Instagram)** | Social media publishing, direct messaging, Instagram Graph API | Artist social handles, message webhooks, OAuth tokens | **Tier 2 (High)** | SOC 2 Type II, Meta Enterprise Data Protection | 2026-09-10 |
| **Stripe** | Subscription billing, customer payments, artist payout routing | Customer billing details, transaction IDs (zero raw PAN on indii) | **Tier 1 (Critical)** | PCI DSS Level 1, SOC 2 Type II | 2026-08-15 |
| **Cloudflare** | Edge DNS routing, DDoS protection, SSL termination | In-transit HTTPS traffic metadata, edge request headers | **Tier 2 (High)** | SOC 2 Type II, ISO 27001 | 2026-08-20 |
| **Sentry** | Error tracking and crash analytics | Redacted client crash traces, error exception metadata | **Tier 3 (Medium)** | SOC 2 Type II, GDPR Compliant | 2026-08-01 |
