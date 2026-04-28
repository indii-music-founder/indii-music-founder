# Succession Plan

**Purpose:** De-risk the single-author concentration by naming a clear successor path and transition timeline.

---

## Current State: Bus Factor = 1

- **William Roberts:** 96.3% of human commits, sole author with deep knowledge of DDEX rail, Vertex AI fine-tuning, payment architecture, and production incident response
- **No documented successors** — no second senior engineer with comparable system knowledge
- **Risk:** If William becomes unavailable (illness, departure, acquisition integration demands), indiiOS becomes unmaintainable

**This plan addresses that risk by establishing a named successor path and 18-month transition timeline.**

---

## Successor Candidates

### Option 1: External Hire (Recommended for Clean Integration)

**Profile:**
- 8+ years backend engineering (Node.js, TypeScript, cloud infrastructure)
- 2+ years working with music/creator platforms (DSP integration, payment systems, distribution)
- Comfortable with AI/ML systems (fine-tuning, model serving, agent frameworks)
- Proven ability to own large systems independently (not just individual contributor)

**Why External:**
- ✅ Clean integration into acquirer org (no politics or prior loyalties)
- ✅ Can be hired into the acquirer's engineering team directly
- ✅ Brings fresh perspective while learning from William
- ✅ Post-acquisition, reports to acquirer's engineering leadership

**Hiring Timeline:**
- **Month 1–2:** Acquirer's recruiting (external recruiter or internal hiring manager)
- **Month 3:** Offer accepted, start date
- **Month 3–18:** Pair programming with William, document learning, lead production incidents

**Cost:** Standard engineering hire for acquirer ($200–300K fully loaded)

### Option 2: Internal Promotion (From indiiOS Team)

**If indiiOS has existing engineers on staff:**
- Promote most senior engineer who has worked closely with DDEX and agent systems
- Fast-track into ownership roles (lead on incidents, design reviews)
- Pair with William starting month 1 (not waiting for external hire)

**Timeline:** Months 1–12 ramping, month 12–18 independent ownership

**Cost:** Lower (internal salary band)

### Option 3: Consultant Hybrid (Time-Bound Bridge)

**If hiring is slow:**
- Engage a senior music-tech consultant (contract, 2–3 years)
- Consultant works alongside William in year 1, takes lead in year 2
- Permanent hire onboards as "third person" in month 12

**Cost:** Higher upfront (~$150K/year contract), but buys time for permanent hire search

---

## Transition Timeline

### Months 1–3: Onboarding & Shadowing

**Successor's Tasks:**
- [ ] Read `docs/ARCHITECTURE.md` (CLAUDE.md level detail)
- [ ] Review DDEX subsystem (`src/services/ddex/`, `execution/distribution/`)
- [ ] Review Vertex AI fleet (`src/services/agent/fine-tuned-models.ts`, agent routing)
- [ ] Review Stripe/payment logic (`functions/src/stripe/`)
- [ ] Attend all production incidents (shadow, do not lead)
- [ ] Set up local dev environment; deploy feature branch to staging

**William's Role:** Mentor, explain design decisions, answer clarifying questions

**Success Metric:** Successor can read the codebase and understand the flow without William explaining

### Months 4–6: Pair Programming & Documentation

**Successor's Tasks:**
- [ ] Pair with William on: DDEX ERN generation flow, Vertex AI endpoint testing, Stripe webhook handling
- [ ] Write runbooks for each subsystem (`docs/RUNBOOKS.md`)
- [ ] Lead code review on at least one non-trivial PR (William reviews their review)
- [ ] Reproduce fine-tuning pipeline locally (`execution/training/`, R1–R7 job submission)

**William's Role:** Passive reviewer, answer questions, validate successor's work

**Success Metric:** Successor has written runbooks that another engineer could follow; can code review competently

### Months 7–12: Independence & Incidents

**Successor's Tasks:**
- [ ] Lead production incident response (for at least 2 incidents; William shadows, does not take over)
- [ ] Onboard a new DSP (real or simulated; full cycle from request → ERN → delivery)
- [ ] Design and implement a non-trivial feature (e.g., new agent type, new DSP, payment flow change)
- [ ] Write successor-for-successor documentation (explain system to a hypothetical third engineer)

**William's Role:** On-call fallback only; does not intervene unless successor requests

**Success Metric:** Successor has independently handled production incidents without William's input; feature ship was successful

