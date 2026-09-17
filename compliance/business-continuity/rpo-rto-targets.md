# Business Continuity RPO & RTO Target Specifications

## 1. System Recovery Objectives

| Subsystem | RPO (Data Loss Window) | RTO (Restoration Window) | Backup Mechanism |
|---|---|---|---|
| **Cloud Firestore** | **<= 1 hour** | **<= 2 hours** | Automated daily point-in-time recovery + continuous Cloud Logging |
| **Artist Audio Vault (GCS)** | **<= 0 hours (0 loss)** | **<= 4 hours** | Object versioning + multi-region replication |
| **User Identity & Auth** | **<= 0 hours** | **<= 1 hour** | Google Identity Platform multi-region failover |
| **Frontend / Web Client** | **<= 0 hours** | **<= 30 minutes** | Firebase Hosting global CDN edge caching |
| **Cloud Functions / Backend** | **<= 0 hours** | **<= 30 minutes** | Stateless Cloud Run containers with auto-scaling |

## 2. Maximum Tolerable Downtime (MTD)
- Core artist audio rendering & catalog browsing: 12 hours
- Platform authentication & core database: 6 hours
