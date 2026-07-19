# Codex Checkpoint — ISSUE-777

**Date:** 2026-07-16
**Branch:** `main`
**Objective:** Complete the Image Creator settings contract without claiming unproven browser acceptance.

## Completed

- Added real image-mode controls for image size, Google/Image Search grounding, thinking level, thought summaries, image count, and image/text response format.
- Kept video-only resolution and person-safety controls out of image mode.
- Routed Direct Generation through the existing authenticated, quota-checked, cost-reserved `ImageGenerationService`.
- Extended renderer/Firebase image request schemas with `count`, `includeThoughts`, and `responseFormat`.
- Extended `generateImageV3` to validate reservation coverage, generate/store all requested outputs, return `resultUris`, and preserve narration/thought metadata.
- Added compensation for partial batch Storage failures and a regression test proving prior writes are deleted before the reservation is voided.
- Updated the legacy Firebase image integration fixture so its two-output request seeds a matching two-image reservation and asserts both returned Storage URIs.
- Added `docs/flowcharts/image-generation-controls-micro.md`.
- Updated `.agent/test_ledger/OPEN_ISSUES.md` and `.agent/artifacts/task.md`.

## Verification

- Renderer focused suites: 2 files, 32 tests passed.
- Firebase gateway suite: 1 file, 22 tests passed.
- Renderer and shared TypeScript checks passed.
- Firebase TypeScript build passed.
- Scoped diff check, schema parity diff, and secret scan passed.
- Pattern detector score at middle checkpoint: 163. No comparable start-of-session baseline was captured.

## Honest Remaining Gate

ISSUE-777 remains `PARTIAL`. The repository `/middle` workflow requires explicit live-browser DOM/interaction evidence before final `FIXED` status. The in-app browser is open, but the required browser-control runtime is not exposed to this task.

## Next Issue

Resume the authoritative partial queue at ISSUE-784 after ISSUE-777 receives live browser proof, or proceed according to the user's next instruction.

## Shared Worktree Warning

Other agents have unrelated dirty changes in the two macro flowcharts and `VideoGenerationService.test.ts`. Do not absorb or revert those files when committing ISSUE-777.
