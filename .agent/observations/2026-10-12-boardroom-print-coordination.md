# Boardroom action and print preparation contract

User scope: coordinate all Boardroom action requests; require explicit crop
confirmation before preparing a poster whose aspect ratio changes.
The proposed Boardroom-specific right-side panel is deferred at the user's
request until this workflow is working. Crop and step confirmations are
portaled above the existing Boardroom overlay so this work can be reviewed now.

The application owns each execution step. Department heads do not gain peer
delegation authority. Needed heads are seated in the same request, original
asset references are captured before routing, and downstream steps receive
structured tool evidence. Discussion/capability turns enforce read-only tool
execution. Queued jobs, pending approvals, failed tools, and partial persistence
are distinct from completion and prevent dependent work from starting.

Print preparation performs pixel enlargement and DPI tagging, retains the 4×
and 80-megapixel limits, confirms an actual focal crop before enhancement,
preserves full-resolution gallery masters, and records the version without
inventing compliance results. File creation, gallery saving, and version
recording are separately reported. Optional metadata is omitted from the
version document rather than written as undefined.

TypeSafe: live-intent routing is wired through the existing server-side
typesafeJudge callable. The question distinguishes discussion, capability, and
action; confidence below 0.80 uses the existing generative routing provider.
If neither decision is valid, no action runs. The renderer holds no TypeSafe
key. No shadow/live agreement or token cost has been measured yet.

Validation distinction: new scheduler/receipt/serialization tests use pure
literal data; existing service-double suites remain structural only. Production
was reached from https://indii.music/ through the visible login link. The
existing authenticated account is wiil, with Founding Member / Lifetime access
shown by the product; it was not created during this task. The changed export
and Boardroom journey still require verification after rollout.

October 13 production follow-up: ee686d771 passed exact-SHA deployment run
38399349595. Reusing the named gallery original incorrectly produced a Keeper
browse_local_files dependency, then skipped Creative and Distribution when the
browser correctly rejected desktop lookup. This was a planning-context defect:
the source manifest was only provided after planning, and generated gallery
assets were absent from the frozen source snapshot. The follow-up supplies
source labels/IDs to planning separately from the original user request, freezes
gallery originals as gallery-N aliases, and grounds print ownership in the
single Creative tool, which already performs approval and persistence.

A subsequent explicit-source request could not classify intent because live
provider calls rejected a missing App Check token. User-authorized official
Studio Sign Out and Sign In restored the same existing account through the
normal UI and browser-saved credentials. No tokens were injected or debug
checks bypassed. Whether provider access and the full print path now work is
still unverified; exact pixels, PNG pHYs metadata and persisted gallery/version
results must be measured before declaring production print success.

After normal re-sign-in, the explicit-source Boardroom request dispatched to
Creative and showed the real crop dialog above the overlay. Original source
1792×2400 enlarged with browser ESRGAN into a saved 3000×3000 PNG. Actual browser-
loaded master bytes (14,681,347 bytes) contain pHYs 11811×11811 pixels/metre,
unit 1 = 299.9994 DPI on both axes; all PNG chunk CRCs validate. SHA-256:
e42f8f1dd43b3c98877ab7a3c52780ba014d73f323babb202398b38e6b54e07c.
Gallery items and tool receipts remained visible after normal reload. Version
persistence is supported by the completed real tool receipts, not a model claim.

The same live run exposed two further failures: Creative repeated the successful
print tool, producing print-1791913652477 and print-1791913866059; the 300s timeout
also temporarily claimed completion from an unrelated change in the shared
gallery. Follow-up execution reuses only a completed identical tool receipt
within its own Boardroom step (different args, failed/queued/partial receipts
remain distinct), and Boardroom timeout notices no longer infer success from
global gallery counts. Named-source routing and duplicate prevention still need
post-follow-up live verification. A 9:16 poster remains unverified.

October 14: 8f82918a0 passed exact-SHA deployment run 38482290737. A fresh
Studio session reached through the production Log in link reused the same
existing Founding Member account. The visible 9:16 gallery source measures
1080×1920. Requesting it by name for poster_11x17 with crop confirmation still
failed before execution: the generated graph was conditional/mapped. The
decomposer's example schema contradicted its Boardroom rules by advertising
condition, inputMapping and waitCondition "any". The follow-up removes those
fields from the Boardroom example, explains that the tool owns crop approval,
and validates before returning a graph with one feedback-based replan. It never
strips conditions to force execution. Poster completion remains unverified until
the follow-up deployment is exercised in the real UI.
