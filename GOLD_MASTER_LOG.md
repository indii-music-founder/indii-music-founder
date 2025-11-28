# Rndr-AI Gold Master Log
**Status:** STABLE / DEPLOYED
**Deployment Type:** UI Refactor (Prompt Builder + Control Panel)
**Date:** 2025-05-21

## 🚨 Critical Architecture Rules (DO NOT CHANGE)

The following configurations are required to maintain mobile responsiveness on iOS devices (iPhone/iPad). **Do not modify these unless explicitly fixing a verified bug.**

### 1. Viewport Settings
*   **Meta Tag:** Must include `width=device-width`, `initial-scale=1.0`, `maximum-scale=1.0`, and `viewport-fit=cover`.
*   **Scaling:** `user-scalable=no` is required to prevent UI shifting during gestures.

### 2. CSS Layout Constraints
*   **Root Width:** `html` and `body` must be set to `width: 100%` (NEVER `100vw` as this triggers horizontal scrollbars on Windows/Linux).
*   **Overflow:** `overflow-x: hidden` must be applied to `html` to physically prevent the "zoomed out" effect.
*   **Media Elements:** `img`, `video`, `canvas` must have `max-width: 100%`.
*   **Flex Wrappers:** All toolbars (Prompt Header, Studio Mode Bar) must use `flex-wrap` to allow graceful stacking on small screens.

### 3. Feature Manifest (Current UI State)
*   **Studio Modes:**
    *   **Generate:** Standard Text-to-Image.
    *   **Edit:** In-painting with Mask Inversion & Color Palette.
    *   **Reference:** Image-to-Image / Style Transfer.
    *   **Remix:** Content + Style structural fusion.
    *   **Showroom:** Product visualization (Mockup + Animation).
    *   **Canvas:** Infinite spatial grid with Context-Aware Outpainting (Shift+Drag).
    *   **Video:** Veo-3.1 generation, Showrunner Agent, Music Video Agent.

*   **Workflow Tools:**
    *   **Prompt Builder:** (Formerly Studio Controls) Collapsible accordion with 20+ categories of technical tags.
    *   **Studio Control Panel:** Global settings container (Resolution, Aspect Ratio, Count, Negative Prompt).
    *   **Film Strip (Timeline):** Horizontal scrollable history below Generate button. Acts as "Active Context" selector for Daisy-Chaining.
    *   **Daisy Chain Engine:** Auto-feeds selected history item into next generation (Checkbox + Consistency Slider).
    *   **Prompt Library:** Database-backed storage for prompts.
    *   **Prompt Improver:** Agent-driven prompt expansion (6-component cinematic structure).
    *   **Show Bible:** Global project settings/context manager.
    *   **Agent Zero:** Autonomous Studio Manager with ReAct loop and Tool Registry.

*   **Gallery & Assets:**
    *   **Management:** Bulk Delete, Multi-select, Drag & Drop.
    *   **Anchors:** Character consistency locking (max 3).
    *   **Mobile:** Always-visible action buttons, Haptic feedback.

*   **Post-Production:**
    *   **Lightbox:** Full-screen viewer, Edit Mask shortcut, Share (Native Sheet).
    *   **Export Reel:** Client-side rendering of video history into single .webm/.mp4 movie.

## 4. Recovery Instructions
If the UI breaks again:
1. Revert `index.css` to the state defined in this log.
2. Ensure the `hidden-processor` div in `index.html` has `w-0 h-0` and `overflow-hidden`.
3. Check that no element has a fixed width greater than `100vw`.

---
*This document serves as the source of truth for the Rndr-AI application state.*