### Months 13–18: Full Ownership

**Successor's Tasks:**
- [ ] Lead all architecture decisions for indiiOS (William is advisor, not approver)
- [ ] Mentor newly hired junior engineers (if team is growing)
- [ ] Plan and execute any major refactoring or tech debt paydown
- [ ] Prepare handoff documentation for future successors

**William's Role:** Strategic advisor (monthly 1:1s), available for major decisions, but not day-to-day

**Success Metric:** Successor is the go-to person for all indiiOS questions; team confidence is high

### Months 19–24: Post-Acquisition Integration

**Successor's Tasks:**
- [ ] Integrate indiiOS systems into acquirer's infrastructure (if needed)
- [ ] Support acquirer's product strategy (new features, migrations, etc.)
- [ ] Onboard acquirer's engineers into indiiOS codebase

**William's Role:** Knowledge transfer only; earnout milestones are measured; non-compete may be waived (depending on acquirer's treatment)

---

## Success Criteria

### For the Successor

| Gate | Criteria | Timeline |
|------|----------|----------|
| **Technical Mastery** | Can independently architect and debug production issues | Month 12 |
| **Operational Ownership** | Leads incident response without escalation | Month 12 |
| **Communication** | Can explain indiiOS to non-technical stakeholders (product, execs) | Month 12 |
| **Documentation** | Has updated runbooks, architecture docs, and onboarding guides | Month 18 |
| **Team Leadership** | Can mentor junior engineers and lead design reviews | Month 18 |

### For William

| Gate | Criteria | Timeline |
|------|----------|----------|
| **Delegation** | Successor owns all day-to-day decisions | Month 12 |
| **Mentorship** | Documented at least 2 complete knowledge transfer cycles | Month 9 |
| **Transition** | Can take vacation / extended leave without production impact | Month 12 |
| **Earnout Release** | Successor handoff milestone is met (earnout $ released) | Month 24 |

### For the Acquirer

| Gate | Criteria | Timeline |
|------|----------|----------|
| **Risk Mitigation** | William is no longer single point of failure | Month 12 |
| **Continuity** | indiiOS can operate independently of William | Month 18 |
| **Integration** | indiiOS team is integrated into acquirer's org chart | Month 24 |

---

## Named Successor Candidate (TBD by William)

**Candidate Name:** [William to fill in upon decision]  
**Current Role/Affiliation:** [e.g., "Senior Backend Engineer at [Company]"]  
**Music-Tech Experience:** [Years and relevant projects]  
**Why This Person:** [William's notes on why they're the right fit]

**Recruiting Status:**
- [ ] Initial outreach sent
- [ ] Conversation scheduled
- [ ] Offer in progress
- [ ] Accepted & start date set

**Timeline to Start:** [Month/Year]

---

## Contingency: If Successor Search Fails

If acquirer cannot hire a suitable successor by month 4:

1. **Extend William's Retention:** Earnout timeline extends accordingly (no penalty to William)
2. **Consultant Bridge:** Engage external consultant to pair with William (months 4–12), while hiring continues
3. **Knowledge Transfer Prioritization:** Focus on runbooks and documentation (more than usual pair programming)
4. **Acquisition Contingency:** If no successor by month 12, William's non-compete is waived (risk mitigation for him)

---

## Retention Linkage to Earnout

**The successor handoff is a measured milestone in William's earnout:**

| Earnout Milestone | Details |
|-------------------|---------|
| **Successor Handoff** | "Onboard and pair-program with 2 successor engineers" |
| **Release Trigger** | By month 12, successor is independent; by month 24, 2nd successor is onboarded or #1 is proven replaceable |
| **Earnout Release:** | 25% of total earnout ($[NEGOTIATE] value) |

**William's incentive:** Gets paid (earnout) for successful transition. Acquirer's incentive: Earnout retention keeps William motivated through transition.

---

## Post-Acquisition: Scaling Successors

If indiiOS grows (more engineers, more DSPs, more agents):

- Successor #1 becomes "VP Engineering, indiiOS"
- Successor #2 & beyond report to Successor #1
- William becomes strategic advisor (if he stays post-earnout)

---

**Status:** Template — William fills in successor name and details before LOI  
**Owned by:** William Roberts (with input from acquirer's HR/engineering leadership)  
**Approval:** Both William and acquirer must sign off on candidate choice
