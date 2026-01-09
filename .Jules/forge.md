## 2024-05-22 - Phantom Tests in Agent Tools
**Learning:** Found unit tests (`VideoTools.test.ts`) validating tool functions (`generate_music_video`) that did not exist in the actual source code. This creates a false sense of security and confuses maintenance.
**Action:** When auditing Agent Tools, explicitly verify the exports of the tool file against the test file methods before trusting existing coverage.
