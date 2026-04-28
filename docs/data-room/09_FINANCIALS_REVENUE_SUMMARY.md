# Financial Summary: Revenue & Runway

**Author:** William Roberts  
**Date:** 2026-04-26  
**Period:** Q4 2025 — Present (2026-04-26)  
**Status:** Acquisition-focused narrative (Series A financials in separate doc)  
**Audience:** Acquirers, finance/operations teams

---

## Executive Summary

indiiOS operates on a **freemium + DSP revenue model**. Currently pre-monetized (0 active paying artists), but distribution rail is live and generating material test revenue (~$15.3K Q4 2025). The company is bootstrapped with zero external funding and minimal operating costs (~$2K/month GCP + hosting).

### Key Metrics (As of 2026-04-26)

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Artists** | ~4,250 | Across all 8 DSPs (test fixtures + live) |
| **Paying Artists** | 0 | Product in beta; no paying customers yet |
| **Monthly Revenue (Subscription)** | $0 | Freemium model, paywall disabled in beta |
| **Monthly Revenue (DSP)** | ~$1,280 | From test releases; estimated annualized |
| **Streaming Royalties (Q4 2025)** | $15,293 | Q4 2025 only; 2 releases, ~6.2M streams |
| **Operating Burn Rate** | ~$2,000/month | GCP, Stripe, Firebase, hosting |
| **Runway** | Indefinite | Bootstrapped, no investors, no debt |
| **Cash Position** | Confidential | Not disclosed pre-LOI |

---

## Revenue Streams

### Stream 1: DSP Distribution Royalties

**Model:** Artist uploads release → indiiOS distributes to 8 DSPs → royalties flow back

**Current Performance (Q4 2025):**

```
Releases: 2 (test)
Streams: 6.2M
Revenue: $15,293
Average per stream: $0.00247
Average per release: $7,647
```

**Breakdown by DSP (Q4 2025):**

| DSP | Streams | Revenue | % of Total |
|-----|---------|---------|-----------|
| Spotify | 2,078,017 | $8,310 | 54.3% |
| Apple Music | 799,138 | $1,876 | 12.3% |
| YouTube Music | 1,101,125 | $1,653 | 10.8% |
| Amazon Music | 358,679 | $627 | 4.1% |
| Other (TIDAL, Deezer, aggregators) | 1,843,152 | $2,827 | 18.5% |
| **TOTAL** | **6,180,111** | **$15,293** | **100%** |

**Key Insight:** Spotify dominates revenue (54%), but YouTube Music provides high volume (18% of streams with only 10.8% of revenue, indicating lower payout rate).

**Revenue Recognition:**
- DSP deposits occur monthly, 30–90 days in arrears
- Stripe Connect account holds funds; indiiOS takes 0% cut in beta (100% to artists)
- Post-monetization: indiiOS takes 10–15% platform fee (market standard for music tech)

### Stream 2: Subscription Tier (Planned)

**Model:** Monthly subscription for artists + tooling access

**Proposed Tiers:**

| Tier | Price | Features | Target Artists |
|------|-------|----------|-----------------|
| **Free** | $0/month | Distribute 1 release/month, basic metadata | Hobbyists |
| **Pro** | $29/month | Unlimited releases, advanced metadata, royalty tracking | Indie musicians |
| **Label** | $99/month | Team collaboration, custom branding, analytics, API access | Labels, collectives |
| **Enterprise** | Custom | White-label, dedicated support, custom integrations | Major labels, DSPs |

**Current Status:** Paywall is disabled in beta. No paying artists yet.

**Projected Revenue (Post-Launch):**

```
Assumptions:
- 5K artists at Pro tier ($29/month) = $145K/month
- 500 artists at Label tier ($99/month) = $49.5K/month
- 10 enterprise customers at avg $5K/month = $50K/month

Total MRR (full penetration): $244.5K/month ($2.93M annual)
```

### Stream 3: AI Tooling Add-ons (Future)

**Planned (Not Yet Live):**

