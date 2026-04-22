# Open Issues — Real-Life Test Findings

> This file is written by the `/real` test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
> 
> **How it works:**
> 1. Test agent runs `/real` → finds issues → appends them here
> 2. Fix agent reads this file → patches code → marks issues `FIXED`
> 3. Test agent runs `/real` again → verifies fixes → removes or confirms
>
> **Last updated:** 2026-04-19T17:17:00Z
> **Current UX Score:** 25/30 → Pending retest after fixes — Target: 30/30

---

## Score Breakdown

| Dimension | Score | Blocking Issues |
|-----------|-------|-----------------|
| Navigation Clarity | 3/5 | ISSUE-001 (FIXED), ISSUE-002 |
| Action Discoverability | 4/5 | ISSUE-003 |
| Cross-Module Asset Flow | 3/5 | ISSUE-004, ISSUE-005 |
| State Persistence | 4/5 | ISSUE-006 |
| Error Communication | 3/5 | ISSUE-007 (FIXED), ISSUE-008 (FIXED) |
| Click Efficiency | 5/5 | — |
| **Overall** | **25/30** | |

---

### ISSUE-001: Sidebar link hit zones are too small
- **Status:** FIXED
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Navigation Clarity
- **Module:** Global (Sidebar)
- **Found:** 2026-04-19 by Detroit Producer
- **Fixed:** Sidebar.tsx — widened NavItem button from `w-[calc(100%-16px)] mx-2 py-2` to `w-[calc(100%-8px)] mx-1 py-2.5`. Larger click target, less margin waste.
- **UX Dimension:** Navigation Clarity
- **Module:** Global (Sidebar)
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Look at the left sidebar
  2. Try to click "Video Producer" — click slightly to the right of the text
  3. Nothing happens. Have to click precisely on the text itself.
  4. Expected: the entire row should be clickable, not just the text label.
- **User Impact:** Feels like the sidebar is broken. You click and nothing happens. Have to try multiple times. Annoying on a trackpad. A first-time user would think the app is buggy.
- **Screenshot:** Sidebar click failure observed during rapid navigation
- **Notes:** Happens across all sidebar items, not just Video Producer. The entire row (icon + label + padding) should be a clickable target.

---

### ISSUE-002: No visual indicator of current module in sidebar besides text highlight
- **Status:** OPEN
- **Severity:** 🟢 LOW
- **UX Dimension:** Navigation Clarity
- **Module:** Global (Sidebar)
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Navigate between multiple modules rapidly
  2. Look at the sidebar to figure out which module you're currently in
  3. The active module has a slightly different text color but no other visual cue
  4. Expected: a strong left-border bar, background highlight, or icon glow on the active item
- **User Impact:** When you're deep in a module, a quick glance at the sidebar should instantly tell you where you are. The current highlight is too subtle — you have to read the text.
- **Screenshot:** Sidebar comparison between active and inactive items
- **Notes:** —

---

### ISSUE-003: Canvas toolbar icons have no tooltips
- **Status:** OPEN
- **Severity:** 🟢 LOW
- **UX Dimension:** Action Discoverability
- **Module:** Creative Director (Canvas)
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Open any image on the Creative Canvas
  2. Look at the vertical toolbar on the left side (rectangle, circle, text, crop, delete, eraser icons)
  3. Hover over any icon
  4. No tooltip appears. You have to guess what each icon does.
  5. Expected: a tooltip like "Rectangle Tool" or "Crop Region" on hover.
- **User Impact:** A first-time user has no idea what the tools do. The icons are abstract enough that you have to click each one to find out. This slows down the creative flow.
- **Screenshot:** Canvas toolbar with mystery icons
- **Notes:** The top toolbar buttons (REFINE, Multi-Format, Save, Create Last Frame, Animate) DO have clear text labels. This is only about the left-side drawing tools.

---

### ISSUE-004: No "Send to Video Producer" action from Creative Director
- **Status:** FIXED
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Cross-Module Asset Flow
- **Module:** Creative Director → Video Producer
- **Found:** 2026-04-19 by Detroit Producer
- **Fixed:** Added "Send to Video", "Create Last Frame", and "Animate" buttons to the Canvas toolbar.
- **Steps to Reproduce:**
  1. Generate an image in Creative Director
  2. Open it on the canvas
  3. Look for a way to send this image to Video Producer as a first frame
  4. There is no button, menu item, or context action for this
  5. Expected: a button like "Send to Video" or "Use as First Frame in Video Producer" somewhere on the canvas or in the image context menu
- **User Impact:** The daisy-chain video workflow (image → first frame → video → extract last frame → next video) is the most powerful creative pipeline in the system. But there's no way to bridge Creative Director to Video Producer without manually downloading and re-uploading the image. This kills the flow.
- **Screenshot:** Canvas showing all available buttons — no "Send to Video" option
- **Notes:** —

---

