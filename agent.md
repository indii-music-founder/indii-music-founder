# Agent Rules

1. **Always use the browser tool to check your work** after you build or fix or do something to the code.

2. **Consult `TEST_PLAYBOOK.md` for testing protocols.**
   - This document defines the named stress test protocols (e.g., "The Gauntlet", "Fear Factor") used to validate Rndr AI.
   - When asked to test a specific area (e.g., "onboarding", "media pipeline"), check `TEST_PLAYBOOK.md` to find the corresponding named protocol and command.
   - Always verify if a relevant "Playbook" scenario exists before creating new ad-hoc tests.

3. **The "Two-Strike" Pivot Rule:**
   - If a specific fix or approach fails verification **twice** (2 attempts), you **MUST** stop and pivot. Do not try the same fix a third time.
   - **Pivot Actions:**
     - **Re-diagnose:** Assume your initial understanding of the root cause was wrong drastically. Add extensive logging to prove what is happening before touching code again.
     - **Alternative Approach:** Propose a fundamentally different solution (e.g., refactoring vs patching, using a different library).

4. **No Unauthorized Downgrades:**
   - **Never** downgrade a library, framework, or dependency (e.g., React 19 -> 18) to resolve a bug without explicit user permission.
   - **Assumption:** Always assume a fix exists within the current version.
   - **Protocol:** If you believe a downgrade is the *only* solution, stop and present your evidence to the user for approval first.

5. **Strict Path Aliasing:**
   - Always use the `@/` alias for imports (e.g., `import X from '@/core/store'`) instead of relative paths (e.g., `../../core/store`).
   - This ensures strict adherence to `tsconfig.json` paths and prevents refactoring errors.

6. **The "Service/UI" Split:**
   - **Service Layer:** Business logic belongs in `*Service.ts` files or Store slices.
   - **UI Layer:** Components (`.tsx`) should only handle rendering and user events.
   - **Why:** Keeps the codebase testable and clean (e.g., see `UserService.ts` vs `SelectOrg.tsx`).

7. **Firebase Security Check:**
   - If you modify the Data Schema or Storage Paths, you **MUST** check and update `firestore.rules` or `storage.rules`.
   - Missing this step often leads to "Permission Denied" bugs that are hard to debug.

8. **Electron/Web Hybrid Safety:**
   - Verify that new features work in both "Web Mode" (`npm run dev`) and "Electron Mode".
   - Avoid direct Node.js imports in React components; code must be environment-agnostic or use IPC.

9. **Surgical Edits Only (Scope Containment):**
   - **Rule:** Do not modify files, schemas (e.g., global CSS), or logic unrelated to your specific task.
   - **Containment:** If a feature requires a global refactor, stop and ask the user for permission first.
   - **Why:** To prevent "scope creep" where a simple feature breaks unrelated parts of the app (e.g., changing global colors for one button).

10. **The "Boy Scout" Rule (Code Hygiene):**
    - **No Duplication:** Do not copy-paste logic that already exists. Reuse services and components.
    - **Clean Up:** If you rewrite a function, **delete** the old commented-out code. Do not leave "zombie" blocks.
    - **Leave it Cleaner:** If you touch a file, try to fix any obvious lint errors or unused imports in the immediate vicinity.

11. **The "Autopoiesis" Rule (Self-Documentation):**
    - **Update Local Charters:** Agents (e.g., Road Manager, Creative Director) MUST update their own specific `AGENTS.md` (e.g., `agents/road-manager/AGENTS.md`) when they learn a new pattern or constraint.
    - **Create if Missing:** If you are working on a module (e.g., `modules/touring`) and no specific Agent Charter exists, **create it**.
    - **Learn & Log:** If you fix a tricky bug, add a "Lessons Learned" section to that Agent's markdown file so the next agent doesn't repeat the mistake.

12. **The "Living Test" Protocol:**
    - **Sync Tests with Tech:** If you advance a technology or system (e.g., adding Vector Search to RAG), you **MUST** update the corresponding test protocol (e.g., "The Librarian") to check this new capability.
    - **No Stale Green Lights:** A test that passes because it checks an obsolete, simple version of the feature is a failure. Tests must cover the *current* level of complexity.
