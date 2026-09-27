# GitHub Issue #317 Origin Audit

**Issue:** #317 — Boardroom status response overclaims production readiness  
**Created:** 2026-09-26 15:18:09 UTC / 11:18 AM EDT  
**Creator shown by GitHub:** the-walking-agency-det  
**Purpose:** Determine whether #317 proves the in-product automatic bug-report-to-GitHub path fired.

## Conclusion

**#317 does not match the repository's in-product `reportBugFn` output contract.**

The strongest evidence supports describing #317 as engineering work created through the connected founder/agent GitHub workflow, not as proof that the product's automatic Firestore-to-GitHub bug-report pipeline completed end to end.

GitHub does not expose enough provenance in the issue itself to identify the exact client/tool invocation beyond the account that created it.

## Why #317 does not match reportBugFn

Current `packages/firebase/src/functions/agent/reportBugFn.ts` creates a new GitHub issue with:

- title format: `[SEVERITY] <bug title>`;
- body heading: `## Bug Report`;
- fields for Severity, Module, Reported, and Reporter;
- sections for Description, Steps to Reproduce, Expected Behavior, Actual Behavior;
- footer: `Reported from indii`;
- labels: `bug`, `severity:<severity>`, and `module:<module>`.

Issue #317 instead has:

- title: `Boardroom status response overclaims production readiness`;
- no severity prefix;
- no bug-report metadata block;
- no reportBugFn labels;
- a hand/agent-authored engineering structure: Problem / Expected behavior / Why this matters.

That format is inconsistent with an issue emitted directly by the current `reportBugFn` create path.

## GitHub provenance available

GitHub reports:

- creator: `the-walking-agency-det`;
- created at: 2026-09-26T15:18:09Z;
- no labels;
- no comments at creation;
- no issue events/timeline entries exposing a more specific creation client.

Therefore the exact originating tool cannot be proven from GitHub metadata alone.

## Contrast with #319

Issue #319 is titled:

`[MAJOR] Image generation failing to meet 3000x3000 resolution requirement`

and contains the expected Bug Report structure and bug/severity/module labels.

However, #319 explicitly states that it was **backfilled** from Firestore after seven genuine in-product reports were discovered stranded because the deployed GitHub-forwarding leg lacked required runtime configuration.

Commit `5504361c9` documents the repair:

- reports were successfully preserved in Firestore;
- GitHub forwarding had not occurred;
- a canonical repository fallback was added;
- live secret/environment configuration was repaired separately.

Therefore #319 is evidence that genuine in-product reports existed and were durable/recoverable, but it was not itself proof of a fresh automatic post-repair roundtrip.

## Fresh post-repair live proof — #332 and #333

That remaining proof gate was crossed later on 2026-09-26.

GitHub issues **#332** and **#333** were created about 44 seconds apart and match the in-product `reportBugFn` contract:

- title format: `[MAJOR] Image generation tool fails to output 3000x3000 resolution`;
- body heading: `## Bug Report`;
- reporter: `wiil@indii.music`;
- footer: `Reported from indii`;
- GitHub creator: `wiil-tech`;
- labels: `bug`, `severity:major`, and `module:Creative Studio`;
- label descriptions explicitly identify severity/module as auto-reported.

This is fresh, post-repair evidence that the product-originated reporting path can reach GitHub successfully.

The two near-simultaneous issues are also evidence of a remaining hardening task: duplicate suppression did not collapse these reports into a single issue under this timing pattern. Treat that as a deduplication/concurrency gap, not as a failure of the reporting path itself.

## Current implementation after the #317 audit

Two follow-up commits materially strengthen the path:

- `ebd06ad8e` — adds deterministic readiness-overclaim detection plus a JEV/TypeSafe `claims_verified_readiness_without_evidence` judgment. Detected overclaims are routed through `reportBugFn`, with a six-hour per-signature cooldown and server-side deduplication. GitHub-sync failures are surfaced visibly rather than hidden in logs.
- `c075761bf` — removes the previously denied client-side `bug_reports` Firestore write and makes the server callable the single durable write path. The tool now returns success only when the callable confirms `firestore: 'ok'`. If persistence fails, it returns a tool error and instructs the agent not to claim the bug was documented.

The important engineering rule is now explicit in code: **an agent may not claim that it performed a durable action unless the action path confirms durable evidence.**

## Current truthful product claim

Safe:

> indii.music implements conversational/product-native bug reporting with server-side durable persistence, GitHub forwarding, deduplication, visible failure signaling, and founder/internal triage. The reporting tool is explicitly prevented from claiming success when persistence did not occur.

Also safe:

> Boardroom readiness overclaims now have deterministic and JEV guardrails that can route the defect into the same reporting pipeline automatically.

Live-verified:

> Fresh post-repair in-product reports have completed the reporting path into GitHub Issues (#332 and #333), using the expected auto-reported metadata and app-originated issue format.

Remaining hardening:

> Near-simultaneous duplicate reports still need stronger deduplication/concurrency handling.

## Why this still matters

The failure is useful engineering evidence rather than something to hide:

1. reports survived the forwarding outage;
2. the outage was diagnosable;
3. the repair was made;
4. stranded reports were recoverable;
5. a fresh post-repair roundtrip was subsequently proven by #332/#333;
6. the duplicate pair exposed the next bounded hardening task: deduplication under near-simultaneous reports.

That is consistent with the broader indii.music engineering rule: distinguish implemented, tested, and live-verified behavior rather than collapsing them into one claim.

**Audited / updated:** 2026-09-26