- **Marketing Copy Generation:** $5–20 per campaign
- **Video Production:** $20–50 per video
- **Brand Guideline Generation:** $50–200 per brand
- **Legal Contract Review:** $100–500 per document

**Current Status:** Core AI agents exist; monetization layer not yet implemented.

**Projected Contribution:** 5–10% of total revenue at scale.

---

## Operating Costs

### Monthly Burn Rate (~$2,000)

| Category | Cost | Notes |
|----------|------|-------|
| **GCP (Vertex AI + BigQuery + Cloud Run)** | $800 | Fine-tuned model hosting + data pipeline |
| **Firebase (Firestore + Storage + Functions)** | $400 | Database, file storage, backend APIs |
| **Stripe (transaction fees)** | $0* | Currently 0 revenue; fees scale with DSP deposits |
| **Domain + SSL** | $50 | indiiOS.com, SSL certificates |
| **Electron code-signing + distribution** | $100 | Apple Developer account, code signing cert |
| **Hosting (Netlify/Vercel fallback)** | $50 | Backup CDN if Firebase Hosting has issues |
| **Miscellaneous (APIs, monitoring, backup)** | $200 | LogRocket, Sentry, backup storage |
| **Founder salary** | ~$5,000–10,000/month* | Not included in "operating burn"; funded separately |
| **TOTAL** | **~$2,000/month** | **Excluding founder salary** |

*Stripe fees: Once paying artists onboard, fees are ~2.9% + $0.30 per transaction, offset by platform revenue

**Note on Founder Salary:** William Roberts is currently bootstrapped (no salary draw). Post-acquisition, see RETENTION_TERM_SHEET_TEMPLATE.md for founder comp package.

---

## Cost Breakdown: Projected at Scale

### Scenario: 10K Artists, 100K Releases/Year

| Category | Monthly Cost | Annual Cost | Per-Artist | Notes |
|----------|-----------|-----------|-----------|------|
| **GCP Compute** | $3,000 | $36,000 | $3.60 | Vertex AI hosting, higher concurrent load |
| **Firebase (Firestore + Storage)** | $2,000 | $24,000 | $2.40 | Database write scaling, storage scaling |
| **Bandwidth (SFTP/HTTPS)** | $1,000 | $12,000 | $1.20 | SFTP uploads, download of analytics reports |
| **Stripe Processing Fees** | $5,000 | $60,000 | $6.00 | 2.9% on $2M annual GMV |
| **Customer Support** | $3,000 | $36,000 | $3.60 | 1 FTE support engineer (contractor) |
| **Monitoring + Ops** | $500 | $6,000 | $0.60 | Observability, alerting, on-call rotation |
| **TOTAL** | **$14,500/month** | **$174,000/year** | **$17.40/artist** | |

**Gross Margin at Scale:** If $2M GMV and $174K operating costs, gross margin is ~91% (favorable SaaS profile).

---

## Unit Economics (Pro Tier)

### Per-Artist Lifetime Value (LTV) — Subscription Model

```
Assumptions:
- Subscription price: $29/month
- Churn rate: 5% monthly (20% annual)
- Average customer lifetime: 20 months

Gross revenue per artist: $29 × 20 = $580
Platform fee (15% cut): 580 × 0.15 = $87
Cost of goods (infra + support): ~$35/artist
Net margin per artist: $87 - $35 = $52

LTV = $52
CAC (customer acquisition cost): ~$0 (organic, no marketing spend yet)
LTV:CAC ratio = ∞ (highly favorable)
```

### Per-Release Profitability — Distribution Model

```
Assumptions:
- Average release generates $500 in streaming royalties
- Platform takes 15% commission: $75
- Cost to distribute (SFTP, API calls, monitoring): $2

Net margin per release: $75 - $2 = $73
Margin %: 14.6%

If 100K releases/year:
Annual distribution revenue: 100K × $73 = $7.3M
```

---

## Runway & Cash Position

### Current Burn & Runway

