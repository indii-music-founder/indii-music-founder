# Tool outcome audit reconciliation — 2026-11-13

Base: origin/main 5b1c29e7a. Delivery branch: codex/tool-audit-durability-20261113.

## Confirmed gap and change

BaseAgent's ordinary dispatch path returned credential-storage and non-retryable
failures before reaching its audit block. Other results scheduled an unawaited
write and could finish before the server acknowledged it. A logged rejection did
not provide a receipt or identify the event by its local invocation ID.

The dispatch path now awaits the existing authenticated logAuditEvent callable
before emitting/storing its completed tool result or taking terminal result
returns. The callable has a ten-second timeout. It continues to determine owner
identity on the server; the client does not submit a user ID in the payload.

Tool result metadata carries an explicit audit receipt: confirmed with the
server's document ID, unconfirmed after a rejection or malformed acknowledgement,
or unavailable when there is no user context. Tool success, error, data, failure,
and existing receipt metadata remain authoritative. A lost audit response is not
proof of a failed write. There is no automatic audit retry or repeated tool
execution. The audit links to the tool event with toolCallId and retains optional
agent fingerprint; arguments, generated assets, and raw tool errors are excluded.

## Scope still open

This fixes completion evidence in ordinary BaseAgent dispatch, not the full
mandatory-audit or external-effect recovery requirements:

- The approved-tool path in ToolApprovalService executes through a separate lane.
  Its durable claim and result state are not equivalent to a server audit receipt.
- A renderer can terminate after dispatch and before outcome persistence. A
  completion write cannot close that crash window or prove external-effect identity.
- Pre-dispatch durable intent/admission, cross-restart reconciliation and external
  provider idempotency remain necessary for mandatory evidence and safe recovery.
- No-user executions explicitly have no authenticated audit receipt.
- Audit metadata is retained in tool results; no new artist-facing audit-recovery
  control or persisted reconciliation queue is supplied by this change.
- Other execution lanes and direct tool/service calls require their own inventory
  and integration. No all-tools or exactly-once guarantee is made.

## Verification

Structural service tests hold acknowledgement pending, validate the returned log
ID, cover rejected/missing/malformed responses and synchronous setup failure, and
check status, identity linkage and absence of browser ownership. Orchestration
regressions hold terminal results until acknowledgement and preserve a successful
image receipt with an unconfirmed audit without repeating the tool.

The live Jev bounded policy check selected retaining the authoritative outcome
with audit uncertainty instead of rerunning the action or claiming an audit was
saved (jev-1.14.0; 466 input / 41 output tokens). This is design feedback, not code
certification or deployed-path evidence.

No production tool action or audit write was submitted. Structural tests do not
establish genuine-account acceptance, backend availability or deployed behavior.

Local verification: 244 tests across 20 selected governance/BaseAgent suites
passed; renderer typechecking passed; touched-file lint passed with eight existing
BaseAgent any-type warnings and no errors; test-quality and whitespace checks
passed. The successful-action audit-uncertainty regression failed against the
unchanged base implementation, then passed with the fix restored.
