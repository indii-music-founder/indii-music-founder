# Artist cover artwork: focused inventory and acceptance

Audit date: 2026-10-20. Scope: finish cover artwork inside the existing indii.music layer editor. The original user plan covers reliable basics, cutouts/composition, and a small set of useful styles.

## Inventory and code destinations

“Working” entries name the scope of their evidence. Release acceptance remains open until the walkthrough below passes.

| Selected capability | Inventory | Destination and evidence |
| --- | --- | --- |
| Square cover, framing, sizing | Working | [PicturePanel](../packages/renderer/src/modules/creative/components/CanvasEditor/PicturePanel.tsx), [ArtworkGeometry](../packages/renderer/src/services/canvas/ArtworkGeometry.ts), and `resizeArtwork` in [canvasEditorSlice](../packages/renderer/src/core/store/slices/creative/canvasEditorSlice.ts). Geometry tests cover fit/fill, transforms, and export bounds. Live size change and undo passed. Frame cancellation restored placement; it also exposed duplicate inspector controls, fixed separately on `cover-editor-panel-identity` (`2d281c52f`) with local CI passing; deployment verification remains open. |
| Photo and editable text layers | Working | [CanvasEditor](../packages/renderer/src/modules/creative/components/CanvasEditor/CanvasEditor.tsx), [LayerList](../packages/renderer/src/modules/creative/components/CanvasEditor/LayerList.tsx), [TextPanel](../packages/renderer/src/modules/creative/components/CanvasEditor/TextPanel.tsx). The saved “Cover QA – Golden Hour” document reopened with its photo, two editable text layers, positions, and style intact. Layer-order controls changed the stack in the live UI. |
| Undo/redo | Working | Artwork-specific `undoArtwork` / `redoArtwork` actions avoid the Project Canvas action-name collision. [PR #423](https://github.com/indii-music-founder/indii-music-founder/pull/423) is merged; root-store regression coverage passes. Production UI checks passed for style and text undo/redo, proportional 3000→1080 resizing followed by undo, and a brightness drag from 0→43 undone in one history step. Move and cutout history still need live checks. |
| Save, reopen, local recovery | Working | [useCanvasAutosave](../packages/renderer/src/modules/creative/hooks/useCanvasAutosave.ts), [ArtworkWriteQueue](../packages/renderer/src/services/canvas/ArtworkWriteQueue.ts), [CanvasDocumentService](../packages/renderer/src/services/canvas/CanvasDocumentService.ts), [ArtworkDraftService](../packages/renderer/src/services/canvas/ArtworkDraftService.ts), [SavedArtworkPanel](../packages/renderer/src/modules/creative/components/CanvasEditor/SavedArtworkPanel.tsx). Live close/reopen passed for the test cover, including its applied cutout. Interrupted-save recovery still needs a genuine UI check. |
| Older artwork | Working | [CanvasDocValidation](../packages/renderer/src/services/canvas/CanvasDocValidation.ts) preserves legacy render/adjustment behavior; the editor offers an explicit adjustment preview and original-version recovery. An older dated saved cover opened successfully. A real version-1 migration/recovery walkthrough remains open. |
| Adjustments and consistent rendering | Working | [ArtworkPixels](../packages/renderer/src/services/canvas/ArtworkPixels.ts), [ArtworkRenderService](../packages/renderer/src/services/canvas/ArtworkRenderService.ts), [AdjustPanel](../packages/renderer/src/modules/creative/components/CanvasEditor/AdjustPanel.tsx). Shared source rendering feeds preview/export; local pixel tests cover the math. Downloaded-file comparison remains open. |
| Guided cutout | Needs repair | [CutoutPanel](../packages/renderer/src/modules/creative/components/CanvasEditor/CutoutPanel.tsx), [MaskService](../packages/renderer/src/services/canvas/MaskService.ts), [GrabCut](../packages/renderer/src/services/canvas/segmentation/GrabCut.ts). Live preview/apply and save/reopen passed after worker recovery was added. A live Keep/Remove pass removed grass beneath the dog and reduced a left patch; small remnants and rough edges remain. Save/reopen preserved that mask. `cover-saved-mask-refinement` (`01827f84a`) preserves saved grayscale masks when reopening refinement, with local and remote CI passing; deployment and clean-edge export checks remain open. |
| Center the isolated artist | Needs repair | Main centers the full source rectangle. [cover-cutout-centering](https://github.com/indii-music-founder/indii-music-founder/tree/cover-cutout-centering), commit `6404fd340`, measures rendered alpha bounds and centers the subject with rotation/reflection preserved. Local tests/build/lint/typecheck passed; merge and live verification are pending. |
| Studio canvas zoom | Needs repair | Main's native wheel callback can redraw a stale image list. [studio-canvas-zoom-render](https://github.com/indii-music-founder/indii-music-founder/tree/studio-canvas-zoom-render), commit `b9543bc4a`, resolves the current committed scene at frame execution. Its [exact-commit CI](https://github.com/indii-music-founder/indii-music-founder/actions/runs/39480380112) passed. Merge and live zoom verification are pending. |
| Curated looks, blur, grain | Working | [PicturePanel](../packages/renderer/src/modules/creative/components/CanvasEditor/PicturePanel.tsx), [ArtworkPixels](../packages/renderer/src/services/canvas/ArtworkPixels.ts), and shared rendering. Warm Film and seeded grain survived live save/reopen. Full preview/export appearance checks remain open. |
| PNG/JPEG export | Working | [ExportBar](../packages/renderer/src/modules/creative/components/CanvasEditor/ExportBar.tsx), [CanvasEditor](../packages/renderer/src/modules/creative/components/CanvasEditor/CanvasEditor.tsx), [download](../packages/renderer/src/utils/download.ts). PR #423 replaced the web data-URL fetch with direct Blob download. Local coverage and deployment passed; the 3000px download and appearance checks remain open. |

## Smallest complete workflow and defaults

1. Open/upload the artist photo in the existing editor. Start with a black 3000 × 3000 cover; 1080 × 1080 remains available.
2. Use **Frame photo**, drag/zoom, then **Apply frame** or **Cancel frame**. **Fit photo** keeps the whole photo; **Fill cover** fills the square. Original pixels remain available.
3. Use **Remove background**: draw a subject box, mark **Keep**/**Remove**, preview the green retained region, then apply. Brush size starts at 30 source pixels; edge softness starts at 1px. **Reset cutout** restores the photo without its separate mask.
4. Position the cutout and use **Center artist** to center its visible bounds after the candidate fix ships. Preserve its current effective scale and rotation.
5. Add editable artist/title text using the existing font library and bundled fonts. Default text is white, 180px on a 3000px cover; uploaded fonts use the existing font registration path.
6. Choose **Original**, **Warm Film**, **Cool Night**, or **Mono**. Look strength starts at 1; grain and blur start at 0. Save the grain seed so reopening and exporting reuse the same texture. Older adjustment behavior changes only through the explicit preview/apply choice.
7. Revise with undo/redo, save, close/reopen, then export PNG at 1× by default. JPEG and 2× use the same full-resolution rendering path. One slider drag is one undo gesture; the artwork history keeps 50 entries.

Success means the artist can complete these steps in this editor and reopen the editable result with the same composition, then download a square cover matching the preview.

## Reuse, interfaces, and dependencies

- Reuse Fabric, the existing document/store, font library, Firebase Auth/Firestore/Storage, Canvas 2D rendering, and IndexedDB drafts. Cloud writes debounce for two seconds; local recovery retains the newest 30 drafts per account.
- PhotoCraft contributes only the selected guided foreground extraction adaptation. The source header records commit `bb3108cfd28a1cc84a9ae3b83531891f36a736fd`; retain the adjacent [MIT notice](../packages/renderer/src/services/canvas/segmentation/PHOTOCRAFT-LICENSE.txt). LightCraft adds no runtime dependency to this scope.
- Keep `maskSrc`, `maskFeather`, adjustment versions, source references, typography, look strength, grain seed, and editable transforms in the existing saved document. The centering/zoom candidates require no saved-file migration or new external API.
- Preview and export share `renderArtworkSource`; full-size exports use `renderArtworkDocument`. Apply the same mask, color math, font rendering, blur, and grain before composition. Source layers are bounded at 24 megapixels; output allocation is bounded at 36 megapixels.

## Delivery sequence and acceptance

1. **Reliable basics:** finish deployed undo/redo, download, square framing, and save/recovery checks.
2. **Cutouts/composition:** deploy subject centering; prove manual edge refinement, placement, editable text, and stack order.
3. **Styles/export polish:** compare the small look set, blur, and grain against actual PNG/JPEG files.

Required genuine-account walkthrough:

- Open an artist portrait through the visible app workflow; make a square cover without stretching the portrait. The existing dog cover provides partial persistence evidence and does not complete the artist-portrait walkthrough.
- Isolate the artist, correct background remnants with Keep/Remove, inspect hair/transparent edges against contrasting backgrounds, center and position the subject, and add artist/title text.
- Change layer order and confirm the visible order. Undo and redo a move, text edit, slider gesture, style change, and cutout. Save after undo and verify the intended revision after reopening.
- Save, close, reopen, and reload the browser. Confirm layers, text editability, mask, dimensions, adjustments, look, and grain seed persist. Repeat with actual older artwork, including original-version recovery where applicable.
- Interrupt a save through normal browser connectivity controls, confirm the error/recovery UI, restore the local draft as a copy, and verify both versions remain available.
- Download 3000 × 3000 PNG and JPEG; inspect actual file dimensions and compare composition, fonts, color, blur, grain, and cutout edges to the editor. Verify a transparent-background PNG retains alpha. Confirm the enlarged-source warning when appropriate.
- In Image Studio, zoom in/out with the mouse wheel and toolbar after adding/reopening an image. Resize the workspace. The image must stay visible without a corrective pan.

Delivery status: the user authorized opening PRs, merging, deploying, and verifying the zoom and centering branches. [Zoom PR #425](https://github.com/indii-music-founder/indii-music-founder/pull/425) and [centering PR #426](https://github.com/indii-music-founder/indii-music-founder/pull/426) are open; both exact branch commits passed CI, and fresh PR checks are running. Saved-mask refinement and panel identity remain separate published branches pending delivery authority.

Production checks used `https://app.indii.music/creative`, the existing genuinely authenticated account and actual saved artwork; account creation was not part of this journey and no plan label was shown. Authentication recovered after a temporary listener timeout. Actual downloaded-file inspection remains unverified: the browser download event was not captured and macOS denied Downloads access; requested filesystem access was not granted. A suitable artist portrait, legacy-version recovery, interrupted-save recovery, and remaining acceptance checks above are still required. Local/mock-backed tests are structural evidence; the complete production walkthrough remains unverified.
