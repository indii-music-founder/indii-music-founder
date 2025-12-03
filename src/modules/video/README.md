# Video Module

## Purpose

The Video Module focuses specifically on video production workflows, distinct from the general Creative Module. It handles advanced video features like timeline editing, keyframing, and specific video generation tasks.

## Key Components

### `VideoEditor` (Conceptual)

An interface for arranging video clips, adding audio, and applying effects.

### `FrameSelectionModal`

A utility component for selecting specific frames from a video to use as inputs for other generations (e.g., image-to-video, daisy-chaining).

## Services

- `VideoGenerationService`: The backend service powering video creation.
- `VideoService`: (Legacy/Alternative) service for video operations.
