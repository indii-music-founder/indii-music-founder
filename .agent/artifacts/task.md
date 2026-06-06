# Active Task Ledger

## Current Goal
Implement the Universal Command Workflow Layer for dashboard cards, typed slash commands, mobile remote workflows, contact capture, tour merch planning, conversation-to-command promotion, and user/team custom command sync.

## Tasks
- [x] Audit existing workflow, mobile remote, merch/POD, contact capture, and harness systems.
- [x] Add a central entry command registry.
- [x] Add active command workflow state to the agent UI store.
- [x] Add command launcher service with guided intake.
- [x] Implement `/capture-contact` field contact persistence.
- [x] Implement `/tour-merch` POD harness quote and approval-gate brief.
- [x] Wire dashboard cards to command definitions.
- [x] Wire typed slash commands in `PromptArea`.
- [x] Wire mobile remote slash commands through the desktop relay.
- [x] Add focused registry and launcher tests.
- [x] Document architecture in `docs/flowcharts/entry-card-slash-workflows.md`.
- [x] Run focused command workflow tests.
- [x] Run adjacent command-bar regression tests.
- [x] Run full typecheck.
- [x] Fix in-scope failures found by verification.
- [x] Add `/save-command` and natural-language custom command promotion.
- [x] Store custom commands separately from built-in commands and prevent built-in slash conflicts.
- [x] Route saved custom merch/contact commands through the same intake and approval-gated handlers.
- [x] Add focused custom command promotion tests.
- [x] Add custom command cloud/team sync with local fallback.
- [x] Add Firestore security rules for user-scoped and team-scoped custom commands.
- [x] Add focused sync service, static rules, and emulator-backed rules tests.
- [x] Document custom command cloud sync.

## Non-Goals
- Do not handle CI, merge, cleanup, or unrelated open work.
- Do not revert concurrent-agent changes.
- Do not execute paid, public, outbound messaging, production, storefront, or distribution actions without explicit approval.

## Verification Targets
- ✅ `npx vitest run packages/renderer/src/services/commands/EntryCommandRegistry.test.ts packages/renderer/src/services/commands/EntryCommandService.test.ts --config vitest.config.ts`
- ✅ `npx vitest run packages/renderer/src/core/components/command-bar/PromptArea.test.tsx --config vitest.config.ts`
- ✅ `npx vitest run packages/renderer/src/core/components/command-bar/AttachmentList.test.tsx packages/renderer/src/core/components/command-bar/PromptArea.a11y.test.tsx packages/renderer/src/core/components/command-bar/DelegateMenu.test.tsx packages/renderer/src/core/components/command-bar/PromptArea.error.test.tsx --config vitest.config.ts`
- ✅ `npm run typecheck`
- ✅ `npx vitest run packages/renderer/src/services/commands/EntryCommandRegistry.test.ts packages/renderer/src/services/commands/EntryCommandService.test.ts --config vitest.config.ts` after custom command promotion updates
- ✅ `npx vitest run packages/renderer/src/services/commands/EntryCommandRegistry.test.ts packages/renderer/src/services/commands/EntryCommandService.test.ts packages/renderer/src/services/commands/EntryCommandSyncService.test.ts packages/renderer/src/services/commands/EntryCommandSecurityRules.test.ts --config vitest.config.ts`
- ✅ `npx -y firebase-tools@latest emulators:exec --only firestore "npx vitest run packages/renderer/src/services/commands/EntryCommandFirestoreRules.emulator.test.ts --config vitest.config.ts"`
