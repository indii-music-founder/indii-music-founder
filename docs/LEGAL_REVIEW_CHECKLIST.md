# Legal Review Checklist — indiiOS Pre-Launch

> **How to use this doc:** Two sections — things only **you (the founder)** can
> decide or action, and things that need an **attorney** to draft. Work through
> the founder section first; the attorney needs your answers before they can
> write anything.
>
> **The scaffolds live in:** `src/modules/legal/pages/LegalPages.tsx`
> Replace every `[ATTORNEY_REVIEW_REQUIRED]`, `[DATE_TBD]`, etc. with finalized
> text when done, then remove the amber "⚠️ Draft" banners.
>
> **How to verify nothing was missed:** `grep -r "ATTORNEY_REVIEW_REQUIRED\|DATE_TBD\|DESIGNATED_AGENT\|REGISTERED_ADDRESS\|PHONE_NUMBER" src/modules/legal/`

---

## PART 1 — FOUNDER DECISIONS (Only you can answer these)

These are not legal drafting tasks. They are business decisions the attorney
will need before they can write a single sentence. Gather these first.

### Business & Company Info

| # | Decision / Info needed | Your answer |
|---|------------------------|-------------|
| F1 | **Launch date** — What is the actual go-live date? Needed for "Effective date" on all legal docs. | `___________` |
| F2 | **Company registered address** — The official LLC address on file with the state. | `___________` |
| F3 | **DMCA designated agent** — Who at IndiiOS LLC will receive copyright takedown notices? (Can be you, a co-founder, or a registered agent service.) | `___________` |
| F4 | **Contact phone for DMCA agent** — Required by the Copyright Office for DMCA safe harbor registration. | `___________` |
| F5 | **Governing state** — Michigan is assumed (Detroit-area LLC). Confirm or correct. | Michigan / other: `___` |
| F6 | **Dispute resolution preference** — Arbitration (cheaper, limits class actions) or standard litigation? This is a business call, not a legal one. | `___________` |
| F7 | **Are you targeting EU users at launch?** — If yes, GDPR data controller registration may be required before day one. | Yes / No |
| F8 | **Data retention preference** — How long should user data be kept after account deletion? (Common: 30 days for accounts, 7 years for payment records.) | `___________` |

### AI Copyright — Platform Policy Decisions

This section is brand new law (Copyright Office, January–March 2025). The
ruling is clear on the spectrum:

> **Fully AI-generated → no copyright.** A user who just types a prompt and
> publishes the output owns nothing.
>
> **AI-assisted with human creative control → copyrightable.** A user who
> uploads their own photo and changes the background owns the result. A user
> who uses AI-generated stems but makes arrangement, selection, and composition
> decisions owns the song they built.

The line: **human decision-making applied to the output.** A prompt alone
is not enough. Selecting, arranging, modifying, or composing with AI outputs is.

You need to decide the platform's stance on each of the following before the
attorney can draft §4 and §5 of the ToS:

| # | Decision needed | Options | Your call |
|---|-----------------|---------|-----------|
| F9 | **Purely prompt-generated tracks** — Will indiiOS allow users to distribute music that was 100% AI-generated (no human arrangement/composition)? | (a) Allow with mandatory disclosure; (b) Block entirely; (c) Allow but warn user they have no copyright | `___________` |
| F10 | **AI disclosure at distribution time** — Will the distribution flow require users to declare AI involvement before sending to DSPs? DistroKid requires it; TuneCore rejects 100% AI tracks outright. | (a) Mandatory disclosure checkbox; (b) Optional; (c) Mirror DistroKid's model exactly | `___________` |
| F11 | **Platform's copyright warranty** — Do you want users to warrant (promise, under penalty of account termination) that they have a valid copyright claim before distributing? | (a) Yes, required before every release; (b) Yes, one-time on account creation; (c) No warranty required | `___________` |
| F12 | **AI image ownership** — For images generated in the Creative Studio: does indiiOS claim any license to those images, or does it all belong to the user? | (a) User owns all; (b) User owns, platform gets a non-exclusive license to display/thumbnail; (c) Attorney to advise | `___________` |
| F13 | **Gemini downstream restrictions** — Google's ToS restricts some uses of Gemini outputs. Do you want the attorney to review Google's current AI ToS and flow restrictions down to users, or keep it simple and just say "comply with Google's terms"? | (a) Full review + custom clauses; (b) Pass-through reference to Google ToS | `___________` |

### Email Infrastructure (Do this yourself — 10 minutes)

