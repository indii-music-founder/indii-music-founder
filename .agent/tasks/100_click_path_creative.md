# 🖱️ Click Path: 100 Interactions in Creative Studio

**Goal:** Execute and verify a 100-click workflow starting from the Video Producer, covering creation, editing, and showroom workflows.

## Path Log

| Id | Action | Target (data-testid) | Data | Feedback/State |
|---|---|---|---|---|
| 1 | Click "Video Producer" Sidebar | `nav-video-producer` | - | Module: Creative Studio (Video) |
| 2 | Toggle "Director" Mode | `mode-director-btn` | - | State: Director Active |
| 3 | Focus Scene Prompt | `scene-prompt-input` | - | Input ready |
| 4 | Type Scene Prompt | `scene-prompt-input` | "Cinematic fly-through of a neon forest" | Value updated |
| 5 | Open Resolution Dropdown | `resolution-select` | - | Dropdown open |
| 6 | Select "4K" | `resolution-option-4k` | - | Selected: 4K |
| 7 | Open Aspect Ratio Dropdown | `aspect-ratio-select` | - | Dropdown open |
| 8 | Select "16:9" | `aspect-ratio-option-16-9` | - | Selected: 16:9 |
| 9 | Click "Add New Shot" | `add-shot-btn` | - | Shot List: 1 item |
| 10 | Edit Shot Name | `shot-name-0` | "The Arrival" | Name updated |
| 11 | Click "Zoom In" | `camera-zoom-in` | - | Camera State: Zoom In |
| 12 | Adjust Motion Slider | `motion-slider` | 80 | Motion: 80 |
| 13 | Click "Render Sequence" | `render-sequence-btn` | - | State: Rendering... |
| 14 | Open Dailies Bin | `dailies-bin-toggle` | - | Sidebar open |
| 15 | Select First Daily Item | `daily-item-0` | - | Selection active |
| 16 | Click "Set as Entity Anchor"| `set-anchor-btn` | - | Toast: "Entity Anchor Set" |
| 17 | Click "Set as End Frame" | `set-end-frame-btn` | - | Toast: "Set as End Frame" |
| 18 | Toggle "Editor" Mode | `mode-editor-btn` | - | State: Editor Active |
| 19 | Click Timeline Region | `timeline-viewport` | - | Timeline focused |
| 20 | Click "Export Project" | `export-btn` | - | Export Modal open |

| 21 | Click "Play" | `timeline-play-pause` | - | Timeline Playing |
| 22 | Click "Pause" | `timeline-play-pause` | - | Timeline Paused |
| 23 | Click "Skip to Start" | `timeline-skip-start` | - | Time: 00:00:00 |
| 24 | Click "Add Track" (Top) | `timeline-add-track-top` | - | Tracks count increased |
| 25 | Click "Add Text Clip" (Track 1) | `track-add-text-[id]` | - | Text clip added |
| 26 | Expand Clip Details | `clip-expand-[id]` | - | Keyframe editor visible |
| 27 | Collapse Clip Details | `clip-expand-[id]` | - | Keyframe editor hidden |
| 28 | Click "Add Video Clip" (Track 1) | `track-add-video-[id]` | - | Video clip added |
| 29 | Toggle Track Mute | `track-toggle-mute-[id]` | - | Track muted |
| 30 | Toggle Track Visibility | `track-toggle-visibility-[id]` | - | Track hidden |
| 31 | Click "Add Audio Clip" (Track 1) | `track-add-audio-[id]` | - | Audio clip added |
| 32 | Remove Clip | `clip-remove-[id]` | - | Clip removed |
| 33 | Remove Track | `track-delete-[id]` | - | Track removed |
| 34 | Click "Add Track" (Bottom) | `timeline-add-track-bottom` | - | Tracks count increased |
| 35 | Click "Open Projector" | `open-projector-btn` | - | Projector Window open |
| 36 | Click "Export Video" | `video-export-btn` | - | Export started/modal |
| 37 | Navigate to "Showroom" | `nav-showroom` | - | Module: Showroom |
| 38 | Select "T-Shirt" Product | `showroom-product-t-shirt` | - | Preview: T-Shirt |
| 39 | Select "Hoodie" Product | `showroom-product-hoodie` | - | Preview: Hoodie |
| 40 | Upload Design Asset | `showroom-upload-input` | "logo.png" | Asset uploaded |
| 41 | Select Placement "Front" | `placement-front` | - | Placement: Front |
| 42 | Select Placement "Back" | `placement-back` | - | Placement: Back |
| 43 | Type Motion Prompt | `motion-prompt-input` | "360 degree spin" | Input updated |
| 44 | Click "Generate Mockup" | `generate-mockup-btn` | - | Generating... |
| 45 | Click "Animate Mockup" | `animate-mockup-btn` | - | Video generating... |
| 46 | View Generated Details | `view-details-btn` | - | Details modal open |
| 47 | Add to Information | `add-to-info-btn` | - | Added to info |
| 48 | Close details modal | `close-modal-btn` | - | Modal closed |
| 49 | Navigate to "Creative Canvas" | `nav-creative-canvas` | - | Module: Creative Canvas |
| 50 | Select Brush Tool | `tool-brush` | - | Cursor: Brush |

*To be continued...*
