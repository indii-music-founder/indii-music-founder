# Open Issues

This root file is a current index for agents. The detailed issue ledger is:

- `.agent/test_ledger/OPEN_ISSUES.md`

**Last updated:** 2026-06-02T01:20Z
**Current main:** `a2549985d62b97a06c4ee929e7f2b96420842aa8`
**Main deploy:** Green - GitHub Actions run `26791791086` completed successfully after PR #126.

## Active Beta-Readiness Issues

### ISSUE-361: Real user PII + password hashes committed to public repo (`users.json`)
- **Status:** ✅ FIXED
- **Severity:** 🔴 CRITICAL
- **Summary:** Purged via git filter-repo and added to gitignore.

### ISSUE-362: Spoofer-vulnerable window allowlist
- **Status:** ✅ FIXED
- **Severity:** 🔴 CRITICAL
- **Summary:** Applied strict URL origins allowlist in `packages/main/src/main.ts`.

### ISSUE-363: Unsanitized HTML rendering
- **Status:** ✅ FIXED
- **Severity:** 🔴 HIGH
- **Summary:** Added DOMPurify for sanitization in AgentCanvasPanel.

### ISSUE-364: Slop UI components (No Backends)
- **Status:** ✅ FIXED
- **Severity:** 🟡 MEDIUM
- **Summary:** Integrated real firestore backends for InventoryTracker, PricingEngine, and SuperfanCRM.

### ISSUE-365: Fake visual audit operation
- **Status:** ✅ FIXED
- **Severity:** 🟡 MEDIUM
- **Summary:** Removed the fake timeout and 'isAuditingAssets' state.

### ISSUE-366: Event-listener Imbalance
- **Status:** ✅ FIXED
- **Severity:** 🟢 LOW
- **Summary:** Verified and fixed improper removeEventListener and unsubscribe methods in useEffect across renderer.

### ISSUE-367: Creative canvas export fails on tainted storage images
- **Status:** ✅ FIXED
- **Severity:** 🔴 HIGH
- **Summary:** Exporting the creative canvas can fail with `Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported` after loading Firebase Storage images.
- **Verdict:** ✅ VERIFIED (D, 2026-06-23): Updated `CanvasOperationsService.loadImageSafe` to detect remote GCP/Firebase storage URLs and prefer loading them as Blobs using `safeStorageFetch` to guarantee they do not taint the canvas context. Checked that all unit/integration tests pass cleanly.

### ISSUE-368: Daisy Chain handoff jumps to video editor without obvious confirmation
- **Status:** 🟡 OPEN
- **Severity:** 🟡 MEDIUM
- **Summary:** Clicking the Daisy Chain / send-to-video flow moves the user into the video editor, but the selected image/frame is not clearly confirmed in-place and the pulsing Daisy Chain state reads like a loading indicator rather than a completed handoff. The result is accidental discovery instead of a visible, intentional workflow.

### ISSUE-369: Video renders save outside the app and completion is not obvious
- **Status:** ✅ FIXED
- **Severity:** 🟡 MEDIUM
- **Summary:** Successful video renders are written to the user's Documents folder (`~/Documents/indii/Assets/Video`) instead of an in-app video folder.
- **Verdict:** ✅ VERIFIED (D, 2026-06-23): Updated video renderer success callback in `useVideoEditor.ts` to surface the final saved location via success toast (`Render complete: ${resultLocation}`) and globally save `localPath` in `generatedHistory`.

### ISSUE-370: Project Assets panel does not surface generated video outputs
- **Status:** ✅ FIXED
- **Severity:** 🟡 MEDIUM
- **Summary:** The Project Assets panel in the creative workspace appears to show image assets only, with no obvious MP4/video artifact.
- **Verdict:** ✅ VERIFIED (D, 2026-06-23): Updated `CreativeGallery.tsx` and `EditorAssetLibrary.tsx` to read the `localPath` using the `file://` protocol wrapper for local rendering of MP4 outputs, surfacing generated video assets correctly inside the gallery and assets sidebar panel.

### ISSUE-371: Creative Director visual correction loop is hard to distinguish from a runaway loop
- **Status:** 🟡 OPEN
- **Severity:** 🟡 MEDIUM
- **Summary:** The Creative Director can enter a self-correction cycle when the visual autorater rejects a generated asset, but the user-facing transcript makes it look like the agent is looping indefinitely and repeatedly asking for another pass. The system needs a clearer stop condition, a final failure state, and an explanation of what was corrected versus what still failed.


### ISSUE-079: Founder Seat Model Split-Brain Across Product Surfaces
- **Status:** ✅ FIXED
- **Severity:** HIGH
- **Ledger:** `.agent/test_ledger/OPEN_ISSUES.md`
- **Summary:** Founder copy and code now agree on 11 total Founder seats: 1 reserved i-i Founder seat plus 10 paid Founder buy-in seats.

### ISSUE-087: Founder Desktop Installer Release Pipeline Is Not Ready End-To-End
- **Status:** 🟡 PARTIAL
- **Severity:** HIGH
- **Ledger:** `.agent/test_ledger/OPEN_ISSUES.md`
- **Summary:** Verify the beta download promise end-to-end: current macOS DMG and Windows EXE exist locally, but the Firebase Storage upload path and Founder-portal authorization logic still need proof.

### ISSUE-088: Dependency Audit Still Reports High/Critical Vulnerabilities
- **Status:** ✅ FIXED (partially risk-accepted)
- **Severity:** HIGH
- **Ledger:** `.agent/test_ledger/OPEN_ISSUES.md`
- **Summary:** The original audit reported 44 vulnerabilities (6 high, 5 critical). The current verified state is 37 total (4 high, 0 critical). The remaining 4 high vulnerabilities belong to the Mastra/OpenTelemetry chain which was formally risk-accepted prior to beta launch.

### ISSUE-089: Green CI Still Emits Launch-Readiness Warning Noise
- **Status:** ✅ FIXED
- **Severity:** MEDIUM
- **Ledger:** `.agent/test_ledger/OPEN_ISSUES.md`
- **Summary:** Cleaned up ESLint unused symbols, upgraded getsentry action to v3 (resolving Node 20 deprecation), and explicitly generated production sourcemaps to fix Sentry missing mapping warnings.

## Current Verification Snapshot

- `npm run typecheck`: PASS on current main before PR #126 and in GitHub Actions after merge.
- Full unit-test shards: PASS in GitHub Actions after merge.
- Build, staging deploy, staging E2E, and production deploy: PASS in GitHub Actions run `26791791086`.
- Live browser smoke after production deploy: PASS for `https://indii.music`, `https://indii-music-studio.web.app`, and `https://indii-music-founder.web.app`.

## Recently Fixed

- ISSUE-080 through ISSUE-086 were resolved by the June 1 launch-readiness agents and are recorded in the detailed ledger.
- PR #126 removed dead external noise texture dependencies that caused the landing page to request `https://grainy-gradients.vercel.app/noise.svg` and fixed a separate unresolved `/noise.png` reference.

## Notes For Agents

- Do not treat the old TypeScript/test regression list as current; main is green as of the run above.
- Add new product, CI, flowchart, or beta-launch issues to `.agent/test_ledger/OPEN_ISSUES.md` using the next issue number.
- Keep flowcharts in `docs/flowcharts/` synchronized with any code or runtime-model fixes.
