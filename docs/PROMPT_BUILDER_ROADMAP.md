# Handoff State
**Updated:** 2026-04-22
**Branch:** `claude/fix-builder-pill-selection-OapN2`
**Working tree:** clean
**Last commit on branch:** `0a88795 fix(creative): wire Prompt Builder pills to the visible input`

---

## Context for the incoming agent

The user is on a basic (token-limited) plan and wants a deterministic, step-by-step plan so a fresh agent can finish this work without re-discovering context. Read this entire file before touching code.

**User's stated quality bar:** 10/10, platinum every time. Refer to `docs/PLATINUM_QUALITY_STANDARDS.md` and run `/plat` before every push.

**Hard rules from the session:**
- Mobile sessions must pass `npx tsc --noEmit`, `npx eslint <changed>`, and the tests covering touched files *before* any commit. Zero tolerance for typing regressions.
- Develop on the branch named in this file. Never push to a different branch without explicit permission.
- Do not open a PR unless the user asks.

---

## What just shipped on this branch (already pushed)

Commit `0a88795` fixed the Creative Prompt Builder. Details:
- Top-nav Builder pills used to write to `state.prompt` while the Generate input read a separate `localPrompt`. Clicks landed in a dead state slot. **Fixed** by seeding `localPrompt` from global and mirroring writes both ways in `packages/renderer/src/modules/creative/hooks/useDirectGeneration.ts`.
- Duplicate `PROMPT ENGINEERING` strip below the input was **removed** from `DirectGenerationTab.tsx`.
- `Improve with AI` button now lives in the single top-nav Builder drawer (`CreativeNavbar.tsx` passes `currentPrompt` + `onPromptImproved`).
- Builder open/close is now store state (`isPromptBuilderOpen`, `togglePromptBuilder` in `creativeControlsSlice.ts`). Both the nav pill and the in-input chevron toggle the same panel.
- Tests: 95 creative-module unit tests pass. Typecheck + eslint clean.

---

## Remaining roadmap

Work is split into two tracks. **Do Track B first** — it locks in the reference implementation that Track A will clone, so the patterns don't have to be rebuilt N times per department.

---

### TRACK B — Creative Builder platinum polish

Five ordered items. Each item is self-contained and should ship as its own commit.

#### B1. Scoped store slot for the creative prompt
**Why:** `state.prompt` is shared by Canvas, Gallery "reuse prompt", Keyframes, and the Generate input. Every writer stomps the others. The current `localPrompt` mirror in `useDirectGeneration.ts` is a workaround for this.

**Steps:**
1. In `packages/renderer/src/core/store/slices/creative/creativeControlsSlice.ts`, add:
   - `creativePrompt: string` (replaces `prompt` for creative-module writers).
   - `setCreativePrompt: (p: string) => void`.
   - Keep `prompt` + `setPrompt` temporarily for back-compat in a single release.
2. Grep every `state.prompt`/`state.setPrompt` reader under `packages/renderer/src/modules/creative/` and switch them to the scoped field:
   - `CreativeStudio.tsx`
   - `CreativeNavbar.tsx`
   - `CreativeGallery.tsx`
   - `ImageSubMenu.tsx`
   - `PromptHistoryDrawer.tsx`
   - `useDirectGeneration.ts`
3. Non-creative readers (e.g. `VideoWorkflow.tsx`, `mobile-remote/components/GenerationMonitor.tsx`, `right-panel/VideoPanel.tsx`) need review: decide per-file whether they track `creativePrompt` or stay on `prompt`. Default assumption: they should track `creativePrompt` if they display creative output, otherwise leave them.
4. Once all creative consumers migrate, delete `state.prompt`/`setPrompt` in a follow-up commit.
5. Tests: grep `setPrompt: mockSetPrompt`, `state.prompt`, `'prompt':` in `packages/renderer/src/` tests and update mocks.

**Acceptance:** typing in the Generate input, then opening Canvas or Gallery, shows no cross-contamination. `tsc`/`eslint`/creative-module tests green.

#### B2. Delete `localPrompt`, read straight from the store
**Depends on B1.** Only possible once the scoped slot exists.

**Why:** The current `localPrompt` state is a test-harness workaround. The real zustand store is reactive; the test mock isn't.

