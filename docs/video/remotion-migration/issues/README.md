# Migration Issues Index — Remotion → HyperFrames

Drafts only. Publishing to a tracker requires explicit founder request (skill policy).
Suggested labels (provisional, pending tracker vocabulary): `video`, `engine-migration`, `afk`/`hitl`.

| ID | Title | Type | Blocked by | Status |
|---|---|---|---|---|
| MIG-001 | Promote IndiiVideoProject to shared | AFK | — | ✅ **done** (shared owner; renderer alias only) |
| MIG-002 | Freeze VideoRenderer contract | AFK | 001 | ✅ **done** (shared contract + one reusable suite) |
| MIG-003 | FFmpeg direct-ops fast path | AFK | — | ✅ **done** (MediaOps executor + probe-based tests) |
| MIG-004 | RenderPlanner router | AFK | 002, 003 | ✅ **done** (fail-closed planner; direct path engine-isolated) |
| MIG-005 | HyperFrames go/no-go gate | HITL | — | ✅ **GO** + spike rendered (deterministic, byte-identical re-render) |
| MIG-006 | Adapter skeleton + contract suite | AFK | 002, 005 | ✅ **done locally** (suite passes RenderService + real HyperFrames adapter; exact 0.8.10 engine pin) |
| MIG-007 | Golden parity harness | AFK | 006 | ✅ **done** — calibrated controls + two corrected structural/SSIM sign-offs |
| MIG-008 | Port: compiler + MyComposition subject | AFK | 006 | ✅ **done** — real CLI lint-clean ×4; text SSIM 0.99921 signed |
| MIG-009 | LogoReveal family | AFK | 008 | ✅ **done** — retained 16:9 port SSIM 0.97177 signed; two other formats deleted by founder directive |
| MIG-010 | BannerAnimations family | AFK | 009 | ✅ closed by scope change — five presets deliberately deleted; no production composition-ID callers remain |
| MIG-011 | Preview swap | AFK | 006, 008 | ✅ **done** — official Player live preview; artifact fallback/delivery |
| MIG-012 | Cloud Run cutover (GCP) | HITL | corrected parity | ⬜ not deployed — cost approval, cloud adapter wiring, auth smoke, and cutover remain |
| MIG-013 | Agents/docs re-point | AFK | 001 | ✅ **done** (SOP, canonical brief, MCP tool, and lockfile paths neutralized) |
| MIG-014 | Lockstep deletion + zero-hit gate | AFK | — | 🟡 local deletion complete; cloud sample-render criterion remains blocked by MIG-012 |

Parallel starts: MIG-001, MIG-003, MIG-005, MIG-013(docs portion).
Remaining critical path: founder GCP approval → cloud adapter/deploy/authenticated
round trip → final cloud criterion in MIG-014.

## Local verification (2026-08-23)

- TypeScript checks: shared, main, renderer, and firebase all clean.
- Renderer: 5,123 passed, 47 skipped.
- Main: 463 passed.
- Shared: 108 passed.
- Firebase: 994 ordinary tests passed; all three security-rule files pass under the Firestore/Storage emulators (256/256).
- Studio build and main-process lint: clean.
- Packaged Electron check: HyperFrames CLI and GSAP are present and a real LogoReveal render completed from the packaged runtime.

MIG-007 is complete with corrected cross-engine sign-offs. MIG-012 remains
approval-gated because deploying the optional cloud composition worker creates
billable GCP resources and requires an authenticated production smoke test.
