# indiiOS-Alpha-Electron: Founders Program Documentation

## Task 1: Founders Program Liability Waiver & EULA Outline

### 1.0 Non-Refundable Capital Classification
*   **1.1 Definition of Contribution:** The $2,500.00 USD buy-in is defined strictly as an early-access participation fee for the "Founders Program" closed Alpha/Beta testing phase.
*   **1.2 Exclusion of Equity:** This fee does not constitute an investment, purchase of equity, stock, or ownership stake in indiiOS, its parent entities, or its intellectual property.
*   **1.3 Exclusion of Consumer Product Guarantees:** The software is not a stable consumer product. Standard consumer purchase protections and warranties are expressly waived.
*   **1.4 Non-Refundability:** The fee is 100% non-refundable under all circumstances, including but not limited to project abandonment, total software failure, or termination of the user's access for Terms of Service violations.

### 2.0 Unprecedented Architecture Acknowledgement
*   **2.1 Alpha/Beta State Acknowledgment:** The user legally acknowledges that the software is in an experimental state.
*   **2.2 Novel Logic Risk:** The user acknowledges the application operates on unprecedented, novel architecture within the music business domain that has not been historically tested at scale.
*   **2.3 Probability of Catastrophic Failure:** The user accepts that critical errors—specifically concerning mechanical routing, data persistence, and DSP (Digital Signal Processing) API connections—are statistically probable and expected during the testing phase.

### 3.0 Total Indemnification & Limitation of Liability
*   **3.1 Data Loss Waiver:** The developer is absolved of all liability for the irrecoverable loss, corruption, or public exposure of uploaded audio files, stems, masters, user metadata, or project files.
*   **3.2 Financial Loss Waiver:** The developer is absolved of all liability for direct or indirect financial losses resulting from misrouted royalties, failed mechanical distribution, incorrect ledger calculations, or DSP payout errors.
*   **3.3 Service Continuity Waiver:** The developer is absolved of all liability for damages resulting from server downtime, database overwrites, API rate-limiting, or permanent discontinuation of the service.
*   **3.4 Maximum Liability Cap:** If indemnification is pierced by jurisdiction law, the developer's maximum aggregate liability shall not exceed the initial $2,500 participation fee.

---

## Task 2: "Founder" Codebase Integration Protocol (SOP)

### 1.0 Objective
Embed the identities of the 10 Founders into the `indiiOS-Alpha-Electron` codebase as a permanent honorific, without granting repository write access, copyright, or intellectual property claims.

### 2.0 Implementation Strategy
*   **2.1 Data Storage:** Founder names will be stored in a strictly read-only, hardcoded array within the shared constants directory: `packages/shared/src/constants/founders.ts`.
*   **2.2 UI Rendering:** The frontend renderer will import this constant to populate a designated "Founders Monument" or "Credits" component.

### 3.0 Standard Operating Procedure (SOP)
1.  **Repository Access Denial:** Do not invite Founders to the GitHub/GitLab repository as collaborators, contributors, or readers. Access to the source code remains strictly restricted to internal engineering staff.
2.  **Hardcoding Process:**
    *   Engineer creates a new branch: `feature/founders-list-integration`.
    *   Engineer populates the `founders.ts` file with the exact legal names/handles provided during onboarding.
    *   Engineer commits the change with a standard PR review process.
3.  **Code-Level Legal Disclaimer:** The `founders.ts` file must contain the following block comment at the top:
    ```typescript
    /**
     * @notice indiiOS-Alpha-Electron Founders Program
     * The individuals listed below participated in the initial closed Alpha/Beta.
     * Inclusion in this programmatic list is strictly an honorific attribution.
     * It does NOT confer equity, ownership, copyright, or intellectual property
     * rights over the indiiOS-Alpha-Electron codebase, application, or business entity.
     */
    ```

---

## Task 3: Firebase Isolation Requirements

### 1.0 Environment Segregation
*   **1.1 Dedicated Production Project:** A specific Firebase project (`indiiOS-founders-prod`) must be provisioned exclusively for the 10 Founders. This project must not share resources, databases, or API keys with internal QA, staging, or generic production environments.
*   **1.2 Local Sandbox Strictness:** Local development must enforce the use of `firebase emulators:start`. The application must programmatically verify the `process.env.NODE_ENV` or `VITE_APP_ENV` to prevent local builds from accidentally writing to the `indiiOS-founders-prod` database.

### 2.0 Authentication & Access Control
*   **2.1 Manual Provisioning:** Firebase Authentication "Sign-up" capabilities must be disabled. The 10 Founder accounts must be manually created by the backend administrator via the Firebase Admin SDK.
*   **2.2 UID Allowlisting:** The authenticated UIDs of the 10 Founders must be explicitly allowlisted in Firestore Security Rules and Storage Security Rules.

### 3.0 API Key & Security Protocol
*   **3.1 Key Distribution:** Live API keys for `indiiOS-founders-prod` are to be injected into the Electron build process via secure CI/CD secrets. They must never be committed to repository version control.
*   **3.2 Firebase App Check:** Implement Firebase App Check (via reCAPTCHA Enterprise or device-level attestation) to ensure only the compiled `indiiOS-Alpha-Electron` binary can communicate with the backend, preventing unauthorized postman/curl queries.
*   **3.3 Security Rules Implementation:**
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Only allow hardcoded Founder UIDs to read/write their own data
        function isAuthorizedFounder() {
          let founders = ['UID1', 'UID2', 'UID3', 'UID4', 'UID5', 'UID6', 'UID7', 'UID8', 'UID9', 'UID10'];
          return request.auth != null && request.auth.uid in founders;
        }

        match /users/{userId} {
          allow read, write: if isAuthorizedFounder() && request.auth.uid == userId;
        }

        match /{document=**} {
          allow read, write: if false; // Default deny
        }
      }
    }
    ```
