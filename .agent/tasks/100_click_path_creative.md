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

*To be continued...*
