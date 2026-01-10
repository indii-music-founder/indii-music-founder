## 2024-05-22 - Phantom Tests in Agent Tools
**Learning:** Found unit tests (`VideoTools.test.ts`) validating tool functions (`generate_music_video`) that did not exist in the actual source code. This creates a false sense of security and confuses maintenance.
**Action:** When auditing Agent Tools, explicitly verify the exports of the tool file against the test file methods before trusting existing coverage.

## 2024-10-24 - Swapped Error Arguments in Tool Wrappers
**Learning:** Discovered that `toolError(message, code)` arguments were swapped in `VideoTools.ts` (passed as `toolError(CODE, message)`). This caused the Agent to receive the error code as the message and the message as metadata, potentially confusing the LLM's error recovery.
**Action:** When writing tests for tools, explicitly assert that `result.error` matches the expected human-readable message and `result.metadata.errorCode` matches the machine-readable code, rather than just checking for truthiness.
