# 05 — Pre-Launch Orchestration Timeline

> **Time to complete:** 20 minutes (read + set dates)  
> **Who:** Founder  
> **What this unblocks:** The actual launch  
> **Dependencies:** Read Docs 01–04 first. You need those decisions before this timeline makes sense.

---

## The Sequencing Problem

Many of these tasks depend on each other. You can't register a DMCA agent without a company address. You can't hire an attorney without your AI copyright decisions. You can't launch without legal docs.

This timeline puts everything in the right order.

---

## Launch Countdown (Work Backwards from Go-Live)

### ── T-minus 6 weeks: Foundation ───────────────────────────

> **Goal:** All business decisions made. Attorney brief prepared.

| Week | Task | Doc | Time | Status |
|------|------|-----|------|--------|
| W-6 Mon | Fill in `01_COMPANY_IDENTITY.md` (all fields) | Doc 01 | 15 min | `[ ]` |
| W-6 Mon | Create 4 email aliases (legal@, privacy@, dmca@, support@) | Doc 01 §1.4 | 10 min | `[ ]` |
| W-6 Mon | Register DMCA agent at copyright.gov | Doc 01 §1.3 | 10 min | `[ ]` |
| W-6 Tue | Fill in `02_AI_COPYRIGHT_STANCE.md` (all 5 decisions) | Doc 02 | 30 min | `[ ]` |
| W-6 Wed | Fill in `03_REVENUE_AND_PRICING.md` (pricing + revenue model) | Doc 03 | 45 min | `[ ]` |
| W-6 Thu | Create Stripe products with decided pricing | Doc 03 §B5 | 30 min | `[ ]` |
| W-6 Thu | Run `firebase functions:config:set` with Stripe price IDs | Doc 03 §B5 | 10 min | `[ ]` |
| W-6 Fri | **Prepare attorney brief** — compile Docs 01 + 02 into a packet | See below | 30 min | `[ ]` |

### ── T-minus 5 weeks: Attorney Engagement ─────────────────

> **Goal:** Attorney has your brief and starts drafting.

| Week | Task | Time | Status |
|------|------|------|--------|
| W-5 Mon | **Contact attorney** — send the brief packet | 30 min | `[ ]` |
| W-5 Mon | Confirm estimated turnaround time (usually 2-3 weeks for ToS + Privacy) | 15 min | `[ ]` |
| W-5 Tue | Start DistroKid API/SFTP credential process | Doc 04 §A1 | 15 min | `[ ]` |
| W-5 Wed | Register at DDEX Knowledge Base + sign implementation license | Doc 04 §B1 | 15 min | `[ ]` |
| W-5 Wed | Apply for DDEX Party ID (DPID) | Doc 04 §B1 | 15 min | `[ ]` |
| W-5 Thu | Register App Check in Firebase Console (monitor-only mode) | Doc 03 §B6 | 15 min | `[ ]` |
| W-5 Fri | Choose ASCAP or BMI — apply as publisher | Doc 04 | 20 min | `[ ]` |

### ── T-minus 4 weeks: Attorney Phase (Passive) ───────────

> **Goal:** Attorney is drafting. You focus on distribution partnerships.

| Week | Task | Time | Status |
|------|------|------|--------|
| W-4 Mon | Follow up on DistroKid API access if no response | 10 min | `[ ]` |
| W-4 Tue | Register at SoundExchange | Doc 04 | 15 min | `[ ]` |
| W-4 Wed | **Attorney check-in** — answer any questions they have | 30 min | `[ ]` |
| W-4 Thu | Register at MLC (Music Licensing Collective) | Doc 04 | 15 min | `[ ]` |
| W-4 Fri | Attorney partnership outreach follow-up (if applicable) | LEGAL_REVIEW_CHECKLIST §O4 | 20 min | `[ ]` |

### ── T-minus 3 weeks: Legal Review ───────────────────────

> **Goal:** Attorney delivers first drafts. Review and iterate.

| Week | Task | Time | Status |
|------|------|------|--------|
| W-3 Mon | **Receive attorney draft** — ToS, Privacy Policy, DMCA Policy | — | `[ ]` |
| W-3 Mon–Wed | **Review all three documents** — mark any corrections | 2 hrs | `[ ]` |
| W-3 Thu | Send corrections back to attorney | 30 min | `[ ]` |
| W-3 Fri | Receive final versions | — | `[ ]` |

### ── T-minus 2 weeks: Code Integration ──────────────────

> **Goal:** Legal text is live in the app. Production infrastructure set.

