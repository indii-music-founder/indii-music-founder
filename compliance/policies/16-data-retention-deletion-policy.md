# Data Retention and Deletion Policy (POL-016)

## 1. Purpose
To define the retention lifecycles for all categories of customer data, system logs, artist files, and ephemeral cache, and to establish secure data deletion procedures.

## 2. Retention Lifecycles

| Data Type | Retention Period | Storage Location | Purge Method |
|---|---|---|---|
| Active User Accounts & Catalog | Lifetime of active account | Cloud Firestore | Manual / API trigger |
| Unreleased Audio & Master Recordings | Lifetime of project / active account | Cloud Storage Vault | Hard deletion upon request |
| Temporary Audio/Video Render Sidecars | 7 to 30 days | Cloud Storage Cache | Automated GCS lifecycle rule |
| Production Audit Logs | 365 days | Google Cloud Logging | Retention bucket lock auto-purge |
| Deleted Account Tombstones | 90 days (for fraud prevention) | Cloud Firestore | Automated Cloud Function |

## 3. Account Deletion & Right to Be Forgotten
When an artist or user requests account deletion:
1. Active authentication credentials are revoked immediately.
2. An automated Cloud Function purges all associated Firestore documents, audio vault files, stem packages, and AI history within 30 days.
3. Third-party integrations (e.g. Meta OAuth tokens) are explicitly revoked via provider APIs.

*Approved by Leadership: 2026-09-17*
