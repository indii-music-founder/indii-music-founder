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
| MIG-006 | Adapter skeleton + contract suite | AFK | 002, 005 | ✅ **done locally** (suite passes RenderService + real HyperFrames adapter; exact 0.8.10 pin) |
| MIG-007 | Golden parity harness | AFK | 006 | 🟡 harness/calibration done; corrected cross-engine sign-off pending immutable baselines |
| MIG-008 | Port: compiler + MyComposition subject | AFK | 006 | 🟡 compiler done and real CLI lint-clean ×4; old SSIM row is not a valid structural pass |
| MIG-009 | LogoReveal family | AFK | 008 | 🟡 16:9 port present; old SSIM row revoked; two other formats deleted by founder directive |
| MIG-010 | BannerAnimations family | AFK | 009 | ✅ closed by scope change — five presets deliberately deleted; no production composition-ID callers remain |
| MIG-011 | Preview swap | AFK | 006, 008 | ✅ **done** — Option B executed (artifact playback, zero engine in bundle) |
| MIG-012 | Cloud Run cutover (GCP) | HITL | corrected parity | ⬜ not deployed — cost approval, cloud adapter wiring, auth smoke, and cutover remain |
| MIG-013 | Agents/docs re-point | AFK | 001 | ✅ **done** (SOP, canonical brief, MCP tool, and lockfile paths neutralized) |
| MIG-014 | Lockstep deletion + zero-hit gate | AFK | — | 🟡 local deletion complete; cloud sample-render criterion remains blocked by MIG-012 |

Parallel starts: MIG-001, MIG-003, MIG-005, MIG-013(docs portion).
Remaining critical path: immutable baselines → corrected parity sign-off → founder GCP
approval → cloud adapter/deploy/authenticated round trip → final cloud criterion in MIG-014.

## Local verification (2026-08-23)

- TypeScript checks: shared, main, renderer, and firebase all clean.
- Renderer: 5,108 passed, 47 skipped.
- Main: 462 passed.
- Shared: 108 passed.
- Firebase: 991 ordinary tests passed; the three security-rule files remain emulator-gated (261 skipped without Firestore/Storage emulators).
- Studio build and main-process lint: clean.
- Packaged Electron check: HyperFrames CLI and GSAP are present and a real LogoReveal render completed from the packaged runtime.

These local results do not convert MIG-007 or MIG-012 into completed work: the
corrected cross-engine comparison still needs immutable baseline media, and the
cloud composition worker still needs explicit founder approval and deployment.
