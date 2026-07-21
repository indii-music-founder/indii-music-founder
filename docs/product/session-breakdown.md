# Session Breakdown

**Status:** Planned — delivery is tracked in ISSUE-1175 through ISSUE-1181.
**Audience:** Independent artists who record performance, announcement, studio, backstage, or social content on a phone.
**Source of truth:** [Active Session Breakdown issues](../../.agent/test_ledger/OPEN_ISSUES_V2.md) and the [Session Breakdown roadmap](../flowcharts/session-breakdown-roadmap.md).
**Last reviewed:** July 21, 2026

## Outcome

Session Breakdown is intended to turn one long, real-world phone recording into organized, artist-approved video material. It will preserve the original recording, identify useful sections, synchronize performance footage to the artist's verified master when possible, prepare spoken clips for cleanup, and let the artist review choices before any final timeline, render, or social handoff is created.

This is not an autonomous publishing feature. A completed analysis is not an approved edit, a completed edit is not a render, and a completed render is not permission to post.

## User journey

1. An artist uploads one long phone recording.
2. indii preserves the original and prepares a private editing proxy, guide audio, timing map, waveform, and visual reference material.
3. The artist selects an owned canonical master when the recording contains a performance or lip-sync.
4. indii produces synchronization evidence or clearly reports that the match needs review or was not found.
5. indii proposes organized segments: performances, spoken takes, candid moments, setup, failed takes, and possible bloopers.
6. The artist reviews the proposals, chooses what to keep, and confirms any low-confidence decision.
7. Only approved selections compile into a durable video project.
8. Only a completed, playable private derivative can become a Social or Campaign draft. Posting remains a separate approval.

## Expected behavior

| Artist action | Expected result | Evidence or state | Recovery path |
|---|---|---|---|
| Upload a long phone recording | Original media remains private and unchanged; an edit proxy is prepared | Source receipt, proxy manifest, processing state | Resume upload or retry processing without replacing the original |
| Select a canonical master | Performance sections receive a match, review request, or no-match result | Alignment receipt and confidence | Choose another owned version or add a manual review adjustment |
| Record several takes | indii groups candidate takes and preserves all source ranges | Session plan with alternatives | Restore a rejected range or choose another take |
| Review spoken content | Artist can choose a best take, a blooper, or no use | Approval-ready segment state | Adjust boundaries or keep the original section |
| Choose audio treatment | Artist can compare clean-master, guide ambience, or spoken-audio treatment where supported | Reversible audio recipe | Change or disable the recipe before approval |
| Approve selections | A durable project revision is created only after approval | Approval receipt and timeline revision | Create a new review version; do not overwrite the original approval |
| Create a social-ready output | A private playable derivative may become a draft | Terminal render receipt | Retry a failed render or revise the approved project; posting still requires separate approval |

## Review and approval boundaries

The artist remains the editorial decision-maker. indii may recommend a complete take, surface a corrected announcement, flag an unclear master match, or suggest a candid moment as a blooper. It must not silently delete footage, replace spoken words, publish content, or treat an analysis as consent.

Low-confidence synchronization, ambiguous repeated sections, stale source material, significant audio damage, and incorrect-master signals require explicit artist action before the workflow can continue.

## What indii does not do

- It does not modify the original recording or the canonical master.
- It does not generate music; all music remains the artist's own uploaded and verified material.
- It does not claim perfect repair for clipped, wind-damaged, distant, overlapping, or heavily masked speech.
- It does not infer ownership or usage rights from an audio match.
- It does not publish or schedule a post automatically.

## Failure and recovery states

| State | Meaning | Artist-facing response |
|---|---|---|
| Upload interrupted | The original has not finished transferring | Resume the transfer; do not ask the artist to start again when a resumable session is available |
| Master match needs review | Evidence is insufficient or more than one version may fit | Ask the artist to choose the correct master or make a manual review adjustment |
| No match found | The recorded audio cannot be safely connected to a master | Keep the footage available for spoken, silent, or manual editing use |
| Audio damage flagged | Cleanup may not produce a natural result | Offer another take, captions, a voice-over, silent B-roll, or master-only use |
| Plan is stale | Source, master, or analysis changed after review began | Require a fresh review version rather than applying old decisions |
| Render is incomplete | There is no usable output yet | Keep the draft private and offer retry/revision; do not expose it to Social or Campaign |

## Data, privacy, and rights posture

Original phone footage, canonical masters, proxies, guide audio, plans, approvals, and outputs are intended to be owner-scoped and private. The original and master are immutable inputs; cleanup, proxying, and rendering produce separate, traceable derivatives. Model-assisted analysis is constrained to bounded evidence and structured recommendations. The product must preserve source/master generation, ownership, approval, and output lineage so it can explain what was used to create an output.

## Dependencies and delivery order

The feature is intentionally ordered:

1. Secure intake and proxy manifest — ISSUE-1175.
2. Deterministic guide-audio-to-master synchronization — ISSUE-1176.
3. Grounded segmentation, transcription, and recommendations — ISSUE-1177.
4. Reversible cleanup and mixing recipes — ISSUE-1178.
5. Director's Cut review and explicit approval — ISSUE-1179.
6. Master-relative timeline compilation — ISSUE-1180.
7. Private derivatives and typed Social/Campaign drafts — ISSUE-1181.

The roadmap also depends on existing work for canonical master verification, durable timeline persistence, private rendering, and terminal/playable handoff eligibility. See the active issue entries for exact acceptance criteria.

## Acceptance evidence

This document may change from **Planned** to **Live and verified** only after the relevant issue acceptance criteria have evidence. That includes owner-isolation tests, immutable source/master checks, timing fixtures at the beginning/middle/end of a render, explicit approval checks, terminal output checks, and the required live verification where an external or production boundary is involved.

## Claim inventory

| Candidate claim | Status | Evidence needed before public use |
|---|---|---|
| “Turn one long phone recording into reviewed selects.” | Not publishable yet | End-to-end upload, analysis, review, and project-compilation proof |
| “Sync performance video to your real master.” | Not publishable yet | Verified master alignment fixtures and artist review flow |
| “Keep your original footage and music untouched.” | Not publishable yet | Immutable source/master and derivative-lineage proof |
| “Clean spoken clips and mix your own music underneath.” | Not publishable yet | Audio recipe, loudness, preview, and approval evidence |
| “Create social-ready drafts without auto-posting.” | Not publishable yet | Private playable output and explicit handoff-approval proof |
