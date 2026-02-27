# Video Studio Module (RC1)

The Video Studio is a production-grade idea-to-render pipeline for AI video synthesis. It integrates **Google Veo 3.1** and **Imagen Video** models into a structured creative workflow that ensures high-fidelity results through a "Director's Cut" validation process.

## 🎞️ Key Features
- **Neural Storyboarding:** Generate consistent keyframes from natural language descriptions.
- **Veo 3.1 Integration:** High-resolution (1080p/4K) video synthesis with support for temporal consistency and cinematic physics.
- **The Director (QA Hub):** A specialized interface for reviewing, regenerating, and upscaling AI samples before final delivery.
- **Multimodal Prompting:** Combine text prompts with reference images (image-to-video) or input videos (video-to-video) for precise control.
- **Remotion Integration:** Local preview and timeline scrubbing for generated assets before cloud rendering.

## 🏗️ Architecture
- **`VideoGenerationService`**: Manages the polling-based asynchronous lifecycle of Vertex AI video jobs.
- **`VideoWorkflow`**: A state machine that tracks the job from `draft` -> `storyboard` -> `rendering` -> `completed`.
- **Inngest Orchestration**: Backend rendering jobs are handled via serverless workflows to manage long-running timeouts and retries.

## 🛠️ Usage
1. Define a creative brief or let the **Creative Director Agent** generate one.
2. Select your model (Veo 3.1 Pro or Fast).
3. Set your duration (4s, 6s, or 8s).
4. Initiate generation and monitor the **The Director** dashboard for real-time progress.
