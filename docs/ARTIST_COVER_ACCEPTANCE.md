# Artist cover artwork: inventory, implementation, and acceptance

Audit completed: 2026-10-22. Scope: finish artist cover artwork in the existing indii.music editor. This is a focused photo, cutout, text, style, save, and export workflow.

## Inventory and change map

| Feature | Status | Code destination and behavior |
| --- | --- | --- |
| Square cover and photo framing | Working | [PicturePanel](../packages/renderer/src/modules/creative/components/CanvasEditor/PicturePanel.tsx), [ArtworkGeometry](../packages/renderer/src/services/canvas/ArtworkGeometry.ts), and `resizeArtwork` in [canvasEditorSlice](../packages/renderer/src/core/store/slices/creative/canvasEditorSlice.ts). Black 3000 × 3000 default; 1080 × 1080 alternative. Frame photo supports drag/zoom, Apply and Cancel; Fit preserves the whole photo, Fill covers the square. Resizing scales composition proportionally. |
| Photo and editable text composition | Working | [CanvasEditor](../packages/renderer/src/modules/creative/components/CanvasEditor/CanvasEditor.tsx), [LayerList](../packages/renderer/src/modules/creative/components/CanvasEditor/LayerList.tsx), [TextPanel](../packages/renderer/src/modules/creative/components/CanvasEditor/TextPanel.tsx). Photos, editable artist/title text, stacking, bundled/custom fonts, positions and transforms reuse the existing document. |
| Safe revision | Working | Artwork-specific history actions in `canvasEditorSlice` avoid the Project Canvas action-name collision. One slider gesture, move, frame, resize, centering or applied mask is one undo operation. History retains 50 entries. |
| Save, reopen and recovery | Working | [useCanvasAutosave](../packages/renderer/src/modules/creative/hooks/useCanvasAutosave.ts), [CanvasDocumentService](../packages/renderer/src/services/canvas/CanvasDocumentService.ts), [ArtworkWriteQueue](../packages/renderer/src/services/canvas/ArtworkWriteQueue.ts), [ArtworkDraftService](../packages/renderer/src/services/canvas/ArtworkDraftService.ts), [SavedArtworkPanel](../packages/renderer/src/modules/creative/components/CanvasEditor/SavedArtworkPanel.tsx). Debounced cloud writes and account-scoped IndexedDB drafts preserve editable state. Inline uploads decode locally before owned-asset upload, avoiding production CSP rejection of fetch(data:). |
| Cutout and refinement | Working | [CutoutPanel](../packages/renderer/src/modules/creative/components/CanvasEditor/CutoutPanel.tsx), [MaskService](../packages/renderer/src/services/canvas/MaskService.ts), [GrabCut](../packages/renderer/src/services/canvas/segmentation/GrabCut.ts). Subject box, Keep/Remove, preview/apply, edge softness and Reset. Reopening loads the saved grayscale mask; untouched areas survive refinement. Separate source and mask remain editable. |
| Precise refinement preview | Working | CutoutPanel and [CutoutPreviewGeometry](../packages/renderer/src/services/canvas/CutoutPreviewGeometry.ts). Deployed 1×/2×/4× zoom, scrollable preview, Fit and explicit source-pixel brush radius passed live placement/history/persistence/export checks. PR #432 fixes source-center drift when scrollbars change CSS width; production Fit, zoom and scrolled-detail checks passed. Preview zoom is transient. |
| Position the isolated artist | Working | ArtworkGeometry measures rendered alpha bounds so Center artist centers the visible subject, preserving effective scale, rotation and reflection. Inspector identity remains stable through framing and text selection. |
| Adjustments, styles and export | Working | [ArtworkPixels](../packages/renderer/src/services/canvas/ArtworkPixels.ts), [ArtworkRenderService](../packages/renderer/src/services/canvas/ArtworkRenderService.ts), [AdjustPanel](../packages/renderer/src/modules/creative/components/CanvasEditor/AdjustPanel.tsx), [ExportBar](../packages/renderer/src/modules/creative/components/CanvasEditor/ExportBar.tsx). Shared rendering applies adjustments, mask, look, blur and seeded grain consistently. Web exports download a Blob directly. |
| Existing artwork and Studio canvas | Working within verified scope | [CanvasDocValidation](../packages/renderer/src/services/canvas/CanvasDocValidation.ts) preserves legacy adjustment behavior. Older dated artwork reopened normally; actual version-1 migration remains unverified because no applicable document was identified. Studio wheel/toolbar zoom and workspace resize retain the image without a corrective pan. |

## Smallest complete artist workflow

