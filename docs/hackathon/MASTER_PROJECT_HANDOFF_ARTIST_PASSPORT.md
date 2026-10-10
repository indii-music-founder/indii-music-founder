# INDII.MUSIC — ARTIST PASSPORT
## MASTER PROJECT HANDOFF
**Version:** 1.0 | October 10, 2026  
**Tracking Issue:** [GitHub Issue #411](https://github.com/indii-music-founder/indii-music-founder/issues/411)

---

## PURPOSE

Establish one shared operational plan for:

1. **ChatGPT** — Project Coordinator
2. **Antigravity** — Knowledge Manager & Repository Maintainer
3. **Replit** — Competition Development Environment

The purpose is to build, launch, measure, and evaluate the Artist Passport customer-acquisition experience during the Oneday × Replit Hackathon (Saturday, October 10, 2026, 12:00 PM – 4:00 PM EDT).

This document is the operational reference for all three systems.

---

## SECTION A — PROJECT IDENTITY

- **COMPANY:** `indii.music`
- **CANONICAL TAGLINE:** `music business at the speed of you` (lowercase, no ending period)
- **PRODUCT:** An AI-native music-business operating system for independent artists at every career stage.
- **CORE PRINCIPLE:**  
  *AI manages the business. Humans create the music.*  
  - AI-generated music is not supported.  
  - Legitimately licensed samples, loops, and sample-based human productions are supported.
- **COMPETITION PRODUCT:** Artist Passport
- **DESCRIPTION:** A short assessment that helps independent musicians identify potential gaps in their music-business setup. The assessment provides relevant recommendations and introduces artists to indii.music. It is a customer-acquisition experience, not the complete indii.music application.
- **OFFICIAL DESTINATIONS:**
  - Website: `https://indii.music`
  - Signup: `https://indii.music/signup`
  - Waitlist: `https://indii.music/#waitlist`
  - Studio: `https://app.indii.music`
  - Repository: `https://github.com/indii-music-founder/indii-music-founder`
  - Tracking: `https://github.com/indii-music-founder/indii-music-founder/issues/411`

---

## SECTION B — WHO DOES WHAT

### CHATGPT — PROJECT COORDINATOR
- Maintaining the overall strategy
- Interpreting competition instructions
- Reviewing Replit's development progress
- Writing instructions and corrections for Replit
- Helping the founder troubleshoot
- Coordinating requests to Antigravity
- Reviewing the actual customer-acquisition results
- Preparing the final demonstration and presentation
- Tracking confirmed versus unverified outcomes
- *ChatGPT is the founder's primary conversation and decision-support system. ChatGPT must not claim to have tested or completed work unless it has direct evidence.*

### ANTIGRAVITY — KNOWLEDGE MANAGER & REPOSITORY MAINTAINER
- Maintaining the official project briefing
- Preserving the design specifications
- Maintaining the decision log
- Organizing research
- Recording implementation progress
- Documenting known problems
- Recording test evidence supplied by Replit
- Maintaining the future migration plan
- Identifying conflicting instructions
- Preserving useful lessons after the competition
- Repository health and maintenance on `main`
- *Antigravity should not duplicate Replit's development work unless specifically instructed.*

### REPLIT — COMPETITION BUILDER
- Creating the Artist Passport application
- Implementing its questionnaire
- Generating personalized assessments
- Creating an optional lead-capture experience
- Implementing suitable measurement
- Testing the application
- Publishing a working public link
- Fixing problems discovered during testing
- *Replit is the official competition development environment.*

### FOUNDER — PRODUCT OWNER
- Final product decisions
- Competition participation
- Contacting musicians
- Approving important changes
- Approving spending
- Approving deployment
- Presenting the results

---

## SECTION C — DEVELOPMENT ENVIRONMENTS

### ENVIRONMENT 1 — REPLIT
- **Purpose:** Competition development and public demonstration.
- Replit contains ONLY the isolated Artist Passport customer-acquisition application.
- It does not contain the proprietary indii.music Studio.

### ENVIRONMENT 2 — LOCAL DEVELOPMENT
- **Address:** `http://localhost:3000`
- **Purpose:** Local testing or fallback development if necessary. Port 3000 is the preferred existing landing-page development convention.
- Verify another service is not using the port before starting. Do not terminate or overwrite existing apps without authorization.
- *Localhost is not publicly accessible to customers.*

### ENVIRONMENT 3 — INDII.MUSIC PRODUCTION
- `https://indii.music`
- `https://app.indii.music`
- These environments remain separate. No production modifications are authorized as part of the initial hackathon build.

### ENVIRONMENT 4 — ANTIGRAVITY
- **Purpose:** Research, documentation, decisions, and knowledge management.
- References internal repository for research, but proprietary code must not be copied into Replit.

---

## SECTION D — INTELLECTUAL PROPERTY FIREWALL

### DO NOT IMPORT INTO REPLIT:
- Complete indii.music repository
- Proprietary Studio source code
- Internal AI agent code or prompts
- Conductor implementation
- Proprietary rights-administration engines
- Royalty calculation engines
- DDEX implementation details
- Production database schemas
- Customer records
- Private API integrations
- Production Firebase credentials
- Service accounts
- GitHub authentication tokens
- Private environment variables
- Internal business documents

### APPROVED INFORMATION:
- Public company description
- Public-facing feature descriptions
- Canonical branding
- Public design tokens
- Public website URLs
- Artist Passport questionnaire
- General educational business recommendations
- Approved marketing language
- Publicly available music-industry information

The Replit project must stand independently. The public competition website may be shared without granting access to indii.music source code. Replit project visibility, ownership, and sharing settings must be reviewed before publication.

---

## SECTION E — OFFICIAL ARTIST PASSPORT DESIGN SYSTEM

- **DESIGN AUTHORITY:** The public `indii.music` landing page.
- **BRAND NAME:** `indii.music` (always lowercase)
- **TAGLINE:** `music business at the speed of you` (always lowercase, no ending period)
- **PRIMARY FONT:** Inter (headlines, body, buttons, navigation, answers)
- **SECONDARY FONT:** JetBrains Mono (step indicators, technical labels, progress, metadata, status)
- **OFFICIAL COLORS:**
  - Primary background: `#000000`
  - Dark surface: `#070709`
  - Surface border: `#1F222A`
  - Active border: `#333846`
  - Primary text: `#FFFFFF`
  - Muted text: `#8A8F9E`
  - Primary gold: `#FFB800`
  - Dark gold: `#CCA000`
  - Existing CTA Gradient: `#FFD700` → `#FFB800` → `#E65100`
- **DESIGN CHARACTER:** Premium, dark, modern, professional, music-industry focused. Restrained gold highlights. No generic AI chatbot styling.
- **INTERFACE REQUIREMENTS:** Mobile-first, responsive, large touch targets, accessible contrast, keyboard navigable, reduced-motion respectful.

---

## SECTION F — ARTIST PASSPORT EXPERIENCE

### VISITOR JOURNEY:
1. Arrive at Artist Passport
2. Understand its value
3. Start assessment
4. Answer questions
5. Receive personalized results
6. Optionally provide contact information
7. Continue to official indii.music
8. Potentially become a member/customer

### COPY SPECIFICATION:
- **Landing Headline:** *How ready is your music business?*
- **Supporting Copy:** *Find potential gaps in your registrations, release preparation, and business operations in about two minutes.*
- **Primary CTA:** *Check My Music Business*

### 5-SECTION QUESTIONNAIRE:
1. Career stage
2. Primary music genre
3. Rights and royalty registrations
4. Distribution and release readiness
5. Immediate business goals

### RESULTS ENGINE:
Show meaningful results before asking for email:
- Rights and royalties observations
- Release-readiness observations
- Business-operations recommendations
- Three suggested next actions
- Relevant indii.music capabilities
- *Do not invent missing royalties. Do not promise automatic recovery. Do not imply copyright disappears without PRO registration. Do not describe -14 LUFS as a mandatory ceiling.*

### CONTACT CAPTURE:
- Optional name and email.
- Separate optional marketing consent checkbox.
- Do not promise email delivery unless fully implemented.

### CONVERSION CTAs:
- Primary: *Continue With indii.music* (`https://indii.music/signup`)
- Secondary: *Join Founding Artist Waitlist* (`https://indii.music/#waitlist`)
- *Do not promise automatic data synchronization into indii.music Studio onboarding.*

---

## SECTION G — MEASUREMENT & INTEGRITY STANDARDS

Track genuine activity:
- Page visitors
- Questionnaire starts
- Questionnaire completions
- Assessment results viewed
- Optional lead submissions
- Clicks to indii.music
- Confirmed official account creations (only if verified)
- Confirmed paying customers (only if verified via Stripe)

*Never invent numbers. Questionnaire completions are not qualified leads. Email submissions are not verified accounts. Clicks are not signups. Free accounts are not paying customers.*

---

## SECTION H — HACKATHON OPERATING SCHEDULE (DETROIT EDT)

- **11:50 AM:** Final preparation reminder
- **12:00 PM – 1:00 PM:** Attend opening and validate concept with Frank
- **1:00 PM – 2:00 PM:** Build Artist Passport in Replit
- **2:00 PM – 3:00 PM:** Contact 10–15 actual musicians and begin user testing
- **3:00 PM – 4:00 PM:** Review results and demonstrate experience to judges

---

## SECTION I — COMPETITION REPLIT BUILD PROMPT

Use prompt in Section 4 of `hackathon_war_room_oct10.md` or Section I of this document when build hour starts.

---

## SECTION J — PRE-LAUNCH VERIFICATION CHECKLIST

- [ ] Homepage loads successfully
- [ ] Branding matches indii.music
- [ ] Questionnaire starts successfully
- [ ] All five sections work
- [ ] Back and next navigation work
- [ ] Results change based on answers
- [ ] Results appear before email is requested
- [ ] Optional consent functions correctly
- [ ] Lead records are private
- [ ] Metrics persist where intended
- [ ] Signup link goes to indii.music
- [ ] Waitlist link goes to indii.music
- [ ] Application works on mobile
- [ ] Public URL works outside developer session
- [ ] No production secrets are exposed
- [ ] No proprietary Studio code is included
- [ ] No unverified capabilities are advertised

---

## SECTION K — CONTINGENCY PROTOCOL

- If advanced analytics fail: Keep assessment functioning.
- If contact capture fails: Do not use insecure workarounds; keep official indii.music signup/waitlist links.
- If backend persistence fails: Keep questionnaire functioning locally; report unverified metrics honestly.
- If Replit public hosting fails: Test locally at `localhost:3000` (if available); arrange approved hosting before outreach.
- Priority order: (1) Working questionnaire → (2) Useful assessment → (3) Conversion links → (4) Reliable deployment → (5) Measurement → (6) Polish.

---

## SECTION L — ANTIGRAVITY KNOWLEDGE MANAGEMENT LOG

- **MASTER SPECIFICATION:** Maintained in `docs/hackathon/MASTER_PROJECT_HANDOFF_ARTIST_PASSPORT.md` and `hackathon_war_room_oct10.md`.
- **DECISION LOG:**
  - 2026-10-10: Established IP firewall separating Replit standalone acquisition funnel from proprietary indii.music Studio.
  - 2026-10-10: Standardized on deterministic rules engine for Replit app (zero external AI cost/keys during build).
  - 2026-10-10: Upgraded `joinFoundingArtistWaitlist` schema in `packages/firebase` to accept `replit_passport` slug.
  - 2026-10-10: Upgraded landing auth (`packages/landing/src/lib/auth.ts`) to persist `acquisitionSource` on `users/{uid}` and forward source query to Studio.
- **BUILD STATUS:** Pre-competition state verified. Ready for 1:00 PM Replit build session.
- **TEST EVIDENCE:**
  - Monorepo typecheck: 0 errors across 9 workspaces.
  - Landing test suite: 11/11 files (62/62 tests) passing.
  - Waitlist verification suite: 5/5 tests passing.
  - Production endpoints: `https://indii.music`, `https://app.indii.music`, `https://indii.music/signup` all verified 200 OK.
  - Mainline commit: `65c763ee8` delivered and pushed to `origin/main`.
- **CUSTOMER EVIDENCE:** To be populated during Session 3 (2:00 PM – 3:00 PM EDT).
- **OPEN ISSUES:** Tracked under GitHub Issue #411. No blocking repo issues.
- **MIGRATION BACKLOG:** Post-hackathon selective ingestion of top-performing questionnaire components into landing page.

---

## SECTION M — POST-HACKATHON MIGRATION

1. Evaluate visitor engagement and feedback.
2. Identify which questionnaire questions worked.
3. Identify which recommendations were useful.
4. Evaluate lead quality and conversion.
5. Review privacy and consent requirements.
6. Select components or ideas worth preserving.
7. Reimplement or selectively import approved functionality into existing landing page.
8. Connect to member onboarding only through separately designed, secure integration.
9. Review code and security through GitHub.
10. Deploy only after appropriate testing and founder approval.

---

## SECTION N — OPERATING PRINCIPLE

**REPLIT BUILDS.**  
**CHATGPT COORDINATES.**  
**ANTIGRAVITY PRESERVES KNOWLEDGE & MAINTAINS REPO.**  
**THE FOUNDER MAKES THE DECISIONS.**  
**INDII.MUSIC RETAINS ITS INTELLECTUAL PROPERTY.**
