# Judgment adoption and execution admission — 2026-11-13

Base: origin/main 981d02397. Branch: codex/simple-choice-confidence-20261113.

## Fixed adoption boundaries

Skill routing, video preview-error guidance and upscale-model selection accepted
bare strings and Choice objects without checking confidence. In skill routing this
contradicted the documented promise to abstain when confidence was low. Such a
response could install a playbook after deterministic matchers had missed.

These three consumers now require an object with type choice, exact membership
in the offered choices and finite numeric confidence from 0.65 through 1. Bare
strings, arrays, other answer types, undeclared IDs, absent/coerced/non-finite/
out-of-range confidence and confidence below the threshold abstain. Named
per-consumer constants keep the adoption policy reviewable. This is not a semantic
calibration claim; the threshold needs labelled evaluation for each consumer.

The existing caller fallbacks remain: ProductSkillRegistry returns no additional
playbook after an uncertain deterministic miss; VideoPopout can retain the raw
preview error; UpscalerService can retain its deterministic model selection.
Deterministic skill matches still precede Jev, and their semantic quality is a
separate review item.

The new boundary regression matrix fails against the base implementation. Caller
coverage verifies that an uncertain skill result does not install a playbook.
Cooldown regression fixtures now supply a valid typed high-confidence answer;
their independent-failure assertions remain intact.

## Confirmed budget boundary still open

ExecutionTokenBudget is bound through explicit agent contexts. BaseAgent reserves
for generation and AgentLoopService reserves for evaluation. In contrast, the
central judgment helpers construct httpsCallable(typesafeJudge) directly without
passing the execution ledger. The separate live-conversation and guardrail
judgment transports also require reconciliation; the original consumer inventory
remains relevant and is not replaced by these three fixes.

An AST count of direct literal httpsCallable(typesafeJudge) constructions found
91 in typesafeJudgments.ts, one in liveConversationJudgments.ts, and one in
JevGuardrailService.ts. These counts describe those three inspected files, not a
complete repository call graph or 93 independent production consumers.

The server callable accepts state/questions/model, authenticates and rate-limits
the user, and records provider token usage through a fire-and-forget aggregate
recordUsage call. It returns answers and optional requestId, not the provider's
usage or a durable run-budget receipt. Rate limiting and aggregate usage logging
do not establish cumulative per-execution admission. No monetary or semantic-call
budget guarantee is added by this branch.

A complete repair requires explicit execution identity/context through transport
and callers, authenticated authoritative admission before provider submission,
conservative handling of unknown usage, durable request/usage settlement receipts,
and idempotent resume accounting. Non-agent calls need their own explicit policy;
a mutable global current execution would mix concurrent conversations. Provider
limits and pricing must be verified before selecting reservation amounts rather
than inventing a token/cost ceiling. All central and non-central transports and
callers must then be inventoried and exercised, including concurrent/recovered
runs. These are outstanding implementation requirements, not completed design.

## Verification limits

Structural parser/caller tests are not evidence of semantic calibration, genuine
provider behavior, deployed operation, model retraining or complete primitive
coverage. Jev's bounded claim check selected describing these three adoption
boundaries while leaving calibration and execution budgets open (jev-1.14.0;
465 input / 38 output tokens); it is not code certification.

Local validation: 579 tests across six central judgment/caller suites, renderer
typechecking, touched lint (two existing warnings), staged test-quality and
whitespace checks passed. No production generation, routing action, model change,
merge or deployment was performed.
