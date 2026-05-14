# Billing & Financial Architecture — Strategic Overview

**Status:** BAND-AID APPLIED (May 13, 2026)  
**Owner:** William Roberts  
**Last Updated:** 2026-05-13

---

## Executive Summary

The immediate $1000+ charge incident has been addressed with a **fail-secure cost control system**. This prevents runaway operations at the client and server level. However, the current billing architecture is incomplete and fragile.

This document captures:
- ✅ What was fixed (immediate protection)
- ❌ What's still broken (strategic gaps)
- 🎯 What needs to be built (long-term financial foundation)

---

## The Incident: $1000 Charge (May 2026)

### Root Cause
`VideoGenerationService.checkVideoQuota()` had **fail-open behavior in dev mode**. When the subscription service failed to respond, it would return `{ canGenerate: true }`, allowing unlimited video generation. An agent testing video generation without cost checks triggered multiple expensive API calls.

### Immediate Fix Applied
Implemented three-layer cost protection:
1. **Client-side:** `CostControlService.checkAndReserve()` before every expensive operation
2. **Server-side:** `enforceOperationCost` Cloud Function as kill-switch
3. **Infrastructure:** GCP quotas at the project level

**Budget Tiers (Hard-Enforced):**
- Free: $5/day, $50/month, 1 op/hour
- Pro: $25/day, $250/month, 5 ops/hour
- Enterprise: $100/day, $1000/month, 20 ops/hour
- **Runaway Kill-Switch:** $500/month (no account exceeds this)

**Pattern:** Fail-secure. If ANY check fails, block the operation.

### Why This Is a Band-Aid

The cost control system **prevents overflow** but doesn't address the underlying financial architecture problems:

1. **No Real Billing System** — Cost tracking is stored in Firestore but never charged to users
2. **No Revenue Capture** — Free tier users hit cost limits but never upgrade
3. **No Unit Economics** — We don't know if $0.04/image or $0.001/agent-stream is sustainable
4. **No Payment Integration** — Stripe is configured but subscription flow is incomplete
5. **No Financial Visibility** — No dashboards, no revenue reports, no cost-to-revenue analysis

---

## The Bigger Picture: What Still Needs to Be Built

### 1. Complete Billing Pipeline

**Current State:**
- Cost tracking in Firestore (`costLedger` collection)
- Budget enforcement via CostControlService
- Stripe payment processor configured (but not fully integrated)
- No actual charging mechanism

**What's Missing:**
- [ ] Usage billing endpoint: Convert cost reservations into actual charges
- [ ] Invoice generation: Monthly invoices for Pro/Enterprise users
- [ ] Dunning flow: Handle failed payments, retry logic
- [ ] Usage reports: Show users what they're spending on
- [ ] Billing history: Per-user cost breakdown by operation type

**Why It Matters:**
Without this, free users hit limits with no upgrade path, and paying users never see invoices. Revenue is zero by design.

---

### 2. Unit Economics & Profitability Analysis

**Current Assumptions:**
- Video generation: $0.10–0.40/sec depending on model
- Image generation: $0.04/image
- Agent streaming: $0.001/request

**Known Unknowns:**
- What are our actual GCP costs for Vertex AI Veo, Imagen, Gemini?
- What are our AWS/infrastructure costs per user?
- What's the full cost of running indii (including engineering, support, hosting)?
- At current prices, are we profitable at any scale?

**What Needs to Happen:**
- [ ] Monthly cost-to-revenue analysis: Track actual spend vs. revenue
- [ ] Unit economics model: Cost per user, revenue per user, payback period
- [ ] Pricing review: Are current tier prices sustainable? Competitive?
- [ ] Profitability dashboard: Real-time visibility into P&L by tier

**Why It Matters:**
If we're burning $500/month on 1 free user generating videos, we can't scale. We need to know the numbers to price responsibly.

---

### 3. Payment Flow & Subscription Activation

**Current State:**
- Stripe integration in Cloud Functions (checkout session creation)
- Webhook handler exists but may not be fully wired
- No confirmation that Pro tier actually unlocks features

