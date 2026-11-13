# Explicit memory-write receipts — 2026-11-13

Base: origin/main 711f66b95. Branch: codex/memory-write-receipts-20261113.

## Reproduced failures

MemoryBankService swallowed rejected writes as empty arrays, and index_memory
unconditionally reported successful indexing. The regression fails against the
original tool implementation. Engine-backed save_memory and save_user_memory
also treated presentation strings such as Failed or Skipped as successful saves.

## Implemented contract

- AlwaysOnMemoryEngine exposes a structured stored/skipped/unconfirmed receipt.
  Stored requires a primary persisted memory ID and an unchanged active owner.
  Legacy text presentation delegates to the receipt path for compatibility.
- File ingestion and session extraction also require IDs before claiming/counting
  new saves. Activity accounting tracks overlapping ingestions by owner generation;
  an older owner's completion cannot clear the new owner's activity state.
- Semantic indexing validates nonempty record IDs/content and propagates rejected
  or incomplete acknowledgements. Aggregate search behavior retains the separate
  successful-empty versus unavailable distinction.
- The three explicit save tools claim success only with a stored ID. Skips use
  MEMORY_NOT_SAVED; uncertain responses use MEMORY_SAVE_UNCONFIRMED. BaseAgent
  stops either outcome using its actual agent identity instead of prompting an
  automatic repeated write. Unauthenticated indexing stops before dispatch.
- A successful primary save is not conditional on secondary indexing success.
  Existing optional-index callers catch failures; no primary document is undone.

## Evidence and limits

The 119-test selected run spans 12 memory, tool and BaseAgent suites. It covers
receipt status, missing/malformed IDs, lost responses, duplicate skips, owner
change, concurrent text/file ingestion activity, semantic service failure and
agent termination after uncertain storage. Renderer typechecking and touched lint
passed with eight existing BaseAgent any-type warnings. These are structural
service/SDK doubles, not genuine cloud-write or cross-device recall acceptance.

No storage schema/rules, credentials, production memory or account state changed.
The updated memory flowchart separates inspected assembly sources and actual
save acknowledgements, replacing unsupported universal five-layer/verified-truth
claims with current source paths and explicit limits.

Remaining: cross-restart idempotency/reconciliation, durable secondary-index
backfill, complete retrieval coverage, alignment-rule effectiveness across all entry points,
project-specific memory isolation, semantic/monetary execution admission and
real-account exact-deployed persistence/recall. A projectId returned by the legacy
tool is caller context, not proof of enforced project-scoped storage. The full
original primitives objective remains open.

The inspected normal context path already forwards alignmentRules through
ContextPipeline.userAlignmentRules to AgentPromptBuilder's alignment section.
This source-level wiring is confirmed; successful retrieval and model compliance
still require genuine-path acceptance. It is not a newly implemented feature.

Workflow route: Modify/T2, authorized isolated branch delivery; certified middle,
go, ci-validate and npm typecheck/lint/ci capabilities; installed dependencies and
capability catalog prerequisites verified. No production/browser acceptance or
external communication capability is selected. Repository-wide typechecking and
lint passed (278 existing warnings, no errors); exact full CI evidence is retained
in the command logs and delivery report. Dev preflight permits missing renderer
configuration and does not prove production configuration readiness.

The first full CI pass found one additional affected dependent:
agent_restore.test.ts still mocked the old ingest string API and asserted an
unconditional Memory stored message. Its corrected registry contract requires the
actual acknowledged ID and separately rejects an uncertain write. All five
registry tests and its focused lint pass. The full gauntlet is rerun against that
correction; its final exit/result is reported observationally, not inferred from
the focused pass.
