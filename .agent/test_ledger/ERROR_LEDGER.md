## 2026-05-29 Case-Sensitivity Compilation Issue
- **Error:** Local TypeScript compilation passes but fails in GitHub Actions CI with module resolution errors.
- **Cause:** macOS is case-insensitive while Linux (Ubuntu CI) is case-sensitive. Incorrect import casing passes locally but fails remotely.
- **Fix:** Added `"forceConsistentCasingInFileNames": true` to `tsconfig.json` to catch casing mismatches during local `npm run typecheck`.

## 2026-05-29 Raw JSON Chat Leak
- **Error:** Agent responses return raw JSON strings containing image IDs or bug reports instead of clean markdown UI.
- **Cause:** `BaseAgent.ts` execution handlers returning raw payloads directly to the LLM message history without wrapping or formatting.
- **Fix:** Wrap internal payload data like image IDs inside `[SYSTEM ONLY - DO NOT REPEAT THIS JSON TO THE USER]` blocks. Update `BugReportTools.ts` to use `toolSuccess` and format outputs directly into Markdown.
