# Task Ledger: Complete Every Open/Partial Issue (Session 2026-07-14)

## Current Goal
Finish every issue in `.agent/test_ledger/OPEN_ISSUES.md` that is not `✅ FIXED`. Nothing is skipped or deprioritized by "importance" — the only ordering rule is: **finish PARTIAL (already-started) items before starting fresh OPEN items.** Within each phase, work in ledger order. Every item gets full end-to-end verification (typecheck + tests + acceptance criteria proven) before being marked `[x]`.

**Total scope:** 36 PARTIAL + 88 OPEN = 124 issues.

## Execution Protocol (per /go workflow)

1. One task per `/go` iteration: read code → find root cause → write fix → test → verify → commit.
2. Do not mark `[x]` unless every acceptance criterion in the issue's own ledger entry is proven with evidence (test output, not assertion).
3. Commit message: `fix: ISSUE-### — <description>`.
4. Update this file and `.agent/test_ledger/OPEN_ISSUES.md` in the same commit.
5. Loop to the next unchecked item in order. No re-sorting by severity/impact — every item ships.

---

## PHASE 1 — Finish PARTIAL Issues First (36 items)

- [ ] ISSUE-694 — Cloud Functions IAM remediation incomplete (webhooks/healthchecks unreachable)
- [ ] ISSUE-765 — Google API surface audit: every non-Firebase Google integration broken
- [ ] ISSUE-773 — Omni storyboard claims scenes synced; no storyboard data actually reaches render
- [ ] ISSUE-775 — Omni labels output "SynthID Protected" without verifying any watermark
- [ ] ISSUE-777 — Image Creator exposes video settings while hiding/ignoring real image settings
- [ ] ISSUE-784 — DDEX compiler emits fake DPID + ERN 4.2 doc app can't actually deliver
- [ ] ISSUE-786 — YouTube/Meta rights exports default to claims user may not legally hold
- [ ] ISSUE-807 — Video "Audio" toggle promises a control that's only prompt text
- [ ] ISSUE-813 — ISWC readiness treats any supplied code as registered, no provenance check
- [ ] ISSUE-814 — Distributor "connect" succeeds with unverified credentials
- [ ] ISSUE-820 — Short-form social delivery queues to token/platform names the worker doesn't support
- [ ] ISSUE-856 — Distributor statement normalization is prompt-only but reports success
- [ ] ISSUE-869 — Temporal inpaint selectable with Lite/Fast models, then fails
- [ ] ISSUE-938 — Enhanced Showroom video jobs can hang forever or save to wrong project
- [ ] ISSUE-939 — Inventory "Sync" is only a 1.5-second animation
- [ ] ISSUE-946 — Discord/Telegram webhook auto-announcement event wiring still unbuilt
- [ ] ISSUE-961 — Audio Distribution QC treats every M4A/MP4 as lossless master, no codec inspection
- [ ] ISSUE-962 — Browser Audio QC base64-encodes + sends full master twice in parallel, no size/duration limit
- [ ] ISSUE-963 — Publishing asset validation converts decode failures into compliant-looking metadata
- [ ] ISSUE-964 — Publishing marks release submitted/metadata-complete when packaging fails
- [ ] ISSUE-969 — Distribution submission builds "delivery" metadata with no audit trail
- [ ] ISSUE-972 — Registration desktop automation wired to a nonexistent Electron API
- [ ] ISSUE-980 — CRM "Launch Drop" marks metadata-only campaigns active, no real creation
- [ ] ISSUE-982 — Quick Capture treats `null` queue result as success, can erase input
- [ ] ISSUE-983 — "Save to Notes" clears media after queue acceptance without verifying persistence
- [ ] ISSUE-984 — Dispatch tasks have no atomic claim; multiple desktop listeners can double-process
- [ ] ISSUE-987 — Voice memo bytes always relabeled WebM; empty/unsupported recordings not caught
- [ ] ISSUE-988 — Venue pin capture can hang indefinitely; rejects valid zero latitude
- [ ] ISSUE-989 — Generation timeout doesn't cancel pending command; late recovery/retry double-spends
- [ ] ISSUE-990 — "Recent Generates" mixes every relay response image into gallery, no command-type scoping
- [ ] ISSUE-994 — Performance Video sends final render callable the wrong request/response
- [ ] ISSUE-1007 — "Cover Art" mode promises distributor compliance but never verifies delivered file
- [ ] ISSUE-1013 — Social account wizard drops creative profile/banner assets before signup handoff
- [ ] ISSUE-1015 — Built 3D music-video stage is local preview only, can't save/render
- [ ] ISSUE-1016 — Sequence Architect trajectory can't affect synthesized frame or Director handoff
- [ ] ISSUE-1025 — Mobile Controller impersonates desktop presence, falsely reports "Studio Connected"

