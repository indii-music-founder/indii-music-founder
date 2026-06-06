# Codex Checkpoint: Universal Command Workflows

**Updated:** 2026-06-06 12:37 EDT  
**Scope:** Universal command workflow layer, custom command promotion, and user/team cloud sync.

## Completed
- Added the reusable entry command registry and launcher path for dashboard cards, typed slash commands, mobile remote commands, contact capture, merch planning, and custom command promotion.
- Added local-first custom command persistence with Firestore sync to:
  - `entryCommands/{uid_commandId}`
  - `teamEntryCommands/{orgId_commandId}`
- Added Firestore rules for custom command persistence, including owner/team access checks and command schema validation.
- Hardened command surface validation during `/middle`:
  - registry validates known surfaces,
  - cloud hydration filters unknown surfaces,
  - Firestore rules deny unknown surfaces.
- Updated command architecture docs:
  - `docs/flowcharts/entry-card-slash-workflows.md`
  - `docs/flowcharts/custom-command-cloud-sync.md`
- Updated active task ledger and implementation plan.

## Verification
- `npx vitest run packages/renderer/src/services/commands/EntryCommandRegistry.test.ts packages/renderer/src/services/commands/EntryCommandService.test.ts packages/renderer/src/services/commands/EntryCommandSyncService.test.ts packages/renderer/src/services/commands/EntryCommandSecurityRules.test.ts --config vitest.config.ts`
  - Result: 4 files passed, 17 tests passed.
- `npx tsc -b packages/renderer`
  - Result: passed.
- `npx -y firebase-tools@latest emulators:exec --only firestore "npx vitest run packages/renderer/src/services/commands/EntryCommandFirestoreRules.emulator.test.ts --config vitest.config.ts"`
  - Result: 1 file passed, 4 tests passed.

## Known Blockers Outside This Scope
- Full `npm run typecheck` is blocked by unrelated dirty main-process files:
  - `packages/main/src/handlers/security.ts`: missing `secret_value`.
  - `packages/main/src/services/IndiiRemoteService.ts`: missing `log`.
- Logged as `ISSUE-213` in `.agent/test_ledger/OPEN_ISSUES.md`.
- Broad Firestore rules suite has unrelated pre-existing failures, logged as `ISSUE-212`.

## Next Agent Notes
- Do not treat custom commands as only local storage anymore; they are local-first with Firestore sync.
- Emulator-backed rules tests under renderer must use `vi.unmock('firebase/firestore')` before importing Firestore SDK functions.
- Do not run paid/public/outbound actions from command workflows without explicit user approval.
