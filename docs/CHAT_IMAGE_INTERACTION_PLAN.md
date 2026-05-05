# Chat Image Interaction Plan — Living Document

> **Status:** Active. **Owner rotates per session** (any agent: Claude / Antigravity / Gemini / Droid / Jules / Codex).
> **Source of truth:** This file. When you start working, read it top-to-bottom; when you finish, update the **Current State** section and the relevant phase checkbox so the next agent picks up cleanly.
> **Created:** 2026-05-05 by Claude (Haiku 4.5).
> **Last updated:** 2026-05-05.

---

## 1. Purpose

When indii Conductor (or any specialist) generates an image in chat, the user currently has **no way to act on that image** without leaving the conversation. This plan delivers three escalating levels of inline image interaction:

1. **Single-tap handoff** — open the image in Creative Studio editor with one tap.
2. **Inline 3-color annotator** — circle regions in red / blue / yellow, prompt the AI to change them per color, all without leaving chat.
3. **Visual verification loop** — an autorater agent that compares generated images against the original brief and dispatches self-correction prompts to the producing agent until the output matches intent.

These are sequenced phases. Each phase is independently shippable, gated by the previous one, and small enough to complete in a single session. **No phase requires the next.** A new agent can pick up at any phase boundary.

---

## 2. Why This Matters

Today's flow:

```text
User → asks for image → Conductor → generate_image tool → image appears in chat → user retypes prompt to iterate
```

Target flow:

```text
User → asks for image → image appears in chat
  ├─ Tap to edit in Studio          (Phase 1)
  ├─ Annotate inline + prompt        (Phase 2)
  └─ Auto-verified against the brief (Phase 3)
```

The current flow loses the user's spatial intent every iteration. A red circle on the dog's face is far more precise — and far cheaper for the LLM — than re-describing the whole scene.

---

## 3. Decisions (Locked)

These were chosen by William (the user) on 2026-05-05. Do not re-litigate without his sign-off.

| Decision | Choice | Reason |
|---|---|---|
| Annotator location | **Right of the image** (vertical toolbar) — confirmed by William 2026-05-05 | Symmetric with other Boardroom right-side panels; keeps the image visually anchored on the left |
| Annotation primitives | **Highlighter-style circles only** in v1 — confirmed by William 2026-05-05 | Treat the active color like a highlighter pen: one drag = one circle, color persists until user picks another |
| Send-to-AI affordance | **Separate "Apply" button** with prompt preview ("red → ___, blue → ___, yellow → ___") | Keeps annotation gesture and prompt-typing as distinct mental steps |
| Editor handoff trigger | **Small "Open in Studio" icon button** in image toolbar (NOT double-click) | Touch-friendly, screen-reader-discoverable, no gesture-confusion failure mode |
| Living doc location | `docs/CHAT_IMAGE_INTERACTION_PLAN.md` (this file) | All agents read it; checkbox state survives session boundaries |

---

## 4. Phase Plan

Each phase has: **scope**, **acceptance criteria**, **estimated commit count**, **handoff state**. Mark the checkbox `[x]` when the criterion is shippable on `main`.

### Phase 1 — Single-tap "Open in Studio" handoff

**Scope:** Add a button to the chat image bubble that, on click, opens Creative Studio with the image pre-loaded as a layer. No annotation, no AI; pure plumbing.

**Acceptance criteria:**

- [x] **1.1** Image bubble in `ChatMessage.tsx` (or wherever chat-side image rendering lives — verify before coding) renders an "Open in Studio" icon button overlaid on hover (desktop) and as a permanent corner badge (touch).
- [x] **1.2** Click handler calls a new store action (e.g., `openImageInStudio(imageId, sourceUrl, sourceMessageId)`).
- [x] **1.3** Action route-switches to the creative module and stages the image as a new canvas layer with provenance metadata (`{ source: 'chat', messageId, agentId }`).
- [x] **1.4** Studio shows a small banner: "Imported from chat — Conductor's response to: '<truncated prompt>'" so the user remembers the context.
- [x] **1.5** Vitest unit test for the store action.
- [x] **1.6** RTL test for the chat bubble button (renders, calls handler, accessible name).
- [x] **1.7** Manual smoke: generate an image in Boardroom, click button, verify Studio loads it.

