# E2E Test Execution Results

**Date:** 2026-01-15
**Environment:** Linux (Docker), Port 4242, Headless Chromium/Electron
**Total Test Files:** 40
**Execution Strategy:** Batched execution via Playwright

## Summary
The following table summarizes the execution results for all identified E2E tests.

| Test File | Status | Passed | Failed | Notes |
|-----------|--------|--------|--------|-------|
| `temp/verify_simple.spec.ts` | ✅ PASS | 1 | 0 | Fixed port configuration. |
| `auth-flow.spec.ts` | ⚠️ MIXED | 1 | 1 | Auth logic partially working. |
| `flow-navigation.spec.ts` | ⚠️ MIXED | 3 | 3 | Fixed syntax error. Sidebar navigation works, back button flaky. |
| `compass-navigation.spec.ts` | ❌ FAIL | 0 | 4 | UI Traversal failed. |
| `cross-platform.spec.ts` | ❌ FAIL | 0 | 1 | Sync logic failed. |
| `electron.spec.ts` | ❌ FAIL | 0 | 1 | IPC communication failed. |
| `maestro-campaign-workflow.spec.ts` | ✅ PASS | 2 | 0 | Agent-User handoff works. |
| `maestro-approval-gate.spec.ts` | ❌ FAIL | 0 | 1 | Gatekeeper logic failed. |
| `maestro-approval-handoff.spec.ts` | ❌ FAIL | 0 | 1 | Handoff workflow failed. |
| `maestro-handoff.spec.ts` | ❌ FAIL | 0 | 1 | Rejection loop failed. |
| `maestro-multi-step-workflow.spec.ts` | ❌ FAIL | 0 | 1 | Multi-step workflow failed. |
| `workflow-coordinator.spec.ts` | ❌ FAIL | 0 | 2 | Orchestration failed. |
| `mobile-content-responsiveness.spec.ts` | ✅ PASS | 2 | 0 | Markdown/Code tables verify correctly. |
| `mobile-experience.spec.ts` | ✅ PASS | 8 | 0 | Performance and Accessibility pass. |
| `mobile-chat-layout.spec.ts` | ⚠️ MIXED | 1 | 2 | Send button/Input issues. |
| `subscription-pricing.spec.ts` | ✅ PASS | 3 | 0 | Pricing UI verified. |
| `subscription-pricing-ui.spec.ts` | ⚠️ MIXED | 1 | 1 | Tier specs failed. |
| `file-search-stress.spec.ts` | ✅ PASS | 4 | 0 | RAG Gauntlet passed. |
| `stress-test.spec.ts` | ⚠️ MIXED | 1 | 1 | Asset loading stress failed. |
| `test_persistence.spec.ts` | ✅ PASS | 1 | 0 | Basic persistence works. |
| `agent-flow.spec.ts` | ❌ FAIL | 0 | 1 | Handover failed. |
| `assets-drawer.spec.ts` | ❌ FAIL | 0 | 1 | UI Elements missing. |
| `audio_intelligence_ui.spec.ts` | ❌ FAIL | 0 | 1 | Analysis flow failed. |
| `audio_intelligence_verification.spec.ts` | ❌ FAIL | 0 | 1 | Verification failed. |
| `chaos-monkey.spec.ts` | ❌ FAIL | 0 | 3 | Stress scenarios failed. |
| `merch-unified.spec.ts` | ❌ FAIL | 0 | 1 | Unified flow failed. |
| `indii_bot.test.ts` | ❌ FAIL | 0 | 2 | Verification failed. |
| `create-three-assets.spec.ts` | ❌ FAIL | 0 | 1 | Asset creation loop failed. |
| `creative-persistence.spec.ts` | ❌ FAIL | 0 | 1 | Persistence failed. |
| `generate-three-assets-manual.spec.ts` | ❌ FAIL | 0 | 1 | Manual generation failed. |
| `simple-asset-test.spec.ts` | ❌ FAIL | 0 | 1 | Mock infra failed. |
| `server-side-stitching.spec.ts` | ❌ FAIL | 0 | 1 | Stitching UI failed. |
| `fear-factor.spec.ts` | ❌ FAIL | 0 | 2 | Chaos testing failed. |
| `hub-spoke.spec.ts` | ❌ FAIL | 0 | 1 | Architecture verification failed. |
| `full-ai-integration.spec.ts` | ❌ FAIL | 0 | 3 | Full AI flows failed. |
| `hundred_click_path.spec.ts` | ❌ FAIL | 0 | 1 | Timed out / Elements not found. |
| `load-simulation.spec.ts` | ❌ FAIL | 0 | 1 | Load simulation failed. |
| `temporal-sessions.spec.ts` | ❌ FAIL | 0 | 2 | Session management failed. |
| `the-librarian.spec.ts` | ❌ FAIL | 0 | 1 | RAG pipeline failed. |
| `the-paparazzi.spec.ts` | ❌ FAIL | 0 | 2 | Media pipeline failed. |
| `time-traveler.spec.ts` | ❌ FAIL | 0 | 1 | Project persistence failed. |

## Detailed Logs
Detailed logs for each test batch were captured in `result_*.txt` files in the root directory.
