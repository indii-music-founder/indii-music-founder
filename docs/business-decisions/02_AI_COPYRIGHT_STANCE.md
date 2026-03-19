# 02 — AI Copyright Platform Stance

> **Time to complete:** 30 minutes (read + decide)  
> **Who:** Founder  
> **What this unblocks:** Terms of Service §4 (IP) and §5 (AI Content), distribution flow UX, DSP compliance  
> **Why this matters:** This is the most strategically important decision you'll make before launch. It defines how your platform positions itself in the music AI space — safely, legally, and credibly.

---

## The Legal Landscape (What You Need to Know)

### The Rule (as of March 2025)

The U.S. Copyright Office has been clear:

| What happened | Copyright? | Why |
|--------------|-----------|-----|
| User types a prompt → AI generates a song → user publishes it as-is | **No** | Prompts alone are not "human authorship" |
| User generates AI stems → arranges, selects, composes with them | **Yes** | Human creative control over arrangement qualifies |
| User uploads their own vocals → AI generates background instrumentation | **Yes** | Human authorship in song + creative approval of AI output |
| User generates 100 AI tracks → picks the 10 best for an album | **Partial** | Album as "collective work" may qualify; individual tracks don't |

**The bright line:** A prompt is not enough. Human creative decisions applied *to* the output — selection, arrangement, modification, composition — create copyrightable work.

### What DSPs Require Today

| Distributor | AI Disclosure | 100% AI Tracks | Human Contribution Description |
|------------|--------------|----------------|-------------------------------|
| **DistroKid** | ✅ Mandatory checkbox | ⚠️ Allowed with disclosure | ✅ Required text field |
| **TuneCore** | ✅ Mandatory | ❌ Rejected | ✅ Required |
| **CD Baby** | ✅ Mandatory | ❌ Rejected | ✅ Required |
| **Spotify** | 🟡 Voluntary supply-chain metadata | ⚠️ Case-by-case | Not required yet |
| **Deezer** | 🤖 Automatic AI detection + auto-label | ⚠️ Flagged but not rejected | N/A (automated) |
| **Apple Music** | 🟡 Voluntary | ⚠️ Case-by-case | Not required yet |

**Trend:** The industry is moving toward mandatory disclosure. Platforms that don't enforce it will lose DSP trust.

---

## Your Decisions

### Decision A1: Purely AI-Generated Tracks

> **Question:** Will indiiOS allow users to distribute music that was 100% AI-generated (no human arrangement, selection, or composition)?

| Option | What it means | Risk | Best for |
|--------|-------------|------|----------|
| **(a) Allow with mandatory disclosure** | Users can distribute, but must check "100% AI" box — DSPs that reject AI tracks will bounce them | Low risk — liability shifts to user via disclosure | Maximum user freedom |
| **(b) Block entirely** | Platform refuses to submit 100% AI tracks to any DSP | Very safe legally; may frustrate some users | Maximum legal safety |
| **(c) Allow but warn** | Allow distribution, but show a warning: "This track has no copyright protection. You cannot sue for infringement." | Medium risk — users are informed but may still have bad outcomes | Balanced approach |

> **Recommendation:** 🟡 **Option (a) — Allow with mandatory disclosure.**
> This mirrors DistroKid's model (the largest indie distributor) and puts the burden on the user. The platform is not making the legal claim — the user is. indiiOS's distribution flow already includes an AI disclosure step.

**Your answer:** `_________________________________`

---

### Decision A2: AI Disclosure at Distribution Time

> **Question:** Will the DDEX release wizard require users to declare AI involvement before submitting to DSPs?

| Option | What it means |
|--------|-------------|
| **(a) Mandatory disclosure checkbox** | Every release asks: "Does this release contain AI-generated content?" If yes, user must describe human contribution. Cannot proceed without answering. |
| **(b) Optional** | Checkbox available but not required. |
| **(c) Mirror DistroKid's exact model** | Checkbox + description field, identical UX to DistroKid's flow so there's no mismatch between what the user disclosed on indiiOS and what DistroKid expects. |

