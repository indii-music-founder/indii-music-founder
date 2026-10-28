# Competitive Teardown & Capability Comparison: Royalti.io vs. indii.music

- **Reference:** `CI-V3-20261021-02`
- **Domain:** Financial & Royalty Operations Acceptance
- **Date:** October 28, 2026
- **Status:** COMPLETED RESEARCH & ARCHITECTURAL SPECIFICATION

---

## 1. Executive Summary

Royalti.io positions itself as an automated royalty processing and accounting software platform targeted at independent record labels, music publishers, and artist managers. Its marketing emphasizes automated CSV ingestion, split contracts, recoupable expenses, catalog metadata linking, and an interactive AI assistant ("Roy") for querying catalog earnings.

This teardown analyzes the public operational capabilities of Royalti.io against the actual implementation within `indii.music`. 

Historically (as identified in GitHub #216), `indii.music` relied on a client-side `RoyaltyService` calculation. The modern `indii.music` architecture has migrated all financial allocations, recoupments, and split computations to server-owned Cloud Functions (`calculateRoyaltyAllocations.ts`, `parseAndIngestReport.ts`), backed by fixed-point integer math (`DecimalMoney`, `shareUnits`), cryptographic tamper-evident receipts, and immutable audit logs.

---

## 2. Evidence-Linked Capability Comparison Matrix

Each capability is classified as:
- **`IMPLEMENTED`**: Fully implemented in production code with passing tests.
- **`PARTIAL`**: Core engine implemented; client integration or UI workflow in development.
- **`MISSING`**: Deliberately deferred or not yet built.
- **`LIVE-UNVERIFIED`**: Implemented in code but awaiting production society/DSP partner transmission credentials.

| Capability Domain | Royalti.io Published Capability | indii.music Implementation & Evidence | Status in indii |
| :--- | :--- | :--- | :--- |
| **1. Statement Formats & Normalization** | Ingests CSVs/TSVs from major DSPs (Spotify, Apple, YouTube) and distributors (DistroKid, TuneCore, CD Baby, Believe). | [`packages/firebase/src/functions/finance/parseAndIngestReport.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/firebase/src/functions/finance/parseAndIngestReport.ts), [`adapters.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/firebase/src/functions/finance/adapters.ts), and [`normalizedStatementMapper.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/firebase/src/functions/finance/normalizedStatementMapper.ts). Auto-detects DistroKid/TuneCore and parses into `NormalizedStatementReport`. | `IMPLEMENTED` |
| **2. Catalog & Rights Matching** | Matches statement rows by track title or ISRC; flags unmatched rows for manual user mapping. | [`packages/shared/src/rights/recordingWorkMatching.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/rights/recordingWorkMatching.ts). Enforces strict ISWC/ISRC linking; auto-quarantines unlinked royalties into `unclaimed_black_box_pool` until society token acknowledgement. | `IMPLEMENTED` |
| **3. Contract Splits & Precision** | Percentage splits (e.g., 50/50, 70/30) with floating-point calculations. | [`packages/shared/src/finance/shareUnits.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/finance/shareUnits.ts) and [`calculateRoyaltyAllocations.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/firebase/src/functions/finance/calculateRoyaltyAllocations.ts). Uses fixed-point integer math (10,000 share units per 1%, total 1,000,000 units). Strict invariant: sum must equal 100% or allocation is blocked. Zero IEEE-754 float drift. | `IMPLEMENTED` |
| **4. Recoupment & Advances** | Tracks advance balances and expense pools against artist revenue before paying out. | [`setRecoupmentBalance.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/firebase/src/functions/finance/setRecoupmentBalance.ts) and [`calculateRoyaltyAllocations.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/firebase/src/functions/finance/calculateRoyaltyAllocations.ts). Automatically deducts recoupment balances in micros from gross before computing distributable net allocations. Cross-tenant isolation strictly enforced. | `IMPLEMENTED` |
| **5. Multi-Currency Normalization** | Converts foreign royalties (EUR, GBP, JPY) to base currency using static or periodic FX rates. | [`packages/renderer/src/services/finance/MultiCurrencyService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/renderer/src/services/finance/MultiCurrencyService.ts). Fixed conversion matrices with snapshot rate capture at report ingestion time to prevent historical statement drift. | `IMPLEMENTED` |
| **6. Payout Ledger & Banking** | Generates PDF statement exports; integrates with PayPal or manual bank wire exports. | [`packages/renderer/src/services/finance/RoyaltyPayoutService.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/renderer/src/services/finance/RoyaltyPayoutService.ts) and Stripe Connect split escrow ([`packages/shared/src/rights/contracts.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/rights/contracts.ts)). Direct automated payouts and held escrow releases. | `PARTIAL` (Stripe active; automated society escrow in test) |
| **7. Negative Adjustments & Reversals** | Handles chargebacks and negative statement rows, deducting from next payout. | Server-owned `calculateRoyaltyAllocations.ts` enforces `blocked_negative_adjustment` when negative deductions exceed provisional held revenues, preventing silent artist debt accrual. | `IMPLEMENTED` |
| **8. AI Assistant Security Boundaries** | "Roy" assistant: conversational chat capable of reading earnings and executing user-prompted report filters. | [`packages/shared/src/security/agentControlIntegrity.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/security/agentControlIntegrity.ts) and `boardroomPolicy.ts`. Indii enforces **strict non-bypassable boundaries**: autonomous agents (Jev / Gemini) cannot alter payout destinations, bypass recoupment balances, or disable audit logging. Attempts log immutable `DENIED` records. | `IMPLEMENTED` |
| **9. Tamper-Evident Receipts & Audit Trail** | Standard database transaction logs. | SHA-256 digest chaining in Firestore transactions ([`calculateRoyaltyAllocations.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/firebase/src/functions/finance/calculateRoyaltyAllocations.ts)), storing cryptographic proof of input checksum, rate snapshot, split matrix, and output allocation IDs. | `IMPLEMENTED` |
| **10. Import Idempotency** | Checks file name or batch timestamp; potential double-import vulnerability if file renamed. | Content-addressable ingestion in [`parseAndIngestReport.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/firebase/src/functions/finance/parseAndIngestReport.ts) and Cloud Storage generation preconditions (`ifGenerationMatch`). Identical file payloads cannot be double-counted. | `IMPLEMENTED` |
| **11. Industry Standard Feeds (DDEX / CWR)** | Primarily CSV/Excel-focused; limited or third-party partner CWR support. | Native ERN 4.3.2 ([`ddexBuilder.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/distribution/ddexBuilder.ts)), RDR-RCC conflict reporting ([`rdrRccTsv.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/distribution/rdrRccTsv.ts)), ECM cluster messaging ([`ecmContracts.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/distribution/ecmContracts.ts)), and CWR 2.1/2.2 batching ([`cwrLifecycle.ts`](file:///Volumes/X%20SSD%202025/Users/narrowchannel/.gemini/antigravity/scratch/imf/packages/shared/src/rights/cwrLifecycle.ts)). | `IMPLEMENTED` / `LIVE-UNVERIFIED` (transmission requires live PRO receiver credentials) |

---

## 3. Deep-Dive Architectural Differences

### 3.1 Client Facade vs. Authoritative Server Engine
In older iterations of `indii.music` (referenced in GitHub #216), `RoyaltyService.ts` calculated allocations in the renderer layer. This was a vulnerability because client-side floats can drift and local execution is subject to tampering.
In the current production architecture:
- `RoyaltyService.ts` in `packages/renderer` is strictly a client facade that proxies requests to the authenticated, Arcjet-protected Cloud Function `calculateRoyaltyAllocations`.
- The server validates caller authentication, verified email, and App Check tokens.
- All balance deductions and allocation distributions run in server-side Firestore transactions with optimistic locking.

### 3.2 Fixed-Point Math vs. Floating-Point Rounding
Royalti.io and traditional web accounting systems often compute splits using IEEE-754 double-precision floats (`amount * (percentage / 100)`). In multi-million row statements, fractional cents accumulate into significant discrepancies or unbalanced payout totals.
`indii.music` enforces:
```typescript
const SHARE_UNITS_PER_PERCENT = 10_000;
const TOTAL_SHARE_UNITS = 100 * SHARE_UNITS_PER_PERCENT; // 1,000,000 units
```
Splits are computed in integer units (micros / millionths of a share), ensuring exact zero-remainder conservation of every cent across all rightsholders.

### 3.3 Autonomous Agent ("Roy" vs. "Jev / Boardroom") Security Posture
Royalti.io promotes its natural-language AI "Roy" as a direct operational assistant. However, granting language models unconstrained write access to payout tables or ledger entries introduces prompt-injection and state-poisoning risks.
Under `indii.music` directives:
- Jev / System One models evaluate data and provide typed judgments (`ConfidenceRating`, `SplitAnomalyJudgment`).
- Agents are strictly isolated behind non-bypassable governance barriers (`packages/shared/src/security/agentControlIntegrity.ts`).
- An agent cannot execute a payout or alter a recoupment balance without explicit human cryptographic signature and immutable audit recording.

---

## 4. Build-vs-Defer Decisions

1. **Build Natively:**
   - **Automated Statement Adapter Registry:** Continue expanding adapters in `packages/firebase/src/functions/finance/adapters.ts` (currently supporting DistroKid and TuneCore; expand to CD Baby and Spotify Direct).
   - **Unmatched Black Box Pool:** Auto-quarantine unlinked revenue in `packages/shared/src/rights/recordingWorkMatching.ts` to protect independent founders from liability.
   - **Arcjet Bot & Replay Defense:** Enforce `packages/firebase/src/functions/security/arcjet.ts` rate limits across all financial submission callable endpoints.

2. **Defer:**
   - **Unvalidated Free-Form Spreadsheet Parsing:** Royalti.io permits arbitrary Excel files with manual UI column mapping. We deliberately defer free-form unvalidated mapping in favor of type-safe schema adapters (`FormatFoundry` / `NormalizedStatementReport`) to prevent corrupted ledger records.
   - **Direct Natural-Language Financial Mutations:** Defer allowing conversational agents to execute payouts via chat commands. All payouts must flow through the structured UI approval pipeline.

---

## 5. Prioritized Smallest Acceptance Test

To guarantee zero regression and verify the competitive superiority of `indii.music`'s server-owned engine:
- **Test Suite:** `packages/firebase/src/functions/finance/__tests__/normalizedStatementMapper.test.ts` and `calculateRoyaltyAllocations.test.ts`.
- **Target Invariant:** Ingest a 500-line statement with multiple currencies, apply advance recoupment deduction, compute 3-way writer/publisher allocations, and assert:
  1. `distributableMicros + recoupmentAppliedMicros === grossRevenueMicros`
  2. Sum of allocated micros across all payees === `distributableMicros` (zero drift).
  3. Re-ingesting the identical payload returns cached receipt with identical hash (idempotency).