| # | Task | Status |
|---|------|--------|
| F14 | Create `legal@indiios.com` and forward to your inbox | [ ] |
| F15 | Create `privacy@indiios.com` and forward to your inbox | [ ] |
| F16 | Create `dmca@indiios.com` and forward to whoever handles takedowns | [ ] |
| F17 | Register DMCA agent at **copyright.gov/dmca-directory** — $6/year, 10 minutes. Required for DMCA safe harbor (17 U.S.C. § 512). Without this, you lose safe harbor protection. | [ ] |

### Production Infrastructure (Engineering — not legal)

| # | Task | How |
|---|------|-----|
| F18 | Add real Stripe price IDs to Cloud Functions environment | `firebase functions:config:set stripe.price_pro_monthly=price_xxx` etc. |
| F19 | Set `VITE_FIREBASE_APP_CHECK_KEY` in production environment | Prevents API abuse. Currently optional; required before production. |

---

## PART 2 — ATTORNEY TASKS (Bring your answers from Part 1)

**Attorney type:** Startup/tech attorney with music industry experience.
Options: Cowan DeBaets (music-focused, NYC), Volunteer Lawyers for the Arts
(affordable), or a general startup firm (Cooley, Gunderson, Clerky) for the
tech side + a music attorney for DSP/distribution clauses.
**Budget estimate:** $2,000–$8,000 for ToS + Privacy bundle; music-specific
clauses (DSP sub-distribution, AI content) may add cost.

### Terms of Service — Attorney Drafts

| # | Section in LegalPages.tsx | What to give the attorney | Legal work required |
|---|--------------------------|---------------------------|---------------------|
| A1 | §4 Intellectual Property | Your answers to F9, F12 | Draft IP ownership clause: user retains rights to original work; define who owns AI-assisted outputs; clarify purely AI-generated work has no copyright per Copyright Office guidance |
| A2 | §5 AI-Generated Content | Your answers to F10, F11, F13 | Draft AI disclosure requirements; copyright warranty clause; Gemini downstream restrictions; align with DistroKid/TuneCore disclosure model |
| A3 | §7 Distribution Services | Confirm your DSP partners (Spotify, Apple, etc.) | Draft sub-distribution terms: takedown SLAs, what happens if a release is rejected by a DSP, exclusivity terms, split sheet enforceability |
| A4 | §9 Limitation of Liability | Your answer to F6 | Standard disclaimer + indemnification cap covering: distribution errors, AI output inaccuracies, payment processing failures |
| A5 | §10 Governing Law | Your answers to F5, F6 | Jurisdiction clause, dispute resolution mechanism, class action waiver if arbitration |
| A6 | Effective Date | Your answer to F1 | Replace `[DATE_TBD]` |

### Privacy Policy — Attorney Drafts

| # | Section | What to give the attorney | Legal work required |
|---|---------|---------------------------|---------------------|
| A7 | §6 Data Retention | Your answer to F8 | Draft retention schedule: accounts, uploaded content, analytics, payment records, legal documents (split sheets, contracts) |
| A8 | GDPR compliance | Your answer to F7 | If EU users: register as Data Controller; draft GDPR-compliant retention, erasure, and portability procedures |
| A9 | Effective Date | Your answer to F1 | Replace `[DATE_TBD]` |

### DMCA Policy — Attorney Reviews

| # | Item | What to give the attorney |
|---|------|---------------------------|
| A10 | Designated agent info | Your answers to F3, F4, company address from F2 — replace `[DESIGNATED_AGENT_NAME]`, `[REGISTERED_ADDRESS]`, `[PHONE_NUMBER]` |
| A11 | Safe harbor review | Confirm DMCA agent is registered (F17) and that your repeat-infringer policy is enforceable |

---

## AI Copyright — Reference Card for the Attorney

> Give this section to your attorney when they draft §4 and §5.

**Current law (as of March 2025):**

| Scenario | Copyrightable? | Basis |
|----------|----------------|-------|
| User types prompt → AI generates image/song, published as-is | **No** | *Thaler v. Perlmutter* (D.C. Circuit, March 2025); Copyright Office Part 2 Report (Jan 2025) |
| User uploads their own photo + AI changes the background | **Yes** | Human authorship in original photo + creative approval of changes |
| User uses AI-generated audio stems + makes arrangement/composition decisions | **Yes** | Human creative control over arrangement and selection qualifies as authorship |
| User generates AI stems with prompts, no further editing | **No** | Prompts alone ≠ human authorship |
| User generates AI stems + curates/arranges into an album | **Partial** | Album as a "collective work" may be copyrightable; individual AI stems are not |

**DSP disclosure landscape (what the platform needs to align with):**
- DistroKid: AI disclosure checkbox + description of human contribution → **required**
- TuneCore: Declares AI involvement in composition/mastering → **required**; rejects 100% AI tracks
- CD Baby: Rejects 100% AI-generated music
- Spotify: Voluntary supply-chain metadata disclosure (for now)
- Deezer: Automatic AI detection, auto-labels tracks

