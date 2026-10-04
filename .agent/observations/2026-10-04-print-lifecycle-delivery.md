# Browser print preparation lifecycle repair

## Observed failure

The genuine production journey through https://indii.music/ into the web studio
on `e716b88a3b125ef0350171230a2322069dbffa8d` remained busy on the 3000px print
action without returning a saved master. The account was already signed in;
it was not created during this journey. Visible Settings showed Founding Member
seat ii, lifetime access, pass-through AI costs, unlimited projects and 10 TB.
The selected artwork was an existing owned asset, not a fresh generation.
Later inspection found the original tab handle missing; that attempt has no
verified result and was not silently restarted because of an observation timeout.

Source inspection found unbounded source/model/tile/pixel-read waits and an
awaited engine disposal that itself waits for model readiness. The installed SDK
also waits for animation frames before checking cancellation when requested.
These are lifecycle hazards; the precise stage of the original stall was not
observed and must not be claimed as diagnosed.

## Repair

- Bound source reads, image decoding, browser module/model readiness, per-tile
  enhancement and pixel reads. Propagate real abort signals; discard/release
  late results instead of turning them into a successful print master.
- Yield between completed tiles with the event loop rather than awaiting browser
  animation frames inside the enhancement SDK. Model failure remains an error;
  no interpolation or fabricated success replaces AI enhancement.
- Dispose the enhancement engine asynchronously after readiness. Cleanup cannot
  keep the caller waiting on an already failed model-readiness stage.
- Show the actual stage and completed-tile progress in the creative canvas,
  with cancellation before persistence. Once durable saving starts, disable
  cancellation and show saving until the existing save operation resolves.
  Changing/clearing the selected asset cancels unfinished enhancement even
  though the editor component remains mounted.

## Evidence and remaining gates

The pure geometry checks (11) and local lifecycle checks (5) pass. Lifecycle
checks use genuine promises, timers and AbortControllers; they do not simulate
images, authentication, GPU results, persisted customer state or remote services.
Existing mock-backed repository suites are structural-only.

Root typecheck and root lint pass (0 errors, 217 existing warnings). Final
typecheck and touched-file lint pass after the selected-asset lifecycle fix.
Full local CI passes across four shards: 9,342 tests passed. The final affected
component/pure-logic run passes 34 checks across five files. Existing component
tests remain structural-only and were not expanded with mocks. Whitespace
validation passes.

Live Jev source review is recorded in `2026-10-04-jev-print-lifecycle-review.json`
(9,660 input tokens, 79 output tokens). Its typed probabilities are advisory.
The more uncertain cleanup/save judgments were checked directly against the
code: cleanup does not await readiness/disposal; saving disables cancellation
and the handler checks the synchronous saving flag before aborting.

Timer deadlines depend on the browser event loop and cannot interrupt a
synchronously blocked GPU/JavaScript call. Network/model operations that lack
native abort support may finish later; their result is not accepted as success.

Exact remote SHA/CI and renewed genuine production acceptance must be reported
after they complete. Enhanced/downloaded pixels, 300 DPI,
reload durability, fresh generation, free-tier behavior and cloud dispatch
remain unverified until their respective actual customer paths complete.
This repair does not complete the two-week backlog or the full print plan.