### ISSUE-005: Video Producer Character Profiles don't suggest Creative Director images
- **Status:** OPEN
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Cross-Module Asset Flow
- **Module:** Video Producer
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Generate images in Creative Director (I had several in my history)
  2. Navigate to Video Producer
  3. Look at "Character Profiles" section on the right panel — shows "0/3 IMAGES"
  4. Click "ADD PERSON" — it only offers file upload
  5. Expected: a dropdown or gallery showing recently generated Creative Director images that can be added as character references with one click
- **User Impact:** The user has to remember which images they made, download them, then re-upload them into Character Profiles. This is busywork that the platform should eliminate. The whole point is that the AI knows what you've made.
- **Screenshot:** Video Producer Character Profiles showing 0/3 with no suggestions
- **Notes:** —

---

### ISSUE-006: Prompt text is not restored when returning to Creative Director
- **Status:** OPEN
- **Severity:** 🟢 LOW
- **UX Dimension:** State Persistence
- **Module:** Creative Director (Generate tab)
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Go to Creative Director GENERATE tab
  2. Type a prompt (don't submit it yet)
  3. Navigate to another module (e.g., Video Producer)
  4. Come back to Creative Director
  5. The prompt field is empty
  6. Expected: the draft prompt should still be there, like a text message draft
- **User Impact:** You lose your work-in-progress prompt. If you were carefully crafting a detailed prompt and accidentally clicked another module, it's gone. Minor, because you'd usually submit before navigating, but still annoying when it happens.
- **Screenshot:** Empty prompt field after returning to Creative Director
- **Notes:** The canvas/editor state now correctly persists (that was fixed). This is specifically about unsaved prompt text in the GENERATE tab's input field.

---

### ISSUE-007: IMAGE/VIDEO mode toggle is easy to accidentally switch
- **Status:** FIXED
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Error Communication
- **Module:** Creative Director (Generate tab)
- **Found:** 2026-04-19 by Detroit Producer
- **Fixed:** DirectGenerationTab.tsx — Active mode now has gradient background, glow shadow, bold text, and border. Inactive mode is clearly dimmed to gray-500. Image uses creative colors, Video uses purple/pink gradient. Impossible to miss which mode is active.
- **UX Dimension:** Error Communication
- **Module:** Creative Director (Generate tab)
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Go to Creative Director GENERATE tab
  2. Intend to generate an IMAGE
  3. The IMAGE/VIDEO toggle sits right above the prompt bar
  4. Click VIDEO accidentally (or don't notice which mode is active)
  5. Submit a prompt — it generates a VIDEO instead of an IMAGE
  6. No confirmation dialog. No "Are you sure you want to generate a video?"
  7. Expected: either (a) stronger visual distinction between modes, or (b) a confirmation when switching modes with a prompt already entered
- **User Impact:** Wasted 20+ seconds generating the wrong type of asset. The toggle looks the same in both states — just text color changes. A real user rushing through their workflow would hit this regularly.
- **Screenshot:** The IMAGE/VIDEO toggle in both states — visually too similar
- **Notes:** —

---

### ISSUE-008: 4K video generation fails silently
- **Status:** FIXED
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Error Communication
- **Module:** Creative Director / Video Producer
- **Found:** 2026-04-19 by Detroit Producer
- **Fixed:** Two-layer fix: (1) VideoGenerationService.ts service-level guard auto-downgrades 4K to 1080p with logger warning — catches ALL call sites. (2) DirectGenerationTab.tsx adds user-facing toast "4K is not yet supported for video. Generating at 1080p instead."
- **UX Dimension:** Error Communication
- **Module:** Creative Director / Video Producer
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Set resolution to 4K in the studio controls
  2. Switch to VIDEO mode (or use Video Producer)
  3. Submit a video generation prompt
  4. Nothing happens. No error message. No toast. Just silence.
  5. Reduce resolution to 1080p → video generates successfully
  6. Expected: Either (a) auto-downscale to 1080p with a toast "4K not supported for video, generating at 1080p", or (b) disable 4K option when in video mode
- **User Impact:** User thinks the system is broken. They have no idea why their video won't generate. They'd probably close the app and try again later. Zero feedback is the worst UX pattern.
- **Screenshot:** Settings panel showing 4K selected with no video output
- **Notes:** —

---

### ISSUE-009: VIDEOS tab in Project Assets shows wrong count badge
- **Status:** OPEN
- **Severity:** 🟢 LOW
- **UX Dimension:** Error Communication
- **Module:** Creative Director (Project Assets panel)
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Generate at least one video
  2. Open the right panel → Project Assets
  3. Look at the tab badges: IMAGES shows a count, VIDEOS shows "1"
  4. Click on VIDEOS tab
  5. Shows "No assets yet" — empty
  6. Expected: Badge should show 0 if there are no videos, or the videos should actually appear
- **User Impact:** Minor trust issue. If the system tells me I have 1 video but there's nothing there, I start wondering what else it's lying about.
- **Screenshot:** VIDEOS tab with "1" badge but empty content
- **Notes:** —

---

### ISSUE-010: Magic Edit/REFINE button doesn't indicate auth requirement
- **Status:** FIXED
- **Severity:** 🟢 LOW
- **UX Dimension:** Error Communication
- **Module:** Creative Director (Canvas)
- **Found:** 2026-04-19 by Detroit Producer
- **Fixed:** CanvasHeader.tsx — REFINE button now shows Lock icon and "Sign in to use Magic Edit" tooltip when auth.currentUser is null. Button is visually dimmed (50% opacity, no glow shadow) to signal it needs authentication.
- **UX Dimension:** Error Communication
- **Module:** Creative Director (Canvas)
- **Found:** 2026-04-19 by Detroit Producer
- **Steps to Reproduce:**
  1. Open an image on the Creative Canvas (works fine in guest mode)
  2. Type an edit prompt in "Magic Edit" field
  3. Click REFINE
  4. Error: "Your session has expired. Please sign in again to edit images."
  5. Expected: if the feature requires sign-in, the REFINE button should either (a) be disabled with a tooltip "Sign in to use Magic Edit", or (b) show a sign-in prompt instead of an error toast
- **User Impact:** The error feels like something is broken, not like a feature gate. A user who's been generating images successfully (which works without auth) wouldn't understand why editing suddenly requires sign-in. The transition from "everything works" to "this one thing needs auth" is jarring.
- **Screenshot:** Error toast after clicking REFINE
- **Notes:** —

---

### ISSUE-011: Canvas state and prompt cleared on module navigation
- **Status:** OPEN
- **Severity:** 🔴 HIGH
- **UX Dimension:** State Persistence
- **Module:** Creative Director
- **Found:** 2026-04-22 by Detroit Producer
- **Steps to Reproduce:**
  1. Open Creative Director → Generate tab
  2. Type a prompt and generate an image
  3. Image auto-pushes to Canvas — canvas is now populated
  4. Navigate away via sidebar (e.g., Marketing Department)
  5. Navigate back to Creative Director
  6. Canvas is blank, prompt is cleared
- **User Impact:** Any in-progress session is wiped on a single navigation click. A real user building something complex would lose all context. Feels like the app crashed.
- **Screenshot:** Canvas blank on return to Creative Director
- **Notes:** History tab preserves past generations — so the data isn't lost, but the active session context is gone.

---

### ISSUE-012: Success toast fires simultaneously with canvas auto-push transition — unreadable
- **Status:** OPEN
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Error Communication
- **Module:** Creative Director (Generate → Canvas transition)
- **Found:** 2026-04-22 by Detroit Producer (user-reported live)
- **Steps to Reproduce:**
  1. Open Creative Director → Generate tab
  2. Type a prompt and click Generate
  3. Wait for generation to complete
  4. A success toast appears ("Image generated directly successfully") at the exact same moment the view transitions to Canvas
  5. Toast is visible for ~2s but the layout shift caused by the canvas transition makes it nearly impossible to read
- **User Impact:** User sees a flash of something but can't read it. Creates anxiety — "was that an error?" The success confirmation is wasted.
- **Screenshot:** Toast appears during canvas transition, user reported they couldn't read it
- **Notes:** Simple fix: delay the toast by ~500ms after the canvas transition completes, or increase toast duration to 4s. Alternatively, show the success state in the Canvas header instead.

---

### ISSUE-013: Boardroom overlay traps the user — no obvious back navigation
- **Status:** OPEN
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** Navigation Clarity
- **Module:** Boardroom
- **Found:** 2026-04-22 by Detroit Producer
- **Steps to Reproduce:**
  1. Click "Boardroom" in the sidebar from any module
  2. Boardroom opens as an overlay/modal experience
  3. Try to navigate back to the previous module
  4. Sidebar links appear to be inactive or hidden behind the overlay
  5. Must find and click an explicit "Exit" or "Close" button
- **User Impact:** The transition in is seamless but the way out is not obvious. Feels like a trap. Real users will hit browser back or get confused.
- **Screenshot:** Boardroom overlay with no visible back navigation
- **Notes:** A persistent "← Back to Studio" or an always-visible close affordance would fix this.

---

### ISSUE-014: Generate button uses icon only — no text label or tooltip
- **Status:** OPEN
- **Severity:** 🟢 LOW
- **UX Dimension:** Action Discoverability
- **Module:** Creative Director (Generate tab)
- **Found:** 2026-04-22 by Detroit Producer
- **Steps to Reproduce:**
  1. Open Creative Director → Generate tab
  2. Look at the submit/generate button at the right end of the prompt bar
  3. The button displays a send/arrow icon with no text label
  4. Hover — no tooltip appears
- **User Impact:** New users won't immediately know this is the Generate button. The icon (send arrow) isn't universally associated with "generate image." A first-time user might type a prompt and not know how to submit it.
- **Screenshot:** Prompt bar with icon-only generate button
- **Notes:** Add a tooltip on hover ("Generate image"), or add a short text label "Generate" that collapses to icon-only on smaller widths.
