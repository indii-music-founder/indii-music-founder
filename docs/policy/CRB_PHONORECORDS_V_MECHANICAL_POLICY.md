# Copyright Royalty Board (CRB) Mechanical Royalty Policy: Phonorecords IV vs. Phonorecords V

- **Issue Reference:** `CI-V3-20261019-05`
- **Domain:** Royalty Accounting, Forecasting, and Educational Integrity
- **Date:** October 28, 2026
- **Status:** APPROVED POLICY & RECONCILIATION DOSSIER

---

## 1. Executive Summary

This document establishes the binding product and legal policy for `indii.music` regarding United States statutory mechanical royalty rates under Section 115 of the U.S. Copyright Act (17 U.S.C. § 115) and proceedings before the Copyright Royalty Board (CRB).

A review of internal documentation, educational agent datasets, and competitor marketing revealed widespread industry confusion regarding:
1. **The Current Effective Rates:** Governed by **Phonorecords IV (37 CFR Part 385)** for the rate period **January 1, 2023 – December 31, 2027**.
2. **The Pending Proceeding:** Governed by **Phonorecords V (Docket No. 25-CRB-0013-PR)** for the future rate period **January 1, 2028 – December 31, 2032**.

**Binding Directive:**
`indii.music` forecasting algorithms, royalty calculators, legal assistants, and educational modules **must never present proposed, contested, or prospective rates from the Phonorecords V proceeding as enacted law**. All calculations and projections must be strictly grounded in the enacted, CPI-adjusted rates of Phonorecords IV.

---

## 2. Definitive Statutory Framework & Rate Schedule

### 2.1 Enacted Baseline: Phonorecords IV (2023–2027)

* **Governing Regulation:** 37 CFR Part 385; CRB Determination in Docket No. 21-CRB-0001-PR (2023–2027).
* **Subpart B — Physical Phonorecords & Permanent Digital Downloads:**
  Under 37 CFR § 385.11, the statutory rate applies to each musical work manufactured and distributed on physical media (vinyl, CD, cassette) or permanent digital download. Beginning in 2023, the rate is adjusted annually based on the Consumer Price Index for All Urban Consumers (CPI-U):
  - **2023:** 12.0¢ per track (or 2.31¢ per minute of playing time or fraction thereof, whichever is greater).
  - **2024:** 12.4¢ per track (or 2.39¢ per minute).
  - **2025:** 12.7¢ per track (or 2.45¢ per minute).
  - **2026:** 13.1¢ per track (or 2.52¢ per minute).
  - **2027:** To be announced by the CRB in late 2026 based on the November CPI-U index.
  *(Note: The legacy rate of 9.1¢ per track / 1.75¢ per minute from Phonorecords III [2006–2022] is obsolete and must not be used in current calculations).*

* **Subpart C — Interactive Streaming & Limited Downloads:**
  Interactive streaming mechanical royalties (paid by digital service providers such as Spotify, Apple Music, and Amazon Music to the Mechanical Licensing Collective [The MLC]) scale progressively up to **15.35% of service revenue** (or defined per-subscriber / headline minimums):
  - **2023:** 15.1% of service revenue.
  - **2024:** 15.2% of service revenue.
  - **2025:** 15.25% of service revenue.
  - **2026:** 15.3% of service revenue.
  - **2027:** 15.35% of service revenue.

---

### 2.2 Pending Proceeding: Phonorecords V (2028–2032)

* **CRB Docket:** No. 25-CRB-0013-PR (*Determination of Royalty Rates and Terms for Making and Distributing Phonorecords*).
* **Applicable Period:** January 1, 2028 through December 31, 2032.
* **Current Procedural Posture:** Active rulemaking and evidentiary proceeding.
* **Subpart B (Physical & Downloads) Settlement Proposal:**
  - A proposed partial settlement was submitted by the National Music Publishers' Association (NMPA), the Nashville Songwriters Association International (NSAI), the American Association of Independent Music (A2IM), and major recording labels.
  - The settlement proposes maintaining the Subpart B rate framework (continuing annual CPI adjustments) through 2032.
  - **Opposition:** Formal objections and petitions have been filed by the Songwriters Guild of America (SGA), the Society of Composers & Lyricists (SCL), and independent songwriter collectives, asserting that inflation indexing alone perpetuates an inadequate historical baseline.
* **Subpart C (Interactive Streaming):**
  - Unsettled. Competing proposals exist between publisher organizations seeking higher headline percentage shares and DSPs seeking deductions for bundled subscriptions and free-tier playbacks.

---

## 3. Product & Technical Decisions

1. **Royalty Forecasting Engine (`PredictiveRoyaltyService.ts` & `MechanicalRoyaltyPanel.tsx`):**
   - The UI correctly displays: `Required for physical phonorecords & permanent downloads (37 CFR §385.11). US statutory rate (2026): $0.131/copy (or 2.52¢/min)`.
   - Projections for 2026–2027 must apply the effective 13.1¢/copy rate.
   - Long-term models extending into 2028+ must explicitly disclaim that 2028–2032 rates are pending final determination in CRB Docket No. 25-CRB-0013-PR.

2. **Educational Datasets & Agent Persona Guidance:**
   - Corrected historical inaccuracies in `docs/agent-training/datasets/` where 2023–2027 rates were mistakenly labeled as "Phonorecords V" or referenced the obsolete 9.1¢ rate.
   - All legal and publishing agent personas are grounded in:
     - 2023–2027 = **Phonorecords IV** (enacted law; 15.35% streaming cap; 13.1¢ physical in 2026).
     - 2028–2032 = **Phonorecords V** (pending proceeding; proposed settlement contested).

3. **Competitive & Investor Evidence Dossier:**
   - Reconciled against competitor claims (e.g. Royalti.io, Songtrust, Stem) to ensure `indii.music` maintains authoritative, legally audited positioning.
