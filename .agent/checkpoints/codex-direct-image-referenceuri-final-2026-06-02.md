# Codex Checkpoint: Direct Image `referenceUri` Payload Fix

## Session Goal
Fix direct image generation failure:

`Payload validation failed. Ensure no base64 is passed and only gs:// URIs are used. Details: referenceUri expected string, received null.`

## Stale Ledger Guard
- `.agent/artifacts/task.md` is stale for this session. It describes old image resizing and deploy work.
- Root `task.md` is stale for this session. It describes guest-auth retirement.
- Completion evidence is based on the current user request and current worktree changes.

## Files Changed
- `packages/renderer/src/modules/creative/hooks/useDirectGeneration.ts`
  - Added `compactCallablePayload`.
  - Direct image and video callable payloads now omit `undefined` and `null` optional fields before calling Cloud Functions.
- `packages/renderer/src/services/creative/CreativeStorageService.ts`
  - Accepts `Blob` media.
  - Returns existing `gs://` references unchanged.
  - Fetches HTTP(S) references and uploads them to Firebase Storage before returning `gs://`.
- `packages/renderer/src/services/intelligence/generators/DirectImageGenerator.ts`
  - Compacts optional direct image payload fields before `generateImageV3`.
- `packages/renderer/src/modules/creative/components/__tests__/DirectGenerationTab.test.tsx`
  - Regression: image generation with no selected reference must not include `referenceUri`.
- `packages/renderer/src/services/creative/__tests__/CreativeStorageService.test.ts`
  - Regression: existing `gs://` reference media is not re-uploaded.
- `docs/flowcharts/direct-image-generation-vertex.md`
  - Updated direct image architecture flow for payload compaction and `gs://` reference boundary.
- `.agent/skills/error_memory/ERROR_LEDGER.md`
  - Added the `referenceUri: null` failure pattern and prevention notes.

## Verification Completed
- `npx vitest run packages/renderer/src/modules/creative/components/__tests__/DirectGenerationTab.test.tsx packages/renderer/src/services/creative/__tests__/CreativeStorageService.test.ts`
  - Passed: 2 files, 7 tests.
- `npm run typecheck:renderer`
  - Passed.
- `git diff --check -- <touched files>`
  - Passed after whitespace cleanup.
- `npm run typecheck && npm run lint`
  - Passed.
- `npm run ci`
  - Passed: preflight config, duplicate identifier check, Electron mock check, fast typecheck, flowchart validation, and sharded Vitest suite.

## Final Workflow Notes
- `/end` stale ledger guard applied: `.agent/artifacts/task.md` and root `task.md` are unrelated to this session.
- Auto-fix external checks could not run authenticated Sentry/GitHub review fetches because the local environment lacks the required permissions/tokens.
- Anti-hallucination scan found mock references in tests and an existing E2E mock branch, so this session should not claim a paid live Vertex generation was executed.

## Worktree Note
Pre-existing untracked file observed and not touched:
- `.agent/checkpoints/antigravity-55eb87e6.md`
