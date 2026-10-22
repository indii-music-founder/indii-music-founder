# Remote-to-Studio workflow acceptance

Scope: a capture or instruction begun on the remote must finish in the intended desktop tool, retain its source, expose failures, and produce the promised saved result. Queue acceptance alone is not completion. Public social posting and other irreversible actions require a separate user action.

## Evidence boundaries

Inspected main baseline: `fef6c774148749ebdb1b83fa669c8ac003890016`.
Live observation on 22 October 2026: `https://app.indii.music/mobile-remote` and `https://app.indii.music/`, connected Chrome indii.music profile. Existing genuine signed-in account; account creation was not observed; actual subscription plan unknown. Controller initially displayed disconnected, then became ACTIVE without authentication changes. No mocked service, injected state, permission change, or public post was used.

A normal remote text capture, “QA remote handoff — desktop note verification (22 Oct 2026).”, appeared in desktop Quick Notes after a reload. Selecting the note showed its full original content. This proves that capture's persisted handoff, not immediate cross-tab synchronization or all remote journeys. Evidence outside Git: `outputs/remote-note-desktop-reopened.png` in the task workspace.

Jev's earlier offline source assessment identified routing and social-format gaps. It is supporting analysis, not evidence of operating a phone camera or successfully publishing a post.

A follow-up offline assessment of the broader source findings used `jev-1.14.0`: it selected partial readiness, truthful completion reporting as the next priority, and conditional Instagram publication. All three selections agreed with the source-inspection baseline; this is not an accuracy benchmark. Recorded usage: 828 input and 117 output tokens, 953 ms observed request latency, dollar cost unavailable. Raw review: `outputs/remote-handoff-jev-review.json` outside Git. Only code-level findings were supplied, without account data or media.

## Journey inventory

Reachability matters: the current `MobileRemote` mounts Quick Capture, StudioWork (including AgentChat), EncounterFeed, RoadMode and Settings. `CommandPad`, `StatusDashboard` (and its mileage modal), `ApprovalQueue`, and the default `GenerationMonitor` component are not mounted by the current remote. StudioWork does reuse GenerationMonitor's gallery helper, which does not inherit the unmounted component's timeout logic. StreamView has a switch case but no current tab entry. Legacy and backend-only rows below are protocol findings, not claims that customers can reach those controls today.

