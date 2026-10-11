# indii.music — Artist Passport Unit Economics, CAC & Investor ROI Model

> **Owner:** New Detroit Music LLC  
> **Status:** Active Commercial & Investor Data Architecture  
> **Version:** 1.80.1  
> **Target Audience:** Founders, Lead Investors, Due Diligence Counsel  
> **Updated:** October 2026  

---

## 1. Executive Thesis: The Music Tech CAC Problem & The Passport Solution

### 1.1 The Industry Bottleneck: Broken Music Tech CAC
Typical B2C music tech SaaS products (AI masterers, distribution platforms, website builders) suffer from catastrophic acquisition unit economics:
* **High Customer Acquisition Cost (CAC):** Ranging from **\$120 to \$280** per paying subscriber on traditional Meta/Google performance ad funnels.
* **Low Initial Value Perception:** Asking skeptical independent artists for credit cards before delivering tangible, verifiable value.
* **Rapid Churn (3–5 months):** Single-utility tools (e.g. standalone mastering plugins) are easily abandoned once a release finishes.

### 1.2 The indii.music Wedge: The Artist Passport Diagnostic Funnel
The **Artist Passport** (`https://indii.music/passport`) replaces the traditional landing-page paywall with a **value-first, loss-aversion diagnostic engine**:
1. **Zero-Slop Philosophical Alignment:** Positions indii as the artist’s ally with the canonical stance:
   > *“People make the music. indii Connected Intelligence© handles the business.”*
2. **Instant Royalty Leakage Identification:** Evaluates the artist's Performing Rights Organization (PRO) and Mechanical Licensing Collective (MLC) status in 120 seconds. It exposes US streaming mechanicals flowing into the unclaimed black box *before* asking for a commitment.
3. **Frictionless Studio Profile Hydration:** When the artist claims their passport, all diagnostic answers (stage, genre, distributor, PRO, release roadmap) automatically pre-populate their `UserProfile` in indii Studio. Onboarding drop-off is virtually eliminated.
4. **Estimated 65–80% CAC Reduction:** Blended CAC falls from \$180+ down to **\$15–\$35 per activated studio account**, creating industry-leading LTV:CAC ratios.

---

## 2. Telemetry & Data Storage Architecture

Every user touchpoint throughout the Artist Passport intake is tracked and persisted across three secure tiers:

```
┌─────────────────────────────────┐
│     Client Diagnostic Web       │  Landing Page (/passport)
│  packages/landing               │  SessionStorage Cache & Multi-Pixel
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     Cloud Firestore (NoSQL)     │  Collection: /prospect_assessments/{id}
│  Security Rules Enforcement     │  Attributes: source, utm_*, stage, rightsGaps
└────────────────┬────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐   ┌─────────────────────────────┐
│ Cloud Run /  │   │   Admin Dashboard (Local)   │
│ Functions    │   │   packages/admin-dashboard  │
│ Resend Email │   │   Real-Time CAC/ROI Server  │
└──────────────┘   └─────────────────────────────┘
```

### 2.1 Firestore Schema: `/prospect_assessments/{assessmentId}`
| Field | Type | Description | Investor Significance |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Cryptographic assessment UUID | Unique audit record |
| `source` | `string` | Acquisition channel (e.g. `replit_passport`, `meta_ad_fall26`, `organic`) | Channel-level CAC attribution |
| `careerStage` | `string` | `bedroom_hobbyist`, `indie_emerging`, `established_diy`, `catalog_owner` | ICP qualification & willingness-to-pay |
| `genre` | `string` | Primary musical lane | Category segmentation |
| `proAffiliation` | `string` | BMI, ASCAP, SESAC, PRS, Unregistered | Performance royalty health |
| `mlcRegistered` | `string` | Yes, No, Unsure | Mechanical black box leakage |
| `distributor` | `string` | DistroKid, TuneCore, CD Baby, Symphonic, None | Existing distribution dependency |
| `releaseStatus` | `string` | Mastered, Recording, Writing, Back-catalog | Release velocity & monetization urgency |
| `goals` | `string[]` | Up to 2 selected operational priorities | Feature demand weighting |
| `email` | `string?` | Captured prospect email | High-intent MQL lead |
| `assessmentConsent`| `boolean` | Opt-in to receive diagnostic email report | Transactional follow-up authorization |
| `marketingConsent` | `boolean` | Opt-in to platform roadmap & waitlist | Long-term nurture permission |
| `claimedByUid` | `string?` | Firebase Auth UID when account is created | Conversion from Prospect to Studio User |
| `claimedAt` | `timestamp?`| When user claimed the passport | Time-to-activation velocity |
| `createdAt` | `timestamp` | Intake creation timestamp | Funnel cohort tracking |

