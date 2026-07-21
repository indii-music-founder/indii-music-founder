---
name: product-docs
description: Create and maintain trustworthy product documentation from approved features, issue plans, shipped behavior, or product conversations. Use whenever a feature needs an internal product reference, artist-facing help guide, expected-behavior checklist, troubleshooting guidance, or a factual claim inventory for future website copy. Use it before describing a feature publicly so documentation, QA, support, and marketing share the same product truth.
---

# Product Docs

Turn product intent into documentation people can rely on. A useful feature document does more than explain a happy path: it makes the expected result, review boundaries, limitations, recovery path, and proof of completion clear enough for an artist, support teammate, QA tester, and builder to agree on what the product promises.

## Start with product truth

1. Find the authoritative source: accepted spec, active issue ledger, verified implementation, or explicit founder direction.
2. Classify each statement as one of:
   - **Live and verified** — describe it as available.
   - **Built but awaiting a named proof** — describe the boundary honestly; do not call it live.
   - **Planned** — describe the intended experience with a clear upcoming/planned label.
   - **Unknown** — do not imply behavior.
3. Read the closest existing product, help, and architectural documents before writing. Reuse their terminology and link to the source of truth rather than duplicating mutable technical detail.
4. Never turn a mock, a planned issue, a queued job, or an unverified provider claim into a customer promise.

## Produce the right documents

Unless the request narrows the scope, create these two artifacts:

1. `docs/product/<feature>.md` — internal product reference.
2. `docs/help/<area>/<feature>.md` — artist-facing guide.

Use lowercase kebab-case paths and simple feature names. Update `docs/README.md` only when it improves discovery.

Do not write website marketing copy here. Instead, include a short **Claim inventory** in the product reference. The separate `website-copy` skill can transform only verified entries from that inventory into public copy.

## Internal product reference

Use this structure:

```markdown
# <Feature>

**Status:** Planned | In development | Live and verified
**Audience:**
**Source of truth:**
**Last reviewed:**

## Outcome
## User journey
## Expected behavior
## Review and approval boundaries
## What indii does not do
## Failure and recovery states
## Data, privacy, and rights posture
## Dependencies and delivery order
## Acceptance evidence
## Claim inventory
```

The expected-behavior section must use a compact table with: user action, expected result, evidence/state, and recovery path. The acceptance-evidence section must point to the tests, live proof, or issue acceptance criteria that would justify changing the status to live.

## Artist-facing guide

Write in calm, direct language. Explain the result first, then the steps. Include:

- What the feature helps the artist do.
- What they need before starting.
- The normal workflow in plain language.
- What each review option means.
- What the artist can change or undo.
- Limitations and honest quality guidance.
- Privacy/rights boundaries where media, audio, or external services are involved.
- A concise troubleshooting section.

For planned features, begin with an explicit availability notice. Never write instructions that imply a non-existent button or screen is available.

## Claim inventory

Keep claim candidates factual and status-aware:

| Candidate claim | Status required before public use | Evidence needed |
|---|---|---|
| Artist benefit stated in outcome language | Live and verified | End-to-end product proof |
| Technical quality claim | Live and measured | Test fixture or production measurement |
| Privacy, rights, or approval claim | Live and verified | Security/ownership and workflow evidence |

Mark unsupported claims as `not publishable yet`. The goal is to give `website-copy` strong raw material without letting marketing outrun the product.

## Quality checks

Before completing documentation:

1. Verify every product claim against its source of truth.
2. Check planned/live wording is consistent in every document.
3. Make approval and recovery paths easy to find.
4. Confirm no invented screen names, timelines, integrations, pricing, or performance claims.
5. Ensure a user can distinguish original media, derived output, and final published content when relevant.
6. Update or add a focused test prompt under `evals/evals.json` when creating or materially changing this skill.

## First-run evaluation prompts

Use these as realistic tests for this skill:

1. Turn a planned creative feature with dependencies into an internal product reference and a truthful upcoming artist guide.
2. Document a live feature with an external-provider limitation without implying the provider action succeeded.
3. Update a help guide after a feature moves from planned to live, replacing only claims supported by evidence.
