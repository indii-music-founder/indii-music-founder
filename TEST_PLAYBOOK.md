# 🧪 Rndr AI Test Playbook

This document defines the named stress test protocols used to validate Rndr AI. Use these names to quickly trigger specific testing scenarios.

## 1. The Gauntlet 🛡️

**Scope:** New User Onboarding & Critical Path  
**File:** `e2e/stress-test-new-user.spec.ts`

"The Gauntlet" simulates a brand new user going through the entire "Happy Path" at speed. It verifies that the core value loop is unbroken.

- **Scenarios:**
  - **The Speedrun**: Full onboarding -> Project Creation -> Agent Interaction.
  - **The Chaos Check**: Rapid navigation between modules to check for memory leaks/unmount crashes.
- **Command:**

  ```bash
  npx playwright test e2e/stress-test-new-user.spec.ts
  ```

---

## 2. Fear Factor 😱

**Scope:** Chaos Engineering & Resilience  
**File:** `e2e/fear-factor.spec.ts`

"Fear Factor" injects failures into the environment to test application resilience. It ensures the "Shell" (Sidebar/Nav) survives even when content modules crash.

- **Scenarios:**
  - **The Network Nightmare**: Simulates 20% request failure (500s) and high latency (3s). Verifies app doesn't white-screen.
  - **The Click Frenzy**: Randomized input flooding (Monkey Testing) to catch race conditions.
  - **The Double Agent**: (Planned) Concurrent, conflicting edits from multiple agents.
- **Command:**

  ```bash
  npx playwright test e2e/fear-factor.spec.ts
  ```

---

## 3. Flash Mob ⚡

**Scope:** High Concurrency & Load  
**File:** `e2e/load-simulation.spec.ts`

"Flash Mob" spawns multiple concurrent virtual users (VUs) to hammer the backend simultaneously. It tests quotas, rate limits (`429`), and frontend state stability.

- **Configuration:** Defaults to 20 Concurrent Users.
- **Pass Criteria:** App must not crash; at least 50% of requests must succeed even under load.
- **Command:**

  ```bash
  npx playwright test e2e/load-simulation.spec.ts --workers=10
  ```

---

## 4. The Nomad 🐫

**Scope:** Cross-Platform Continuity  
**File:** `e2e/cross-platform.spec.ts`

"The Nomad" verifies the data persistence and synchronization workflow across different devices. It simulates a user switching contexts by transferring Authentication State.

- **Flow:**
  1. **Electron (Desktop)**: Login -> Create Project -> Save Work.
  2. **Mobile (iPhone)**: Login (Session Transfer) -> Verify Work Exists -> Make Edit.
  3. **Cloud (Web)**: Login -> Verify Mobile Edit appears.
- **Command:**

  ```bash
  npx playwright test e2e/cross-platform.spec.ts
  ```

---

## 5. The Librarian 📚

**Scope:** RAG, Knowledge Base, & File Processing  
**Status:** Planned  
**File:** `e2e/the-librarian.spec.ts`

"The Librarian" validates the entire Intelligence Pipeline using **REAL DATA**.

1. **Ingest**: Uploads a unique "Test Manifesto" text file to the Knowledge Base.
2. **Index**: Waits for the backend to vector-embed the document (Real Cloud Function).
3. **Retrieve**: Asks the Agent a question *only* answerable by that document.
4. **Verify**: Ensures the Agent quotes the document. **NO MOCKS.**

---

## 6. The Paparazzi 📸

**Scope:** Media, Storage, & Generation  
**Status:** **ACTIVE**  
**File:** `e2e/the-paparazzi.spec.ts`

"The Paparazzi" tests the heavy media pipelines.

1. **Shoot**: Uploads a real image file to Storage.
2. **Process**: Triggers the AI Vision analysis.
3. **Print**: Requests an image generation based on the analysis.
4. **Daisychain**: Validates the sequential multi-mask editing and reference image passing.
5. **Gallery**: Verifies the generated image URL is valid and publicly accessible.

**Command:**

```bash
npx playwright test e2e/the-paparazzi.spec.ts
```

---

## 7. The Time Traveler ⏳

**Scope:** Data Integrity, Undo/Redo, Persistence  
**Status:** Planned  
**File:** `e2e/time-traveler.spec.ts`

"The Time Traveler" ensures that what we write to the database *actually stays there* and implies correct ordering.

1. **The Timeline**: Creates a Project, adds 5 distinct items (history events).
2. **The Jump**: Reloads the page (clears local state).
3. **The Paradox**: Verifies all 5 items load in the correct order.
4. **The Correction**: Deletes item #3. Reloads. Verifies #3 is gone but #1, #2, #4, #5 remain.

