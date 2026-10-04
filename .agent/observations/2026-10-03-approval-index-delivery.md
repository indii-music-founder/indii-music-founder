# Pending tool approval index repair

## Observed failure

Production entry was https://indii.music/, whose visible Log in link opened
https://app.indii.music/. The browser used the genuine pre-existing signed-in
account; no account was created in this journey, no authentication was injected,
and no account or entitlement state was altered. The product showed Founder
lifetime access, pass-through AI costs, unlimited projects, 10 TB storage, and a
zero credit wallet. This is not new-account or free-tier evidence.

The production browser reported `ToolApprovalService.onPendingApprovals` failing
because the per-user `tool_approvals` query required an index. The runtime's
requested fields were status ascending and createdAt descending. The source
query filters status to pending and sorts createdAt descending. The index
manifest contained no tool_approvals index.

## Repair

Add that exact composite index with COLLECTION scope. Keep the existing owner
path, filter, ordering, approval gate and permissions. Production deployment
uses the existing CI firestore:indexes step. Index creation may finish building
after deployment returns; genuine browser revalidation is required.

## Evidence limits

No approval was accepted or tool executed. An index repair is not proof of
approve/resume behavior. Print/export acceptance remains unverified: an existing
owned artwork was opened, multi-format export and print upscale were attempted,
and a Download asset event timed out. The visible loaded bitmap measured
2048x2048; no downloaded file bytes or DPI were measured. Do not close print
acceptance or claim fresh generation from these observations.

## Jev build partner

Live TypeSafe API evidence review: index addressing the read failure 0.62;
index alone proving approval execution 0.05; downloaded print output proven 0.01.
Code review confirms the exact field match; these probabilities are advisory.
Agreement: execution and print gates stay open. Usage: 525 input / 63 output
tokens. Dollar cost was not returned. No key or customer conversation retained.
See `2026-10-03-jev-approval-index-review.json` for questions and raw judgments.

## Validation

Local typecheck, lint (0 errors, 213 warnings), exact index-shape assertion,
and the complete npm run ci passed. Existing test suites are structural checks,
not genuine approval execution or print evidence. Firebase authorization was renewed through the official user-completed flow
on October 4. Remote index reads then succeeded. No alternate credential or
CI deployment was used to bypass the expired-credential stop.
Exact-SHA remote CI and live listener recovery remain unverified until delivery.
