---
description: Request-bound report_bug approval, server persistence, and best-effort GitHub issue synchronization.
---

# Bug Reporting and Approval

Reviewed 2026-11-05. Agent-requested reporting has an approval gate before the reporting tool runs. A chat reply expressing consent currently does not establish that the pending approval was executed.

```mermaid
flowchart TD
    Agent["Agent requests report_bug"] --> Policy["BaseAgent tool policy"]
    Policy --> Pending["Persist pending approval with bound tool, arguments, user, and session"]
    Pending --> Pause["Return AWAITING_TOOL_APPROVAL and show Approvals panel"]
    Pause --> Choice{"User chooses exact pending request"}
    Choice -->|Deny| Denied["Record denied; do not execute"]
    Choice -->|Approve| Claim["ToolApprovalService: validate binding and claim execution"]
    Claim --> Tool["BugReportTools.report_bug validates required fields"]
    Tool --> Callable["Firebase callable reportBugFn"]
    Callable --> Auth["Require verified non-anonymous user and abuse protection"]
    Auth --> Hash["Server hashes title, module, severity, and description"]
    Hash --> Persist["Attempt Firestore bug_reports write"]
    Persist --> Token{"Server GitHub token available?"}
    Token -->|No| Skipped["GitHub skipped"]
    Token -->|Yes| Search["Search open issues by sanitized title phrase and module label"]
    Search --> Match{"Search returns a match?"}
    Match -->|Yes| Comment["Append duplicate-report comment to first match"]
    Match -->|No or search fails| Create["Attempt issue creation"]
    Comment --> Result["Return separate Firestore and GitHub statuses and issue URL if available"]
    Create --> Result
    Skipped --> Result
    Result --> Outcome["Record approval execution outcome and surface actual tool result"]
    Claim -->|Ambiguous dispatch failure| Reconcile["Keep claimed outcome unresolved for reconciliation"]
    Pause -.-> Consent["Conversational consent currently enters another model turn"]
    Consent -.-> Gap["Missing request-bound chat continuation: repair required"]
```

## Transition Breakdown

1. `BaseAgent.ts` binds the implementation, original arguments, schema, and execution context to a persisted approval request. It pauses without executing the tool.
2. `governance/ToolApprovalService.ts` approves a specific ID, validates the binding, and records a durable claim before dispatch. Denial does not execute the call. Ambiguous dispatch failures must not invite an automatic duplicate execution.
3. The current chat path lacks a request-bound natural-language approval continuation. Repeated “I approve” messages can produce another tool proposal and pause. A repair must identify the exact request and preserve its arguments and identity checks.
4. `BugReportTools.ts` calls **reportBugFn**, not a callable named reportBug. The server computes a truncated SHA256 key from title, module, severity, and description; the earlier chart incorrectly placed hashing in the client.
5. `reportBugFn.ts` attempts Firestore persistence before GitHub synchronization and reports channel statuses separately. GitHub credentials remain server-side. Authentication or abuse-protection rejection stops the callable before these writes.
6. GitHub deduplication is best effort: phrase search plus a module label, followed by the first match. Search errors fall back to creation. This is not an exact-title check, author restriction, or atomic guarantee against duplicate issues.

## Acceptance evidence still required

Verify approving and denying the same pending request in the real UI; ensure consent cannot authorize a different request; test interruption and duplicate clicks; confirm the original result returns to the conversation. Confirm a returned issue URL and persistence status before claiming a report was filed. An existing issue proves one report reached GitHub, not that every approval path works.


## Approval owner boundaries

```mermaid
flowchart TD
    OWNER["Capture authenticated owner for approval ID"] --> READ["Read and validate request-bound approval"]
    READ --> CHECK{"Owner still matches after awaited work?"}
    CHECK -->|No| STOP["Do not dispatch; review under original account"]
    CHECK -->|Yes| CLAIM["Persist approval claim or obtain desktop authorization"]
    CLAIM --> RECHECK{"Owner still matches before tool dispatch?"}
    RECHECK -->|No| STOP
    RECHECK -->|Yes| EXECUTE["Execute original approved implementation once"]
    EXECUTE --> RESULT["Keep actual returned tool outcome"]
    RESULT --> COMPLETE{"Owner still matches?"}
    COMPLETE -->|No| UNCONFIRMED["Return outcome with approval persistence unconfirmed"]
    COMPLETE -->|Yes| WRITE["Record outcome under original owner"]
    WRITE -->|Write unavailable| UNCONFIRMED
```

Owner checks also fence denial reads and transactions. Desktop denial and
completion payloads carry `expectedOwnerId`; the callable compares it with the
authenticated UID before reading the approval. Authentication remains the source
of authority. The expected owner field is optional for existing clients.
Completion requires a boolean success value, so a string such as `"false"` cannot
be recorded as success through coercion.

An owner change before dispatch leaves the tool unexecuted; any persisted claim
may still need review under the original account. A change after dispatch does
not erase the actual outcome or authorize a retry. Effects already started are
not cancelled by these checks. Structural account-switch tests cover these
boundaries; genuine multi-account UI acceptance remains unverified.