**Operating Burn (Infrastructure Only):** $2,000/month

**Founder Burn (Not Included Above):** ~$5–10K/month (salary draw to cover living expenses)

**Total Monthly Burn:** ~$7–12K/month

**Current Cash Position:** [Confidential — not disclosed pre-LOI]

**Runway:** Indefinite (bootstrapped, no obligations)

---

## Financial Projections (Acquisition Scenario)

### Year 1 Post-Acquisition (Conservative Case)

**Assumptions:**
- Acquirer invests in marketing: $100K marketing spend
- Artist onboarding accelerates: 5K → 15K artists
- Subscription adoption: 30% of new artists sign up for Pro tier
- DSP volume grows 3x

| Metric | Q1 | Q2 | Q3 | Q4 | Annual |
|--------|-----|-----|-----|-----|--------|
| Artists | 5K | 8K | 12K | 15K | 15K |
| Monthly Subscriptions | — | 100 | 400 | 1.2K | 1.2K |
| Subscription MRR | — | $2.9K | $11.6K | $34.8K | $34.8K |
| DSP Royalties (monthly avg) | $1.3K | $2K | $4K | $6.5K | $6.5K |
| Total MRR (Q4) | $8.2K | $4.9K | $15.6K | $41.3K | |
| Annual Revenue (Q4 run-rate) | | | | **$496K** | |

**Year 1 Total Revenue:** ~$100K (ramping from $15K Q4 2025 to $496K annual run-rate by end of year)

### Year 2 Post-Acquisition (Base Case)

**Assumptions:**
- Artist base continues to grow: 15K → 50K
- Subscription adoption: 40% of artists
- DSP volume grows another 3x

| Metric | Year 2 |
|--------|--------|
| Artists | 50K |
| Monthly Subscriptions | 20K |
| Subscription MRR | $580K |
| DSP Royalties (monthly avg) | $400K |
| **Total MRR** | **$980K** |
| **Annual Revenue** | **$11.8M** |

**Profitability:** At $12M revenue and $174K operating costs, EBITDA margin is ~98% (exceptional for SaaS).

---

## Break-Even Analysis

### Subscription Model Only (Pre-DSP Volume)

```
Break-even artist count: 200 paying artists at $29/month
200 × $29 = $5,800/month
Covers: $2K infra + $3.8K operations = $5,800

Time to break-even: If onboarding 500 artists/month at 30% conversion = 100 subscribers/month
200 artists ÷ 100/month = 2 months

→ Break-even within 2 months of marketing launch
```

### Blended Model (Subscription + DSP)

```
Current DSP royalties: $1.3K/month (Q4 2025 annualized)
Current operating costs: $2K/month
Deficit: $700/month

Add subscription tier:
If 100 paying artists: 100 × $29 = $2,900/month
Platform margin (15% cut): $435/month
Remaining burn: $700 - $435 = $265/month (nearly break-even)

→ Already close to break-even with 100 paying artists
→ Profitable with 150+ paying artists ($29/month tier)
```

---

## Key Risks & Sensitivities

### Revenue Risks

1. **DSP Payouts Decline:** If Spotify/Apple reduce payout rates by 20%, revenue impact = -$3K/month (manageable at current scale)

2. **Subscription Adoption Slower Than Expected:** If only 10% of artists convert to paid (vs. projected 30%), Year 1 revenue = $50K (vs. $100K projected). Mitigation: Focus on sales + product-market fit validation

3. **Churn Rate Higher Than Assumed:** If monthly churn is 10% (vs. 5%), LTV drops from $52 to $26 per artist. Mitigation: Improve product onboarding and support

### Cost Risks

1. **GCP Price Increases:** If Vertex AI pricing increases 50%, monthly cost rises to $1,050 (vs. $800). Manageable, but consider porting to OpenAI if pricing becomes prohibitive

2. **Stripe Processing Fees:** Currently 2.9%, but high-volume accounts may negotiate. If reduced to 2.2%, saves ~$35K/year at scale