> **Recommendation:** 🟢 **Option (c) — Mirror DistroKid's model.**
> Since DistroKid is the primary distribution partner, matching their UX exactly prevents disclosure mismatches that could cause DSP rejections. This is also the most legally defensible position.
>
> ✅ **Already implemented in code:** The distribution flow in `useDDEXRelease.ts` includes an `ai_disclosure` step in the wizard. The `ERNMapper.ts` includes AI disclosure classification in DDEX ERN 4.3 output.

**Your answer:** `_________________________________`

---

### Decision A3: Copyright Warranty

> **Question:** Before distributing, should users warrant (promise, under penalty of account termination) that they have a valid copyright claim?

| Option | What it means |
|--------|-------------|
| **(a) Required before every release** | Checkbox on each release: "I confirm I have human authorship over the creative decisions in this release." Strongest protection. |
| **(b) One-time on account creation** | Warranty given once at sign-up. Less friction, less protection. |
| **(c) No warranty required** | Users distribute with no claim. Weak legal position for the platform. |

> **Recommendation:** 🟡 **Option (a) — Required before every release.**
> This matches DistroKid and TuneCore. It's the industry standard. If a user distributes an infringing work, the platform can point to the warranty as evidence that the user lied — critical for DMCA safe harbor defense.

**Your answer:** `_________________________________`

---

### Decision A4: AI Image Ownership

> **Question:** For images generated in the Creative Studio (via Gemini), does indiiOS claim any license?

| Option | What it means |
|--------|-------------|
| **(a) User owns all** | indiiOS claims zero rights to any generated image. Cleanest for users, but means indiiOS can't use user creations in marketing without separate permission. |
| **(b) User owns + platform display license** | User owns all rights. indiiOS gets a non-exclusive, revocable license to display thumbnails/previews within the platform UI (not externally). Standard SaaS clause. |
| **(c) Attorney to advise** | Let the attorney recommend based on your business model. |

> **Recommendation:** 🟡 **Option (b) — User owns + platform display license.**
> This is the standard SaaS model. Without the display license, the platform technically can't even show the user's own images back to them in the gallery. The license is limited to in-platform display — no marketing use, no sublicensing.

**Your answer:** `_________________________________`

---

### Decision A5: Gemini Downstream Restrictions

> **Question:** Google's ToS restricts some uses of Gemini outputs. How should the platform handle this?

| Option | What it means |
|--------|-------------|
| **(a) Full review + custom clauses** | Attorney reviews current Google Gen AI ToS and writes custom clauses in your ToS that flow restrictions down to users. More expensive but thorough. |
| **(b) Pass-through reference** | Your ToS says: "Content generated through AI features is subject to Google's Generative AI Terms of Service. You agree to comply with those terms." Simpler and cheaper. |

> **Recommendation:** 🟢 **Option (b) — Pass-through reference.**
> Google updates their AI ToS frequently. Custom clauses would need updating every time Google changes theirs. A pass-through reference auto-updates because it points to the current version.

**Your answer:** `_________________________________`

---

## Summary: What to Tell Your Attorney

Once you've made all 5 decisions above, hand this document to your attorney and say:

> "I need you to draft §4 (Intellectual Property) and §5 (AI-Generated Content) of our Terms of Service based on these decisions. Here's a reference card on the current AI copyright landscape — see the bottom of `docs/LEGAL_REVIEW_CHECKLIST.md` for the full AI Copyright Reference Card with case citations."

The attorney will use your A1–A5 answers to write legally binding language that:
- Defines who owns what (user vs. platform)
- Requires AI disclosure before distribution
- Includes a copyright warranty per release
- References Gemini/Google ToS
- Aligns with DSP requirements

---

## Code Already Implemented

All code paths for these decisions already exist:

| Feature | Status | Location |
|---------|--------|----------|
| AI disclosure wizard step | ✅ Built | `src/modules/publishing/hooks/useDDEXRelease.ts` → `ai_disclosure` step |
| ERN 4.3 AI classification | ✅ Built | `src/services/ddex/ERNMapper.ts` → `classifyAIDisclosure()` |
| Distribution flow with disclosure | ✅ Built | `src/modules/publishing/` → ReleaseWizard components |
| Legal page scaffolds | ✅ Built | `src/modules/legal/pages/LegalPages.tsx` — awaiting attorney text |

The only thing missing is the human decision that tells the attorney *which* option to codify into legal language.

