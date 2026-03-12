---
description: 10,000-click full-app stress test using the browser subagent
---

# 10,000-Click Full-App Stress Test

A comprehensive browser agent stress test that exercises every module, interaction surface, and user flow in indiiOS. The test simulates a real power-user session — from onboarding through production workflow.

## Test Asset Inventory

All test assets live in the repo. **Never use the generate_image tool for album art** — that belongs inside the Creative Director module.

### Images (Realistic User Materials)
| Asset | Path | Use Case |
|-------|------|----------|
| Portrait 1 (Transit) | `cypress/fixtures/persona/1_establishing_transit.png` | Headshot upload, brand assets |
| Portrait 2 (Raw) | `cypress/fixtures/persona/2_raw_portrait.png` | Profile photo, press kit |
| Portrait 3 (Studio) | `cypress/fixtures/persona/3_studio_session.png` | EPK photo, social media |
| Portrait 4 (Live Gig) | `cypress/fixtures/persona/4_live_gig.png` | Brand assets, marketing |
| Portrait 5 (Selfie) | `cypress/fixtures/persona/5_clean_selfie.png` | Profile avatar |
| Max Portrait 1-5 | `cypress/fixtures/persona/max_*.png` | Alternate persona photos |
| App Screenshot 1 | `public/brand/screenshot-agent.png` | Style reference upload |
| App Screenshot 2 | `public/brand/screenshot-creative.png` | Style reference upload |
| Banner | `docs/assets/indiios-banner-v3-teal-square.png` | Brand asset upload |

### Audio
| Asset | Path | Use Case |
|-------|------|----------|
| Test Audio WAV | `cypress/fixtures/persona/test_audio.wav` | Audio Analyzer upload |
| Sample MP3 (6s) | `assets/audio/sample-6s.mp3` | Quick audio test |
| Soul Test WAV | `assets/audio/soul_test.wav` | Audio analysis |
| Fading Echoes MP3 | `test-fixtures/audio/Fading Echoes ext v2.2.mp3` | Full track test |
| What To Come WAV | `test-fixtures/audio/What To Come.wav` | Full track analysis |

### Generating New Assets (When Needed)
- **Headshots/Press Photos:** Use `generate_image` tool — these are real-world user uploads
- **Album Art:** Create inside the app using Creative Director module — this IS the product
- **Video:** Create inside the app using Video Producer module
- **Brand Logos:** Generate with `generate_image` — users would bring their own

## Module Test Matrix (29 Modules × ~345 clicks each = ~10,000)

// turbo-all

### Phase 1: Dashboard (500 clicks)
- Navigate to Dashboard
- Click every card, chart, stat widget
- Expand/collapse sections
- Click notification items
- Click quick action buttons
- Resize viewport 3x (mobile/tablet/desktop)
- Rapid scroll up/down
- Click sidebar items
- Toggle sidebar collapse/expand 5x

### Phase 2: Brand Manager (500 clicks) — COMPLETED IN 200-CLICK TEST
- Brand Interview AI chat (send 10 messages)
- Identity Core (bio, career stage, social links, fonts, colors)
- Visual DNA (palette, typography, aura, asset management)
- Release Manifest (metadata, tracklist CRUD)
- Brand Health (audit, map, divergence analysis)
- Tab cycling × 10 full cycles
- Cross-module navigation × 5 round trips

### Phase 3: Creative Director (800 clicks)
- Navigate to Creative Director
- Open prompt input, type generation prompts
- Click style presets/options
- Expand/collapse sidebar panels
- Click all toolbar buttons
- Upload persona photos as reference images (from cypress/fixtures/persona/)
- Generate images via the AI (test the actual product flow)
- Click canvas tools (zoom, pan, layers)
- Gallery management (select, delete, favorite)
- Resolution/aspect ratio selectors
- Rapid generation queue stress test

### Phase 4: Video Producer (500 clicks)
- Navigate to Video Producer
- Click all timeline controls
- Click all toolbar items
- Test template selection
- Text overlay editing
- Duration/format selectors
- Export settings panel
- Preview controls (play/pause/scrub)

