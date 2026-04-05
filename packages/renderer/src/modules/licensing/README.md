# Licensing & Rights Module (RC1)

The Licensing module is a specialized hub for independent creators to manage intellectual property, issue synchronization licenses, and track performance rights. It bridges the gap between creative assets and commercial monetization.

## 📄 Key Features
- **Sync License Builder:** Generate professional Synchronization, Master Use, and Performance licenses in seconds.
- **Pulse Check:** Real-time verification of rights ownership before initiating a commercial licensing request.
- **License Dashboard:** Centralized tracking of all active, pending, and expired licenses.
- **Smart Quoting:** Automated quote generation based on usage type (TV, Film, Social, Games).
- **Public Catalog:** View and manage track availability for third-party licensing.

## 🏗️ Technical Architecture
- **`LicensingService`**: The core business logic for processing licensing requests and status updates.
- **`LicensingDashboard`**: Unified UI for artists and label managers to oversee IP portfolios.
- **Firestore Schema**: Strict relational mapping between `tracks`, `users`, and `license_requests`.
- **Legal Agent Integration**: AI-driven analysis of incoming license terms and conflict detection.

## ⚖️ Rights Management
Supports tracking for:
- **Master Rights:** Ownership of the sound recording.
- **Publishing Rights:** Ownership of the composition (lyrics/melody).
- **Mechanicals:** Rights associated with reproduction.
- **Performance:** Tracking for PRO (Performance Rights Organizations) like ASCAP, BMI, and PRS.