**Steps:**
1. Rewrite `packages/renderer/src/modules/creative/components/DirectGenerationTab.test.tsx` to use a real zustand store seeded per-test instead of `vi.fn().mockReturnValue(storeState)`. Pattern to follow: see tests under `packages/renderer/src/core/` that import the real store and call `useStore.setState({...})` in `beforeEach`.
2. In `useDirectGeneration.ts`, delete `localPrompt`, `setLocalPromptState`, and the sync `useEffect`. Return `prompt`/`setPrompt` directly (using the scoped slot from B1).
3. In `DirectGenerationTab.tsx`, replace `localPrompt` → `prompt`, `setLocalPrompt` → `setPrompt`.
4. Run the full creative test suite.

**Acceptance:** no `localPrompt` identifier anywhere in the creative module. Tests still green with the real store.

#### B3. Sticky popover with chip rail for selected tags
**Why:** Today clicking a pill auto-closes the category popover, so adding five tags means five round-trips. Users want to pick multiple tags without re-opening.

**Steps:**
1. In `packages/renderer/src/modules/creative/components/PromptBuilder.tsx`:
   - Remove the `setOpenCategory(null)` call from `handleTagClick`.
   - Close the popover only on outside-click or Escape. Use a `useClickOutside` hook if one exists under `packages/renderer/src/hooks/`, otherwise add a scoped `useEffect` listener.
2. Add a **chip rail** row above or below the pill grid that renders each tag already in the prompt as a chip with an `×` button. Clicking `×` removes that tag segment from the prompt.
   - Segmentation rule: split the current prompt on `, ` (same delimiter `onAddTag` uses). Removing a chip splices that segment out and rejoins with `, `.
   - Don't render the chip rail when the prompt is empty.
3. Keyboard: Esc closes the open category; clicking the active category pill re-toggles it.

**Acceptance:** a user can click 5 tags in a row without the popover closing. Each tag shows as a removable chip. The input text stays in sync both ways.

#### B4. Anchored popover — stop pushing the canvas down
**Why:** The Builder drawer currently expands in-flow between the navbar and the canvas, causing a jarring height jump. Brand and History already use anchored overlays; Builder should match.

**Steps:**
1. In `packages/renderer/src/modules/creative/components/CreativeNavbar.tsx`, move the `{showPromptBuilder && <PromptBuilder .../>}` render from its current inline position to an anchored overlay pattern.
2. Use the same pattern as `BrandAssetsDrawer` or `PromptHistoryDrawer` (both already exist and ship as overlays). Pattern: absolute-positioned container anchored to the nav, with a semi-transparent backdrop beneath it.
3. The PromptBuilder component itself should not need structural changes — only its mount site.
4. Make sure the chevron in `DirectGenerationTab.tsx` still toggles the same overlay (store state already unifies this, so this should Just Work).

**Acceptance:** opening/closing the Builder no longer reflows the canvas. Clicking outside the overlay closes it. Tab focus stays inside the overlay while open (trap focus — copy the pattern from the existing drawers).

#### B5. Consistent video-mode entry points
**Why:** Today in video mode the nav Builder pill is replaced by `DaisyChainControls` (see `CreativeNavbar.tsx` `generationMode === 'image'` conditional), but the in-input chevron still toggles the Builder. Two entry points should agree.

**Steps:**
1. Decide: does the Builder belong in video mode? Two reasonable options:
   - **(a)** Hide the chevron in video mode for symmetry with the nav pill.
   - **(b)** Bring the nav pill back for video mode and keep both. Ask the user.
2. Implement whichever option the user picks. Change is local to `CreativeNavbar.tsx` and `DirectGenerationTab.tsx`.

**Acceptance:** nav pill presence and chevron presence match in both image and video mode.

---

### TRACK A — Department-scoped Builders

**Goal:** Replicate the Creative Builder pattern for each department that has a prompt/chat input. Each department gets its own pill vocabulary tailored to its work (Marketing has campaigns/tone/platform; Finance has queries/time-ranges/metrics; Legal has document types/jurisdictions/clauses; etc.).

**Prerequisite:** complete Track B first. Do not start Track A with a pre-platinum Builder — it will multiply the rework.

