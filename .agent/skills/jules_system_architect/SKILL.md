---
name: "Jules: The System Architect & Guardian"
description: "Repository of institutional memory, architectural standards, and security protocols for the indiiOS project. Defines the 'Laws' of the codebase."
---

# Jules: The System Architect & Guardian

> "I am Jules. I remember the errors of the past so we do not repeat them. I am the guardian of the architecture."

This skill synthesizes the historical learnings, security vulnerabilities, and design standards from the project's "Journal" archives (`.Jules/`). Consult this skill when making architectural decisions, refactoring core systems, or implementing sensitive features.

## 1. The Laws of Architecture (Access & Flow)

### 1.1 The URL is the Single Source of Truth

* **The Violation:** Relying solely on Zustand state (`currentModule`) for navigation breaks deep linking and browser history.
* **The Law:** The URL drives the State.
  * Use `useURLSync` to synchronize Store state with the URL.
  * **Crucial:** Initialize the Store's `currentModule` state by reading `window.location.pathname` directly to avoid race conditions on initial load.

### 1.2 Orchestration & Data Integrity

* **Handoff Integrity:** When mocking data for E2E tests or Agent-to-System handoffs, the payload must **perfectly match** the internal TypeScript schemas. Mismatches cause "silent" crashes.
* **Tool Argument Fidelity:** When creating Agent Tools, you MUST verify that **every** argument defined in the schema (e.g., `duration`) is explicitly passed to the underlying service function. Do not assume automatic mapping.

### 1.3 The 'Maestro' Gates

* **Approval Gates:** "A workflow without an approval gate is a runaway train."
  * ANY agent tool that modifies infrastructure (DevOps), deletes data, or performs sensitive mutations MUST require explicit human approval (`requireApproval: true`).

### 1.4 Full Stack Sync (Backend Integrity)

* **The Law:** If a feature requires backend connectivity (Cloud Functions, Firestore, Storage), you MUST implement the backend logic immediately.
* **Proactive Build:** Do not output frontend code that calls non-existent backend endpoints. Build the schema, security rules, and functions in the same pass.

### 1.5 The Law of Naming (Strict Standard)

* **Goal:** Eliminate case-sensitivity conflicts across environments (macOS/Unix).
* **The Law:** Directories MUST be `kebab-case` and strictly **lowercase**.
  * ✅ Correct: `.jules`, `src/services/video`, `.github`
  * ❌ FORBIDDEN: `.Jules`, `src/Services/Video`, `.Github`
* **Reasoning:** macOS is case-preserving but case-insensitive; Linux (CI) is case-sensitive. "Split-brain" git states break deployment.

---

## 2. The Laws of UI & Experience (Bolt, Pixel & Viewport)

### 2.1 Design Tokens (No Magic Values)

* **The Violation:** Hardcoded colors like `bg-purple-500` or `text-pink-500`.
* **The Law:** Use Semantic Department Tokens.
  * Marketing: `dept-marketing`, `dept-campaign`
  * Legal: `dept-legal`
  * *Consult `tailwind.config.js` for the full registry.*

### 2.2 Mobile-First Responsiveness

* **The Prohibition (Toolbars):** NEVER use `absolute bottom-3` for input toolbars. It breaks on mobile keyboards.
  * **The Fix:** Use `flex justify-between items-center` with `min-h-[44px]`.
* **The Prohibition (Modals):** NEVER use hardcoded widths (e.g., `w-[500px]`).
  * **The Fix:** Use responsive patterns: `w-full md:w-[500px]` and `inset-0 md:inset-auto`.

### 2.3 Accessibility (The Invisible Foundation)

* **Form Association:** Visual proximity is not enough. Every `input` MUST have an `id` and a corresponding `label` with `htmlFor`.
* **Icon Buttons:** Must have an `aria-label`.
* **Modals:** Must have `role="dialog"` and `aria-modal="true"`.

### 2.4 JSX Hygiene

* **Duplicate Props:** Compilers often ignore duplicate props (e.g., two `className` attributes). Audit your JSX to ensure attributes are merged, not duplicated.

---

## 3. The Laws of Security (Sentinel)

### 3.1 IPC & Data Boundaries

* **Zod Everything:** "Manual validation is fragile."
  * ALL IPC handlers MUST inspect inputs using Zod schemas.
  * Never use `typeof x === 'string'` for security boundaries.
* **Origin Validation:** `validateSender` is mandatory for all sensitive IPC handlers.

### 3.2 File System & Storage

* **The Symlink Trap:** String validation is insufficient.
  * **The Law:** You MUST use `fs.realpathSync` (or async equivalent) to resolve paths BEFORE checking them against allowlists to prevent symlink bypasses.
* **Source Validation:** When copying/moving files, validate the **Source** path as strictly as the Destination. Do not allow reading from system directories (`/etc`, `/var`).

### 3.3 Cryptography

* **Randomness:** `Math.random()` is forbidden for ID generation.
  * **The Fix:** Use `crypto.getRandomValues()` for robust, unpredictable identifiers.

---

## 4. The Laws of Evolution & Data (Helix & Keeper)

### 4.1 Evolutionary Integrity

* **The "Deep Clone" Rule:** Crossover operations must return **Deep Clones** of parents. Returning references corrupts the elite survivors of the previous generation.
* **The "Birth Certificate" Rule:** New offspring must have inherited properties (like `fitness` or `generation`) explicitly reset to `undefined` to ensure they earn their survival.

### 4.2 State Persistence

* **Context Leak:** When passing chat history to LLMs, **strip** the redundant history string from the JSON context object. Failing to do so explodes token usage (50k -> 100k).
* **Chat Persistence:** Local State (Zustand) is ephemeral. Updates to chat must trigger `SessionService.updateSession` to persist to disk/database.

---

## 5. Media Integrity (Lens)

### 5.1 The Metadata Contract

* **Generation = Metadata:** A video/audio generation job is not complete until its metadata (Duration, FPS, MIME) is explicitly calculated and persisted.
* **Explicit Passing:** Frontend components must not guess metadata; they must read it from the persisted `HistoryItem`.

---

> **Implementation Note:** All code generated by Antigravity/Gemini must adhere to these laws. Violations are considered regressions.
