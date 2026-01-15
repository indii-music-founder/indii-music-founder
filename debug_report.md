# Debug Report: Asset Gallery & Image Generation

## Summary
The "Red Block" images appearing in the Asset Gallery were caused by a failure in the `generateImageV3` Cloud Function, triggering the local Mock Fallback mechanism.

## Root Cause Analysis
1. **Cloud Function Crash (`INVALID_ARGUMENT`)**:
   - The `generateImageV3` function was sending an invalid configuration to the Gemini 3 Pro Image model.
   - **Error**: `responseModalities: ["TEXT", "IMAGE"]`
   - **Requirement**: Image generation models (Imagen 3 / Gemini 3 Pro Image) strictly require `responseModalities` to be `["IMAGE"]` or omitted. Requesting "TEXT" caused a 400 Bad Request.

2. **Frontend Fallback**:
   - The `ImageGenerationService` caught the 400 error.
   - It triggered the "Mock Mode" fallback, producing a 1x1 Red Pixel image (scaled up to a red block in the gallery) to prevent the app from crashing.

3. **Gallery Artifacts**:
   - **Red Blocks**: Failed generations (Mock Fallback).
   - **"DEV PREVIEW (Size Limit)"**: Large images from *previous sessions* reloaded from Firestore. In Dev mode, we bypass Firebase Storage, so large Data URIs (>1MB) are replaced with placeholders in the database to prevent write errors. This is expected behavior in local development when persistence is lost.
   - **Cat Image**: A working image that was either uploaded or small enough to be stored directly in Firestore.

## Resolution
- **Fixed `functions/src/index.ts`**:
  - Removed "TEXT" from `responseModalities`.
  - Removed unsupported `temperature`, `topK`, and `topP` parameters for the image model.
- **Verified Build**: Ran `npm run build` in the functions directory (Success).

## Next Steps
- Redeploy the Cloud Functions (if applicable) or restart the local emulator.
- Try generating a new image. It should now produce a real image instead of a red block.
