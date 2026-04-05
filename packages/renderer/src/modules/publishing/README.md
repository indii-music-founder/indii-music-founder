# Publishing & Catalog Module (RC1)

The Publishing module manages the intellectual property of songwriters and composers. It serves as the bridge between the **Music Studio** and the **Distribution** engine, ensuring all metadata is professionally formatted for ingestion by PROs (Performance Rights Organizations) and mechanical agencies.

## 🎼 Key Features
- **Catalog Management:** A high-performance metadata repository for tracks, albums, and compositions.
- **ISWC Management:** Tracking for **International Standard Musical Work Codes** across global databases.
- **Release Timeline:** A visual roadmap for planning releases from pre-save to post-launch.
- **Split Sheets:** Digital generation and signature tracking for creative contribution splits.
- **PRO Sync:** Automated data formatting for ASCAP, BMI, and PRS registration.

## 🏗️ Technical Architecture
- **`PublishingService`**: The primary business logic layer for track registration and catalog auditing.
- **`PublishingDashboard`**: Advanced UI for managing large catalogs with filtered search and bulk metadata editing.
- **Release Details Engine**: Unified schema for syncing metadata between **Creative** (Artwork) and **Distribution** (Audio).
- **Zod Validation**: Strict schema enforcement for songwriting credits and publishing splits.

## 🔗 Integrations
- **Music Studio:** Direct import of analyzed audio metadata (BPM, Key).
- **Distribution:** Automatic pre-population of release data for aggregators.
- **Legal Agent:** Automated review of songwriting agreements and co-publishing terms.
