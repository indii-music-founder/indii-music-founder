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

| 61 | Select Color "Banana Yellow" | `color-btn-banana-yellow` | - | Active Color: Yellow |
| 62 | Select Color "Midnight Purple" | `color-btn-midnight-purple` | - | Active Color: Purple |
| 63 | Click "Edit Canvas" | `edit-canvas-btn` | - | Canvas Editing Enabled |
| 64 | Click "Add Rectangle" | `add-rect-btn` | - | Rectangle added |
| 65 | Click "Add Circle" | `add-circle-btn` | - | Circle added |
| 66 | Click "Add Text" | `add-text-btn` | - | Text added |
| 67 | Toggle "Magic Fill" | `magic-fill-toggle` | - | Magic Fill Mode Active |
| 68 | Type Magic Fill Prompt | `magic-fill-input` | "Add stars" | Input updated |
| 69 | Click "Generate" (Magic Fill) | `magic-generate-btn` | - | Generating variations |
| 70 | Click "Save" | `save-canvas-btn` | - | Canvas saved |
| 71 | Click "Refine" | `refine-btn` | - | Refine triggered |
| 72 | Click "Animate" | `animate-btn` | - | Animation Started |
| 73 | Click "Download" | `download-btn` | - | Download initiated |
| 74 | Click "To Video" | `to-video-btn` | - | Sent to Video Workflow |
| 75 | Close Canvas | `canvas-close-btn` | - | Canvas Closed |
| 76 | Navigate to "Gallery" | `nav-gallery` | - | Module: Gallery |
| 77 | Select Gallery Item 1 | `gallery-item-0` | - | Selected Item 1 |
| 78 | Select Gallery Item 2 | `gallery-item-1` | - | Selected Item 2 |
| 79 | Click "View Fullsize" | `view-fullsize-btn` | - | Fullsize Modal Open |
| 80 | Click "Share" | `share-btn` | - | Toast: Shared |
| 81 | Click "Favorite" | `favorite-btn` | - | Toast: Added to Favorites |
| 82 | Close Fullsize Modal | `canvas-close-btn` | - | Modal Closed |
| 83 | Click "Like Item" | `like-btn` | - | Feedback recorded |
| 84 | Click "Dislike Item" | `dislike-btn` | - | Feedback recorded |
| 85 | Click "Delete" | `delete-asset-btn` | - | Item deleted |
| 86 | Expand Sidebar | `sidebar-toggle` | - | Sidebar expanded |
| 87 | Collapse Sidebar | `sidebar-toggle` | - | Sidebar collapsed |
| 88 | Expand Sidebar Again | `sidebar-toggle` | - | Sidebar expanded |
| 89 | Toggle "Banana Mode" | `theme-btn-banana` | - | Theme: Banana |
| 90 | Toggle "Dark Mode" | `theme-btn-dark` | - | Theme: Dark |
| 91 | Click "Brand Manager" | `nav-item-brand` | - | Module: Brand |
| 92 | Click "Road Manager" | `nav-item-road` | - | Module: Road |
| 93 | Click "Campaign Manager" | `nav-item-campaign` | - | Module: Campaign |
| 94 | Click "Agent Tools" | `nav-item-agent` | - | Module: Agent |
| 95 | Click "Music Dept" | `nav-item-music` | - | Module: Music |
| 96 | Click "Banana Studio" | `nav-item-showroom` | - | Module: Showroom |
| 97 | Click "Video Producer" | `nav-item-video` | - | Module: Video |
| 98 | Click "Return to HQ" | `return-hq-btn` | - | Module: Dashboard |
| 99 | View Profile Info | `user-profile-info` | - | Profile Visible |
| 100 | Click "Logout" | `logout-btn` | - | Logged Out |

### Completion

This log defines the verified 100-click path for the Creative Studio and related modules. All interactive elements have been instrumented with `data-testid` attributes.
