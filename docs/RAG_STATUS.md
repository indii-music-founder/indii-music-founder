# RAG Status Update - 2025-12-24

## Current Implementation: Stable Inline Fallback

Native RAG using the Gemini Files API (`fileData`) with `gemini-3-pro-preview` and `gemini-3-flash-preview` currently returns a persistent `400 Bad Request` (Invalid Argument) even when using official REST formats and recommended URI structures.

To ensure application stability, the **Inline Text Fallback** has been restored and optimized.

### Changes Made

1. **Fixed RAG Functionality**: Restored `ragService.ts` to pass local file content to the LLM when native retrieval fails or is bypassable.
2. **Standards Compliance**: Updated RAG temperature to `0.0` in both `ragService.ts` and `GeminiRetrievalService.ts` per `GEMINI.md`.
3. **Model Policy Enforcement**: Purged all active references to forbidden `gemini-1.5` models from scripts and services.
4. **Native RAG Prep**: `GeminiRetrievalService.ts` is now fully prepared with the correct camelCase REST payload structure, ready for when the `gemini-3` preview models fully support the Files API in this region/context.

### Technical Findings (For Future Debugging)

- **Error**: `400 Bad Request` - `Request contains an invalid argument.`
- **Tested Formats**:
  - `https://generativelanguage.googleapis.com/v1beta/files/<id>`
  - `https://generativelanguage.googleapis.com/files/<id>`
  - `files/<id>`
- **Suspected Cause**: `gemini-3-pro-preview` may not yet support the `fileData` part in the `generateContent` method via the REST API, or requires a very specific `systemInstruction` or `generationConfig` not yet identified.
- **Pivot**: Using the `GoogleGenerativeAI` Node SDK instead of raw REST might resolve this, but would require a dependency update and ensuring the `ragProxy` supports the SDK's internal formatting.