**Departments in scope (from `packages/renderer/src/modules/`):**
`marketing`, `finance`, `legal`, `licensing`, `publishing`, `social`, `touring` (a.k.a. road), `merchandise`, `distribution`, `publicist`.

Also relevant: `agent`, `workflow` (might benefit but deprioritize).

**Per-department steps (template):**
1. **Vocabulary research.** Before writing UI, collect pill vocabulary for the department. Check these sources in order:
   - `directives/<department>*.md` — SOPs often list domain terms.
   - `agents/<department>/` — agent persona may enumerate specialties.
   - `packages/renderer/src/services/<department>/` — service method names signal what the dept does.
   - `docs/` for any spec files.
   - If vocabulary is still thin, **ask the user** for a 2-minute brain-dump per department. Do not invent generic pills.
2. **Create the vocabulary constant.** Add `packages/renderer/src/modules/<department>/constants.ts` (or extend if it exists) with a `<DEPT>_TAGS` object matching the shape of `STUDIO_TAGS` in `packages/renderer/src/modules/creative/constants.ts` (top-level category → array of pills, or category → subcategory → pills for nested popovers).
3. **Create a thin `<Dept>PromptBuilder` wrapper** that composes `PromptBuilder` from `packages/renderer/src/modules/creative/components/PromptBuilder.tsx` but passes the department's tag set. If `PromptBuilder`'s current shape assumes `STUDIO_TAGS` directly, generalize it first (B3/B4 may already force this — another reason to do Track B first).
4. **Wire into the department's input surface.** Identify where each department renders its prompt/chat input. Add:
   - A "Builder" nav/toolbar button that toggles an anchored overlay of the department's `PromptBuilder`.
   - A chevron in the input that toggles the same store slot.
5. **Store slot.** Each department gets its own `isXxxBuilderOpen` + `toggleXxxBuilder` (or a generic `activeBuilder: 'creative' | 'marketing' | ... | null` — recommended, since only one can be open at a time app-wide).
6. **Tests.** Mirror the creative test suite: one test per new wrapper + store update.

**Order of attack:** start with `marketing` (largest copywriting/prompt surface, easy wins), then `finance` (very different shape — good second example to prove the abstraction generalizes), then the rest.

---

## Open questions blocking execution

1. **B5 branch decision:** in video mode, hide the chevron (symmetric) or restore the nav pill (full parity)? — needs user.
2. **Track A vocabulary per department:** does the user have pre-existing lists, or should the agent mine `directives/` + `agents/` and propose drafts for user review? — needs user.
3. **Track A first department:** user didn't pick one. Assumption: start with `marketing`.

If the user is unavailable, default to the assumptions above and flag them in the commit message.

---

## How to verify work on this branch

From `/home/user/indiiOS-Clean`:

```bash
# Type safety
cd packages/renderer && npx tsc --noEmit

# Lint (run on touched files)
npx eslint <path/to/changed/file>

# Tests relevant to Creative Builder
npx vitest run src/modules/creative/
```

All three must exit 0 before any commit. If a mobile session is limited on tokens, at minimum run `tsc --noEmit` + the tests for files touched.

---

## Files touched in this session (reference for follow-up)

- `packages/renderer/src/core/store/slices/creative/creativeControlsSlice.ts`
- `packages/renderer/src/modules/creative/components/CreativeNavbar.tsx`
- `packages/renderer/src/modules/creative/components/CreativeNavbar.test.tsx`
- `packages/renderer/src/modules/creative/components/DirectGenerationTab.tsx`
- `packages/renderer/src/modules/creative/components/DirectGenerationTab.test.tsx`
- `packages/renderer/src/modules/creative/hooks/useDirectGeneration.ts`

Not touched but directly relevant to the roadmap:
- `packages/renderer/src/modules/creative/components/PromptBuilder.tsx` (needs B3/B4 changes)
- `packages/renderer/src/modules/creative/constants.ts` (contains `STUDIO_TAGS` — the Track A template)
- `packages/renderer/src/modules/creative/components/BrandAssetsDrawer.tsx` + `PromptHistoryDrawer.tsx` (anchored-overlay pattern to copy for B4)