## PHASE 2 — Every OPEN Issue (88 items, ledger order)

- [ ] ISSUE-766 — Social media marketing stack fully built, ZERO platforms configured
- [ ] ISSUE-785 — Founder music-identity/royalty-registration checklist incomplete, not tied to release readiness
- [ ] ISSUE-787 — Workflow video nodes submit invalid Veo options + mismatched cost reservations
- [ ] ISSUE-790 — PRO dispatch marks registrations SUBMITTED without external delivery
- [ ] ISSUE-791 — Registration completeness can show 100% after confirming only one organization
- [ ] ISSUE-792 — MLC "BWARM" export wrong shape, fabricates legal data
- [ ] ISSUE-794 — Copyright guidance and fees stale/misleading
- [ ] ISSUE-795 — "Golden Metadata" asserted without running the Golden validator
- [ ] ISSUE-800 — Merlin readiness assumes exclusive rights instead of collecting proof
- [ ] ISSUE-809 — Video editor export has no completed cloud artifact path; local export overwrites fixed temp path
- [ ] ISSUE-811 — Agent ISRC tool claims local/generated identifiers are officially registered
- [ ] ISSUE-815 — Touring setlist tools overstate PRO royalty submission and payout math
- [ ] ISSUE-816 — Creator-protection readiness scores identifiers as protection evidence
- [ ] ISSUE-817 — DDEX deal mapper converts physical-only releases into digital streaming/download deals
- [ ] ISSUE-818 — Music metadata tools claim ID3 tags/splits embedded when only Firestore changed
- [ ] ISSUE-819 — Temporal inpaint UI creates zero-length still-image mask, passes as video mask
- [ ] ISSUE-821 — Royalty release gate declares "ready to release" after PRO only
- [ ] ISSUE-822 — Distribution checklist can show "Ready" from static defaults instead of release evidence
- [ ] ISSUE-823 — Publishing rights compiler marks registration ready while MLC/IPI/ISWC missing/pending
- [ ] ISSUE-824 — Tax form collection disconnected from payees, renders 0/0 progress
- [ ] ISSUE-826 — Waterfall payout UI/TS contract/Python engine use incompatible payload/report shapes
- [ ] ISSUE-827 — Sync-clearance upload path disconnected from clearance service and compiler
- [ ] ISSUE-828 — Licensing request flow says agreement draft generated when it only changes status
- [ ] ISSUE-830 — Living-plan tools return `success: true` when required project/auth context missing
- [ ] ISSUE-831 — PRO repertoire lookup can invent registry records from model memory
- [ ] ISSUE-833 — Merch mockup tool labels AI product photos as POD-ready manufacturing assets
- [ ] ISSUE-834 — POD connection state based on registered adapters, not verified provider credentials
- [ ] ISSUE-836 — Marketing campaign platforms allowed by UI rejected by campaign execution
- [ ] ISSUE-837 — A/B campaign tool marks tracking pixel configured without creating/verifying any pixel
- [ ] ISSUE-839 — Playlist pitch email tool asks model to "scrape" Spotify with no scraper/source
- [ ] ISSUE-840 — Credential storage falls back to localStorage and raw Firestore fields
- [ ] ISSUE-841 — Permission audit reports "Live Audit Complete" from guessed organization roles
- [ ] ISSUE-843 — Multiple active user-scoped feature collections missing Firestore rules
- [ ] ISSUE-844 — Pre-save builder exposes shareable campaign URL without publishing page or storing leads
- [ ] ISSUE-846 — Release velocity benchmark reports projections from hard-coded follower baseline
- [ ] ISSUE-847 — Social analytics connection state can be inferred from denied/stale token/cache paths
- [ ] ISSUE-849 — Limited-drop wizard says drop is live and fans notified without persistence or notification
- [ ] ISSUE-850 — Merch pricing engine presents default benchmarks as AI/market-backed recommendations
- [ ] ISSUE-851 — Storefront deployment creates one fixed-price Stripe link for all items
- [ ] ISSUE-852 — Production UI says manufacturing started when only a pending Firestore request exists
- [ ] ISSUE-855 — Split escrow UI treats zero collaborators as ready to release
- [ ] ISSUE-857 — Royalty forecasts use fixed approximate rates/confidence as if verified
- [ ] ISSUE-858 — DDEX readiness treats local metadata fields as delivery authority
- [ ] ISSUE-873 — Mask-URI image edits don't tell the model the edit is masked
- [ ] ISSUE-874 — Image Search grounding toggle not forwarded by direct generation
- [ ] ISSUE-875 — Video duration normalized after client cost reservation
- [ ] ISSUE-876 — "No People" video safety setting overridden for frame-based jobs
- [ ] ISSUE-877 — Long-form video reserves requested duration but generates full 8-second blocks
- [ ] ISSUE-878 — Long-form video completion returns only first segment as final output
- [ ] ISSUE-879 — Video "Audio" toggle is only prompt text, not an API control
- [ ] ISSUE-880 — Video grounding preflight uses image model ID the gateway rejects
- [ ] ISSUE-882 — Sync-license checkout activates license without license terms or usage scope
- [ ] ISSUE-890 — "Complete" GDPR data export omits major app data, two inconsistent implementations
- [ ] ISSUE-891 — Account deletion can be partial while UI reports permanent removal
- [ ] ISSUE-892 — DevOps agent tools report successful local config when backend control functions aren't wired
- [ ] ISSUE-893 — Resized-image tool returns synthetic `gs://` paths for missing variants, still reports success
- [ ] ISSUE-894 — Storage scrub agent calls nonexistent cleanup callable, reports queued scrub
- [ ] ISSUE-895 — Screenwriter "Generate AI Scene" is a timer with hard-coded storyboard content
- [ ] ISSUE-896 — Screenwriter Veo handoff collapses storyboard structure into one prompt string
- [ ] ISSUE-899 — Merch "Mint New Item" creates a marketplace product, not an on-chain token
- [ ] ISSUE-903 — Failed Songfile search creates mechanical license record marked `not_required`
- [ ] ISSUE-905 — Marketing Agent deployment tool descriptions claim live provider actions tools don't perform
- [ ] ISSUE-913 — Generation started in one project filed into whichever project is active when it finishes
- [ ] ISSUE-914 — Selecting multiple reference files can retain only the last file that finishes reading
- [ ] ISSUE-916 — Video assets selectable as image frames/references, uploaded with image semantics
- [ ] ISSUE-919 — Deleting a generated Gallery asset only hides it locally; reappears, remains billed
- [ ] ISSUE-920 — Creative Gallery resolves `gs://` image URLs then ignores the resolved URL
- [ ] ISSUE-922 — Gallery upload reports all files uploaded before reads/cloud persistence finish
- [ ] ISSUE-923 — Video Editor asset library excludes all uploaded assets and all music/audio history
- [ ] ISSUE-924 — Video Editor timeline/project state entirely volatile, shared as one global default project
- [ ] ISSUE-944 — EPK "Generate" publishes nothing but exposes nonexistent live URL; press-photo upload inert
- [ ] ISSUE-947 — Rapid Capture reports completed OCR/ingest after only a two-second timer
- [ ] ISSUE-948 — Quick Capture silently saves a contact without the photo the user selected
- [ ] ISSUE-950 — Campaign image retry uses stale state; last failed job can be relabeled complete
- [ ] ISSUE-952 — AI campaign output bypasses business validation, can create empty/off-brief/unschedulable plans
- [ ] ISSUE-953 — Creative-to-Marketing handoff acknowledged and deleted before brand asset durably saved
- [ ] ISSUE-957 — Failed Brand Interview sends discard typed prompt + all selected attachments before retry
- [ ] ISSUE-958 — Brand Assets reports successful add/move/delete without durable confirmation, leaks uploads
- [ ] ISSUE-959 — Product Showroom relabels every JPEG/WebP source as PNG, doesn't verify decoding
- [ ] ISSUE-960 — Product Showroom draft/results global across projects, survive project switches
- [ ] ISSUE-965 — Closing/replacing a Publishing release draft abandons uploaded masters and cover art
- [ ] ISSUE-971 — Registration manual fallbacks claim form data saved/downloadable but provide only a portion
- [ ] ISSUE-974 — Marketplace can sell songs/albums/merch/tickets/services with no deliverable or fulfillment contract
- [ ] ISSUE-976 — Stem-pack upload/listing lifecycle leaves partial/orphaned files on failure/close/retry
- [ ] ISSUE-979 — CRM destroys launch draft after `createCampaign` converts persistence failure into `null`
- [ ] ISSUE-995 — Client-side Cloud Run renders explicitly public; storyboard compile calls queued marker a shareable URL
- [ ] ISSUE-1043 — GitHub Release missing updater manifest files (blocked on ISSUE-992 founder signing secrets — external action required, will flag when reached, not skip)
- [ ] ISSUE-1045 — App icon/favicon gives no visual cue for which surface is open (web/Electron/remote)

---

## Non-Goals
- Do not mark any issue fixed without meeting all its acceptance criteria with pasted evidence.
- Do not use placeholders, TODOs, or partial solutions to close an item.
- Do not reorder items by perceived importance — ledger order within each phase only.
- Do not silently skip an item. If genuinely blocked on external action (secrets, third-party account, human decision), say so explicitly in this file next to the item and move to the next one — the item stays unchecked, not deleted.