1. Upload/open a portrait and prepare a black 3000px square. Frame, Fit or Fill without stretching; Apply commits placement and Cancel restores it.
2. Draw a subject box, mark Keep/Remove and preview before applying. Initial brush radius is 30 source pixels and edge softness is 1px. Zoom to 2×/4× for smaller marks; scrolling reaches other edges. Reset restores the unmasked photo.
3. Center the visible artist and adjust placement. Add editable artist/title text. Default text is white, 180px on a 3000px cover; use the existing font library/upload path.
4. Choose Original, Warm Film, Cool Night or Mono. Look strength defaults to 1; grain and blur default to 0. Preserve the grain seed across reopening/export. Existing adjustment versions change only through the explicit preview/apply choice.
5. Revise using undo/redo; save, close, reopen and confirm editable layers. Recover a genuine failed-save draft as a copy when needed.
6. Export PNG at 1× by default; JPEG and 2× use the same rendering path. Show the source-enlargement warning when appropriate. Inspect actual dimensions, composition, lettering, effects and alpha.

Success is observable: the artist can complete this sequence in one editor, reopen the editable composition, and download a square image matching the preview. No separate craft applications are required.

## Reuse, compatibility and dependencies

Reuse Fabric, the current document/store, font library, Firebase Auth/Firestore/Storage, Canvas 2D and IndexedDB drafts. Cloud writes debounce for two seconds; recovery retains the newest 30 drafts per account. Source layers are bounded at 24 megapixels and output allocation at 36 megapixels.

PhotoCraft supplies only the selected guided foreground-extraction adaptation. Its source header records commit `bb3108cfd28a1cc84a9ae3b83531891f36a736fd`; preserve the adjacent [MIT notice](../packages/renderer/src/services/canvas/segmentation/PHOTOCRAFT-LICENSE.txt). LightCraft adds no runtime dependency.

Retain maskSrc, maskFeather, adjustment versions, owned source references, typography, transforms, look strength and grain seed in the existing document. Centering, canvas zoom and refinement-preview zoom add no external API or file migration. Preview and export share `renderArtworkSource`; composition exports use `renderArtworkDocument`.

## Delivery and acceptance evidence

Delivery proceeded in the planned order: reliable basics; cutouts/composition; curated styles and export polish. Merged changes:

