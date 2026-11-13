# Conversation clear persistence — 2026-11-13

Base: origin/main 981d02397. Branch: codex/session-clear-generation-20261113.

## Reproduced gaps

Clear chat deleted one snapshot without a durable parent fence. Another device
could append during deletion. An attachment upload could start before a clear and
commit afterward. The store also retries failed persistence calls, so retrying an
acknowledged-but-response-lost clear with a fresh identity could delete messages
created after the first clear completed.

## Implemented protocol

- Each clear has one operation object/ID retained by the store across retries.
- The initial transaction binds its starting generation, advances messageEpoch,
  claims clearingOperation, and removes legacy inline history.
- A failed clear leaves the fence intact. The same operation resumes; a distinct
  explicit clear can take over with a new generation.
- Server-required queries drain pages of at most 400 messages. Each deletion
  transaction reads and verifies the parent operation/generation. A superseded
  worker cannot delete a page or release a newer fence.
- The final transaction releases the fence and records lastClearedOperation.
  A retry of that completed operation returns without deleting again. Generation
  binding also rejects an older retry after a newer clear replaces that receipt.
- Appends capture the server generation before uploading and bind the original
  message object across retries. Edits verify both parent and child generations.
- Generation/clear/delete conflicts stop automatic store retries and preserve the
  failed local message rather than resubmitting it as new work.

Rules validate bounded generation/operation fields on parent create and update,
prohibit generation rollback/skips, bind the completion receipt to its clear,
and prevent resurrecting inline history after the first clear. Child writes use
getAfter for same-batch parent changes and require the current active generation.
Owner authority remains pinned. Generation zero supports existing legacy sessions.

## Verification

The stale-append regression fails against the unchanged base implementation.
With the fix, 62 structural service/attachment/store tests across five files pass.
The STANDARD emulator suite passes all 371 rules tests, including cross-owner
writes, invalid/skipped/rolled-back generations, clearing-time writes, legacy
writes after clear, takeover transitions, and a same-batch fence/append race.
Renderer and Firebase-test typechecking passed. Touched lint passed with three
existing any-type warnings in agentSessionSlice and no errors. Whitespace, staged
test-quality and flowchart validation passed.

Read-only CLI inspection reconfirmed the existing production `(default)` database
is STANDARD / FIRESTORE_NATIVE. No production data was changed. All writes in
rules verification target an isolated local emulator. These tests do not establish
a genuine-account save/clear journey or deployed behavior.

Jev selected stable, generation-bound retry identity rather than fresh deletion
on every retry (jev-1.14.0; 460 input / 40 output tokens). This is bounded policy
feedback, not correctness certification.

## Rules audit and remaining work

Scoped audit score: 4/5. Create/update authority, generation transitions, same-batch
post-state, completion identity and stale-client rejection were reviewed. The
inherited session/message payloads still lack complete bounded schemas; this
change validates the new protocol fields rather than claiming global rules
hardening. Owners can still intentionally delete their own data.

Client and rules require coordinated delivery. After a clear, old clients that
omit generations fail closed. The operation object survives current-process
retries, not renderer termination. New explicit clears can recover interrupted
fences; no unattended cross-restart recovery is claimed.

Attachment orphan inventory/cleanup, local-cache clear coherence, session-creation
acknowledgement recovery, execution-start generation binding for agent output
that has not yet begun persistence, complete schema validation and genuine
exact-deployed-commit acceptance remain open in the original primitives review.
