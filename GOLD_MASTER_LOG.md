# Rndr-AI Gold Master Log

**Status:** STABLE / LOCKED
**Deployment Type:** Video Studio Unification & Gemini 3 Pro Upgrade
**Date:** 2025-11-29

## 🚨 Critical Architecture Rules (DO NOT CHANGE)

The following configurations are required to maintain mobile responsiveness on iOS devices (iPhone/iPad). **Do not modify these unless explicitly fixing a verified bug.**

### 1. Viewport Settings

* **Meta Tag:** Must include `width=device-width`, `initial-scale=1.0`, `maximum-scale=1.0`, and `viewport-fit=cover`.
* **Scaling:** `user-scalable=no` is required to prevent UI shifting during gestures.

### 2. CSS Layout Constraints

* **Root Width:** `html` and `body` must be set to `width: 100%` (NEVER `100vw` as this triggers horizontal scrollbars on Windows/Linux).
* **Overflow:** `overflow-x: hidden` must be applied to `html` to physically prevent the "zoomed out" effect.
* **Media Elements:** `img`, `video`, `canvas` must have `max-width: 100%`.
* **Flex Wrappers:** All toolbars (Prompt Header, Studio Mode Bar) must use `flex-wrap` to allow graceful stacking on small screens.

### 3. Feature Manifest (Current UI State)

* **Unified Creative Studio:**
  * **Navigation:** Single `CreativeNavbar` with global "Image" / "Video" mode toggle.
  * **View Switching:** "Gallery" button added to sub-menu; redundant "View Toggle Bar" removed.
  * **Agent Window:** "Holster" position locked to `top-28 left-20`. Draggable but resets to holster.

* **Studio Modes:**
  * **Image Mode:**
    * **Gallery:** Asset management and history.
    * **Canvas:** Infinite spatial grid.
    * **Showroom:** Product visualization.
  * **Video Mode:**
    * **Workflow:** 4-Step AI Director (Idea -> Briefing -> Production -> Result).
    * **Composition:** First/Last Frame, Daisy Chain, Time Offset.
    * **AI Model:** **Gemini 3 Pro Preview** with `thinking_level: "high"` for Director/Briefing.

* **Workflow Tools:**
  * **Prompt Builder:** Collapsible accordion with technical tags.
  * **Studio Control Panel:** Global settings (Resolution, Aspect Ratio, Seed).
  * **Brand Kit:** Integrated color palette and asset drawer.

* **AI Infrastructure:**
  * **Text/Reasoning:** Gemini 3 Pro Preview (High Thinking).
  * **Onboarding:** Gemini 3 Pro Preview (High Thinking).
  * **Video Generation:** Veo 3.1 (via ImageService).

## 4. Recovery Instructions

If the UI breaks again:

1. Revert `index.css` to the state defined in this log.
2. Ensure the `hidden-processor` div in `index.html` has `w-0 h-0` and `overflow-hidden`.
3. Check that no element has a fixed width greater than `100vw`.

---
*This document serves as the source of truth for the Rndr-AI application state.*