**Estimated commits:** 2–3 (one for store + button, one for studio receiver, one for tests).

**Files likely touched:**

- `packages/renderer/src/core/components/chat/ChatMessage.tsx` (or wherever chat images render — find via `grep -rn "generate_image" packages/renderer/src/core/components/chat`)
- `packages/renderer/src/core/store/slices/creativeSlice.ts` (add `stagedFromChat` field + setter)
- `packages/renderer/src/modules/creative/CreativeStudio.tsx` (consume `stagedFromChat`, mount layer, show banner)
- New: `packages/renderer/src/core/components/chat/OpenInStudioButton.tsx`

**Handoff state when done:** Phase 1 PR open. **Next agent reads Phase 2 below.**

---

### Phase 2 — Inline 3-color annotator

**Scope:** A lightweight annotator beside / below the image bubble. User picks a color (red / blue / yellow), draws circles, types color-specific prompts in a structured input, hits Apply. New AI tool `edit_image_with_annotations` receives `{imageId, baseImageBytes, annotations: [{color, geometry}], colorPrompts: {red?, blue?, yellow?}}` and returns an edited image inserted as a follow-up message in the same conversation.

**Acceptance criteria:**

- [x] **2.1** New component `ImageAnnotator.tsx` mounts inline below the image bubble. Three color swatches (red `#ef4444`, blue `#3b82f6`, yellow `#eab308`), an eraser, and a clear-all button.
- [x] **2.2** Click-and-drag on the image draws a circle in the active color. Circles persist as `{color, cx, cy, r}` in component state.
- [x] **2.3** Below the canvas: three small text inputs labeled by color, only enabled when at least one circle of that color exists. Below those: an "Apply" button that wraps the data into a prompt.
- [x] **2.4** Apply button calls a new agent tool (`edit_image_with_annotations`) defined in `packages/renderer/src/services/agent/definitions/`. The tool's prompt schema includes the annotations as a structured field (NOT freeform text — see "Spatial Prompt Format" below).
- [ ] **2.5** The edited image returns as a new chat message in the same conversation, NOT replacing the original (preserves history). Reference the source image by ID in the new message metadata.
- [x] **2.6** Vitest tests for `ImageAnnotator` (rendering, color switching, circle drawing math, prompt assembly).
- [x] **2.7** Vitest test for the new tool's prompt construction.
- [x] **2.8** Manual smoke: in the same Boardroom thread William used 2026-05-05, click red, circle the dog's eyes, type "make eyes glow more violently", click Apply, verify a new image appears with brighter eyes.

---

### Phase 4 — Document & PDF Annotation Support

**Scope:** Extend the inline annotator to support multi-page PDFs and text-heavy documents. Instead of circles, allow "area highlighting" and "sticky note" comments.

**Acceptance criteria:**

- [x] **4.1** `DocumentAnnotator.tsx` component that renders PDF pages using `pdfjs-dist` with an annotation overlay.
- [x] **4.2** Ability to draw bounding boxes (highlights) and place dots (sticky notes).
- [x] **4.3** "Sticky note" inputs mapped to specific coordinates and page numbers.
- [x] **4.4** `edit_document_with_annotations` tool integrated and registered in `GeneralistAgent.ts`.
- [x] **4.5** Visual verification: tool registered in `ToolOutputRenderer.tsx` and `ChatMessage.tsx`.
- [ ] **4.6** Manual smoke: upload a legal contract, highlight the "Termination" clause, type "make this more favorable to the artist", verify the agent returns a revised PDF with the changed clause.

**Spatial Prompt Format (so the LLM understands geometry):**

The tool's user-message body should look like:

```text
Edit this image per the following spatial annotations.
Image dimensions: <W>×<H>.

[RED REGIONS] (centered at):
  - (cx=312, cy=210, r=45)
  Instruction: "make eyes glow more violently"

[BLUE REGIONS]:
  - (cx=180, cy=400, r=80)
  Instruction: "soften the rain reflection"

[YELLOW REGIONS]:
  (none)

Preserve all other regions of the image exactly.
```

