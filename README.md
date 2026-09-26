<div align="center">
  <img width="1280" height="560" alt="indii.music banner" src="docs/assets/indii-banner.png" />
</div>

# indii.music

**music business at the speed of you**

indii.music is working business operating software for independent music artists. It connects the work around finished music — planning, rights and registrations, delivery preparation, creative campaigns, release operations, money, audience activity, and repeatable workflows — around shared project context.

> **Current stage:** Founding Artist Beta. Working software is still being refined. Beta access is invitation-based. External integrations are described as live only when genuine account/provider verification proves them.

## Product truth

The product lifecycle is:

```text
Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat
```

The internal engineering lifecycle is broader:

```text
create → prepare → register → deliver → release → track → operate → repeat
```

indii.music is not positioned as a music-generation product. AI assists interpretation, planning, creative workflows, and domain reasoning. Deterministic code owns exact business rules such as identity, authorization, arithmetic, identifiers, workflow transitions, and security boundaries.

### What is implemented

The repository contains working implementations across:

- React web and Electron desktop applications;
- Firebase / Google Cloud backend services;
- canonical master-audio ingestion and technical analysis;
- registration, rights, metadata, and catalog review surfaces;
- DDEX ERN 4.3 generation and delivery-readiness tooling;
- finance, split, royalty, and accounting workflows;
- creative image/video workflows and local FFmpeg processing;
- CRM, marketing, social, and campaign systems;
- merchandise and business-operations tooling;
- phone-to-cloud-to-Studio remote execution;
- specialist-agent orchestration and deterministic execution tooling.

### Important external-verification boundaries

Implementation is not the same as external production proof.

- **Distribution:** DDEX generation, preflight, packaging, and transport tooling exist. Do not claim direct delivery to Spotify, Apple Music, TIDAL, or other DSPs until partner credentials, conformance, and genuine transmissions are documented.
- **Meta / Instagram:** publishing validation, webhook, OAuth, analytics, and CRM infrastructure exist. Genuine Meta OAuth/webhook/publishing verification remains a separate live-account gate.
- **Registrations:** workflows preserve manual-required states where an organization or filing cannot truthfully be completed automatically.
- **Offline:** bounded local audio/metadata inspection exists; the application is not generally offline-capable.
- **Commerce:** Founding Artist Beta pricing is decided publicly, but paid checkout must remain closed until backend entitlements and live price configuration agree.

## Founder-beta pricing

Current public beta packaging:

| Stage | Monthly price |
| --- | ---: |
| Free | $0 |
| Start | $22 |
| Build | $55 |
| Scale | $110 |
| Founding Owner License | $2,500 one time |

Commitment savings are approximately 5% quarterly, 10% for six months, and 20% annually. These are beta prices and remain subject to operating-cost validation before broad paid activation.

## Architecture

indii.music uses a layered operating model:

1. **Directives / SOPs** define intent, constraints, and expected outcomes.
2. **Orchestration / intelligence** routes work and supplies bounded semantic reasoning.
3. **Deterministic execution** performs exact operations, API calls, validation, persistence, and calculations.

The architectural rule is simple: probabilistic systems may advise; they do not silently manufacture business truth.

### TypeSafe / JEV

TypeSafe JEV System One supplies typed low-latency semantic judgments where semantic interpretation is more appropriate than brittle string parsing. Questions and thresholds are centrally reviewable, deterministic fallbacks remain available, and production credentials stay behind the server-side `typesafeJudge` Firebase callable.

JEV does not establish legal permission, ownership, financial truth, security authorization, or deterministic identifiers.

### Remote execution

The phone-to-Studio path uses a durable Firestore relay, server-authorized Studio presence, executor leases, atomic command claims, and explicit cloud-versus-local execution boundaries. Desktop-only work remains on the desktop rather than being simulated by the phone.

## AI-assisted engineering workflow

The repository contains founder-defined slash workflows under `.agent/workflows/`.

The core development loop is:

```text
/start → /middle → /end
```

Supporting workflows include `/ci-validate`, `/review`, `/proceed`, and other bounded development procedures.

The intent is to make AI-assisted development auditable:

- define the objective and evidence before mutation;
- work in bounded verification units;
- protect unrelated repository state;
- distinguish structural, simulated, local-real, and production-real evidence;
- run proportional tests, type checking, linting, builds, and security checks;
- bind remote acceptance to the exact pushed SHA;
- invalidate a gate when post-gate edits occur.

The AI saying “done” is never proof that work is done.

## CI/CD

`.github/workflows/deploy.yml` is the main deployment pipeline. It includes:

- setup and security sanity checks;
- 20 sharded unit-test jobs;
- Firestore / Storage rules tests;
- lint and TypeScript checks;
- production builds;
- staging deployment;
- staging E2E validation;
- production deployment.

Exact-SHA CI is the acceptance boundary for repository delivery.

## SOC 2 readiness

The repository includes a compliance framework under `compliance/` and a scheduled evidence workflow at `.github/workflows/soc2-evidence-collector.yml`.

This is **SOC 2 readiness and evidence collection**, not SOC 2 certification.

The goal is to accumulate control evidence as the company operates so a future auditor is not forced to reconstruct the development history after the fact. The current GitHub artifact archive is a 90-day hot-evidence store; longer Type II observation periods require durable evidence retention outside expiring Actions artifacts. See `compliance/EVIDENCE_RETENTION.md`.

## Quick start

```bash
git clone https://github.com/indii-music-founder/indii-music-founder.git
cd indii-music-founder

make prime
cp .env.example .env

make dev-web
# or
make dev
```

Useful commands:

```bash
make doctor
npm run typecheck
npm run lint
npm run ci
```

Before repository delivery, follow `.agent/workflows/branch-safety.md`, `.agent/workflows/ci-validate.md`, and `.agent/workflows/end.md`.

## Repository map

```text
packages/renderer        React Studio application
packages/main            Electron main process / local execution
packages/firebase        Cloud Functions, rules, server workflows
packages/shared          Shared schemas and deterministic contracts
packages/landing         Public landing / beta site
packages/render-worker   Background rendering
packages/admin-dashboard Internal operator surface
agents/                  Specialist agent definitions
execution/               Deterministic execution scripts
directives/              Operating procedures
docs/                    Architecture, product, security, and operating docs
compliance/              SOC 2 readiness, policies, controls, risk, vendors
.agent/workflows/        Founder-defined AI development workflows
```

## Documentation truth hierarchy

For external company, funding, or accelerator claims, use:

1. `docs/funding/APPLICATION_SOURCE_OF_TRUTH.md`
2. current business-decision documents
3. current architecture / phase-status documents
4. implementation and exact-SHA CI evidence

Historical acquisition worksheets, test fixtures, projections, demo records, and generated sample data are not commercial actuals.

## License

Copyright 2024–2026 New Detroit Music LLC. Proprietary software. See `LICENSE`.