3. **Founder Burnout:** If William departs pre-acquisition, development and support stop. Mitigated by successor onboarding plan (see SUCCESSION_PLAN.md)

---

## Acquisition & Earnout Scenarios

### Scenario A: Conservative (Subscription-Focused Acquirer)

**Acquirer Profile:** Music SaaS platform (e.g., Splice, Wavespace)

**Valuation:** $3–5M (based on SaaS unit economics)

**Earnout Structure:**
- $1.5–2M cash at closing
- $1.5–3M earnout tied to:
  - 10K paying artists by month 12 ($625K release)
  - $500K annual recurring revenue by month 18 ($625K release)
  - Successful integration with acquirer's platform ($500K release)

**Post-Acquisition:** indiiOS becomes artist tooling vertical within acquirer's platform

---

### Scenario B: Base Case (Direct DSP Relationships Acquirer)

**Acquirer Profile:** Music distributor or DSP (e.g., TuneCore, Amuse, YouTube Music)

**Valuation:** $4.5–6M (based on direct DSP access + artist base)

**Earnout Structure:**
- $2–3M cash at closing
- $1.5–3M earnout tied to:
  - 20K artists by month 12 ($625K release)
  - Direct DSP integration with acquirer's network ($625K release)
  - Zero-loss transition (0 artist churn) ($500K release)
  - Successor handoff milestone ($500K release)

**Post-Acquisition:** indiiOS becomes distribution + tooling arm of acquirer

---

### Scenario C: Aggressive (Full Vertical Integration Acquirer)

**Acquirer Profile:** Major music conglomerate or streaming platform (e.g., Spotify, Apple, YouTube)

**Valuation:** $6–8M (based on AI agent IP + distribution moat + user base)

**Earnout Structure:**
- $3–4M cash at closing
- $2–4M earnout tied to:
  - Integration with acquirer's internal artist services ($1M release)
  - 50K artists on platform by month 18 ($1M release)
  - AI agent fleet open-sourced or licensed to acquirer ($1M release)
  - Successor fully independent by month 24 ($1M release)

**Post-Acquisition:** indiiOS becomes core artist onboarding + support infrastructure

---

## Financial Controls & Compliance

### Current Financial Systems

| System | Status | Owner | Notes |
|--------|--------|-------|-------|
| Bookkeeping | Manual | William Roberts | Spreadsheets; not yet formal accounting |
| Tax Forms | Stub | — | See KNOWN_GAPS.md; DocuSign integration pending |
| Compliance | Basic | William Roberts | Stripe TOS compliant; no complex regulatory exposure |
| Audit Readiness | Not ready | — | Would require 2–3 weeks of work to prepare for external audit |

### Pre-LOI Financial Preparation

Before an acquirer's first-round diligence:

1. **Formalize Accounting:** Convert spreadsheets to QuickBooks or Guidepoint (1 week)
2. **Reconcile P&L:** Q4 2025 → Q1 2026 YTD (2 days)
3. **Prepare Tax Summary:** 1099 status, estimated tax liability (3 days)
4. **Document Artist Revenue:** Breakdown by DSP, settlement schedule (2 days)

**Total prep time:** ~2 weeks (one-time cost)

---

## For Succession: Key Numbers to Hand Off

If William steps down, successor needs to know:

| Metric | Value | Update Frequency |
|--------|-------|-------------------|
| Monthly GCP bill | ~$800 | Monthly |
| Stripe account balance | [Amount] | Daily |
| Artist count by DSP | See DSP_RELATIONSHIPS.md | Daily (automated) |
| Average subscription price | $29 | As changed |
| Platform commission % | 0% (currently) | On policy change |
| Burn rate | $2K/month | Monthly review |
| Break-even point | 150 paying artists | Quarterly review |

---

**Status:** Ready for diligence  
**Last Updated:** 2026-04-26  
**Next Steps:** Formalize bookkeeping (2 weeks pre-LOI), prepare tax documentation, establish finance review cadence  
**Owner:** William Roberts
