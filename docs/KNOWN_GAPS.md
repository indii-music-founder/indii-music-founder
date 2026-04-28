# Known Gaps & Deferred Work

**Status Document for Acquisition Diligence**

This file documents subsystems that are intentionally stubbed, disabled, or incomplete pending specific triggers. Each gap includes:
- **What**: Description of the stub
- **Where**: File location and line reference
- **Why**: Reason for deferral (timeline, cost, dependency, etc.)
- **When**: Trigger condition for remediation
- **Effort**: Estimated effort to complete

---

## 1. Stripe Tax Forms Integration

**What:** `functions/src/stripe/taxForms.ts` (39 LOC) returns mock "Requested" status instead of wiring DocuSign + Stripe 1099 reporting.

**Where:** `functions/src/stripe/taxForms.ts:1-39`

**Why:** Stripe Tax Forms requires DocuSign integration for e-signature collection and 1099 reporting to IRS. Full implementation is deferred pending:
- Confirmation of DSP payment volume (when GMV > threshold)
- Legal review of 1099 thresholds and foreign entity handling
- DocuSign API onboarding and contract template setup

**When:** Remediation triggered when:
1. Artist count > 50 active creators, OR
2. Cumulative GMV > $25,000 in a single month, OR
3. Legal/finance explicitly requests 1099 compliance

**Effort:** 2–3 weeks (DocuSign SDK integration, webhook handling, form field mapping, testing)

**Current Behavior:** Returns `{ status: "Requested", url: null, signedAt: null }` regardless of input. No actual signature request is sent.

---

## 2. Blockchain Smart Contract Suite

**Status:** Fully disabled (not stubbed — removed from runtime)

**What:** Blockchain-backed NFT minting, royalty distribution contracts, and on-chain licensing were designed but not implemented.

**Where:** Code removed; configuration flags exist in `src/core/config/` but resolve to no-ops.

**Why:** Blockchain requires:
- Mainnet gas cost considerations (Ethereum, Polygon, or equivalent)
- Legal review of smart contract security (external audit)
- User education on wallet management and gas fees
- Alternatives (traditional escrow + API-driven splits) proved more reliable

**When:** Remediation triggered only if explicit business decision to pursue blockchain distribution.

**Effort:** Unknown (requires external audit + legal review; recommend 4–6 weeks for production-ready contracts)

---

## 3. <TBD by William>

**What:** <Description>

**Where:** <File and line reference>

**Why:** <Reason for deferral>

**When:** <Trigger for remediation>

**Effort:** <Time estimate>

---

## Verification Checklist

Before shipping to an acquirer, confirm:

- [ ] Each gap has a clear trigger condition (not "someday")
- [ ] Effort estimates are realistic and documented
- [ ] No security implications from stubbed code (confirm with security review)
- [ ] Customer-facing docs do not reference incomplete features
- [ ] CI/CD does not attempt to deploy stubbed subsystems

---

**Last Updated:** 2026-04-26  
**Author:** William Roberts (indiiOS)  
**Audience:** Acquisition diligence teams
