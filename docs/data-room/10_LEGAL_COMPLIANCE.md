# Legal, Security & Compliance Posture

**Canonical date:** 2026-09-26  
**Status:** Current diligence summary; not legal advice and not an external certification

## Entity / ownership

- Current entity in use: New Detroit Music LLC, Michigan.
- Founder reports 100% ownership.
- Founder reports the LLC was formed in 2018 originally for record-label activity.
- Exact formation date, good standing, DBA status, and financing-entity choice must be verified before external legal submission.
- Repository licensing identifies New Detroit Music LLC as owner of the software/IP.

## SOC 2 readiness

indii.music does not claim an independent SOC 2 Type I or Type II attestation.

The repository contains a SOC 2 readiness/control framework designed to collect evidence continuously before a future audit. Current evidence includes 16 policy documents, a machine-readable control registry, 41 controls referenced by the automated evidence workflow, risk/vendor/incident/business-continuity materials, scripts/verify-soc2-controls.mjs, and .github/workflows/soc2-evidence-collector.yml.

The GitHub Actions evidence collector is scheduled daily at 04:00 UTC and also runs on relevant changes. It validates the control registry, frontend API/token boundaries, Vertex/backend routing, dependency vulnerabilities, and writes evidence snapshots archived as GitHub Actions artifacts for 90 days.

This is a readiness/evidence-collection system, not an auditor opinion.

## AI-assisted development governance

The repository contains custom development controls including /start orientation, /middle bounded execution, /end acceptance reconciliation and closure, /ci-validate, exact-SHA remote CI verification, no-post-gate-edit rules, branch/mainline safety, typecheck/lint/unit/integration/E2E tests, API/secret boundary guards, backend Vertex-routing guards, deployment safeguards, scheduled health checks, and weekly demo/readiness audits.

The process matters because AI-assisted work is not accepted merely because an agent says it is complete.

## Jev / TypeSafe

TypeSafe/Jev is integrated in both the engineering process and product runtime. Product judgments route through an authenticated, App Check-protected server-side typesafeJudge Firebase callable.

The central registry currently contains 70 exported typed judge functions, with an additional Jev guardrail service. Confidence thresholds, failure cooldowns, and deterministic fallbacks are part of the architecture.

Exact arithmetic, identifier validation, security policy, legal truth, ownership, and permissions remain deterministic or human-authoritative rather than probabilistic.

## External review / CI tooling

- CodeRabbit: repository configuration exists.
- Greptile: founder reports access/free installation; paid capacity may be used as funding allows. Active repository integration was not proven in this audit.
- Blacksmith: founder reports access/free installation; paid CI capacity may be used as funding allows. Current workflows still show standard GitHub-hosted runners, so active Blacksmith execution should not be claimed yet.

## Payments / distribution

Stripe-oriented subscription/commerce code exists, but historical acquisition drafts made stronger claims about live merchant revenue and artist settlements than current business facts support. Revenue is currently $0 and paying customers are 0.

Do not claim live direct-DSP commercial relationships based solely on adapters, DDEX builders, fixtures, or configuration. See 08_DSP_RELATIONSHIPS.md.

## Public-repository rule

Never commit secrets or sensitive diligence records here, including tax returns, EIN documents, personal medical/disability records, bank records, investor-confidential documents, passwords, tokens, API keys, or recovery codes.

**Last updated:** 2026-09-26
