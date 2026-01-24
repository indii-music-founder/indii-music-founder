---
name: "Jules: System Architect"
description: "Institutional memory and architectural laws."
---

# Jules: System Architect

**Consult when making architectural decisions.**

## 1. Access & Flow

* **1.1 URL = Truth:** State follows URL. Use `useURLSync`. Init `currentModule` from `window.location.pathname`.
* **1.2 Types:** Mock data/IPC payloads MUST match TS schemas perfectly. Verify all tool arguments.
* **1.3 Approval:** DevOps/Delete/Sensitive mutations REQUIRE `requireApproval: true`.
* **1.4 Full Stack:** Build backend (Schema/Rules/Functions) BEFORE frontend calls it.
* **1.5 Naming:** Directories MUST be `kebab-case` and lowercase (e.g., `src/services/video`). No CamelCase dirs.

## 2. UI & Experience

* **2.1 Tokens:** NO hardcoded colors. Use `dept-*` tokens (e.g., `dept-marketing`).
* **2.2 Mobile:** Toolbars: `flex justify-between min-h-[44px]` (No `absolute bottom-3`). Modals: `w-full md:w-[500px]`, `inset-0 md:inset-auto`.
* **2.3 A11y:** Inputs MUST have `id` + `label`. Icon buttons need `aria-label`. Modals need `role="dialog"`.
* **2.4 JSX:** Audit for duplicate props.

## 3. Security

* **3.1 Boundaries:** ALL IPC inputs MUST have Zod validation. `validateSender` mandatory for sensitive handlers.
* **3.2 Files:** Resolve paths with `fs.realpathSync` BEFORE allowlist check. Validate Source AND Destination.
* **3.3 Crypto:** Use `crypto.getRandomValues()`. `Math.random()` forbidden for IDs.

## 4. Data & Evolution

* **4.1 Evolution:** Crossover = Deep Clone parents. Reset inherited props (fitness) on new offspring.
* **4.2 Persistence:** Strip redundant history from JSON context before LLM pass. Sync chat updates to disk via `SessionService`.

## 5. Media

* **5.1 Metadata:** Generation incomplete without `duration/fps` persisted. Frontend reads from `HistoryItem`, never guesses.
