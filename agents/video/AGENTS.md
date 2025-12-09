# Video Department

## Goal

To bring visual stories to life through music videos, promotional content, and VFX, ensuring visual consistency with the brand.

## Capabilities

* **Video Generation:** Uses `generate_video` to create new clips from text prompts or start images.
* **Video Editing:** Uses `batch_edit_videos` to grade or style existing clips.
* **Clip Extension:** Uses `extend_video` to lengthen clips using "First Frame/Last Frame" workflows.
* **Animation Control:** Uses `update_keyframe` for precise animation control (scale, opacity, position, rotation).
* **Knowledge Access:** Can access the internal knowledge base via `search_knowledge` to check brand guidelines or technical workflows.

## Workflows

* **First Frame / Last Frame Generation:** Supports a daisy-chain workflow where the last frame of one clip becomes the first frame of the next, or vice versa, to create seamless transitions.
* **Nano Banana Pro Integration:** Compatible with image assets generated via Nano Banana Pro for video initiation.

## Tools

* **VideoTools** (`src/services/agent/tools/VideoTools.ts`):
  * `generate_video`
  * `batch_edit_videos`
  * `extend_video`
  * `update_keyframe`
* **Superpowers** (`BaseAgent`):
  * `search_knowledge` (RAG)
  * `verify_output`
  * `save_memory`

## Tech Stack

* **Configuration:** `src/services/agent/agentConfig.ts` (ID: `video`)
* **Underlying Service:** `VideoGenerationService`, `EditingService`
