# Blender render workflow follow-up

## Observed starting state

Packaging repair a98b2653910b6244b0a29f96f5958560667612bd passed all 26 jobs in
CI 37251716199, including production deployment and its health summary. The
installed native studio remains the older release; its customer render path was
not verified by that package/protocol check.

Current source review found a placeholder audio filename, timer-based progress,
a hard-coded Unix output path, a completion toast without library persistence,
an ignored progress callback, default short MCP request timeouts, and a local
connection marked ready before its handshake completed. Browser status also
mistook an absent desktop bridge for proof Blender was not installed.

## Implementation

- Reject missing, empty or unreadable music before direct MCP execution; treat Python runner failures as nonzero process exits and require successful audio-strip creation.
- Select real music and optional cover files through the existing desktop file
  chooser; existing file-access grants are enforced before native execution.
- Allocate a private UUID MP4 in the native app's managed output directory.
  Reserve the output exclusively; never overwrite an existing file. Delete
  partial output on cancellation or failed execution, retaining completed files.
- Forward actual MCP progress notifications through sender-scoped desktop IPC.
  Requests carry UUIDs; cancellation checks the requesting window, aborts the
  MCP request, and stops its actual Blender child with a bounded kill grace.
- Support bounded long-running requests with progress-based timeout resets and
  a two-hour total deadline. Disconnecting the owning window cancels its render.
- Await local/harness connection initialization and clear failed transports.
- Upload completed bytes under the genuine current owner's project. Commit
  history and file-node records in one Firestore batch with explicit captured
  ownership; never retarget a save after account/project/organization changes.
- Expose project-save retry without re-rendering, retaining native output and
  account/project-scoped pending references across reload. Use stable record IDs
  for retries. Play the persisted cloud URL after the batch acknowledges success.
- Say the web studio cannot inspect local Blender and direct it to desktop,
  rather than pretending an unavailable desktop bridge proves missing software.

The existing configured (default) Firestore database was queried through the
already-authorized Firebase CLI: STANDARD edition, FIRESTORE_NATIVE, nam5.
No database, rules, account, tier, authentication state, or customer data was
provisioned or mutated during that environment query.

## Evidence and limitations

The real isolated MCP package check passed. A separate real-process negative
lifecycle probe received an actual progress notification, observed Blender child
PID 43326, cancelled the request, and confirmed that child exited and no partial
output remained. This probe preceded the new required-input guard. No audio media was supplied: this establishes historical startup
cancellation through MCP/OS, not frame rendering, customer UI acceptance, or a
completed music video. Evidence is /tmp/indii-blender-render-cancellation-proof.log.

Jev source review returned advisory probabilities .35 cancellation leak, .13
owner retarget, .69 save-retry loss, and .12 fabricated progress. It used 11,235
input and 79 output tokens; no dollar cost was returned. Manual review following
the highest concern found that the initial retry reference lived only in memory;
account/project-scoped persistence was added afterward. Raw results are retained
unchanged. Jev probabilities are not approval or deterministic proof.

Legacy focused suites passed 13 structural tests. The component suite's old
fabricated completion assertion was changed to verify the absent-desktop guard;
remaining doubles are explicitly structural-only, not customer render proof.
No service, account, subscription, or successful render mock was added/expanded.
Root lint passed with zero errors and 217 existing warnings. Changes after that
run are covered by a focused lint check. Full CI completed successfully before the final required-input guard. A new full run covers that guard and runner error propagation.

The first full CI logged two TypeScript cleanup errors. Cleanup was corrected to
close failed transports; the known-invalid run was deliberately terminated with
exit 143. A subsequent focused check caught an unintended change to the generic client's
explicit initialization contract. The generic client now awaits existing
initialization; the Blender service explicitly requests/retries its local
connection. The focused contract passed unchanged. That known-invalid full run
was also stopped (exit 143); the latest full run evaluates the corrected source. No timeout was treated as
terminal and no test assertion was relaxed to mask a production failure.

Signed local desktop build is waiting on a Developer ID Application certificate
and private key: the local keychain query found no Developer ID identity. The
user was given Apple's official certificate authorization page. No alternate
identity, ad-hoc signing, or authentication substitution was attempted.

Genuine signed-app input selection, complete rendering, frame-time cancellation,
project-save failure/reload recovery, playback, account switching, free-user
acceptance, other platform behavior and release distribution remain unverified.
The eight Blender reports remain open. Full two-week completion remains open.

Delivery reconciliation found unrelated local commit ca34b120b9fec2c2e8af4338be046beabb3d0f9d (print-resolution browser test) ahead of origin/main. A subsequent fetch confirmed the exact commit was independently published to origin/main; local divergence is now zero. It is preserved as the delivery base.

Final input-boundary evidence: the rebuilt isolated local and harness MCP packages passed their real protocol checks. A real SDK call with an absent music path returned isError=true with the required-input message; no output file existed. Log: /tmp/indii-blender-missing-input-proof.log. No audio was fabricated, and this negative check does not prove successful rendering or customer acceptance. Full source revalidation is live in session 50497 (/tmp/indii-blender-render-input-ci.log); root lint is live in session 22123.

Runner review also corrected Blender 5 collection detection: an empty strips collection is valid, so fallback uses an explicit None check instead of truthiness. This Python-only change requires package verification and affects the currently running gate; no successful verdict is assigned until final-tree verification.

Actual installed Blender 5.2.2 LTS confirmed its empty strips collection exists and exposes new_sound (native process exit 0, /tmp/indii-blender-strip-api-proof.log). Final Python source rebuilt into isolated local/harness packages; both actual tool-response verifiers passed (/tmp/indii-blender-render-final-package.log). Root lint finished exit 0 with 217 existing warnings. Full CI session 50497 remains live in sharded tests; its typecheck and packaging steps passed. The collection API check is not audio loading, frame rendering, or signed-app acceptance.

Final owner-context review guarded late save/render error, progress and busy-state updates against a changed account/project key. The two located component/MCP suites passed nine structural checks (/tmp/indii-blender-render-context-focused.log); the handler filename supplied in that run did not match an existing test and was not executed. The full CI remains active at shard 1/4 in session 50497; these final UI edits require final-tree revalidation before commit.

The correctly located blender.security.test.ts suite subsequently passed all four structural checks (/tmp/indii-blender-render-handler-final.log). Combined affected-suite count remains 13 passed. Final delivery diff review completed across native service, IPC declarations/allowlist/preload, MCP connection lifecycle/executor/notification forwarding, runner input/error propagation, frontend render lifecycle and project persistence. No unrelated funding file was altered or staged.

Native Python failure propagation verified against installed Blender 5.2.2: a deliberate RuntimeError under --python-exit-code 1 returned exit 1 (/tmp/indii-blender-python-exit-proof.log). This is expected negative process evidence, not a failed product render. Runner source syntax compilation passed. Full CI shard 1 completed 337 files/2,378 tests passed, 5 files/10 tests skipped; later shards remain live. Final typecheck session 95646 is also live. The final UI guard lint passed exit 0.

Full input-boundary CI session 50497 finished exit 0: four shards passed 2,378 + 2,022 + 2,489 + 2,464 = 9,353 tests, with recorded skips. Final standalone typecheck session 95646 passed exit 0. Because runner collection detection and late UI context guards were edited during that run, a final frozen-tree root gate is required before publishing. No further functional changes are planned for this delivery. All customer and broader completion limitations above remain.
