# Open Issues V3 execution and closure plan

## Contract and current baseline

Execute against `.agent/test_ledger/OPEN_ISSUES_V3.md`; V2 and the root
`OPEN_ISSUES.md` are historical. The October 29 reconciliation preserved the
50 October 28 findings, ISSUE-1553–1602. The November 2 baseline also includes
later numbered production findings through ISSUE-1623. Imported allegations
remain subject to current-source verification.

At baseline `d713233451110725b0d86f0194d39c45394a2736`, the ledger had
**378 numbered sections, 374 unique IDs, 100 nonterminal IDs, 7 ambiguous
statuses, 1 research decision, and 266 terminal-labelled IDs**. ISSUE-1608–1614
accounted for all seven ambiguous statuses. Their normalization makes 107
nonterminal and zero ambiguous without closing any customer path. Four
historical duplicate IDs remain preserved. These are ledger classifications,
not freshly verified defect or acceptance counts. The seven older evidence
rows (#1383, #1390–1395) still await reconciliation. ISSUE-1603 / GitHub #563
remains partial in this ledger despite its GitHub issue being closed. Run:

```bash
node scripts/issue-ledger-inventory.mjs
node scripts/issue-ledger-inventory.mjs --json
```

The [current acceptance inventory](audits/open-issues-v3-closure-inventory-2026-11-02.md)
links every pending ID to its finding, source paths and original acceptance.
Dated intelligence proposals are separate work, not extra numbered defects.

For this objective the user authorized task branches on October 29. Start each
coherent delivery from current `origin/main`, preserve unrelated dirty work,
publish its exact branch SHA, and verify matching remote CI. Do not merge or
deploy without explicit authorization. This exception does not change the
repository's default mainline policy for future objectives.

## 1. Reconcile before rebuilding

Compare each finding with current source and later evidence, including the
October 29–31 production findings #1604–1623. Record the
remaining acceptance, owner, prerequisites, implementation paths, and smallest
observable next check. Historical probes, test totals, merged PRs, and semantic
judgments do not prove current production behavior. Resolve contradictory
checkpoint language (#1158, #1510) and stale acceptance descriptions (#1406,
#1407, #1448, #1449) without deleting historical evidence.

The first delivery preserves findings, normalizes ambiguous statuses, supplies
a reproducible inventory and retains the closure-evidence integrity guard.
Subsequent deliveries implement confirmed gaps rather than bulk-closing rows.
Prioritize #1614's unintended in-app post, #1609's false Complete state,
#1617's stuck Running state, and #1618's repeated denied tools within their
respective safety and workflow batches. Source repairs for #1608, #1609, and
#1614 still need genuine post-deployment acceptance.

## 2. Establish safe boundaries for each journey

Triage #1553–1602 against current implementation, prioritizing tenant ownership,
authorization, local execution/filesystem exposure, and financial/webhook
integrity. Critical inspection targets include remote MCP (#1593), local MCP
and Blender (#1598), Electron/DAW (#1599), admin backend (#1600), rights-session
cleanup (#1601), and SDK/API contracts (#1602).

Resolve canonical collection/path and owner models before adding Firestore or
Storage permissions. Activate the Firestore skill for any Firestore work and
rule auditing when changing rules. Do not broaden access to make a failing
journey pass. Block only the affected journey on its relevant security gaps;
independent work can proceed.

## 3. Prepare founder and external prerequisites

Track signing/updater assets (#1163), Meta Business (#1173), Stripe (#1372),
integration secrets (#1373), social ownership (#1428), and Maps (#1448).
Use the issue's latest evidence: #1448 already records key restriction changes;
recheck configuration rather than assuming the earlier key task remains open.

For #1169, verify private engine-dsp/Cloud Tasks provisioning, invoker/enqueue/
signing IAM, configured target identity, and a hash/generation-bound receipt
that does not modify the canonical master. Infrastructure writes and deployment
require separate authorization. Missing or expired credentials require the
official clickable sign-in flow and waiting for the user; no alternate identity
or authentication path.

## 4. Verify financial and destructive operations

- #1406: reconcile existing refund/reversal implementation in Stripe webhook
  handling, replay safety, and the remaining finance-review dispute boundary.
- #1407: validate draft → checkout → paid webhook → manufacturing/status return;
  unpaid orders must remain unable to manufacture.
- #1424: align business terms and server entitlements, then prove one genuine
  eligible purchase, actual usage boundary, recognition, and persisted rights.
- #1413: inspect orphan selection/ownership and dry-run evidence before any
  narrowly approved disposable-artifact deletion; retain the disabled flag
  until acceptance is satisfied.

Genuine provider sandbox evidence supports sandbox claims only. Real charges,
refunds, fulfillment, paid generation, external transmission, or destructive
cleanup require bounded explicit authority.

## 5. Complete product acceptance and implementation gaps

Verify enrollment/invitation/milestone delivery (#1420), real homepage clips
and the artist journey (#1426/#1427/#1431), generated audio/video terminal
artifacts (#1158/#1159), DSP analysis (#1169), and real AI spending/alert rollout
(#1168). Clips must capture actual behavior; activate the required video skills
when creation begins.

For Boardroom (#1449), distinguish its structural-test acceptance from genuine
stream/billing acceptance; the October 28 structural suite pass is already
recorded. Keep billing-settlement guards. For #1458–1461, verify delivered files,
reopen/reload, keyboard/setup accessibility, treatment preview/render, and
Last Frame output plus settlement.

For #1510, connect the missing demuxed encoded-frame feed before benchmarking.
Relevant paths: renderer `services/video/nle/`, compiler `nle*.ts`, and shared
NLE types. Record hardware/browser/media and measure the ledger thresholds:
<80 ms seek on a 60-minute long-GOP source, ≤1 ms drift over 30 minutes,
keyframe scrub behavior, export comparison, and two-hour memory stability.
Do not equate component existence or unit-test totals with those results.

## 6. Resolve decisions, claims and proposal acceptance

Verify Evolas (#1354) using the production-reality audit only after reviewing
its authenticity. Settle orphan-module product decisions (#1437), retain
quarantined calculator claims (#1430) until source/legal/financial requirements
are met, and prove owner catalog publication/reload/downstream retrieval
(#1452). A prepared/exported rights artifact is not a registered work.

Attach dated intelligence and incident follow-ups to their existing parent
findings. Record verify/implement/defer decisions; create new defect work only
for a demonstrated distinct failure.

## Verification and definition of done

Run relevant structural regressions, lint/typecheck, and repository delivery
gates for each coherent implementation. Inventory tests use literal Markdown
inputs and prove parsing/counting only. For this reconciliation, run:

```bash
node --test scripts/issue-ledger-integrity.test.mjs scripts/issue-ledger-inventory.test.mjs
node scripts/validate-issue-ledger.mjs origin/main
node scripts/validate-mainline-workflows.js
node scripts/validate-flowcharts.js
node scripts/check-ci-node-runtime.mjs
npm run validate:capabilities
```

Live claims require `https://indii.music/`, genuine UI authentication, the
actual displayed plan, visible results and reload/downstream persistence.
Record environment, account provenance, tier, time, deployed revision where
available, and blocked steps. No injected sessions, seeded customer state,
impersonation, or artificial entitlements. Legacy mocks prove structure only.

An issue closes only with its residual acceptance satisfied, required
commit/CI evidence and any genuine external receipt. Otherwise retain PARTIAL/
OPEN with its exact blocker and next action. Each branch delivery reports the
remote SHA and matching CI; report “Remote CI not scheduled” when appropriate.
The overall plan remains incomplete while required acceptance is blocked.