| Week | Task | Time | Status |
|------|------|------|--------|
| W-2 Mon | **Replace all placeholders** in `LegalPages.tsx` with finalized attorney text | 1 hr (engineering) | `[ ]` |
| W-2 Mon | Remove amber "⚠️ Draft" banners from legal components | 15 min (engineering) | `[ ]` |
| W-2 Tue | Run verification: `grep -r "ATTORNEY_REVIEW_REQUIRED\|DATE_TBD\|DESIGNATED_AGENT\|REGISTERED_ADDRESS\|PHONE_NUMBER" src/modules/legal/` — should return 0 results | 5 min | `[ ]` |
| W-2 Tue | Set `VITE_FIREBASE_APP_CHECK_KEY` in production `.env` | 5 min | `[ ]` |
| W-2 Wed | **Full production deploy** — `npm run deploy` | 15 min | `[ ]` |
| W-2 Wed | Deploy Cloud Functions with finalized Stripe config | 10 min | `[ ]` |
| W-2 Thu | **Staging test** — complete end-to-end flow: sign up → create → distribute → checkout | 1 hr | `[ ]` |
| W-2 Fri | Fix any staging issues discovered during testing | Varies | `[ ]` |

### ── T-minus 1 week: Final Checks ───────────────────────

> **Goal:** Everything works. Pre-launch marketing begins.

| Week | Task | Time | Status |
|------|------|------|--------|
| W-1 Mon | **Test Stripe checkout** in live mode (pay $1 test product, refund) | 15 min | `[ ]` |
| W-1 Mon | Verify Founders Pass flow works (use test mode) | 30 min | `[ ]` |
| W-1 Tue | Verify DMCA agent registration is active on copyright.gov | 5 min | `[ ]` |
| W-1 Tue | Verify distribution flow submits to DistroKid (test track) | 30 min | `[ ]` |
| W-1 Wed | **Pre-launch announcement** — social media, email list, etc. | 1 hr | `[ ]` |
| W-1 Thu | **Soft launch to Founders** — invite first 2-3 founders for early access | 1 hr | `[ ]` |
| W-1 Fri | Collect founder feedback, hotfix anything critical | Varies | `[ ]` |

### ── T-0: Launch Day ─────────────────────────────────────

| Task | Status |
|------|--------|
| Open registration to public | `[ ]` |
| Publish Founders Pass for sale | `[ ]` |
| Monitor error logs (Sentry, Cloud Functions) | `[ ]` |
| Stand by for support requests | `[ ]` |
| Celebrate 🎉 | `[ ]` |

---

## Attorney Brief Packet (What to Send)

When you contact an attorney, send them this packet:

1. **This document set:**
   - `01_COMPANY_IDENTITY.md` — filled in with your answers
   - `02_AI_COPYRIGHT_STANCE.md` — filled in with your decisions

2. **From the existing codebase:** 
   - `docs/LEGAL_REVIEW_CHECKLIST.md` — contains the AI Copyright Reference Card (cases + DSP policies) and the full list of attorney tasks (A1–A11)

3. **A one-sentence brief:**
   > "I need a Terms of Service, Privacy Policy, and DMCA Policy for a SaaS platform that helps independent musicians create, distribute, and monetize music using AI tools. The platform integrates with third-party distributors (DistroKid, TuneCore) and generates content using Google's Gemini AI. I've filled in all business decisions — I need you to draft the legal language."

4. **Budget context:**
   - ToS + Privacy + DMCA bundle: $2,000–$8,000 (typical for startup)
   - Music-specific clauses may add cost
   - Consider Volunteer Lawyers for the Arts or TechTown Detroit for lower-cost options (see `LEGAL_REVIEW_CHECKLIST.md` → Detroit Resources)

---

## Post-Launch Milestones

These are not launch blockers but should happen within 90 days:

| Timeframe | Milestone |
|-----------|-----------|
| Launch + 2 weeks | Enforce App Check (switch from monitor-only to enforce) |
| Launch + 30 days | First revenue report from DistroKid DSR |
| Launch + 30 days | Attorney partnership deal structure agreed (if pursuing) |
| Launch + 60 days | DPID received — begin DDEX peer conformance testing |
| Launch + 90 days | ASCAP/BMI IPI number received — enable performance royalty features |
| Launch + 6 months | First direct DSP delivery via DDEX (Phase B) |

---

## Your Launch Date

> Fill this in once you've decided:

**Go-live date:** `_________________________________`

This date will be used as the "Effective Date" on all legal documents and becomes the target for the countdown above.

