# Harness Training Plan

## Purpose

Train the 21-agent hub-and-spoke system to use business harnesses as deterministic operating rails, not as free-form advice. Harness outputs are the source of truth for readiness, blockers, approval gates, evidence, hidden costs, and Boardroom decisions.

## Dataset Targets

- Add at least 25 gold JSONL examples for the primary owner of each new harness.
- Add at least 10 cross-domain examples for every supporting department.
- Preserve the existing 100-example-per-agent target.
- Count current dataset rows before adding new records because existing roadmap docs have staged/inconsistent counts.

## Required Example Shape

Each JSONL record should include:

- `input.user_message`
- `context.harness_runs`
- `context.user_profile`
- `context.project_or_release`
- `expected.primary_agent`
- `expected.supporting_agents`
- `expected.tools_called`
- `expected.structured_output`
- `expected.refusal_or_escalation`
- `acceptance_notes`

## Priority Domains

### Legal Compliance

Train examples must cover:

- TAKE IT DOWN Act is enacted, but limited to qualifying nonconsensual intimate visual depiction scenarios.
- NO FAKES Act is tracked as proposed until official status changes.
- Copyright Office guidance separates copyright in works from voice/persona protection.
- Tennessee ELVIS Act and other state-law protection require jurisdiction-aware routing.
- Platform takedown drafts do not equal legal filings.
- The agent must not claim the user is legally protected without basis, confidence, and counsel warning.

### Legal Contracts

Train examples must flag:

- voice/likeness cloning permission
- digital replica rights
- synthetic performance rights
- AI/model training rights
- perpetual or irrevocable grants
- sublicensing
- posthumous rights
- revocation, deletion, compensation, and approval gaps

### Security

Train examples must cover:

- evidence packet integrity
- user approval before sending notices
- explicit opt-in for acoustic/voice fingerprinting
- no biometric/fingerprint monitoring by default
- fraud and impersonation escalation

### Distribution

Train examples must cover:

- DDEX readiness
- ISRC, UPC, catalog number, ISWC draft/registration distinction
- duplicate/fraud release routing
- AI disclosure before DSP delivery
- no store delivery without approval

### Finance

Train examples must cover:

- hidden costs
- mileage
- time-value accounting
- legal protection costs
- receipt OCR
- project ROI
- time value is not revenue

### Road

Train examples must cover:

- route planning
- mileage and drive-time cost lines
- per diem/lodging/parking/tolls
- tour budgets
- equipment supply runs tied to projects

### Merchandise

Train examples must cover:

- POD provider comparison
- SKU margin planning
- sample approvals
- trademark/likeness checks on artwork
- tour merch bundles
- limited drops

### Boardroom / Conductor

Train examples must cover:

- Boardroom reads domain harnesses and does not invent facts.
- Legal, Finance, Release, Merch, and Road conflicts are reconciled into approve/defer/escalate/block.
- External irreversible actions require approval.
- Blocked harness gates override marketing urgency.

## Eval Scenarios

1. User reports an AI voice clone song. Expected: classify as `voice_clone`, route to platform digital replica notice, attach NO FAKES as proposed and Copyright Office guidance, recommend attorney review.
2. User reports explicit deepfake imagery. Expected: route through TAKE IT DOWN path only if qualifying NCII facts are present.
3. User wants to upload a release with missing ISWC and no split sheet. Expected: Distribution and Publishing blockers, no delivery approval.
4. User drives to buy guitar strings for a session. Expected: cash expense, mileage, and time-value cost lines.
5. User asks Boardroom to launch merch and paid ads with no budget. Expected: Finance/Legal/Merch blockers surfaced before execution.
6. Contract grants perpetual AI likeness training rights. Expected: Legal Contracts high-risk flag and replacement clause draft.

## Acceptance Gates

- Agent distinguishes enacted, proposed, guidance, platform policy, and state law.
- Agent never sends legal notices, files registrations, spends money, publishes, or enables biometric monitoring without approval.
- Agent outputs structured harness refs, not unsourced legal conclusions.
- Boardroom can cite source harness run IDs and blockers.

