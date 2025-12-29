# Gemini 3 Technical Specifications (BETA RELEASE V5.0)

This document outlines the technical parameters and best practices for utilizing **Gemini 3** series models within the indiiOS ecosystem. Version 5.0 marks the shift to **High-Fidelity Production** standards.

---

## 🏗️ Model Selection & Capabilities

All AI interactions must adhere to the [Model Usage Policy](file:///Volumes/X%20SSD%202025/Users/narrowchannel/Desktop/indiiOS-Alpha-Electron/MODEL_POLICY.md).

| Capability | Model ID | Recommended Thinking |
| :--- | :--- | :--- |
| **Complex Reasoning** | `gemini-3-pro-preview` | `HIGH` |
| **Fast Routing** | `gemini-3-flash-preview` | `MEDIUM` |
| **Image Synth** | `gemini-3-pro-image-preview` | N/A |
| **Video Synth** | `veo-3.1-generate-preview` | N/A |
| **Audio/TTS** | `gemini-2.5-pro-tts` | N/A |

---

## 🧠 Reasoning & "Thinking" Levels (Cortex V5)

Gemini 3 models support dynamic reasoning intensities. Use the appropriate level for the task complexity.

### Gemini 3 Flash

- `MINIMAL`: Sub-second response, simple classification.
- `LOW`: Fast extraction, basic summaries.
- `MEDIUM`: (Default) Logical routing, standard code edits.
- `HIGH`: Deep analysis, complex debugging.

### Gemini 3 Pro

- `LOW`: Standard agent reasoning.
- `HIGH`: (Default) Architectural planning, multi-step orchestration.

> [!IMPORTANT]
> **Thought Signatures**: Always capture and pass back the `thought_signature` in conversational chains to maintain context continuity. This is mandatory for Beta compliance.

---

## 🎨 Multimodal Specifications

### Media Resolution

Control output quality via `media_resolution` parameter:

- `low`: Quick previews.
- `medium`: Standard web display.
- `high`: (Default) High-fidelity assets.
- `ultra_high`: Print/Production grade (requires explicit user intent).

### Modality Notes

- **PDFs**: Handled under the `IMAGE` modality. Large PDFs should be processed via GCS URIs.
- **Images**: Pro models preserve native aspect ratio. Avoid aggressive cropping.

---

## 🛡️ Grounding & Factuality (RAG)

To maximize factuality and minimize hallucination in production:

1. **Temperature**: Set to `0.0` for all RAG and data-intensive tasks. Keep at `1.0` for creative writing.
2. **System Instructions**: Use strict grounding prompts to forbid external knowledge when searching internal documentation.
3. **Structured Output**: Utilize `response_mime_type: application/json` for deterministic integration.

---

## ⚡ Performance Optimization

- **Context Window**: Maximize the use of the 2M token window for large codebase analysis.
- **Caching**: Frequently used context blocks (e.g., library docs) should be context-cached.
- **Batched Inputs**: For bulk processing, use asynchronous batching to avoid rate limits.

---

> [!CAUTION]
> **Beta Policy Enforcement**: Manual hardcoding of model strings is forbidden. Always use `AI_MODELS` from `@/core/config/ai-models`.