### Phase 5: Distribution (600 clicks)
- Navigate to Distribution
- Release wizard (step through all phases)
- Distributor selection checkboxes
- ISRC/UPC field editing
- Territory selection (region checkboxes)
- Pricing tier selection
- Cover art upload (from persona assets)
- Track upload (from test-fixtures/audio)
- Metadata validation
- Date picker interactions
- Pipeline status views

### Phase 6: Finance (400 clicks)
- Navigate to Finance
- Revenue chart interactions (hover, click data points)
- Date range selectors
- Export buttons
- Transaction list scrolling/sorting
- Royalty split editing
- Payment method management

### Phase 7: Campaign Manager (400 clicks)
- Navigate to Campaign Manager
- Create campaign flow
- Target audience selectors
- Budget sliders
- Content preview
- Calendar interactions
- Campaign status toggles
- A/B test setup

### Phase 8: Social Media (400 clicks)
- Navigate to Social
- Platform connection toggles
- Post composer
- Schedule calendar
- Analytics charts
- Content library browsing
- Caption generator

### Phase 9: Publishing (400 clicks)
- Navigate to Publishing
- Rights management forms
- Split sheet editing
- Catalog browsing
- Search/filter
- Deal terms
- Document previews

### Phase 10: Legal (400 clicks)
- Navigate to Legal
- Contract review
- Template selection
- Clause editing
- Term toggling
- Signature workflow
- Document management

### Phase 11: Road Manager (500 clicks)
- Navigate to Road
- Map interactions
- Venue search
- Tour calendar
- Budget tracking
- Routing tools
- Gas/food/hotel quick actions

### Phase 12: Agent Workspace / Booking Agent (400 clicks)
- Navigate to Agent
- Agent scout interface
- Specialist agent delegation
- Task history
- Chat interface
- Tool panel interactions

### Phase 13: Audio Analyzer (500 clicks)
- Navigate to Audio Analyzer
- Upload test audio files (from assets/audio/ and test-fixtures/audio/)
- Waveform interactions
- Analysis results browsing
- Comparison tools
- Export/share buttons

### Phase 14: Workflow Builder (400 clicks)
- Navigate to Workflow
- Node creation (drag/click)
- Connection drawing
- Node configuration panels
- Execution controls
- Template loading

### Phase 15: Merch Tool (300 clicks)
- Navigate to Merch
- Product browser
- Design customization
- Pricing setup
- Inventory management

### Phase 16: Publicist (400 clicks)
- Navigate to Publicist
- EPK builder
- Press release composer
- Media list management
- Pitch drafting

### Phase 17: Licensing (300 clicks)
- Navigate to Licensing
- License type selection
- Terms configuration
- Catalog management

### Phase 18: Knowledge Base (300 clicks)
- Navigate to Knowledge
- Article browsing
- Search functionality
- Category navigation

### Phase 19: Memory Agent (300 clicks)
- Navigate to Memory
- Memory feed scrolling
- Search memories
- Filter/category toggles
- Memory detail views

### Phase 20: Cross-Module Stress (800 clicks)
- Rapid module switching (all 20+ modules, 5 cycles)
- Sidebar collapse/expand during navigation
- Command bar (⌘K) open/close/search
- Theme toggle if available
- Viewport resize cycling (5 sizes)
- Keyboard navigation (Tab × 50, Shift+Tab × 50)
- Right panel toggle (chat overlay open/close/minimize × 10)

## Execution Strategy

Each phase runs as a separate `browser_subagent` call. After each phase:
1. Take a verification screenshot
2. Log the click count
3. Verify no white screen / crash
4. Continue to next phase

## Running the Test

1. Ensure dev server is running: `npm run dev` (port 4242)
2. Tell Antigravity: "Run the 10,000-click test"
3. Agent will execute each phase sequentially
4. Final report artifact with all recordings will be generated

## Success Criteria

- **Zero crashes** across all 10,000 clicks
- **Zero white screens** during module transitions
- **Zero state corruption** (data persists across tab/module switches)
- **< 50 critical console errors** (exclude known Firebase/network noise)
- **All 20+ modules reachable** from sidebar navigation
- **All uploaded files processed** without blocking
