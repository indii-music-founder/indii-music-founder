# Investor-room protocol

Lead with the answer, then why it matters, strongest proof, material boundary, and next verification artifact. Use a 20-second short answer first and a two-minute deep answer only when useful.

## Required open-ended questions

- What does it do?
- Why do I need it?
- What problem does it solve?
- Who is it for and not for?
- Why not use generic point tools?
- What changes on day one?
- Why now? Why you? Why can this win?
- Why invest?

For indii, preserve this meaning:

**What does it do? — short:** “indii is a music-business operating system for independent artists and their teams. It connects creative work, release preparation, rights and publishing, finance, marketing, and specialized assistants in one music-native workspace.”

**Why do I need it? — short:** “Running a music business means forcing generic tools and disconnected music services to understand the same artist, release, rights, and money repeatedly. indii is the round peg for that round hole.”

## Diligence questions

Cover product truth, flagship workflows, customer, market, alternatives, vertical fit, architecture, proprietary versus third-party technology, AI/agents, audio/upload, distribution boundary, rights/finance, pricing, founders, unit economics, security/privacy, IP/legal ownership, moat, founder dependence, roadmap, use of capital, and the adjustable acquisition target.

Never say without proof: no competitors; live direct distribution; customers/revenue; secure/compliant; complete IP ownership; strong margins/churn/CAC; or an exact/guaranteed valuation.

## IP and transferability answer card

### What intellectual property do you own?

**Short answer:** “We separate the platform we are building from the music our
customers control. Our current evidence supports a platform-IP position for the
codebase, operating workflows, and internal product know-how, subject to the
chain-of-title and dependency records in our data room. Artist masters,
compositions, likenesses, and uploads are not counted as indii-owned IP unless
there is a specific written transfer.”

**Deep answer:** “The asset register divides value into transferable platform
software and know-how; licensed or vendor-dependent capabilities; and
customer-controlled music rights. That distinction matters because a release
pipeline or a validated audio system can be strategically valuable without
giving us ownership of an artist's master. For every material asset, we track
the source/holder, evidence, restrictions, and review state. An investor can
review the assignment/disclosure record, dependency licensing, operating
artifacts, and any rights-specific evidence. We do not represent unverified
datasets, vendor model weights, user uploads, or a partner integration as owned
or transferable. The remaining diligence gates are explicit in the register and
founder checklist.”

### Why does that IP matter, and how do you value it?

**Short answer:** “It matters because the value is in a connected music-native
operating workflow and the evidence that it is reproducible—not in claiming
ownership of customer catalog. We use a risk-adjusted replacement-value and
transferability view until traction provides a separate revenue basis.”

**Deep answer:** “We do not assign a price just because code exists. The asset
bridge asks what is transferable, how costly it is to reproduce, what has been
tested or externally accepted, and what dependency or chain-of-title risk
reduces value. The current valuation memo is explicitly provisional; a buyer or
investor should treat missing assignments, data permissions, trademark/domain
evidence, vendor portability, or partner acceptance as deductions until the
source records are supplied.”

### Evidence to offer in the room

- [ ] `docs/data-room/13_IP_ASSET_REGISTER.md` — current asset classes, evidence posture, restrictions, and open gates.
- [ ] `docs/IP_ASSIGNMENT.md` and `docs/AI_AUTHORSHIP_DISCLOSURE.md` — chain-of-title claims and AI disclosure.
- [ ] Dependency licence report and material vendor terms — generated/refreshed for the current commit.
- [ ] Brand/domain and rights evidence — only in the controlled data room or counsel-approved form.
- [ ] `docs/RELEASE_CHECKLIST.md` — human/counsel/partner actions that remain open.

### IP follow-up matrix

Use this matrix when the first answer prompts a deeper diligence question. It
keeps the conversation concrete without disclosing secrets, unredacted legal
documents, customer data, or provider credentials.

| Investor question | Answer discipline | Evidence to offer now | Boundary / next proof |
|---|---|---|---|
| “What did you create that is actually valuable?” | Identify the named platform workflow or know-how and its current technical evidence. Explain the operational problem it solves and why it is costly to reproduce. | Relevant IP-register row; source/tag/test or immutable artifact reference; non-secret architecture evidence. | Implementation is not legal title or a patent. Chain-of-title and trade-secret posture need the register/checklist evidence. |
| “Do you own the music, recordings, or trained model?” | Normally no: artist masters, compositions, uploads, and likenesses are customer-controlled; provider model weights remain provider assets. | Rights posture in the IP register; applicable artist agreement only through the controlled room. | A written transfer or licence may create a narrower right; do not generalize it to the catalog or platform. |
| “What is proprietary versus licensed?” | Separate platform code/configuration/know-how from cloud, model, API, SDK, open-source, stock-media, and partner dependencies. | Dependency-licence report and material vendor terms, current to the reviewed commit. | Missing licence, portability, assignment, or consent evidence is a valuation deduction until resolved. |
| “Could a buyer actually take this over?” | Describe the transfer path: entity/assignment record, repository and build provenance, domain/brand control, vendor-account transferability, operating runbooks, and second-operator proof. | Controlled data-room references, not credentials. | Name the missing transfer document, vendor consent, domain proof, or operator evidence and its checklist owner. |
| “How much is the IP worth?” | Use a range-based risk-adjusted replacement/transferability argument, separate from future revenue multiples. | Current valuation memo, IP bridge, and assumptions ledger. | No asset-specific transaction price is asserted; missing rights/brand/data/vendor evidence lowers the range. |
| “What changed since our last meeting?” | State the dated register delta: asset, classification, technical proof, and whether the legal/economic evidence changed. | Updated register row and commit/artifact reference. | Never turn a code change into an ownership, registration, revenue, or partner-acceptance claim without independent evidence. |

### Live-room closeout

End every IP answer with one of these precise states: **evidence available for
review**, **implemented but legal/transfer evidence pending**, **licensed or
vendor-dependent**, **customer-controlled**, or **unknown pending diligence**.
If a state needs a human, counsel, registry, counterparty, payment, signature,
or filing, give the founder the corresponding `RELEASE_CHECKLIST.md` item—not
a vague promise to “follow up.”
