# Distribution & DDEX Module (RC1)

The Distribution module is the "Last Mile" of the indiiOS creative process. It transforms artistic assets (Audio, Artwork, Metadata) into standardized digital releases for global delivery to streaming services (DSPs) like Spotify, Apple Music, and TIDAL.

## 🚀 Key Features
- **DDEX Engine:** Full support for **DDEX ERN (Electronic Release Notification)** 4.3 and 3.8. Generates compliant XML messages for high-fidelity ingestion at major aggregators.
- **ISRC & UPC Management:** Automated generation and validation of International Standard Recording Codes and Universal Product Codes.
- **Multi-Distributor Facade:** Unified interface for **DistroKid**, **TuneCore**, **CD Baby**, and **Symphonic**.
- **QC (Quality Control):** Automated pre-flight checks (audio bitrate, artwork dimensions, title casing) before delivery.
- **Earnings Reconciliation:** Parsing of **DDEX DSR (Digital Sales Report)** files to normalize revenue data across multiple platforms.

## 🏗️ Technical Architecture
- **`DDEXService`**: The core XML generator and validator.
- **`DistributionDashboard`**: Real-time status tracking for pending, active, and completed releases.
- **SSH2/SFTP Clients**: Secure Electron-native transport for delivering binary assets to distributor ingestion points.
- **Validation Schemas**: Zod-based enforcement of strict industry metadata rules.

## 📊 Analytics
Integrated with the **Finance Agent** to provide a direct link between distribution status and revenue forecasting.
