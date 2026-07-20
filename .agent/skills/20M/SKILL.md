---
name: 20m
description: Run the 20M evidence-backed valuation, investor-room, pricing, and acquisition system for software businesses. Use for /20M, /20M room, investor questions, current/remediated app value, founder-unit and subscriber scenarios, replacement-stack pricing, or adjustable $20M/$50M/$100M/$1B acquisition targets.
---

# 20M

`20M` is the system name and default north star, not a ceiling. Accept any user-supplied target and preserve the same evidence standards.

## Non-negotiable rules

1. Separate verified facts, calculations, assumptions, and judgment.
2. Founder payments are one-time cash, never ARR or MRR.
3. Code, tests, documents, fixtures, and sandbox records do not prove customers, revenue, partnerships, or external acceptance.
4. Pre-revenue value is governed by risk-adjusted transferable asset value, not projected ARR multiples.
5. Do not add incompatible methods. Triangulate and name the governing method.
6. Never claim “no competitors” without a documented search. Point-tool stacks and inertia are competition.
7. Vertical specialization is a potential round-peg/round-hole premium, not an automatic discount. Prove it through time, integrations, errors, risk, and outcomes avoided; disclose portability separately.
8. Current prices, multiples, comparables, laws, and market facts require current research and nearby citations.
9. Use ranges and confidence labels. Never promise a transaction price.

## Modes and targets

- `/20M` defaults to $20,000,000 target enterprise value.
- `/20M 50M`, `/20M 100M`, `/20M 1B`, or a custom target replaces the default.
- Multiple targets compare paths side by side.
- `/20M room` builds the investor pack and enters live Q&A mode.
- Accept `$`, commas, and case-insensitive `K`, `M`, `B`, or `T`.

## Workflow

### 1. Freeze the state

Record as-of date, commit/branch, currency, buyer type, current state, remediated state, paying-customer definition, prices, founder scenarios, and whether the target means enterprise value or proceeds.

For indii, read [references/indii-profile.md](references/indii-profile.md). Preserve the user's corrected scenarios; do not revive typo-derived cases.

### 2. Build the evidence ledger

- **A — Externally verified:** processor/bank receipts, signed agreements, production analytics, registry records, independently reproduced production workflows.
- **B — Current implementation:** code/configuration at the analyzed commit.
- **C — Locally verified:** reproducible tests, builds, scans, or local workflows.
- **D — Documented claim:** internal prose, audits, projections, and marketing.
- **H — Hypothetical:** future price, customers, remediation, or premium.

Use the weakest relevant grade when a conclusion depends on several claims.

### 2A. Build the IP asset bridge

Read `docs/data-room/13_IP_ASSET_REGISTER.md` and classify every material
asset used in the valuation or investor answer as one of: transferable platform
IP, licensed/vendor-dependent capability, customer-controlled rights/content,
or unknown/restricted. For each claimed asset, cite the underlying assignment,
licence, provenance record, immutable artifact, registry, or agreement.

Do not count customer masters/compositions, user uploads, provider model weights,
unverified datasets, or internal documents as company-owned IP. Discount missing
chain-of-title, brand/domain, dataset, vendor-transfer, or rights evidence in
the current valuation; record human/counsel/counterparty actions in
`docs/RELEASE_CHECKLIST.md`.

### 3. Verify product truth

For each flagship workflow record separately: UI exists, backend connected, authenticated end-to-end run reproduced, and external/commercial acceptance proven. Check signup/auth, payment, core workflow, upload/audio analysis, creative work, distribution boundary, rights/finance, agents, security, operations, and data export.

### 4. Research market evidence

Build dated direct-comparable, replacement-stack, and transaction/multiple sets. Prefer official pricing, filings, transaction announcements, and datasets with disclosed methodology. Distinguish ARR, revenue, EBITDA, profit, asking-price, and completed-deal multiples.

### 5. Run deterministic math

Use `assets/indii-defaults.json` or an equivalent configuration:

```bash
python3 scripts/valuation_model.py --config CONFIG.json --target 20M --out-dir OUTPUT_DIR
```

Repeat `--target` for comparisons. Independently cross-foot founder cash, MRR/ARR, required ARR, and rounded-up customer counts.

### 6. Value current and remediated states

For pre-revenue stages use:

`verified replacement value − completion cost − transfer cost − risk deductions + separately justified strategic premium`

Show low/base/high inputs. “Remediated” means named evidence gates passed—not merely “bugs fixed.” Discount incomplete flagship workflows, security/legal/IP uncertainty, inaccessible relationships, founder dependence, weak reproducibility, and buyer integration cost.

