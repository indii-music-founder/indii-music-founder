# Legal & Rights Module (RC1)

The Legal module provides a protective layer for independent creators, ensuring that all commercial actions—from licensing to distribution—are compliant and protected. It is designed to bridge the "legal gap" for artists who don't have a full-time law firm.

## ⚖️ Key Features
- **Contract Review:** AI-driven analysis of incoming performance, distribution, and licensing agreements.
- **Smart Templates:** A library of "Digital Handshake" agreements for producers, features, and collaborators.
- **Rights Audit:** Real-time verification of master and publishing ownership before release.
- **NDA Generator:** One-click generation of non-disclosure agreements for studio sessions and early-stage projects.
- **Compliance Scanner:** Checks metadata against industry standards to prevent ingestion errors at DSPs.

## 🏗️ Technical Architecture
- **`LegalDashboard`**: A unified view of all active agreements and rights statuses.
- **`LegalAgent` Integration:** The specialized agent spoke that performs deep reasoning on legal text.
- **Contract Renderers:** Specialized UI components for viewing and signing markdown-based agreements.
- **Firestore Schema**: Secure, user-scoped storage for sensitive legal documents.

## 🤖 Legal Agent
The module is powered by a specialized agent capable of:
- Highlighting "Red Flags" in complex contracts.
- Summarizing legalese into plain English.
- Recommending counter-offer terms based on industry standard rates.