**What's Missing:**
- [ ] E2E payment flow test: Fake card → subscription record → tier change → feature unlock
- [ ] Subscription renewal: Monthly/annual billing and renewal logic
- [ ] Failed payment handling: Retry schedule, grace periods, downgrade-to-free
- [ ] Subscription cancellation: Clean removal, refund handling
- [ ] PII/GDPR compliance: Payment data handling, retention policy

**Why It Matters:**
Without a working payment flow, we can't charge anyone. The first paying customer will hit a broken system.

---

### 4. Financial Visibility & Reporting

**Current State:**
- Cost ledger in Firestore (daily, monthly, hourly buckets)
- Incidents logged when runaway protection triggers

**What's Missing:**
- [ ] Admin dashboard: Total revenue, total costs, profit margin
- [ ] Per-user billing dashboard: What each user has spent, what they owe
- [ ] Revenue forecasting: Cohort analysis, churn prediction
- [ ] Cost anomaly detection: Automatic alerts if a user's cost spikes
- [ ] Tax/legal compliance: Sales tax calculation, VAT handling, invoicing standards

**Why It Matters:**
You can't manage what you can't measure. No dashboard = flying blind on financial health.

---

### 5. Founder/Beta Pricing Model

**Current Gap:**
William manually activates "founder pass" for early supporters via GitHub API, but:
- No documented process
- No tracking of who got founder access
- No sunset date (when does founder pricing end?)
- No financial impact analysis (how many founders offset revenue?)

**What Needs to Happen:**
- [ ] Founder SOP: Document exact process with screenshots
- [ ] Founder database: Track all founders, their tier, activation date, expiry
- [ ] Sunset plan: When do founders move to paid tiers? How much runway?
- [ ] Financial modeling: Founder revenue impact (what if 50 founders?)

**Why It Matters:**
Founders are customer acquisition. But if you don't track them, you can't model when they become paying customers or churn.

---

## Strategic Decisions Needed (Not Code)

### Decision 1: Pricing Model

**Options:**
1. **Usage-based (current)** — Pay per API call (video, image, agent)
   - Pros: Aligns cost with value
   - Cons: Unpredictable monthly bills, hard to forecast revenue

2. **Hybrid (tiered + overage)** — $19/month Pro gets 1000 credits, pay overage
   - Pros: Predictable MRR, growth upside
   - Cons: More complex, credit system overhead

3. **Seat-based** — $49/month per user account (annual discount)
   - Pros: Simple, predictable SaaS model
   - Cons: Doesn't reflect actual usage

**Recommendation:** Hybrid. Define monthly credit allowances per tier, show users their burn rate in dashboard so they upgrade willingly.

---

### Decision 2: Free Tier Sustainability

**Current:** Free users get $5/day, $50/month
- At $0.04/image, that's 1,250 images/month
- Most free users won't hit limits, but heavy users (agents testing) will

**Options:**
1. **Aggressive limits** — $2/day, $20/month (forces faster upgrade)
2. **Fair limits** — Current ($5/$50) with clear upgrade UX
3. **No free tier** — 7-day trial only (highest revenue, highest friction)

**Recommendation:** Fair limits with excellent upgrade prompts. Free tier is a customer acquisition funnel. If you crush it with limits, users churn instead of upgrading.

---

### Decision 3: Founder Pricing Expiry

**Current:** Undefined. Founders have lifetime pass?
- If yes: Opportunity cost (lost revenue if 100 founders)
- If no: When do they convert? 6 months? 1 year?

**Recommendation:** 12-month founder pass, then Pro tier for $9.99/month (50% discount). Create a clear milestone: "Your founder access expires June 2027. Upgrade to Pro to keep building."

---

## Implementation Roadmap (Next 6 Weeks)

### Week 1: Payment Flow Verification
- [ ] Run E2E test: Sign up → checkout → subscribe → tier changes → features unlock
- [ ] Verify Stripe webhook is handling `customer.subscription.created` and `invoice.payment_succeeded`
- [ ] Confirm Pro tier users see "Pro" badge and access commercial modules