- [#423](https://github.com/indii-music-founder/indii-music-founder/pull/423): artwork undo/redo and Blob export.
- [#425](https://github.com/indii-music-founder/indii-music-founder/pull/425): disappearing Studio canvas image during zoom.
- [#426](https://github.com/indii-music-founder/indii-music-founder/pull/426): visible-subject centering.
- [#427](https://github.com/indii-music-founder/indii-music-founder/pull/427): saved-mask refinement.
- [#428](https://github.com/indii-music-founder/indii-music-founder/pull/428): stable inspector identity.
- [#429](https://github.com/indii-music-founder/indii-music-founder/pull/429): uploaded-photo saving.
- [#430](https://github.com/indii-music-founder/indii-music-founder/pull/430): bounded refinement-preview zoom and brush-radius label.
- [#432](https://github.com/indii-music-founder/indii-music-founder/pull/432): measured-content zoom anchoring across native scrollbars.

PR #430 deployed as `cad70c29c834f75ce4992984abb58503c19bd892`; [deployment 39652628932](https://github.com/indii-music-founder/indii-music-founder/actions/runs/39652628932) completed successfully and its logs were inspected. PR #432 head `38e80fcb184f08c932b0b7fc77c7ea4b2adaed1d` passed six pure geometry checks, 9,990 tests in full local CI, lint, typecheck and the Studio build. [Exact-head CI 39695539155](https://github.com/indii-music-founder/indii-music-founder/actions/runs/39695539155) passed; completed logs were inspected. It merged as `2061ef98b0ac21b62df2c2721d80231e0a20460c`. [Deployment 39696545765](https://github.com/indii-music-founder/indii-music-founder/actions/runs/39696545765) completed successfully; full production logs were inspected, including Hosting and workers serving 100% traffic. After reconnecting browser control and normal user sign-in, the published editor reopened the saved artist cover and passed Fit→2×→4×→Fit. The source center changed by less than two source pixels from integer scroll rounding, compared with roughly 35 pixels before repair. A scrolled detail returned to exactly the same measured center after 4×→2×→4×, and Fit restored the original viewport. Measurements: `artist-cutout-zoom-center-production.json`; screenshot: `artist-cover-final-production.jpg`. The saved artwork was left in Saved state without applying another mask edit.

Production checks used https://app.indii.music/creative and the existing genuinely authenticated account. Account creation was not part of the journey. The creative editor displayed no plan label; no free-tier claim is made and no plan was changed or simulated. No authentication, entitlement, service response, database or application state was injected. Local legacy mock-backed suites are structural evidence only.

| Acceptance check | Genuine UI / artifact evidence |
| --- | --- |
| Real artist composition | A [public-domain Billie Holiday portrait by William P. Gottlieb](https://commons.wikimedia.org/wiki/File%3A%28Portrait_of_Billie_Holiday%2C_Carnegie_Hall%2C_New_York%2C_N.Y.%2C_between_1946_and_1948%29_%28LOC%29_%285020400014%29.jpg) entered through normal Upload Photo. “QA – Billie Holiday – Archive Study” has a masked photo, editable BILLIE HOLIDAY (Montserrat Bold 170, spacing 8), editable ARCHIVE STUDY (70, spacing 12), black 3000px square, Warm Film and grain 0.12. |
| Frame, positioning and stacking | Frame Apply followed a deliberate drag; Undo restored placement. Artist text dragged across the face was visible above the photo and occluded after Backward. Two Undos restored stack and heading. Subject centering and direct photo movement passed one-step undo/redo. |
| Safe revision | Text, style, brightness gesture 0→43, proportional 3000→1080 sizing, framing, movement and cutout passed undo/redo. Saved intended revisions reopened correctly. |
| Persistence and genuine recovery | Inline portrait saving genuinely failed with “Failed to fetch.” Keep draft and close / Restore draft as a copy preserved the real failed document. After #429, Save/Close/Reopen and full browser reload retained all three layers, editable text, source, mask and effects. A fresh normal upload also reached Saved. |
| Saved-mask and precise refinement | Reopening refinement showed the saved mask without a new box. No-stroke preview/apply preserved it. A dog-background remnant was removed and persisted. On the portrait, Keep restored facial detail. At 4×, a 6px-radius Remove mark landed precisely on retained wall beside the sleeve. Apply, one-step Undo/Redo, Save/Close/Reopen and reopened-mask inspection passed. |
| Blur, looks and grain | Warm Film and grain persisted and matched actual exports. Blur 8 softened the photo while text stayed sharp; one-step Undo/Redo and Save/Close/Reopen passed. Actual `canvas-doc_6543-r15.png` retained that appearance. The layered original was restored to blur 0 and saved. |
| Actual exported images | Portrait `canvas-doc_6543-r1.png` / `.jpeg` and dog `canvas-doc_1792-r55.png` / `.jpeg` each showed 3000 × 3000 and decoded to the expected composition. Transparent `canvas-doc_1792-r56.png` changed empty regions against white/black backgrounds, proving alpha. Latest refined `canvas-doc_6543-r27.png` opened directly from Chrome’s completed download in native Preview: 3000 × 3000; small mask correction, lettering, look and grain matched the editor. This is visual agreement, not a bit-exact comparison. |
| Older artwork | Actual “Untitled cover · 10/19/2026, 7:01:39 AM” reopened in Saved state without modification. No version-1 original-recovery control appeared. Pure compatibility tests do not establish a genuine version-1 migration journey. |
| Canvas zoom regression | Reproduced image disappearance after wheel zoom and recovery after pan. Following #425, real assets remained visible through mouse-wheel zoom, toolbar zoom and workspace resize. |

Screenshots remain in the task workspace `outputs/`, including `artist-cover-after-browser-reload.jpg`, `artist-frame-applied.jpg`, `artist-text-above-photo.jpg`, `artist-text-behind-photo.jpg`, `artist-blur-export-inspected.jpg`, `exported-png-alpha-white.jpg`, `exported-png-alpha-black.jpg`, `older-cover-reopened-production.jpg`, and `artist-six-pixel-refinement-{applied,undone,reopened,mask-reopened,export-inspected}.jpg`.

## Compatibility and visual limits

The selected workflow and the scrollbar-center follow-up passed their defined production checks. Every selected feature above has a code destination, defined behavior, dependencies and acceptance evidence.

- Version-1 migration/original-version recovery remains conditionally unverified because the account supplied no applicable real document. Do not fabricate one or claim the structural tests prove that journey.
- Dark portrait edges still include broad wall remnants and an angular lower silhouette. The live test proves precise manual editing, not automatic professional-quality extraction from every source.

Earlier session context records Jev architecture-review use. Raw agreement/token-cost evidence was not retained in inspected artifacts; those metrics are unavailable, not zero. No renderer-side judgment calls or key material entered either precision change.
