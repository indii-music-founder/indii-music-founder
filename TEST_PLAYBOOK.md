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
