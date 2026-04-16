# AI API Capabilities Reference
*A comprehensive guide to features and tools available across Gemini, Nano Banana, Veo, and Imagen APIs.*

## 1. Core Multimodal Understanding & Reasoning (Gemini API)
*   **Multimodal Inputs:** The models can process text, audio, video, images, and documents (including PDFs up to 1,000 pages).
*   **Long Context Window:** Can process up to 1 million or 2 million tokens to understand entire codebases, books, or hour-long videos.
*   **Thinking Mode (Reasoning):** Models can utilize internal reasoning before responding, effective for complex math, coding, or multi-step planning. 
    *   *Thinking Levels/Budgets:* Control depth of reasoning (Minimal, Low, Medium, High).
    *   *Thought Summaries:* Return synthesized summaries of internal reasoning for debugging.
    *   *Thought Signatures:* Encrypted representations used to maintain reasoning context across multi-turn workflows.
*   **Object Detection:** Detect specific objects in an image and return bounding box coordinates.
*   **Image Segmentation:** Segment detected items and provide contour masks (base64-encoded probability maps).
*   **Video Understanding:** Extract insights from video/audio, answer questions based on timestamps (`MM:SS`), set clipping intervals, and sample at custom frame rates.
*   **YouTube URL Processing:** Public YouTube URLs can be passed directly for processing.

## 2. Image Generation & Editing (Nano Banana & Imagen APIs)
*   **Text-to-Image Generation:** Generate photorealistic images, digital art, illustrations, and assets from text prompts.
*   **Variable Resolutions:** Natively generate images at 0.5K (512px), 1K, 2K, and up to 4K resolutions.
*   **Flexible Aspect Ratios:** Supports up to 14 aspect ratios (e.g., 1:1, 9:16, 3:4, 16:9, 4:3, 4:1, 1:4, 8:1, 1:8).
*   **Conversational Multi-Turn Editing:** Iteratively edit images via chat, utilizing "Thought Signatures" to remember visual context.
*   **Reference Images & Identity Retention:** Input up to 14 reference images to maintain character consistency (up to 4-5 faces) or preserve specific object details.
*   **Inpainting (Insert & Remove):** Define a mask to insert new objects or seamlessly remove elements.
*   **Outpainting (Canvas Expansion):** Expand an image beyond original borders or change aspect ratio, filling in the background.
*   **Background Replacement:** Automatically detect and replace the background of a subject/product shot.
*   **Style Transfer & Customization:** Force the model to adopt a specific artistic style, texture, or pattern from reference images.
*   **Text Rendering & Translation:** Precisely render legible text (logos, posters) and translate directly within the image (over 10 languages).
*   **Image Upscaling:** Increase resolution without losing quality (up to 17 megapixels).
*   **SynthID Watermarking:** Automatically embeds an invisible digital watermark to identify AI generation.

## 3. Video Generation (Veo 3.1 API)
*   **Text-to-Video:** Generate high-fidelity, cinematic videos directly from text prompts.
*   **Image-to-Video:** Upload an initial image to serve as the first frame for animation.
*   **Interpolation (First & Last Frames):** Specify starting and ending frames; the AI generates the transitional sequence.
*   **Video Extension:** Extend generated videos by 7 seconds at a time (up to 148 seconds total).
*   **Native Audio Generation:** Automatically generates synchronized dialogue, sound effects, and ambient noise.
*   **Reference Images:** Use up to 3 reference images to guide style, character, or product appearance.
*   **Resolution & Duration Control:** 720p, 1080p, or 4K resolutions at 4, 6, or 8 seconds duration.
*   **Aspect Ratios:** Supports landscape (16:9) and portrait (9:16) outputs.

## 4. Advanced Developer Tools & Orchestration
*   **Function Calling (Tool Use):** Connect to external APIs. Supports single, sequential, and parallel function calling.
*   **Code Execution:** Write and execute Python internally to solve math, process data, or physically manipulate images.
*   **Search Grounding:** Integrate with Google Search, Google Maps, or enterprise data for real-time facts context.
*   **Image Search Grounding:** Retrieve web images as visual context to improve generation accuracy.
*   **Context Caching:** Process large files once, cache, and reuse tokens for reduced latency and cost.
*   **Structured Outputs (JSON):** Constrain output to strictly conform to a predefined JSON schema or enum format.
*   **Live API (Real-Time Streaming):** Bidirectional, real-time voice and video streaming for low-latency agents.
*   **System Instructions:** Provide a preamble to steer persona, formatting rules, and behavior.

## 5. Enterprise, System & Administration Features
*   **Batch Prediction API:** Send large volumes of requests asynchronously via GCS/BigQuery for lower-cost 24hr processing.
*   **Model Tuning:** Fine-tune models (SFT, Preference Tuning, LoRA) to adapt to organizational data.
*   **Configurable Safety Settings:** Block None, Low, Medium, High filtering for harassment, dangerous content, etc.
*   **Token Counting API:** Calculate exact token consumption before execution.
*   **RAG Engine:** Built-in infrastructure for parsing, chunking, vector DB ingestion, and metadata search.
*   **OpenAI Compatibility Layer:** Access capabilities using standard OpenAI SDKs and endpoints.
