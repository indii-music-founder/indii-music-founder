# Prompt additive ranking contract — 2026-11-13

Base: origin/main 981d02397. Branch: codex/prompt-additive-ranking-contract-20261113.

## Reproduced failures

The helper parsed cand_ IDs as integer prefixes, accepting undeclared answers
such as cand_1junk, cand_01 and cand_1.0. It also accepted missing/invalid/low
confidence. A successful provider selection returned only its eight-item shortlist,
dropping every remaining input candidate.

## Resulting behavior

The helper first snapshots the deterministic ranking. It offers at most the first
eight entries, binding each generated ID to that precise ordering. Adoption
requires a typed Choice, exact offered ID and finite numeric confidence from
0.65 through 1. The threshold is policy, not semantic calibration.

A valid choice promotes exactly one item in the full baseline. All other entries
retain their order, including the unjudged tail and repeated references. Inputs
can be readonly/frozen, and returned entries retain their identity and metadata.
A none, unknown, malformed or uncertain response, disabled feature or provider
failure retains the complete deterministic baseline. No additive is inserted into
the artist's prompt by this helper; the menu still requires their selection.

## Evidence and limits

The initial regression suite fails 14 cases against the base implementation.
With the fix, 522 structural tests across central judgments, the ranking contract
and BrandPromptAdditivesMenu pass. A strengthened non-Choice boundary also passes
in the final focused 20-test ranking run. Renderer typechecking, touched lint
(two existing warnings), staged test-quality and whitespace checks pass.

One direct live Jev fixture used a watercolor/pastel prompt with chrome, watercolor
paper and pastel-light candidates. Jev returned cand_2 at confidence 0.41
(jev-1.14.0; 423 input / 54 output tokens). The new adoption policy would retain
the deterministic baseline for that uncertain response. This single ambiguous
fixture is not calibration, a server-proxy acceptance check or a live product
journey. No product generation, merge or deployment was performed.

The current menu supplies at most eight frequent entries, but the exported helper
now preserves its full input contract for other callers. Broader relevance
calibration, cross-consumer evidence contracts, execution-bound semantic/monetary
budgets and exact-deployed genuine-account acceptance remain open.