---

## 8. The Gatekeeper 🔐

**Scope:** Authentication & Onboarding  
**Status:** Ready  
**File:** `e2e/auth-flow.spec.ts`

"The Gatekeeper" verifies the Authentication System, ensuring the critical bridge between the Landing Page and the Studio App is secure and functional.

- **Scenarios:**
  - **The Initiate**: New User Signup on Landing Page.
  - **The Return**: Existing User Login.
  - **The Border**: Verifies automatic redirects for unauthenticated users trying to access the Studio.
- **Command:**

  ```bash
  npx playwright test e2e/auth-flow.spec.ts
  ```

---

## 9. The Bouncer 🦍

**Scope:** Landing Page UI Logic
**Components:** `landing-page/app/page.tsx`
**File:** `landing-page/app/TheBouncer.test.tsx`

"The Bouncer" checks the front door. It ensures that the Landing Page recognizes VIPs (authenticated users) and rolls out the "Launch Studio" carpet, while directing guests to the "Sign In" line.

- **Scenarios:**
  - **The Guest**: Unauthenticated user sees "Sign In" / "Get Started".
  - **The VIP**: Authenticated user sees "Launch Studio".

- **Command:**

  ```bash
  cd landing-page && npx vitest run app/TheBouncer.test.tsx
  ```

---

## 10. The Architect 📐

**Scope:** `src/modules/workflow` (Node Editor Logic)
**Status:** Planned
**File:** `src/modules/workflow/TheArchitect.test.tsx`

"The Architect" verifies the structural integrity of the Workflow Engine. It ensures that nodes connect correctly, data flows downstream, and invalid connections are rejected.

- **Scenarios:**
  - **The Blueprint**: Create a valid workflow (Trigger -> Action -> Output).
  - **The Structural Failure**: Connect incompatible types and verify validation error.

---

## 11. The Director 🎬

**Scope:** `src/modules/video` (Video Editor State)
**Status:** Planned
**File:** `src/modules/video/TheDirector.test.tsx`

"The Director" puts the Video Editor through a stress test. It manages the timeline, clips, and ensures that the edit decision list (EDL) remains stable under rapid changes.

- **Scenarios:**
  - **The Rough Cut**: Add clips to timeline -> Reorder them.
  - **The Undo/Redo**: Perform edits and revert them, verifying state integrity.

---

## 12. The Anarchist Ⓐ

**Scope:** `src/modules/video` (Chaos & Error Handling)
**Status:** Planned
**File:** `src/modules/video/TheAnarchist.test.tsx`

"The Anarchist" attempts to break the system by ignoring rules, injecting chaos, and simulating state corruption.

- **Scenarios:**
  - **The Riot (Input Chaos)**: Inject wildly invalid data (NaN, Infinity, Negative numbers) into Store actions. Verify graceful handling.
  - **The Squatter (Permission Defiance)**: Attempt to modify non-existent (or "unowned") resources.
  - **The Mutiny (State Rebellion)**: Force the store into impossible states (e.g. `completed` status without result data) and verify UI resilience.

---

## 13. The Inspector 🕵️

**Scope:** dependency diagnostics & environment verification
**Status:** Ad-hoc
**File:** `functions/inspect_genkit.js`

"The Inspector" is a utility script to verifying the installed versions and exports of Genkit packages in the Cloud Functions environment, helpful for debugging dependency issues.

- **Command:**

  ```bash
  cd functions && node inspect_genkit.js
  ```

---

## 14. The Producer 🎧

**Scope:** Audio Analysis & Music Tools
**Status:** Ready
**File:** `src/services/agent/tools/MusicTools.test.ts`

"The Producer" verifies that the AI's music tools correctly interface with the Electron Audio Engine (Tone.js wrapper).

- **Scenarios:**
  - **The Soundcheck**: Verifies `analyze_audio` calls the correct Electron API.
  - **The Crate Dig**: Verifies `get_audio_metadata` retrieves correct tags.

- **Command:**

  ```bash
  npx vitest run src/services/agent/tools/MusicTools.test.ts
  ```

---

## 15. The Judge ⚖️

**Scope:** Legal Contract Analysis
**Status:** Ready
**File:** `src/services/agent/tools/LegalTools.test.ts`

"The Judge" ensures that the Legal Department agent can correctly submit documents for analysis and generate standard forms.

- **Scenarios:**
  - **The Review**: Mock contract submission to Firebase Functions.
  - **The Draft**: Generation of standard NDA templates.

