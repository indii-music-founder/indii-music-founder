# Debug Module

The Debug module provides system-level diagnostics and "Gauntlet" style stress testing tools specifically engineered to validate multimodal service stability.

## 🛠️ Key Features

- **Multimodal Gauntlet:** Executes parallel visual and video generation flows to ensure high-concurrency limits and API stabilities are functioning as expected.
- **Latency & Throughput Monitoring:** Visualizers for tracking timing metrics from Firebase and Google GenAI responses.

## 🏗️ Technical Architecture

- **`MultimodalGauntlet.tsx`**: Isolated component capable of bypassing normal UI flows to directly inject load onto the orchestration engines and `AIService`.
- Relies heavily on `useToast` to dump backend logs quickly into the frontend viewport for easy inspection.

## 🔗 Integrations

- Strictly connects to `ImageGenerationService` and `VideoGenerationService`.
- Exclusively active in non-production builds (or gated behind admin authorizations) to avoid exposing internal test logic.
