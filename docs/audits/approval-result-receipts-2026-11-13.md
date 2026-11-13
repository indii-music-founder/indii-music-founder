# Approved tool receipt preservation — 2026-11-13

Base: origin/main 5b1c29e7a. Branch: codex/approval-result-receipts-20261113.

## Reproduced defect

ToolApprovalService replaced the actual result of an approved non-computer tool
with a generic failure when the final approval-record write rejected. That lost
success state, artifact IDs, failure details and durable receipt metadata even
though a tool response was available. A rejected computer-completion callable
was only logged, leaving approval controls to display ordinary success.

## Resulting behavior

Both completion-record rejection paths now retain the exact returned tool
success/error/message/data/failure and existing metadata, adding
metadata.approvalPersistence with status unconfirmed and the approval ID.
A lost acknowledgement may follow a successful write, so the status is not
labelled failed. No write is retried and no action is re-executed.

All four approval consumers (right-panel action, dashboard widget, dashboard
banner action and banner bulk action) use one warning formatter. The warning
states whether the tool reported success or failure and separately explains that
its approval record could not be confirmed. Bulk approval stops at the first
unconfirmed completion instead of dispatching further actions in that batch.

The existing durable pre-dispatch claim, original-argument validation, consumed
session binding and trusted computer authorization boundaries remain in force.
Tests verify a second attempt cannot dispatch a consumed session binding.

## Evidence and limits

The two success/failure receipt-preservation regressions fail against the original
service implementation. With the fix restored, 94 tests across six service,
BaseAgent validation and approval UI suites pass. Renderer typechecking,
touched-file lint (no errors or warnings), staged test-quality and whitespace
checks pass. These are structural tests with simulated service boundaries; they
do not prove a genuine account, deployed backend, or customer action.

Jev selected preserving known tool outcomes with separate record uncertainty and
stopping bulk dispatch (jev-1.14.0; 472 input / 40 output tokens). This bounded
policy judgment is not code certification.

This change retains receipts returned to the current caller. It does not persist
arbitrary tool payloads in approval documents, recover them after a renderer
crash, prove provider idempotency, or supply a reconciliation workflow. Existing
claimed records can still require manual effect verification. Mandatory audit,
cross-restart recovery and exact deployed-commit acceptance remain open.