---

## 3. Mathematical Unit Economics & CAC / ROI Formulas

The Admin Dashboard calculates live unit economics based on aggregate intake cohorts:

### 3.1 Funnel Conversion Ratios
$$\text{Diagnostic Completion Rate} = \frac{\text{Completed Assessments}}{\text{Funnel Starts}}$$

$$\text{Lead Capture Rate (CPL)} = \frac{\text{Emails Captured}}{\text{Completed Assessments}}$$

$$\text{Diagnostic Copy Request Rate} = \frac{\text{Copy Requests}}{\text{Emails Captured}}$$

$$\text{Account Claim Rate (Activation)} = \frac{\text{Claimed Accounts}}{\text{Completed Assessments}}$$

$$\text{Paid Conversion Rate} = \frac{\text{Paid Subscribers}}{\text{Claimed Accounts}}$$

### 3.2 Acquisition Cost Formulas
* **Cost Per Completed Diagnostic (CPD):**
  $$\text{CPD} = \frac{\text{Total Marketing / Campaign Spend}}{\text{Total Completed Assessments}}$$
* **Cost Per Qualified Lead (CPL):**
  $$\text{CPL} = \frac{\text{Total Marketing / Campaign Spend}}{\text{Emails Captured}}$$
* **Customer Acquisition Cost (CAC - Activated Studio User):**
  $$\text{CAC}_{\text{Blended}} = \frac{\text{Total Marketing Spend} + \text{Acquisition Operational Costs}}{\text{Claimed Studio Accounts}}$$
* **Paid Customer Acquisition Cost ($\text{CAC}_{\text{Paid}}$):**
  $$\text{CAC}_{\text{Paid}} = \frac{\text{CAC}_{\text{Blended}}}{\text{Paid Conversion Rate}}$$

---

## 4. Revenue Model, Lifetime Value (LTV) & ROI Multipliers

indii.music commercialization operates across four clear subscription tiers and a lifetime founder license:

| Tier | Price | Annual Contract Value (ARR) | Estimated Retention | Imputed LTV | Target LTV:CAC Ratio |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Free Preview** | \$0 | \$0 | Ongoing | Top of Funnel | — |
| **Start** | \$22 / mo | \$264 / yr | 12 months | **\$264** | **10.5 : 1** (at \$25 CAC) |
| **Build** | \$55 / mo | \$660 / yr | 18 months | **\$990** | **39.6 : 1** (at \$25 CAC) |
| **Scale** | \$110 / mo | \$1,320 / yr | 24 months | **\$2,640** | **105.6 : 1** (at \$25 CAC) |
| **Founding Owner License** | \$2,500 one-time | \$2,500 upfront | Lifetime | **\$2,500** | **100.0 : 1** (at \$25 CAC) |

### 4.1 Payback Period
$$\text{Payback Period (Months)} = \frac{\text{CAC}_{\text{Paid}}}{\text{Monthly Average Revenue Per User (ARPU)} \times \text{Gross Margin (85\%)}}$$
* **Start Tier (\$22/mo):** $\approx 1.3 \text{ months}$ payback period.
* **Build Tier (\$55/mo):** $\approx 0.5 \text{ months}$ payback period.
* **Founding Owner (\$2,500 upfront):** **Immediate Day-1 Cashflow Positive**.

---

## 5. Proprietary Value Metric: Discovered Rights Gap Pipeline Value

A conventional SaaS company pitches software features. **indii.music calculates immediate monetary restitution.**

* In the diagnostic, an artist who has songs on streaming with a PRO but without The MLC is forfeiting interactive mechanical royalties (currently set by the US Copyright Royalty Board at ~15.35% of streaming revenue).
* **Aggregate Rights Gap Discovered:** For every 1,000 completed assessments with rights gaps, indii identifies an estimated **\$45,000 to \$180,000 in uncollected historical and ongoing mechanicals**.
* **Investor Takeaway:** *For every \$1 spent acquiring an artist via the Passport funnel, we uncover \$35+ in tangible cash leakage for that artist.* This establishes unmatched switching costs and near-zero churn.

---

## 6. Verification & Audit Trail

The metrics and models detailed in this document are surfaced live in:
1. **Local Admin Dashboard (`packages/admin-dashboard`):** Real-time aggregation of `/prospect_assessments` and channel attribution via `GET /api/prospects`.
2. **Founders Portal (`FoundersPortal.tsx`):** Roster of activated lifetime Founding Owners from `/founders`.
3. **Automated Transactional Engine:** Cloud Function `sendPassportReportEmail` triggered on document creation.