### Week 2: Usage Billing Endpoint
- [ ] Create Cloud Function: `recordUsageCharge()` that converts cost ledger entries into billable charges
- [ ] Create Firestore schema: `user.monthlyCharges` to track actual billed amounts
- [ ] Wire this into the cost control system (on day 1 of month, invoice prior month's costs)

### Week 3: Founder Database & SOP
- [ ] Audit GitHub for all founder pass activations since v1.60
- [ ] Create `founders.ts` with full list (uid, email, activation_date, tier, expiry_date)
- [ ] Document the activation SOP in `docs/FOUNDERS_ACTIVATION_SOP.md`
- [ ] Set up Slack alert when a founder's pass is about to expire

### Week 4: Financial Dashboards
- [ ] Admin dashboard: Total revenue, total costs, net profit
- [ ] Per-user dashboard: Current month usage, remaining budget, upgrade CTA
- [ ] Stripe integration dashboard: Subscription status, failed payments, churn

### Week 5: Unit Economics Analysis
- [ ] Calculate actual GCP costs for each operation type (request real invoices from GCP)
- [ ] Survey comparable products: What do they charge?
- [ ] Model break-even point: At current pricing, how many Pro users do we need?

### Week 6: Payment Failure Handling & Tax
- [ ] Implement dunning flow: Failed payment → retry 3 days later → downgrade to free if repeated failures
- [ ] Add tax calculation: Integration with tax service (TaxJar or similar) for state sales tax
- [ ] Legal review: Ensure ToS covers billing, refunds, cancellation

---

## Metrics to Track Weekly

| Metric | Current | Target (3mo) | Why It Matters |
|--------|---------|--------------|--|
| Users on Pro tier | 0 | 5+ | Revenue |
| MRR (Monthly Recurring Revenue) | $0 | $100+ | Sustainability |
| Cost per user/month | Unknown | <$2 (free tier) | Profitability |
| Failed payment rate | N/A | <2% | Revenue recovery |
| Free → Pro conversion | 0% | 5%+ | Growth |
| Cost anomalies detected | 0 | 1+ per week | Runaway prevention |
| Founder expiry alerts | N/A | Manual tracking | Cohort management |

---

## Known Risks

### Risk 1: GCP Cost Explosion
If Vertex AI Veo costs more than $0.10/sec, our pricing is too aggressive.
- **Mitigation:** Request actual invoices from GCP this week. If costs are higher, adjust pricing immediately.

### Risk 2: Free Tier Abuse
If agents can run batch operations and hit limits, they might exploit the system.
- **Mitigation:** Runaway kill-switch at $500/month prevents catastrophic overage. Monitor incidents daily.

### Risk 3: Payment Processor Downtime
If Stripe is down, users can't upgrade and revenue is blocked.
- **Mitigation:** Implement fallback payment method (wire transfer for Pro/Enterprise) and manual activation SOP.

### Risk 4: Regulatory Compliance
Charging users without clear invoicing, tax handling, or privacy compliance creates legal exposure.
- **Mitigation:** Hire a tax professional and legal review before first real charge.

### Risk 5: Churn Without Engagement
If users hit cost limits but don't see value, they churn instead of upgrading.
- **Mitigation:** Build in-app usage visualization. Show users exactly what they're getting for their spend.

---

## Conclusion

The **fail-secure cost control system stops the bleeding** but doesn't build sustainable revenue. The next phase is:

1. **Verify payment flow works end-to-end** (this week)
2. **Understand unit economics** (weeks 2-3)
3. **Build financial visibility** (weeks 4-6)
4. **Launch usage billing** (week 8)

Without this foundation, indii remains a cost center, not a business.

**Next Step:** Schedule a 30-minute financial review with William to align on pricing strategy (usage-based vs. hybrid vs. seat-based) before implementing billing endpoints.

---

**Document Status:** LIVING DOCUMENT  
**Last Updated:** 2026-05-13  
**Author:** Claude (with William Roberts)  
**Next Review:** 2026-05-20