### 7. Value traction milestones

Calculate exact MRR/ARR and show stage-appropriate multiple sensitivities. Require collected revenue, cohort age, gross margin, churn, GRR, NRR, CAC/payback, growth, concentration, refunds, and time-to-milestone before granting a quality SaaS multiple. Customer count alone is not valuation.

### 8. Treat founder units correctly

Show gross/net cash, units, price, agreement and seat-cap compatibility, validation strength, lifetime obligations, refunds, concentration, and the valuation with/without that evidence. Do not add gross founder receipts directly to enterprise value.

### 9. Price the vertical product

Separate:

1. gross alternative-stack price;
2. credibly displaced cost today;
3. vertical-fit incremental value from less setup, context switching, integration, error, and industry risk;
4. portability trade-off;
5. variable cost and support guardrails.

A $10 plan may be a bounded acquisition experiment. Define quotas, metering/BYOK rules, upgrade triggers, and the evidence needed for sustainable margin.

### 10. Reverse-engineer the target

For each supported multiple compute `required quality ARR = target EV ÷ multiple`, then required customers at every price/mix. Separate mathematical, operating-quality, strategic-buyer, and transaction-readiness thresholds. Make the base plan work without a strategic premium.

### 11. Operate investor-room mode

Read [references/investor-qa.md](references/investor-qa.md). Generate or refresh `investor_brief.md`, `live_answer_card.md`, `investor_qa.md`, `evidence_ledger.md`, and `never_overclaim.md` from one as-of baseline.

Every prepared question needs:

- **Short answer:** direct, conversational, about 20 seconds.
- **Deep answer:** up to two minutes, covering the problem, mechanism, evidence, boundary, and next proof.

Put “What does it do?” and “Why do I need it?” first. Explain customer pain and changed workflow before modules, architecture, valuation, or the acquisition target. Never invent traction, partnerships, distribution status, legal ownership, security assurance, or metrics.

For IP, always prepare answers to: “What do you own?”, “What belongs to the
artist/customer?”, “What is licensed or vendor-dependent?”, “What evidence can
I review today?”, and “What would prevent transfer in diligence?” Use the IP
asset bridge, not a generic claim that all assets are owned.

### IP investor-answer protocol

Treat an IP question as a diligence request, not a branding opportunity. For
each answer, retrieve the relevant row(s) from
`docs/data-room/13_IP_ASSET_REGISTER.md` and state, in this order:

1. **Asset and posture:** name the asset and say whether it is transferable
   platform IP, licensed/vendor-dependent capability, customer-controlled
   content, or unknown/restricted.
2. **Evidence available today:** cite the non-secret assignment, licence,
   registry, immutable artifact, commit/tag, or agreement reference. Distinguish
   a technical artifact from legal chain-of-title evidence.
3. **Value mechanism and boundary:** explain the replacement-cost, workflow,
   defensibility, or strategic value without assigning a transaction value to
   the asset; name the restriction or deduction.
4. **Next proof and accountable owner:** if evidence is incomplete, identify
   the exact document, registry result, counterparty acknowledgement, or
   counsel decision required and point to the matching actionable item in
   `docs/RELEASE_CHECKLIST.md`.

Do not use “we own it” when the register says `unknown`, `restricted`,
`licensed`, or `customer-controlled`. Do not call code, a generated output,
an artist upload, a provider model weight, a DDEX package, or a partner
configuration a proprietary company asset merely because the product can use
it. If the investor asks about a newly-created capability, add a dated IP
register delta before treating it as valuation support.

### 12. Write and validate

Follow [references/report-contract.md](references/report-contract.md), attach assumption/source ledgers, and run:

```bash
python3 scripts/validate_report.py --report REPORT.md --model OUTPUT_DIR/model.json
python3 scripts/validate_report.py --report REPORT.md --model OUTPUT_DIR/model.json \
  --room \
  --ip-register docs/data-room/13_IP_ASSET_REGISTER.md \
  --live-answer-card OUTPUT_DIR/live_answer_card.md \
  --investor-qa OUTPUT_DIR/investor_qa.md
```

The investor-room command validates the memo, live-answer card, Q&A index, and
authoritative IP register's minimum diligence structure. It does not certify
legal title or value; use it to catch a missing answer or evidence source before
the meeting.

If commercial facts conflict or essential evidence is unavailable, issue a provisional range and exact verification plan—not a definitive valuation.
