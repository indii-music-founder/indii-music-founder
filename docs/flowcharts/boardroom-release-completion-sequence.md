# Boardroom Release Completion Sequence

**Purpose:** Define the dependency-safe path from the green Gen2 baseline to a
truthful, production-evidenced Boardroom release without overwriting concurrent
work or treating unit tests as live acceptance proof.

```mermaid
flowchart TD
    BASE["Exact main 34f504e7f<br/>CI 30544501763 green"] --> RES["Agent-stream reservation lifecycle<br/>billing helper + Firebase gateway + renderer client"]
    RES --> RESGATE["Focused validation<br/>full CI<br/>exact-main deployment green"]
    RESGATE --> PEOPLE["ISSUE-1135 No People safety<br/>creative gateway + focused test"]
    PEOPLE --> PEOPLE_GATE["Focused validation<br/>exact-main CI green"]
    PEOPLE_GATE --> IMAGE["Boardroom image reliability<br/>durable receipts + authoritative tool result"]
    IMAGE --> IMAGE_GATE["Renderer validation<br/>exact-main CI + deploy green"]
    IMAGE_GATE --> CAP["Capability truth audit<br/>server-attested contract if still required"]
    CAP --> OPS["Operational truth cleanup<br/>failed function + health workflow + issue ledger"]
    OPS --> ACCEPT["Authenticated Boardroom acceptance matrix"]
    ACCEPT --> CONVERSATION["Specialist conversation<br/>no general fallback"]
    ACCEPT --> IMAGE_E2E["Image reservation<br/>provider result + settlement + recovery"]
    ACCEPT --> VIDEO_E2E["Video ownership + staging<br/>one provider job + receipt"]
    ACCEPT --> PLAN_E2E["Durable marketing plan<br/>pause + resume + progress"]
    ACCEPT --> EXTERNAL["Calendar and social approval gates<br/>no unapproved external mutation"]
    ACCEPT --> MOBILE["Cross-device monitoring<br/>approval + resume"]
    CONVERSATION --> UI["Responsive and state-matrix acceptance"]
    IMAGE_E2E --> UI
    VIDEO_E2E --> UI
    PLAN_E2E --> UI
    EXTERNAL --> UI
    MOBILE --> UI
    UI --> END["/end cleanup<br/>canonical preserved<br/>local main equals origin/main<br/>latest exact main CI green"]
```

## Step-by-Step Transition Breakdown

1. **Green baseline to reservation lifecycle:** Begin only from the exact
   `origin/main` SHA whose complete CI and deployment run is green. Integrate
   the current-main reservation candidate without generated declarations or
   unrelated workflow files. Preserve typed capacity errors, specialist
   fail-closed routing, and the Gen2 callable/stream contracts.
2. **Reservation lifecycle to its gate:** Prove owner/type/status claims,
   pre-provider voids, settlement before the terminal completion frame,
   cancellation propagation, typed 429 behavior, and bounded stale-claim
   reconciliation. Deploy the required Firestore index with the same release.
   Do not open a dependent lane until the exact pushed SHA is green.
3. **Reservation gate to ISSUE-1135:** Apply the independent creative-gateway
   fix only after the reservation release is green. Verify that explicit
   `dont_allow` survives every frame/reference path and reaches the Veo worker
   unchanged. Require a separate exact-main green result.
4. **ISSUE-1135 gate to Boardroom image reliability:** Rebuild the preserved
   image patch on the exact new main SHA. Remove synthetic founder/admin
   receipts, fail closed when durable reservation creation fails, and preserve
   an authoritative completed or typed-failed image result when only the
   post-tool summary is throttled. Never retry the provider or fall back to a
   general model.
5. **Image gate to capability truth:** Audit the current deployed contract
   before using stale capability work. If the gap remains, define a fresh
   server-attested session, entitlement, connector, and live-health contract.
   Unknown state must not silently advertise a capability as available.
6. **Capability truth to operational cleanup:** Reconcile repository and live
   function inventories, remove or repair the stale failed function through
   the official deployment path, correct the misleading health workflow, and
   update issue states only to the level proven by exact CI, deployment, logs,
   and authenticated checks.
7. **Operational cleanup to authenticated acceptance:** Exercise the real
   Boardroom with genuine credentials. Record available, degraded, or blocked
   for specialist chat, image, video, long-running plans, approved calendar
   actions, approved social publishing, and cross-device continuation. Planned
   code and mocked tests do not count as production proof.
8. **Acceptance to UI completion:** Complete the 80–200% zoom, Electron window,
   secondary-window, responsive-container, and state matrix. Extend the shared
   workspace contract to the remaining creative surfaces, then finish the
   authorized asset/job, quote/recovery, handoff, timeline, node, and evaluation
   work without weakening billing, rights, or ownership boundaries.
9. **UI completion to `/end`:** Remove only release-owned temporary artifacts,
   leave user-owned canonical workflow files untouched, make all ledgers and
   handoffs truthful, require local main to equal `origin/main`, and finish on
   the latest exact main-branch CI and deployment run with no attributable
   failure.

## Release Invariants

- Only the release coordinator pushes `HEAD:main`; no force-push or task branch
  is part of the integration path.
- Every incoming commit is audited in the clean detached integration worktree
  and receives an exact-main CI gate before a dependent commit lands.
- Synthetic receipts, general-model fallback, client-authoritative capability
  claims, and fabricated production evidence are forbidden.
- Paid production generation, real calendar events, and live social posts
  require explicit founder authorization at execution time.
- Original uploads, unrelated cloud assets, concurrent worktrees, and the
  canonical user-owned workflow edits remain preserved.