**What the platform needs in-app (for the engineer, not the attorney):**
- An AI disclosure step in the distribution flow (before sending to DSPs)
- A checkbox: "This release contains AI-generated content" + description field
- A copyright warranty checkbox: "I confirm I have human authorship over the creative decisions in this release"
- Platform-level block or warning when user tries to distribute a track flagged as 100% AI

---

## How to Close This Checklist

1. Complete all **F items** in Part 1 — decisions only you can make
2. Register DMCA agent at copyright.gov (F17) — do this now, it takes 10 min
3. Set up email aliases (F14–F16)
4. Brief the attorney with your Part 1 answers + the AI reference card above
5. Attorney returns finalized language → update `LegalPages.tsx`
6. Remove amber "⚠️ Draft" banners from each legal component
7. Run: `grep -r "ATTORNEY_REVIEW_REQUIRED\|DATE_TBD\|DESIGNATED_AGENT\|REGISTERED_ADDRESS\|PHONE_NUMBER" src/modules/legal/` — should return zero results

When that grep returns nothing, the legal P0 is cleared.

---

## Detroit / Local Entrepreneur Resources

> **Note to founder:** Look into these before paying full market rate for
> legal, accounting, or business services. Detroit has a strong startup
> support ecosystem and several of these offer subsidized or free services
> specifically for early-stage tech companies.

| Organization | What they offer | Why relevant |
|---|---|---|
| **TechTown Detroit** | Business accelerator, co-working, legal clinics, mentorship, and connections to investors. Focused on Detroit-based tech entrepreneurs. | First stop. They run programs for startups at exactly this stage and can connect you to vetted attorneys, accountants, and advisors at reduced cost. Website: techtowndetroit.org |
| **Michigan SBDC** (Small Business Development Center) | Free one-on-one business advising, market research, and funding guidance. Statewide network. | Can help with business plan, financials, and funding options at no cost. |
| **Wayne State University Law School — Law Clinic** | Law students supervised by licensed attorneys provide free or low-cost legal services to small businesses | Good option for basic contract review and business formation questions |
| **Volunteer Lawyers for the Arts (VLA)** | Free and low-cost legal help for artists and arts organizations | Directly relevant for music IP, copyright registration, and artist contracts |
| **Detroit Venture Partners / Invest Detroit** | Local VC and community development finance | If you need seed funding, these are the Detroit-first investors to know |
| **Michigan Economic Development Corp (MEDC)** | State grants, tax credits, and startup programs | Check for any tech startup grants or Creative Economy programs |

**Action:** Contact TechTown Detroit first — they can route you to the right
resources for legal, accounting, and investor introductions all in one call.

---

## Agent Tools — Music Rights Registries (Engineering Backlog)

> **Context:** The platform's browser agent tools currently support music
> distribution lookups. The following two registries need to be added as
> searchable/actionable tools in the agent layer so users can handle
> music rights directly from within indiiOS.

### Harry Fox Agency (HFA) / Songfile
- **What it is:** The primary US mechanical licensing agency. When someone
  wants to cover a song or use it in a recording, they get a mechanical
  license through HFA.
- **What the tool needs to do:** Allow a user to search HFA/Songfile for
  mechanical license availability, initiate a license request for a song
  they want to sample or cover, and track license status.
- **API / integration path:** HFA is now owned by SESAC. Check
  songfile.com for their API/affiliate program. Alternatively integrate
  via a mechanical licensing aggregator (Songclip, Musicbed, etc.).
- **File to update:** Add tool definition to `python/tools/` and register
  in the agent tool registry.

### Library of Congress — Copyright Registration
- **What it is:** The official US copyright registration system
  (copyright.gov). Registration is optional but required to sue for
  statutory damages and attorney fees if someone infringes your work.
- **What the tool needs to do:**
  1. Guide the user through pre-registration (checklist of what they need)
  2. Link directly to the eCO (Electronic Copyright Office) registration
     portal at copyright.gov/registration
  3. For AI-assisted works: prompt the user to declare human authorship
     contributions before registering (per Copyright Office Part 2 guidance,
     January 2025 — see AI Reference Card above)
  4. Track registration status by case number
- **Note:** The Copyright Office does not have a public API for automated
  filing. The tool should be a guided workflow + deep link, not a direct
  API integration.
- **File to update:** Add to `python/tools/` alongside the HFA tool.

**Priority:** Both tools are P1 — important for a full-service music
platform but not a launch blocker. Add to the engineering backlog.
