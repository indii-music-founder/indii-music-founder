# Open Issues

This root file is a current index for agents. The detailed issue ledger is:

- `.agent/test_ledger/OPEN_ISSUES.md`

**Last updated:** 2026-06-02T01:20Z
**Current main:** `a2549985d62b97a06c4ee929e7f2b96420842aa8`
**Main deploy:** Green - GitHub Actions run `26791791086` completed successfully after PR #126.

## Active Beta-Readiness Issues

### ISSUE-079: Founder Seat Model Split-Brain Across Product Surfaces
- **Status:** ✅ FIXED
- **Severity:** HIGH
- **Ledger:** `.agent/test_ledger/OPEN_ISSUES.md`
- **Summary:** Founder copy and code now perfectly agree on 11 total Founder seats (1 reserved Founder #1 + 10 paid seats).

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