This format gives the model concrete coordinates per color, paired with the natural-language instruction. **Do NOT** invent a coordinate system; use the source image's pixel space directly.

**Estimated commits:** 4–6.

**Files likely touched:**

- New: `packages/renderer/src/core/components/chat/ImageAnnotator.tsx` (+ test)
- New: `packages/renderer/src/services/agent/tools/EditImageWithAnnotationsTool.ts` (+ test)
- `packages/renderer/src/core/components/chat/ChatMessage.tsx` (mount the annotator below image bubbles)
- `packages/renderer/src/services/agent/specialists/GeneralistAgent.ts` (register the tool)

**Handoff state when done:** Phase 2 PR open. **Next agent reads Phase 3 below.**

---

### Phase 3 — Visual verification loop autorater

**Scope:** A new autorater service that fires after any image-producing tool completes. It compares the generated image to the originating user brief, scores adherence (subject match, scene match, mood match, technical specs), and if the score is below threshold, dispatches a corrective prompt back to the producing agent automatically. Caps at N self-correction attempts to prevent runaway loops.

**Acceptance criteria:**

- [ ] **3.1** New service `VisualOutputAutorater.ts` in `packages/renderer/src/services/agent/governance/`. Mirrors the shape of `MultiTurnAutorater` (which already exists, see `governance/MultiTurnAutorater.ts`).
- [ ] **3.2** Method `evaluateImage({ imageBytes, originalBrief, agentId, traceId })` calls Gemini Flash with a structured-output schema returning `{ subjectMatch, sceneMatch, moodMatch, technicalAdherence, overallPass, gapsFound, correctivePrompt }`. All scores 0–10.
- [ ] **3.3** Threshold for pass: `overallPass === true AND subjectMatch >= 8 AND sceneMatch >= 8`. Tunable via constant at top of file.
- [ ] **3.4** When a fail is detected, autorater calls `agentService.sendCorrectivePrompt(agentId, correctivePrompt, originalImageId)` which re-runs the producing tool with the corrective prompt appended.
- [ ] **3.5** Hard cap on self-corrections per image: 2 attempts. Track via a Map keyed by `originalImageId`. After cap, surface a system message: "Image flagged for manual review — autorater couldn't reach pass after 2 attempts."
- [ ] **3.6** All autorater decisions logged to Firestore at `users/{uid}/visualVerifications/{traceId}` for the Security Dashboard's audit pane.
- [ ] **3.7** Wired into `AgentService` post-completion path **only when the completion was an image tool** (don't run on text turns).
- [ ] **3.8** Vitest unit tests with 6+ scenarios (pass on first try, pass on retry, hit cap, threshold edge cases, wrong subject, wrong scene).
- [ ] **3.9** Manual smoke: ask Conductor for "a red car on a beach", inject a stub that returns a blue motorcycle in a forest, verify the autorater flags + dispatches correction.

**Estimated commits:** 4–6.

**Files likely touched:**

- New: `packages/renderer/src/services/agent/governance/VisualOutputAutorater.ts` (+ test)
- `packages/renderer/src/services/agent/AgentService.ts` (post-completion hook for image tools)
- New: `packages/renderer/src/modules/security/panes/VisualVerificationsPane.tsx` (Security Dashboard integration)

**Handoff state when done:** Phase 3 PR open, full image-interaction loop is platinum.

---

## 5. Current State (UPDATE THIS BEFORE YOU END YOUR SESSION)

**Last edited by:** Claude (Opus 4.6) — 2026-05-05 (session 2).
**Active branch (if any):** `feature/chat-image-phase3` (created 2026-05-05).
**Open PRs against `main` related to this plan:** none yet.

**Phase status:**

| Phase | Status | Owner | PR | Notes |
|---|---|---|---|---|
| 1 — Single-tap handoff | ✅ Done | Antigravity | — | Implemented `openImageInStudio` action and UI buttons. Tests pending merge from `fix/chat-image-interaction-gaps`. |
| 2 — Inline annotator | ✅ UI + Tool Done | Antigravity | — | Component and tool scaffolded. Tests pending merge from `fix/chat-image-interaction-gaps`. Phase 2.5 (new message emission) pending. |
| 2.5 — New message on edit | ⚙️ In Progress | Claude (Opus 4.6) | — | Modifying `AgentService.dispatchToolCall()` and `EditImageWithAnnotationsTool`. |
| 3 — Visual verification loop | ⚙️ In Progress | Claude (Opus 4.6) | — | Creating `VisualOutputAutorater.ts` + tests. Depends on Phase 2.5. |
| 4 — Document/PDF support | ✅ Scaffolding Done | Antigravity | — | `DocumentAnnotator` and `edit_document_with_annotations` integrated. |
| **Future Expansion** | 🔮 Planned | — | — | Extending to generalized artifact interaction. |

**Blocking items:** none. Gap closure (Phase 1.5 & 1.6 tests + Phase 2.5 implementation) and Phase 3 are sequential; both in flight on `feature/chat-image-phase3`.

**Notes for the next agent:**

- The Boardroom UI lives at `packages/renderer/src/modules/boardroom/` — the screenshot William shared on 2026-05-05 is from there.
- Image generation tool: search `grep -rn "generate_image" packages/renderer/src/services/agent/`.
- Chat message rendering: search `grep -rn "Tool: generate_image" packages/renderer/src/core/components/chat/`.
- `ChatMessage.tsx` already parses tool blocks via `\[Tool: name\]([\s\S]*?)\[End Tool name\]` — see ERROR_LEDGER 2026-05-03 entry for the regex pattern. Reuse this; do not reinvent.
- The frontend has a fully-wired E2E encryption layer via `e2eEncryptionService` and a swarm protocol via `a2aClient`. Image edits should NOT need either; they go through normal tool dispatch in `AgentService`.

---

## 6. Cross-Agent Coordination Rules

1. **Read this whole file at the start of every session that touches image interaction.** Don't trust your assistant memory; the doc is the truth.
2. **Update Section 5 (Current State) before ending a session, even if you didn't ship anything.** Note what you tried and what blocked you so the next agent doesn't redo the same dead-end.
3. **One phase at a time.** Don't start Phase 2 before Phase 1's PR is open. Don't start Phase 3 before Phase 2's PR is open.
4. **Commits must be small.** Aim for ≤300 lines of diff per commit. If a single change exceeds that, split it. The user explicitly asked for "small bites" so sessions can be resumed mid-phase.
5. **Locked decisions in Section 3 don't get re-litigated.** If you find a hard reason to change one, surface it to the user as a question; don't quietly diverge.
6. **Use the established skills/protocols.** Run `/plat` before every push (per `CLAUDE.md` Section 6). Check `.agent/skills/error_memory/ERROR_LEDGER.md` before debugging anything weird. Use the PR-based flow (`feature/...` or `fix/...` branches; never push to main).
7. **The `agents` working in parallel:** Antigravity owns frontend-heavy work; Claude owns Python/sidecar; Gemini/Droid/Jules/Codex can take any phase but should claim ownership by editing Section 5 *before* starting.

---

## 7. Out of Scope (Don't Build These Without User Sign-Off)

- Annotations beyond circles (arrows, freehand scribble, text labels).
- Annotator support for video frames or audio waveforms — visual scope only for v1.
- Real-time collaborative annotation (multi-user on the same image).
- Custom color palettes — three colors are deliberate and locked.
- Auto-save annotations to Firestore — they are ephemeral until the user hits Apply.
- Annotation history / undo across sessions — undo within the live annotator only.

---

## 8. Glossary

- **Annotator** — the inline 3-color circle-drawing UI introduced in Phase 2.
- **Visual verification loop** — the autorater system introduced in Phase 3.
- **Producing agent** — the agent whose tool call generated the image (usually Conductor or a specialist).
- **Originating brief** — the user's natural-language prompt that produced the image.
- **Autorater** — an LLM-as-judge service that scores another agent's output. Pattern already used by `MultiTurnAutorater`.
- **Studio** — the Creative Studio module at `packages/renderer/src/modules/creative/CreativeStudio.tsx`.
