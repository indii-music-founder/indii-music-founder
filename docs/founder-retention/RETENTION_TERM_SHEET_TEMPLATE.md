# Founder Retention Term Sheet Template

**For:** William Roberts, Founder & Technical Lead  
**From:** Prospective Acquirer  
**Valid:** Upon signed LOI  
**Currency:** USD

---

## Executive Summary

This term sheet outlines the retention package for William Roberts upon acquisition of New Detroit Music LLC (indiiOS) by [Acquirer Name]. The package incentivizes knowledge transfer, product continuity, and successor engineer onboarding over a 24-month period.

**Key Components:**
1. **Cash Component** — Base salary + signing bonus
2. **Equity / Earnout Component** — Contingent cash or stock tied to product metrics
3. **Role / Scope Clause** — Title, reporting line, decision authority
4. **Knowledge Transfer Milestones** — Deliverables with success metrics
5. **Non-Compete & IP Carve-Outs** — Scope and duration

---

## 1. Cash Component

### Signing Bonus
- **Amount:** $[NEGOTIATE: typically 1–3 months of base]
- **Timing:** Upon closing (day 1 post-acquisition)
- **Condition:** None (unconditional)

### Base Salary
- **Annual:** $[NEGOTIATE: music-tech founder benchmark $250–350K]
- **Frequency:** Bi-weekly payroll
- **Benefits:** Standard [Acquirer] employee benefits (health, 401k, etc.)

### Performance Bonus (Optional)
- **Target:** [NEGOTIATE: 20–30% of annual base]
- **Metrics:** Tied to product launches, uptime (see Earnout section)

---

## 2. Equity / Earnout Component

### Option A: Equity in Acquirer Stock

- **Grant:** [NEGOTIATE: typically $[X] value in acquirer equity]
- **Vesting:** 4-year vest, 1-year cliff
  - Year 1: 25% vests on anniversary
  - Years 2–4: 25% vests annually
- **Double-Trigger Acceleration:** If William is terminated without cause OR if indiiOS product is shut down, remaining equity accelerates (100% vests immediately)
- **Exercise Window:** 90 days post-vest (standard)

### Option B: Earnout (RECOMMENDED)

**Rationale:** Earnout aligns William's incentives with measurable product outcomes. Acquirer retains $[Y] in escrow, released against milestones.

- **Total Earnout:** $[NEGOTIATE: 30–40% of acquisition price held in escrow]
- **Duration:** 18–24 months post-closing
- **Release Schedule:**
  
| Milestone | Trigger | Release Amount | Timeline |
|-----------|---------|-----------------|----------|
| Artist Count | Reach 200 active artists on indiiOS | 25% of earnout | Month 6 |
| Platform GMV | Achieve $50K GMV through distribution rail | 25% of earnout | Month 12 |
| Fine-Tune Fleet Uptime | Maintain 99.5% endpoint availability | 25% of earnout | Month 18 |
| Successor Handoff | Onboard and pair-program with 2 successor engineers | 25% of earnout | Month 24 |

**Earn-Out Governance:**
- Metrics are measured by [Acquirer internal systems]
- Monthly reporting to William
- Dispute resolution: [Acquirer CFO + William agree on measurement]
- If milestone missed by <5%, [Acquirer] may defer release to next review period (no loss)
- If earnout triggers are not achievable due to acquirer business decisions (e.g., pivot away from distribution), remaining earnout pays out in [month 18]

---

## 3. Role & Scope Clause

### Title
- **Position:** VP Engineering, indiiOS Product Unit (or equivalent)
- **Reporting Line:** [Acquirer CEO or Chief Product Officer — direct report, not embedded in larger team]