- **Command:**

  ```bash
  npx vitest run src/services/agent/tools/LegalTools.test.ts
  ```

---

## 16. The Auditor 📋

**Scope:** Live Infrastructure & Security Configuration  
**Status:** **ACTIVE**  
**File:** `scripts/the-auditor.ts`

"The Auditor" is the infrastructure verification protocol. It bypasses frontend mocks and speaks directly to the live Firebase backend to verify configuration, connectivity, and security rules.

- **Scenarios:**
  1. **Service Auth:** Verifies `automator` service account can login.
  2. **Storage Connect:** Verifies connection to `gs://indiios-alpha-electron`.
  3. **Rule Enforcement:** Verifies writes are allowed for owner and denied for others.

- **Command:**

  ```bash
  npx tsx scripts/the-auditor.ts
  ```

---

## 17. The Printer 🖨️

**Scope:** `src/modules/design` (Physical Media Designer)
**Status:** **ACTIVE**
**File:** `src/modules/design/ThePrinter.test.tsx`

"The Printer" stress tests the Physical Media layout engine to ensure it can handle rapid format switching and rendering without memory leaks or crashes.

- **Scenarios:**
  1. **The Press Run**: Renders every available template to verify data integrity.
  2. **The Zoom Lens**: Rapidly updates zoom props (100x) to test re-render performance.
  3. **The Ink Spill**: Rapidly mounts/unmounts components to catch cleanup failures.

- **Command:**

  ```bash
  npx vitest run src/modules/design/ThePrinter.test.tsx
  ```

---

## 18. The Cinematographer 🎥

**Scope:** Video Tools & Chain Generation
**Status:** **ACTIVE**
**File:** `src/services/agent/tools/VideoTools.test.ts`

"The Cinematographer" verifies the AI Video Tools, specifically the iterative generation capabilities ("video chaining").

- **Scenarios:**
  - **The Long Take**: Verifies `generate_video_chain` correctly loops, extracting the last frame and recycling it as the start frame for the next segment.
  - **The Director's Cut**: Verifies keyframe update logic.

- **Command:**

  ```bash
  npx vitest run src/services/agent/tools/VideoTools.test.ts
  ```

---

## 19. The Editor 🎨

**Scope:** Image Editing Service
**Status:** **ACTIVE**
**File:** `src/services/image/__tests__/EditingService.test.ts`

"The Editor" validates the Image Editing pipeline, including complex multi-mask composition and reference image handling.

- **Scenarios:**
  - **The Magic Kill**: Verifies `multiMaskEdit` processes masks sequentially.
  - **The Reference**: Confirms `referenceImage` data is correctly passed to the backend.

- **Command:**

  ```bash
  npx vitest run src/services/image/__tests__/EditingService.test.ts
  ```

---

## 20. Agent Tool Integration (Specialist Agents)

**Goal**: Verify that the new specialist agents and their tools (Maps, Finance) are functioning correctly.

#### Automated Unit Tests

Run the following command to verify the tool logic and mocks (including internal DevOps/Security tools):

```bash
npx vitest src/services/agent/tools/MapsTools.test.ts src/services/agent/tools/BigQueryTools.test.ts src/services/agent/tools/DevOpsTools.test.ts src/services/agent/tools/SecurityTools.test.ts
```

#### Verification Scenarios

1. **Road Manager Agent (Maps)**
   - **Prompt**: "Find me a hotel in Paris."
   - **Expected**: A list of hotels in Paris with ratings and addresses (from Google Maps API).

2. **Finance Agent (BigQuery)**
   - **Prompt**: "What was the revenue for Q1 2025?"

---

## 21. The Vault 🏦

**Scope:** Production Security & Access Control
**Framework:** Zero Touch Prod (ZTP) & Security Rings
**Status:** **ACTIVE**
**File:** `src/services/agent/tools/SecurityTools.test.ts`
**Documentation:** `docs/PRODUCTION_SECURITY_PROTOCOL.md`

"The Vault" verifies compliance with production security protocols:

1. **Zero Touch Prod (ZTP)**: Ensures services are managed via automation (NoPe).
2. **Crown Jewels**: Verifies Core Dumps are disabled for foundational services.
3. **Isolation**: Checks Workload Security Rings placement.

**Scenarios:**

1. **The Airlock**: Verifies "prod-" services are flagged for Full Automation.
2. **The Containment**: Checks that critical auth services have debugging/core dumps disabled.
3. **The Quarantine**: Ensures foundational workloads have 0 neighbors (dedicated hardware/vm logic).

**Command:**

```bash
npx vitest run src/services/agent/tools/SecurityTools.test.ts
```
