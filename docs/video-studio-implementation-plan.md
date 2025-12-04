# Video Studio Implementation Plan

This document outlines the roadmap for completing the **Video Studio** in `indiiOS`, covering both the backend export infrastructure and advanced editing features.

## Overview

The goal is to transform the current "Remotion Studio" prototype into a fully functional video production suite. This involves two parallel tracks:

1. **Export Engine**: Enabling users to render their compositions into actual MP4 files.
2. **Advanced Editor**: Adding professional features like transitions, effects, and audio visualization.

---

## Phase 1: Export Infrastructure (Backend Rendering)

We will implement a **Local Rendering Service** first. This allows for immediate, zero-cost rendering using the machine's resources, which is ideal for the current development environment. We will structure this to be easily swappable with **Remotion Lambda** for future cloud scalability.

### 1.1. Backend API Setup

* **Endpoint**: Create `/api/video/render` to handle render requests.
* **Technology**: Use `@remotion/renderer` (specifically `renderMedia`) within a Node.js/Next.js server context.
* **Process**:
    1. Receive the `VideoProject` JSON payload from the frontend.
    2. Validate assets and composition settings.
    3. Trigger the render process using the bundled FFMPEG.
    4. Store the output file in a temporary public directory or upload to Firebase Storage.

### 1.2. Progress Tracking

* **Endpoint**: Create `/api/video/status/[renderId]` (or use a shared state if keeping it simple).
* **UI**: Add a "Rendering..." modal with a progress bar in the Editor.
* **Feedback**: Poll the status endpoint to update the progress bar in real-time.

### 1.3. Download & Save

* **Action**: Once rendering is complete, provide a "Download MP4" button.
* **Integration**: Automatically save the rendered video to the `generatedHistory` in the global store so it appears in the Gallery.

---

## Phase 2: Advanced Editing Features (Frontend Experience)

We will enhance the `VideoEditor` component to support richer creative expression.

### 2.1. Transitions System

* **Data Model**: Update `VideoClip` interface to include `transitionIn` and `transitionOut` properties (e.g., `fade`, `slide`, `wipe`).
* **Rendering**: Create a `TransitionWrapper` component in the Remotion composition that applies the selected transition logic based on the clip's overlap or edges.
* **UI**: Add a "Transitions" tab in the Properties Sidebar to select transition types and durations.

### 2.2. Visual Effects (VFX)

* **Data Model**: Add an `effects` array to `VideoClip` (e.g., `{ type: 'blur', intensity: 10 }`).
* **Rendering**: Implement effect filters using CSS filters or Remotion's `<AbsoluteFill>` with style props.
* **UI**: Add an "Effects" section in the Properties Sidebar with sliders for parameters (Blur, Opacity, Grayscale, Sepia).

### 2.3. Audio Visualization

* **Feature**: Display actual audio waveforms on audio clips in the timeline instead of generic blocks.
* **Tech**: Use `@remotion/media-utils` to generate waveforms from audio URLs.
* **Benefit**: Makes syncing video to beat/speech significantly easier.

### 2.4. Keyframe Animation (Basic)

* **Feature**: Allow properties like `scale`, `opacity`, and `position` to be animated over time.
* **UI**: Simple "Start" and "End" values for properties in the sidebar (e.g., "Zoom In" effect: Scale 1.0 -> 1.2).

---

## Phase 3: Polish & Integration

### 3.1. Performance Optimization

* **Memoization**: Optimize the Timeline rendering to handle many clips without lag.
* **Proxies**: Use lower-resolution proxies for the preview player if editing 4K content.

### 3.2. Asset Management

* **Media Library**: Integrate the `CreativeGallery` directly into the Editor's sidebar for drag-and-drop asset insertion.

---

## Execution Order

1. **Step 1**: Implement **Phase 1 (Export)**. A video editor is useless if you can't get the video out.
2. **Step 2**: Implement **Phase 2.1 & 2.2 (Transitions & Effects)**. High impact visual upgrades.
3. **Step 3**: Implement **Phase 2.3 (Audio Waveforms)**. Crucial for "music video" style editing.