### Responsibilities
- **Ownership:** Full technical decision authority over indiiOS product roadmap
- **Decision Rights:**
  - ✅ Architecture changes
  - ✅ Technology stack changes
  - ✅ Feature prioritization (within acquirer's product strategy)
  - ✅ Hiring for indiiOS team (up to [X] headcount)
- **Veto Rights:**
  - ✅ Rebranding or sunsetting the indiiOS distribution rail (24-month veto)
  - ✅ Shutdown of indiiOS product (must be mutual decision)

### Successor Onboarding Requirement
- **Deliverable:** Identify and onboard 2 successor engineers by month 12
- **Criteria:** Each must be capable of independently running production indiiOS systems by month 18
- **Method:** Pair programming, architecture docs, runbooks (see Knowledge Transfer section)

---

## 4. Knowledge Transfer Milestones

### Deliverable 1: Architecture Documentation

**Deadline:** Month 1  
**Deliverable:** Complete `docs/ARCHITECTURE.md` covering:
- 3-layer design (Directive → Orchestration → Execution)
- Hub-and-spoke agent topology (indii Conductor + 17 specialists)
- DDEX distribution pipeline (ERN generation through DSP submission)
- Vertex AI fine-tuning pipeline (dataset generation, job submission, endpoint deployment)
- Critical path for incident response

**Success Metric:** Two successor engineers can read this doc and understand system design without asking William

### Deliverable 2: Production Runbooks

**Deadline:** Month 2  
**Deliverable:** `docs/RUNBOOKS.md` covering:
- On-call procedure (who to page, escalation)
- Common incidents: agent endpoint down, DDEX delivery failure, Stripe payment failure
- Rollback procedures for each incident
- Monitoring dashboards and alert definitions
- Database backup/restore procedures

**Success Metric:** Successor can execute runbook steps without guidance

### Deliverable 3: Vertex AI Fine-Tuning Reproducibility

**Deadline:** Month 4  
**Deliverable:** Document the R1–R7 fine-tuning pipeline:
- Dataset schema and annotation rules
- Training job configuration (batch size, learning rate, epoch count)
- How to re-run training if a model becomes outdated
- How to deploy new models to endpoints
- Cost estimates for retraining

**Success Metric:** A new engineer (not William) can re-run a training job and deploy to production

### Deliverable 4: DDEX Onboarding Cycle

**Deadline:** Month 3 (pair programming)  
**Deliverable:** Live walkthrough of:
- Accepting a new DSP connection request
- Generating an ERN for a new release
- Monitoring SFTP delivery
- Processing DSP acknowledgment
- Handling delivery failures

**Success Metric:** Successor can independently onboard a new DSP after pairing with William

### Deliverable 5: Successor Engineers (Named & Onboarded)

**Deadline:** Month 6 (named), Month 12 (fully onboarded)  
**Deliverable:**
- Name(s) of successor engineers
- Training plan (pair programming schedule, doc reviews, lead responsibilities)
- By month 12: each successor has independently handled at least one production incident

**Success Metric:** Successors are capable of running indiiOS without William (no on-call fallback to William)

---

## 5. Non-Compete & IP Carve-Outs

### Non-Compete Scope

**Duration:** 24 months post-acquisition closing  
**Restricted Activities:**
- ❌ Direct-to-DSP music distribution platforms (competes with indiiOS rail)
- ❌ AI-orchestrated artist tooling (SaaS tools for creators using agentic AI)

**Permitted Activities:**
- ✅ Music production (William's own artistic output)
- ✅ Consulting (non-competing domains)
- ✅ Advising other startups (outside music/distribution/AI-agent space)
- ✅ Open-source contributions
- ✅ Teaching / speaking engagements

**Geographic Scope:** Worldwide (standard for SaaS)

### IP Carve-Out: Customer Founders Covenant

**Status:** The "Founders" program (customer-facing, $2,500 lifetime seats) is separate from William's retention.

**Clarification:** These customer commitments (10 lifetime seats, append-only records in `src/config/founders.ts`) survive acquisition. Acquirer cannot:
- ❌ Unilaterally void the Founders covenant
- ❌ Change the $2,500 lifetime term
- ❌ Reduce the 10 seat cap

**Mechanism:** William holds a side-letter confirming these commitments are binding post-acquisition. Violation = William can exit early with full earnout payout.

### Personal Project Carve-Out

**William's Prior Work:** Any music/art created before acquisition closing date is William's personal IP. Acquirer has no claim to:
- ❌ Pre-acquisition music/track masters
- ❌ Personal brand (William Roberts as artist/musician)
- ❌ Personal social media / audience

---

## 6. Governance & Dispute Resolution

### Amendment
- This term sheet may be amended by mutual written agreement (email OK)
- No amendment unless both parties (Acquirer CEO/CFO + William) sign

### Termination Scenarios

| Scenario | William's Outcome | Earnout | Non-Compete |
|----------|-------------------|---------|------------|
| Voluntary resignation (William quits) | Base salary to date + signing bonus | Forfeited (partial at acquirer discretion) | Full 24 months applies |
| Involuntary termination (acquirer fires without cause) | Base salary + severance (see below) + earnout | Accelerates (100% released) | Waived (William can compete immediately) |
| Constructive termination (indiiOS shut down or rebranded against William's will) | Base salary + severance + earnout | Accelerates (100% released) | Waived |
| Termination for cause (negligence, fraud) | Base salary to date | Forfeited | Full 24 months applies |

**Severance Definition:** 6 months of base salary (if terminated without cause)

### Dispute Resolution
- **First:** Good-faith negotiation (30 days)
- **Second:** Mediation ([Agreed mediator], 60 days)
- **Third:** Binding arbitration (if mediation fails, enforce per [State] law)

---

## 7. Conditions & Contingencies

### Condition 1: Closing
- This term sheet becomes binding upon acquisition closing (stock purchase complete, funds delivered)
- Until closing, this is a non-binding expression of intent

### Condition 2: Successor Identification
- Acquirer will identify / hire successor engineers by month 3
- If acquirer delays hiring beyond month 3, William's knowledge transfer milestones are extended accordingly (not a breach by William)

### Condition 3: Product Continuity
- Acquirer commits to maintaining the indiiOS distribution rail for minimum 24 months post-closing
- If acquirer shuts down the product before month 24, earnout is accelerated and William can exit without non-compete

---

## 8. Exhibits & Attachments

- **Exhibit A:** Earnout Release Schedule (detailed milestones and measurement methodology)
- **Exhibit B:** Successor Engineer Criteria (role description, required capabilities)
- **Exhibit C:** Knowledge Transfer Deliverable Checklist (sign-off template for each milestone)

---

## 9. Signature Block

**By signing below, both parties agree to the terms outlined above, subject to final legal review and integration into the Acquisition Agreement.**

**For New Detroit Music LLC / indiiOS:**

William Roberts (Founder)  
Signature: ________________________  
Date: ________________________

**For [Acquirer Name]:**

[CEO/CFO Name]  
Signature: ________________________  
Date: ________________________

**Legal Counsel Review:**

[William's Outside Counsel]  
Signature: ________________________  
Date: ________________________

[Acquirer's Counsel]  
Signature: ________________________  
Date: ________________________

---

## Notes for Negotiation

**Market Benchmarks (for reference):**

- **Founder salary:** Music-tech founders typically $250–350K base (William can command higher given technical depth)
- **Signing bonus:** 1–3 months of base (typical)
- **Earnout:** 30–40% of acquisition price (common for single founder)
- **Vesting cliff:** 1-year cliff is standard (no cliff means more favorable to founder)
- **Non-compete:** 24 months is market standard (narrower scope = more favorable to founder)

**Red Flags to Avoid:**

- ❌ "Earnout based on subjective metrics" (demand measurable, verifiable milestones)
- ❌ "Non-compete applies to all software development" (too broad — push back)
- ❌ "No double-trigger acceleration" (you need protection if shut down)
- ❌ "Knowledge transfer is implied" (insist on written milestones with success metrics)

---

**Prepared:** 2026-04-26  
**Author:** William Roberts (with input from acquisition consultant)  
**Audience:** Prospective acquirers, William's outside counsel  
**Status:** Template — to be filled in with acquirer-specific numbers before LOI
