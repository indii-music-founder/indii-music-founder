# Investor Relations Module (RC1)

The Investor module is a specialized portal for managing relationships with stakeholders, equity holders, and "Genesis" investors. It provides transparency into organization performance and facilitates secure communication between creators and their backers.

## 📈 Key Features
- **Sovereign Equity Tracker:** Real-time visualization of equity splits and ownership structures based on the "Digital Handshake" model.
- **Organization Health:** High-level reporting on revenue, growth, and project milestones for investor review.
- **Genesis Portal:** Specialized access for early-stage backers (e.g., the "Detroit 8") to monitor platform development.
- **Document Vault:** Secure storage for investor agreements, capitalization tables, and financial audits.

## 🏗️ Technical Architecture
- **`InvestorService`**: Manages the permissions and data visibility for investor-level accounts.
- **Equity Math Engine**: Deterministic logic for calculating dilution and payout scenarios.
- **Firestore Security**: Layered rules to ensure investors only see data they are explicitly authorized to access.
