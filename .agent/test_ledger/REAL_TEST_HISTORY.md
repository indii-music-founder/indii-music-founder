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

## 2026-04-20 - Detroit Producer - Multi-Module Navigation & Regression Run
- **Modules Tested:** Creative Director (GENERATE, CANVAS)
- **Duration:** ~15 minutes (Interrupted)
- **Findings:**
  - Verified fix for ISSUE-007: IMAGE/VIDEO toggle now has clear visual distinction (gradient/glow for active mode).
  - Verified fix for ISSUE-008: 4K video selection properly notifies user and downgrades to 1080p.
  - Verified fix for ISSUE-010: REFINE button now displays a lock icon when unauthenticated.
  - Verified fix for ISSUE-004: "Send to Video", "Create Last Frame", and "Animate" buttons are now present in the Canvas toolbar.
  - Successfully generated TR-909 image and verified it populates the Project Assets sidebar.
- **Coverage Delta:**
  - ✅ Regression test: IMAGE/VIDEO toggle
  - ✅ Regression test: 4K video feedback
  - ✅ Regression test: Auth requirement for Magic Edit
  - ✅ First test: Canvas toolbar action buttons
- **UX Score:** N/A (Partial Run)

---

## 2026-04-22 — Detroit Producer — Creative Director Smoke Test (Post-Hardening)

- **Modules Tested:** Creative Director (Generate, Canvas, History), Boardroom (navigation only), Agent Chat
- **Duration:** ~4 minutes
- **Persona:** Detroit Producer
- **Scenario:** Post-hardening sprint smoke test — prompt → image → canvas → navigation persistence → agent chat
- **Findings:** 4 issues (1 HIGH, 2 MEDIUM, 1 LOW)
- **Key Issues:**
  - ISSUE-011: Active canvas + prompt cleared when navigating away to major module
  - ISSUE-012: Success toast fires simultaneously with canvas transition — unreadable (user-reported)
  - ISSUE-013: Boardroom overlay requires explicit "Exit" click to return to Studio view
  - ISSUE-014: Generate button icon-only — no text label or tooltip for discoverability
- **Coverage Delta:**
  - ✅ Regression: Direct generation pipeline end-to-end
  - ✅ Regression: Auto-push to canvas on generation complete
  - ✅ First test: Agent chat "What tools do you have?" query in Creative module
  - ✅ First test: History tab persistence after navigation away/back
- **UX Score:** 23/30
- **Recording:** creative_real_smoke_test_1776863122145.webp
- **Issues Filed:** ISSUE-011 through ISSUE-014

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

---

## 2026-05-02 - Detroit Producer - Deep-Interaction Core Phases Stress Test
- **Modules Tested:** Dashboard, Brand Manager, Creative Director, Video Workflow
- **Duration:** ~10 minutes
- **Findings:** 1 issue filed (0 HIGH, 0 MEDIUM, 1 LOW). ISSUE-015 successfully verified as FIXED.
- **Key Issues:**
  - ISSUE-016: Persistent "Drop files here" overlay in Creative Director
- **Coverage Delta:**
  - ✅ Regression test: 3D SceneBuilder Stability (ISSUE-015)
  - ✅ First test: Brand Manager Identity Bio editing and AI Chat
  - ✅ First test: Video mode camera motion and aspect ratio dropdowns
  - ✅ First test: Drag-and-drop from gallery to Sequence Architect
- **UX Score:** 30/30
- **Issues Filed:** ISSUE-016

## 2026-05-02 - Detroit Producer - Creative Director Edge Case Testing
- **Modules Tested:** Creative Director, Boardroom
- **Duration:** 4 minutes
- **Findings:** 3 HIGH, 1 MEDIUM
- **Key Issues:** Prompt state loss on mode toggle, Boardroom trap, Z-index bleeding.
- **Coverage Delta:** State persistence and character references tested thoroughly.
- **UX Score:** 18/30

## 2026-05-02 - Detroit Producer - Universal Deep-Interaction Stress Test
- **Modules Tested:** Dashboard, Brand Manager, Creative Director, Boardroom
- **Duration:** 17 minutes
- **Findings:** 2 CRITICAL, 1 HIGH, 1 MEDIUM
- **Key Issues:** Global state lost on reload, Vite resolution failure on reload, UI lag on tabs.
- **UX Score:** NO-GO for Demo

## 2026-05-02 - Detroit Producer - Brand Interview Logic Test
- **Modules Tested:** Brand Manager (Brand Interview)
- **Duration:** 5 minutes
- **Findings:** 1 HIGH
- **Key Issues:** AI returns empty bubbles due to Firebase permission-denied / empty responses.
- **Coverage Delta:** Validated function call extraction (failed gracefully but exposed backend error).
- **UX Score:** 15/30

## 2026-05-03 - Detroit Producer - Primary Goal & Career Stage Verification
- **Modules Tested:** Brand Manager (Identity Core, Visual DNA, Release Manifest, Brand Health, Brand Interview), Creative Director (navigation persistence), Marketing Department, Road Manager
- **Duration:** ~10 minutes
- **Findings:** 0 new issues. 2 pre-existing regressions confirmed still open (ISSUE-022, ISSUE-025).
- **Key Issues:**
  - ✅ Primary Goal selector: functional, persistent, AI-wired
  - ✅ Career Stage selector: functional, persistent, AI-wired
  - ⚠️ ISSUE-022 (Brand Interview tab lag): still present
  - ⚠️ ISSUE-025 (Brand Interview empty bubbles): still present
- **Coverage Delta:**
  - ✅ First test: Primary Goal dropdown selection + persistence across navigation
  - ✅ First test: Career Stage change + persistence across navigation
  - ✅ First test: Marketing Department (Campaign Generator, EPK Generator)
  - ✅ First test: Road Manager (Tour Planning, Tech Rider, Hospitality Rider)
  - ✅ Regression: Brand Interview tab rendering
- **UX Score:** 27/30

---

## 2026-05-03 - Detroit Producer - Recent Fixes Regression Test
- **Modules Tested:** Creative Director, Boardroom, Brand Manager
- **Duration:** 3 minutes
- **Findings:** 1 HIGH regression remaining.
- **Key Issues:**
  - ✅ ISSUE-017 (Boardroom Z-Index Bleed): FIXED
  - ✅ ISSUE-018 (Direct Generation Prompt Persistence): FIXED
  - ✅ ISSUE-020 (Boardroom Trap): FIXED
  - 🔴 ISSUE-028 (Brand Manager State Persistence): OPEN (Local-first logic needs further work to sync component inputs)
- **Coverage Delta:**
  - ✅ Regression: Creative Director Image/Video Mode Toggle Prompt Persistence
  - ✅ Regression: Boardroom Overlay Hierarchy and Exit Button
  - ✅ Regression: Brand Manager Identity Core field entry followed by Hard Reload
- **UX Score:** 28/30
