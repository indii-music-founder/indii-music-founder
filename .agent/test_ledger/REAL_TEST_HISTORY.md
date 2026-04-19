# Real-Life Test History Ledger

> This file tracks all `/real` test runs for coverage awareness.
> The test agent reads this to decide what to test next.
> Issues go to `OPEN_ISSUES.md` — this file is coverage tracking only.

---

## 2026-04-19 - Detroit Producer - Creative Pipeline Gauntlet
- **Modules Tested:** Creative Director (GENERATE, CANVAS, Settings), Video Producer (Director view, Dailies Bin)
- **Duration:** ~45 minutes
- **Findings:** 10 issues filed (0 HIGH, 5 MEDIUM, 5 LOW)
- **Key Issues:**
  - No "Send to Video" cross-module action (ISSUE-004)
  - IMAGE/VIDEO toggle confusion (ISSUE-007)
  - 4K video fails silently (ISSUE-008)
  - Sidebar hit zones too small (ISSUE-001)
  - Canvas toolbar icons need tooltips (ISSUE-003)
- **Coverage Delta:** 
  - ✅ First test: 4K Pro image generation
  - ✅ First test: Create Last Frame workflow
  - ✅ First test: Animate from canvas
  - ✅ First test: Cross-module asset visibility
  - ✅ First test: State persistence across module navigation
  - ✅ First test: Video Producer Director view + settings
- **UX Score:** 25/30
- **Issues Filed:** ISSUE-001 through ISSUE-010

---

## Untested Areas (For Next Run)
- [ ] Distribution pipeline (upload → DDEX)
- [ ] Audio Analyzer (full DNA extraction)
- [ ] Boardroom agent orchestration
- [ ] Brand Kit → Creative Director integration
- [ ] Finance/Royalty workflows
- [ ] Marketing/Social modules
- [ ] Legal/Licensing modules
- [ ] Publishing dashboard
- [ ] Road Manager / Booking Agent
- [ ] Multi-Format export from canvas
- [ ] Video Producer EDITOR tab
- [ ] Video Producer timeline/editing
- [ ] Knowledge base
- [ ] Onboarding flow
- [ ] Canvas crop tool
- [ ] Canvas inpainting (requires auth)
- [ ] Style transfer
- [ ] Story chain generation
- [ ] Reference Mixer (Subject/Scene/Style)
- [ ] Image Styles presets (Album Cover, Poster, Social, Vinyl, Merch, Promo)
- [ ] Merchandise module
- [ ] File management
- [ ] Settings panel
- [ ] Mobile responsive
- [ ] Keyboard shortcuts
- [ ] Drag-and-drop file upload
