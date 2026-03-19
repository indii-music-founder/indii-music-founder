# 01 — Company Identity & Legal Basics

> **Time to complete:** 15 minutes  
> **Who:** Founder only  
> **What this unblocks:** All legal documents, DMCA safe harbor, attorney engagement, privacy policy

---

## Instructions

Fill in every field below. These answers go directly into your Terms of Service, Privacy Policy, and DMCA Policy. Your attorney cannot write a single sentence until these are complete.

When you've filled in a field, change the status from 🔴 to 🟢.

---

## 1.1 Company Information

| # | Field | Your Answer | Status |
|---|-------|------------|--------|
| F1 | **Legal entity name** | IndiiOS LLC | 🟢 |
| F2 | **Registered address** (the official LLC address filed with Michigan) | `_________________________________` | 🔴 |
| F3 | **State of incorporation** | Michigan | 🟢 |
| F4 | **EIN (Employer Identification Number)** — needed for Stripe, banking, ASCAP/BMI | `_________________________________` | 🔴 |

---

## 1.2 Launch Date

| # | Field | Your Answer | Status |
|---|-------|------------|--------|
| F5 | **Target launch date** (becomes "Effective Date" on all legal docs) | `_________________________________` | 🔴 |

> **Tip:** Pick a date at least 4 weeks out from when you brief the attorney. They need 2–3 weeks for ToS + Privacy drafting.

---

## 1.3 DMCA Safe Harbor

> ⚠️ **This is non-negotiable for a platform that hosts user content.**  
> Without DMCA safe harbor registration, IndiiOS LLC is directly liable for every copyright-infringing upload.  
> Registration costs $6/year and takes 10 minutes.

| # | Field | Your Answer | Status |
|---|-------|------------|--------|
| F6 | **DMCA designated agent name** — Who will receive copyright takedown notices? (Can be you, a co-founder, or a registered agent service like CT Corporation.) | `_________________________________` | 🔴 |
| F7 | **DMCA agent email** | `dmca@indiios.com` (create this alias) | 🟡 |
| F8 | **DMCA agent phone** — Required by the Copyright Office. Can be a Google Voice number. | `_________________________________` | 🔴 |
| F9 | **DMCA registration** — Register at [copyright.gov/dmca-directory](https://www.copyright.gov/dmca-directory/) | `[ ] Done` | 🔴 |

### How to Register (10 minutes)

1. Go to [copyright.gov/dmca-directory](https://www.copyright.gov/dmca-directory/)
2. Click "Register a DMCA Agent"
3. Create a copyright.gov account (if you don't have one)
4. Fill in:
   - **Service Provider:** IndiiOS LLC
   - **Alternative Names:** indiiOS, indiios.com
   - **Agent Name:** (your answer to F6)
   - **Agent Address:** (your answer to F2)
   - **Agent Phone:** (your answer to F8)
   - **Agent Email:** dmca@indiios.com
5. Pay $6
6. Save your confirmation number

---

## 1.4 Email Infrastructure

> These email aliases take 2 minutes to set up in your domain provider (Google Workspace, Cloudflare Email, etc.). All can forward to your personal inbox.

| # | Email | Purpose | Status |
|---|-------|---------|--------|
| F10 | `legal@indiios.com` | Contact address in Terms of Service footer | `[ ] Created` | 🔴 |
| F11 | `privacy@indiios.com` | Contact address in Privacy Policy (GDPR requirement) | `[ ] Created` | 🔴 |
| F12 | `dmca@indiios.com` | DMCA takedown notice submissions | `[ ] Created` | 🔴 |
| F13 | `support@indiios.com` | General user support (used in error pages) | `[ ] Created` | 🔴 |

---

## 1.5 Jurisdiction & Disputes

| # | Decision | Options | Recommended | Your Answer | Status |
|---|----------|---------|-------------|------------|--------|
| F14 | **Governing law state** | Michigan (your LLC state) | ✅ Michigan — keeps it consistent with your filing | `_________` | 🔴 |
| F15 | **Dispute resolution** | (a) Binding arbitration; (b) Standard litigation; (c) Small claims exception + arbitration | ✅ Option (c) — arbitration with small claims carve-out. Industry standard for SaaS. Limits class action exposure while keeping small claims accessible. | `_________` | 🔴 |

---

## 1.6 Data & Privacy

| # | Decision | Options | Recommended | Your Answer | Status |
|---|----------|---------|-------------|------------|--------|
| F16 | **Are you targeting EU users at launch?** | Yes / No | No — launch US-only, add GDPR later. Reduces day-one legal cost significantly. | `_________` | 🔴 |
| F17 | **Data retention after account deletion** | (a) 30 days account data, 7 years financial; (b) 90 days account, 7 years financial; (c) Custom | ✅ Option (a) — 30 days for account data (allows "undo"), 7 years for payment/financial records (IRS requirement) | `_________` | 🔴 |

---

## What Happens After You Complete This

1. **Send this document to your attorney** — they need F2, F5, F6, F8, F14, F15, F16, F17 to draft legal docs
2. **The code placeholders are updated** — an engineer replaces `[DATE_TBD]`, `[REGISTERED_ADDRESS]`, `[DESIGNATED_AGENT_NAME]`, `[PHONE_NUMBER]` in `src/modules/legal/pages/LegalPages.tsx`
3. **DMCA safe harbor is active** — once F9 is registered at copyright.gov
4. **Attorney can begin drafting** — ToS, Privacy Policy, DMCA Policy

---

## Where These Answers Go (Code Reference)

| Answer | Used In | Code Location |
|--------|---------|---------------|
| F2 (Address) | ToS footer, DMCA Policy, Privacy Policy | `src/modules/legal/pages/LegalPages.tsx` → `[REGISTERED_ADDRESS]` |
| F5 (Launch date) | All legal docs "Effective Date" | `src/modules/legal/pages/LegalPages.tsx` → `[DATE_TBD]` |
| F6 (DMCA agent) | DMCA Policy designated agent section | `src/modules/legal/pages/LegalPages.tsx` → `[DESIGNATED_AGENT_NAME]` |
| F8 (Phone) | DMCA Policy | `src/modules/legal/pages/LegalPages.tsx` → `[PHONE_NUMBER]` |
| F15 (Disputes) | ToS §10 | `src/modules/legal/pages/LegalPages.tsx` → `[ATTORNEY_REVIEW_REQUIRED]` |
| F17 (Retention) | Privacy Policy §6 | `src/modules/legal/pages/LegalPages.tsx` → `[ATTORNEY_REVIEW_REQUIRED]` |