| Remote start | Expected desktop finish | Source findings / acceptance still required |
| --- | --- | --- |
| Selfie or photo → Photo Editor | Saved editable artwork; cutout, replacement photo background and text; retained original | Repaired in `remote-photo-social-handoffs`: explicit photo destination, desktop importer, saved document receipt and active-artwork protection. Disconnected remotes request Studio reconnection instead of claiming to open an editor on the phone. Live repaired path pending. |
| Photo → Video Editor | Intentional still-image timeline clip | Explicit video destination preserves this separate choice. Verify clip, ordering, save/reopen and rendered duration. |
| Video → Video Editor | Playable timeline clip | Import uses synchronous store action; it was not an unawaited async API. Capture feed now waits for desktop completion and surfaces errors instead of silently opening a local fallback. Media decoding/duration and project save/reopen need live checks. |
| Photo/video/document/receipt → Notes | Persisted note with usable uploaded attachment | Direct Notes tool returns a local ID before cloud sync completes. Separate `remote-note-durable-receipts` repair awaits the cloud write before desktop completion. Verify attachment opens after reload; document scan does not imply OCR, receipt capture does not establish a booked expense. |
| Voice memo → Notes | Playable saved audio | Direct save path exists. Transcription is a distinct capability; verify actual browser recording MIME, playback and downstream reuse. |
| Text live moment → Notes | Persisted original text | Baseline live check passed after desktop reload. Repair now retains text until terminal desktop response and exposes errors. Repaired live check pending. |
| Voice/photo contact intake | Saved encounter, extraction, reviewed contact | Durable encounter is the primary path; relay is advisory. Verify extraction status, manual review, desktop Contacts and saved source. Do not treat “parsing” as a saved verified contact. |
| Manual contact intake | Persisted entered fields on the remote and desktop | Baseline Save Contact failed twice in the normal production UI because it tried to review pending AI analysis. `remote-manual-contact-save` saves both records atomically without AI extraction, retains captured media, and uploads optional portraits to real object paths. Deployed acceptance remains pending; see that branch's contact acceptance report. |
| Venue pin | Saved pin plus optional Scout findings | Coordinate validation exists. Agent completion currently has no typed lead/result receipt. Verify coordinate consent, pin persistence and actual saved leads separately. |
| Legacy mileage modal | Saved expense and note, or explicit partial failure | The unmounted StatusDashboard owns this modal. Expense-write failure can still imply full logging; it also uses an unverified hard-coded mileage rate. Do not revive it without repair. This is not the active Road room's workflow. |
| Attach to Boardroom | Attachment ready in chat, then sent with the user's instruction | Attachment preparation is not completion of an agent task. Verify MIME, upload, remote chat send and desktop response. |
| Chat / agent instruction | Visible response and actual requested artifact | Response subscription exists. General dispatch completion does not certify the requested tool result; verify task-specific output and failures. |
| Flyer / image generation | Returned real image visible on phone and usable on desktop | Active StudioWork gallery consumes response images. Its request-sent message is queue acceptance. The unmounted GenerationMonitor's timeout handling does not prove this surface's behavior. Verify image, reuse, timeout and duplicate-spend behavior. |
| Road conversational request | Desktop agent response visible back on phone | Active RoadMode calls the local AgentService and changes local module state rather than using the paired relay. Separate `remote-road-chat-handoff` repair routes remote Road requests through the existing Studio chat relay. Verify actual response and requested saved artifact; Places search remains local. |
| Navigation / playback / Show Me / wake | Correct desktop room/action and reflected remote status | Wake is active in Settings; CommandPad's navigation/playback/Show Me controls are legacy and unmounted. Protocol support alone is not a visible feature. Verify reachable commands and failure feedback before certifying them. |
| Computer task | Requested desktop artifact through genuine executor lease | Electron computer API and lease are required. A browser-only Studio cannot establish this capability. Agent return is not a durable artifact receipt. |
| Video render dispatch | Actual saved render with job/project receipt | Dedicated renderer path exists. Verify original saved project, actual video, render failure and remote receipt. |
| Finished artwork → social composer | Flattened cloud image, correct dimensions, reviewable caption/account/time | Separate `artwork-social-composer` repair: existing portrait preset, compositor output and preselected image in composer. Baseline only downloaded a file. Live repaired flow pending. |
| Schedule / publish | Queued receipt, then actual platform publication receipt | Instagram requires connected authorized account and validated media. Current Twitter backend delivers text only; TikTok/YouTube scheduling is unavailable. Never imply universal image posting. Public publication has not been tested or authorized here. |

## Repair and acceptance sequence

1. Correct import intent and truthful receipts. Photos must not replace open artwork; failed imports preserve the remote capture; unknown task types must fail. Retry a dispatch and inspect the saved document rather than accepting a toast.
2. Complete portrait artwork and composer handoff. Apply cutout, add background beneath subject, add text, undo/redo, save/reopen and compare the flattened composer image to the editor. Verify 1080×1350 output without stretching or losing editable cover artwork.
3. Repair partial-success reporting in mileage, instructions and commands using actual saved result IDs or appropriately bounded “requested” status. Check queue timeout followed by late desktop recovery before retrying; do not duplicate generation or publication.
4. Run normal paired-device acceptance for each row: online, sleeping, disconnected/reconnected, busy executor, permission denied, upload failure, account change, duplicate click, reload and downstream reuse. Hardware capture, external account authorization and third-party publication remain explicit verification boundaries.

Additional recovery finding: dispatch tasks are atomically claimed, but the inspected dispatch path does not have the command executor's watchdog/recovery semantics. A desktop crash after claim needs an explicit uncertain/interrupted outcome; blindly replaying it risks duplicate notes, renders, generations or external effects. Recovery remains open, not verified by the normal note check.

Transport finding: editor imports and optional contact portraits supplied explicit `undefined` payload fields to Firestore, whose renderer configuration does not ignore them. `remote-dispatch-payload-save` omits those optional fields while preserving zero coordinates, amounts and empty strings. This is required alongside the editor route repair; a correct desktop destination cannot help a task that fails before queueing.

Pure tests and legacy structural suites are regression checks only. This inventory is intentionally not an all-flows PASS. Each row needs its own visible result and persistence evidence before closure.
