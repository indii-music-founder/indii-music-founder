# Primitives follow-up — 2026-11-12

This is a bounded continuation of the full primitives review, not certification
that every primitive or customer path is complete.

## Implemented in this follow-up

- Execution token-budget bindings survive Boardroom task contexts, discussion
  contexts, direct-mode contexts, delegated tools and graph-node context clones.
- TypeSafe argument/internal/deadline failures cool down the affected judgment;
  transport-wide failures retain the shared outage cooldown. All 91 central
  judgment availability/failure scope pairs were checked for consistency.
- Creator-protection judgments require valid confidence. Protective clearance
  cannot hide conflicting grant/risk evidence, and unresolved model results
  cannot lower retained baseline risk severity.
- Department journey suggestions identify heuristic versus Jev provenance.
  Deterministic suggestions no longer claim invented model confidence.
- Boardroom makes the mounted background workspace inert and hidden from assistive
  technology while preserving drafts. Global dialogs and their popup surfaces use
  layers above the workspace.
- Shared dialog focus restores persistent autofocus editors to their opening
  trigger, follows native positive-tabindex ordering, and respects stacked dialogs.
  Command menu registration follows its portal lifecycle. Quick Notes joins the
  focus stack and closes on Escape only when topmost.
- Shared prompt input composes textarea change listeners with draft updates,
  allows callers to consume Enter before submission, preserves native Enter when
  no submit callback exists, and prevents child props from overriding loading
  disablement. Four new regressions failed before those changes.

## Verification

The combined structural suite passed 1,002 tests across 63 files covering shared
UI, central judgments, creator protection, department suggestions, dialogs,
governance, graph/loop orchestration, core tools and agent-service callers.
Changed-file lint passed with 11 existing warnings and no errors; diff whitespace
and the test-quality scan passed. Renderer typechecking passed. Full-repository
checking is recorded in the delivery report after it finishes.

Earlier production inspection found the background workspace still exposed beneath
Boardroom and observed historical chat errors. It did not submit a new generation,
approval, purchase or upload. These local changes are not deployed and the
structural suite does not prove live-user behavior, real billing or free-tier
acceptance.

## Still open in the original review

- Complete judgment consumer inventory, calibration and uncertainty handling.
- Semantic judgment calls and cumulative monetary admission in execution budgets.
- Durable side-effect receipts, recovery and mandatory audit evidence.
- Attachment orphan cleanup, cross-device clearing races and ambiguous save/create
  acknowledgments, followed by genuine persistence verification.
- Durable memory continuity and full shared UI/motion coverage.
- Production acceptance of the exact delivered commits using genuine authorized
  accounts and service responses. Phone testing remains deferred by the founder.
