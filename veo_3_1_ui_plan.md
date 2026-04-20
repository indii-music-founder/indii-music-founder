# Veo 3.1 "Ingredients to Video" & Video Editing UI Plan

## Objective
Integrate the Veo 3.1 "Ingredients to Video" and Video Editing capabilities into the Creative Studio. This empowers users to generate highly customized videos using up to 3 reference images (ingredients) for character, pet, and style consistency, as well as providing advanced editing features like Scene Extension and Frame Transitions natively through the Google Generative AI API.

## Core Capabilities Supported (Veo 3.1 via Google API)
1. **Ingredients to Video (Image-to-Video):** Users can supply up to three reference images. These "ingredients" lock in the visual identity of characters, people, pets, instruments, or general composition to ensure consistency across the generated video.
2. **Video Editing - Scene Extension:** Extend an existing Veo video by generating new clips that seamlessly connect to the final second of the previous clip, ensuring narrative and visual continuity.
3. **Frame Transitions:** Specify both a starting frame and an ending frame, directing the model to generate a seamless, audio-synchronized transition between the two.

## UI Scope
- **Location:** A dedicated `VideoStudioTab` within the Creative Studio.
- **Components to Modify/Create:**
  - `VideoPromptBuilder`: A specialized, auto-expanding text area for the video prompt.
  - `IngredientDropZone`: A drag-and-drop area accepting up to 3 images/frames or 1 base video. Thumbnails of uploaded assets will appear here.
    - *Modes:* "Reference Images" (for generation), "Base Video" (for scene extension), "Transition Frames" (Start & End frames).
  - `VideoGenerationControls`: Dropdowns/buttons to configure `aspect_ratio` (16:9, 9:16) and `duration` (e.g., 4s, 8s).
  - `VideoGenerationProgress`: A non-blocking "Task Card" in a sidebar or toaster that shows asynchronous progress (Veo tasks take 2-4 mins), allowing the user to continue working.
  - `VideoPlayer`: A component to playback the generated or edited video natively with synchronized audio.

## Empty States & Edge Cases
- **No Ingredients Uploaded:** The `IngredientDropZone` should look inviting with a dashed border, an icon (like a photo with a plus), and helper text: "Drag up to 3 reference images here to lock in characters, pets, instruments, or styles."
- **Max Ingredients Reached:** The drop zone changes state to indicate it's full (3/3 uploaded). Drop interactions are disabled.
- **Generation In Progress:** The generation happens asynchronously. The progress card shows a pulsing "Generating video..." text with a cancel button.
- **Generation Error:** If the API fails, the progress card turns red, explicitly explains the error (e.g., safety filter tripped, rate limit), and offers a "Retry" button.

## Comprehensive Design Review (10/10 Platinum Standard)

1. **Hierarchy (Service):**
   - **Primary:** The video prompt text area. It must be auto-expanding and clearly the focal point.
   - **Secondary:** The `IngredientDropZone` / `EditingTimeline`. It should be visually distinct (e.g., glassmorphic panels) but not overpower the prompt.
   - **Tertiary:** Settings (aspect ratio, duration) and the final "Generate / Extend" action.
2. **Edge Cases (Paranoia):**
   - **File Format/Size:** Reject invalid formats or images > 10MB immediately with a clean toast notification. Validate that videos used for Scene Extension are compatible.
   - **Safety Filters:** If Veo 3.1 trips a safety filter, the UI must explain exactly *why* rather than showing a generic 500 error.
3. **Empty States:**
   - The drop zone needs warmth: "Drop an image to lock in characters, style, or composition." 
   - Before generation, the Video Player space should have a sleek, subtle placeholder (e.g., a glassmorphism skeleton loader) so the UI doesn't suddenly jump when the video completes.
4. **Typography:**
   - Adhere strictly to the `indiiOS` font system. Use bold, legible text for the generation progress, and muted text for helper copy below the settings.
5. **Responsiveness:**
   - The layout must gracefully reflow if the right panel is resized. The video preview should maintain aspect ratio without breaking flexbox constraints.
6. **Accessibility:**
   - The `IngredientDropZone` must be keyboard-navigable (`tabIndex=0`, `onKeyDown` handlers for Enter/Space to open the file dialog).
   - "Generate Video" needs clear `aria-disabled` states during active generation.
7. **Trust:**
   - Transparency is key for long-running AI jobs. Set clear expectations: "Generation takes 2-4 minutes." Provide a cancel button if the user changes their mind.

## Architectural & Engineering Decisions (Platinum Standards)
1. **State Persistence (Database-Backed Jobs):** To prevent 2-4 minute video generations from being lost upon a page refresh, all jobs will be immediately written to a `VideoJobs` Firestore collection with a `PENDING` status. The UI will subscribe to this document. Upon completion, the backend/SDK updates the status to `COMPLETED` along with the asset URI.
2. **API Payload Construction:**
   - Implement the `reference_images` array inside the `GenerateVideosConfig` mapping in `MediaGenerator.ts` to transmit the uploaded images directly to the Google Generative AI API.
   - Ensure the API keys are correctly scoped, and fallback logic correctly parses Blob data to base64 `mimeType` and `data` properties.
3. **Resilient API Polling & Error Recovery:** The long-running Veo 3.1 task must not rely on a single open HTTP connection that could timeout. Instead, the task should utilize an exponential backoff polling mechanism against the job ID, handling intermittent 5xx errors gracefully without failing the user-facing generation.

## GSTACK REVIEW REPORT

NO_REVIEWS
---CONFIG---
false---HEAD---
e565a76ac
