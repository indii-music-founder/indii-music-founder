# PHASE 3.1: The "Sovereign Registration" Protocol

## 1. The Fee & Payment Engine

- **Logic:** The Hybrid Orchestrator calculates the specific fee (e.g., $45 for single work, $85 for group).
- **Human-in-the-Loop (HITL):**
  - Agent generates a "Payment Authorization" card in the Studio.
  - User approves the specific dollar amount.
  - Integration with indiiOS Finance Department for secure wallet/card processing.

## 2. PRO Integration (Public & Private)

- **Targets:**
  - **Public/Government:** US Copyright Office (Library of Congress).
  - **Private PROs:** ASCAP, BMI, SESAC, GMR.
  - **Mechanical/International:** MLC, SoundExchange, PRS (UK), SACEM (FR).
- **Capabilities:**
  - **Account Sync:** Securely store/use user credentials via the Electron "Secure Storage" bridge.
  - **Registration:** Automate the "Register a Work" form-fill across all selected platforms.
  - **Data Scraping:** Regularly audit the PRO dashboards to ensure royalty flows match internal split sheets.

## 3. Account Provisioning

- **Self-Healing:** If the agent detects no account for a specific PRO, it offers to "Orchestrate Sign-up" using the user's Brand Kit / Identity data.

## 4. Implementation Checklist

- [ ] Connect `BrowserTools` to the indiiOS Finance "Payment Trigger" UI.
- [ ] Build "Credential Vault" skill for handling multi-platform logins securely.
- [ ] Script the navigation flows for the "Top 4" (BMI, ASCAP, MLC, SoundExchange).
