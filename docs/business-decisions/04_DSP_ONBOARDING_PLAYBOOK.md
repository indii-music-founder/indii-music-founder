# 04 — DSP & Distribution Onboarding Playbook

> **Type:** Reference document (not a fill-in form)  
> **Who:** Founder + later engineering  
> **What this unblocks:** Direct distribution to Spotify, Apple Music, etc.  
> **Dependencies:** Company identity (Doc 01) and revenue model (Doc 03) must be complete first.

---

## Overview: The Three Paths to Distribution

indiiOS's distribution architecture supports three paths, which you'll pursue in sequence:

```
Phase A (Now): Distribute through existing distributors (DistroKid, TuneCore, etc.)
    └── Requires: distributor API/SFTP credentials
    └── You are a customer of the distributor
    └── Revenue: subscription fees from users

Phase B (6-12 months): Direct DDEX integration with DSPs
    └── Requires: DDEX Party ID (DPID), peer conformance testing
    └── You become the distributor yourself
    └── Revenue: subscription + potential revenue share

Phase C (12-24 months): Full distribution license
    └── Requires: formal agreements with each DSP
    └── You are a licensed distributor
    └── Revenue: subscription + wholesale rate negotiation
```

**Start with Phase A.** The code for all three phases is built. This document walks you through what you need to do for each.

---

## Phase A: Distribute Through Existing Partners

### A1. DistroKid (Primary Partner)

> **Why DistroKid first:** Largest indie distributor, most permissive AI policy, fastest delivery (1-2 days to stores), and your users' most likely existing distributor.

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | **Create a DistroKid account** at [distrokid.com](https://distrokid.com) | 5 min | `[ ]` |
| 2 | **Upgrade to a Team/Label plan** — needed for API access and multi-artist distribution | 5 min | `[ ]` |
| 3 | **Request API access** — email `api@distrokid.com` with: "I'm building a distribution platform (indiiOS) and would like API access for automated uploads." Include your label plan account email. | 10 min | `[ ]` |
| 4 | **If API access is denied:** Use SFTP upload as fallback. DistroKid provides SFTP credentials for bulk uploads on Label plans. | — | `[ ]` |
| 5 | **Configure credentials:** Add to Cloud Functions environment: | 5 min | `[ ]` |

```bash
firebase functions:config:set \
  distrokid.api_key="YOUR_API_KEY" \
  distrokid.sftp_host="sftp.distrokid.com" \
  distrokid.sftp_user="YOUR_USERNAME" \
  distrokid.sftp_pass="YOUR_PASSWORD"
```

**Code locations already built:**
- `src/services/distribution/adapters/DistroKidAdapter.ts` — API adapter
- `execution/distribution/sftp_uploader.py` — SFTP upload script
- `src/modules/distribution/components/TransferPanel.tsx` — UI for managing transfers

---

### A2. TuneCore

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | **Create a TuneCore account** at [tunecore.com](https://tunecore.com) | 5 min | `[ ]` |
| 2 | **Apply for Partner/Label program** — email `partners@tunecore.com` or apply through their website | 10 min | `[ ]` |
| 3 | **Request API documentation** — TuneCore provides API access to approved partners | 10 min | `[ ]` |
| 4 | **Note:** TuneCore **rejects 100% AI-generated tracks**. Your AI disclosure flow must respect this. | — | N/A |

---

### A3. CD Baby

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | **Create a CD Baby account** at [cdbaby.com](https://cdbaby.com) | 5 min | `[ ]` |
| 2 | **Apply for CD Baby Pro** — enhanced royalty collection services | 10 min | `[ ]` |
| 3 | **Note:** CD Baby now owned by Downtown Music. API access may be through Downtown's partner program. | — | `[ ]` |

---

### A4. Ditto Music

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | **Create a Ditto Music account** at [dittomusic.com](https://dittomusic.com) | 5 min | `[ ]` |
| 2 | **Apply for Label Services** — bulk upload and API access | 10 min | `[ ]` |

---

## Phase B: DDEX Direct Integration

> **Timeline:** Start this process 3-6 months before you want to go direct. Certification takes time.

### B1. Get Your DDEX Party ID (DPID)

> This is the single most important registration for direct distribution.

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | **Register at DDEX Knowledge Base** — [kb.ddex.net](https://kb.ddex.net) | 10 min | `[ ]` |
| 2 | **Sign the Implementation License** — Royalty-free click-wrap agreement | 5 min | `[ ]` |
| 3 | **Apply for DPID** at [dpid.ddex.net](https://dpid.ddex.net) | 15 min | `[ ]` |
| 4 | **Wait for approval** — typically 1-2 weeks | — | `[ ]` |
| 5 | **Store your DPID** in environment: | 5 min | `[ ]` |

```bash
firebase functions:config:set ddex.dpid="PADPIDA{your-10-digit-code}"
```

Your DPID looks like: `PADPIDA2024123456`

**Code location:** `src/services/ddex/DDEXIdentity.ts` is ready and waiting for this value.

---

### B2. Download DDEX Schemas

| Step | Action | Notes |
|------|--------|-------|
| 1 | Download ERN 4.3 XSD from DDEX Knowledge Base | Used for release notifications |
| 2 | Download DSR 2.1 XSD | Used for sales report parsing |
| 3 | Download MWN 1.0 XSD | Used for musical work notifications |
| 4 | Place in `src/services/ddex/schemas/` | Directory already exists |

---

### B3. Peer Conformance Testing

> Before you can send real releases to DSPs via DDEX, you must pass peer conformance testing with each recipient.

| Step | Action | Notes |
|------|--------|-------|
| 1 | Generate a test ERN message using `ERNMapper.ts` | Use `isTestFlag: true` |
| 2 | Validate against ERN 4.3 XSD using `DDEXValidator.ts` | Must pass with zero errors |
| 3 | Submit to DDEX Workbench for validation | Web-based validation tool |
| 4 | Send test delivery to DSP's test SFTP endpoint | Each DSP has a test server |
| 5 | Resolve any rejections | Common issues: element ordering, namespace mismatches |
| 6 | DSP confirms conformance | Keep confirmation email |

**Code locations:**
- `src/services/ddex/ERNMapper.ts` — generates ERN messages
- `src/services/ddex/DDEXValidator.ts` — schema validation
- `execution/distribution/sftp_uploader.py` — file delivery

---

## PRO (Performing Rights Organizations)

### ASCAP Registration

> **What it is:** ASCAP collects performance royalties (radio, streaming, live performance) for songwriters and publishers.

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Go to [ascap.com/join](https://www.ascap.com/join) | — | `[ ]` |
| 2 | Register as a **Publisher** (not a Writer — you're the platform) | 15 min | `[ ]` |
| 3 | Pay the one-time registration fee ($50 for publishers) | — | `[ ]` |
| 4 | Get your **IPI Number** (Interested Parties Information) | Wait 2-4 weeks | `[ ]` |
| 5 | Store IPI in environment: `firebase functions:config:set pro.ascap_ipi="YOUR_IPI"` | 5 min | `[ ]` |

> **Why register as a publisher?** indiiOS users create songs. If you register as a publisher affiliated with ASCAP, you can help users collect performance royalties through the platform. This is a future revenue stream.

---

### BMI Registration

> **What it is:** BMI is the other major US PRO (along with ASCAP and SESAC). Artists choose one.

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Go to [bmi.com/join](https://www.bmi.com/join) | — | `[ ]` |
| 2 | Register as a **Publisher** | 15 min | `[ ]` |
| 3 | Pay the registration fee ($150 for publishers) | — | `[ ]` |
| 4 | Get your **IPI Number** | Wait 2-4 weeks | `[ ]` |

> **Note:** You cannot be affiliated with both ASCAP and BMI. Choose one for the platform. Individual users choose their own PRO separately.

---

### SoundExchange Registration

> **What it is:** SoundExchange collects digital performance royalties (internet radio, satellite radio, non-interactive streaming) for sound recording owners and artists.

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Go to [soundexchange.com](https://www.soundexchange.com) | — | `[ ]` |
| 2 | Register as a **Featured Artist** or **Sound Recording Copyright Owner** depending on platform role | 15 min | `[ ]` |
| 3 | **Free registration** | — | `[ ]` |

> **Note:** SoundExchange is separate from ASCAP/BMI. It handles *recording* royalties, not *songwriting* royalties. Your users may want both.

---

## Mechanical Licensing

### Harry Fox Agency (HFA) / Songfile

> **What it is:** HFA handles mechanical licenses — required when covering a song or using a sample.

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Go to [songfile.com](https://www.songfile.com) | — | `[ ]` |
| 2 | Create a publisher account | 10 min | `[ ]` |
| 3 | **Explore API/affiliate program** — email HFA about platform integration for mechanical license lookups | 10 min | `[ ]` |

**Code backlog:** `python/tools/` needs an HFA search tool for the agent layer (already documented in `LEGAL_REVIEW_CHECKLIST.md`).

---

### Music Licensing Collective (MLC)

> **What it is:** The MLC administers blanket mechanical licenses for interactive streaming (Spotify, Apple Music, etc.) under the Music Modernization Act.

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Go to [themlc.com](https://www.themlc.com) | — | `[ ]` |
| 2 | Register as a publisher to claim works | 15 min | `[ ]` |
| 3 | **Free registration** | — | `[ ]` |

> **Why it matters:** When your users' songs are streamed on interactive services, the MLC collects mechanical royalties. If the songwriter isn't registered with the MLC, royalties go unclaimed. Registration through indiiOS is a value-add feature.

---

## Copyright Registration

### Library of Congress (eCO)

> **What it is:** Federal copyright registration. Optional but required to sue for statutory damages if someone infringes your users' work.

| Step | For users (not the platform) | Notes |
|------|-----|-------|
| 1 | Go to [copyright.gov/registration](https://copyright.gov/registration) | $65 per work (online filing) |
| 2 | Fill in the claim form | eCO system guides through it |
| 3 | Upload a copy of the work | Audio file, cover art, lyrics |
| 4 | Wait for registration certificate | 3-7 months processing time |

> **Platform feature (backlog):** Build an eCO guided workflow in the Legal module that pre-fills info from the release metadata. Already documented in `LEGAL_REVIEW_CHECKLIST.md`.

---

## Priority Order

| Priority | Action | Blocks |
|----------|--------|--------|
| 🔴 P0 | DistroKid API/SFTP access | User distribution (Phase A) |
| 🔴 P0 | DDEX Knowledge Base registration | Phase B certification |
| 🟡 P1 | DPID application | Direct DSP delivery |
| 🟡 P1 | ASCAP or BMI publisher registration | Performance royalty collection |
| ⚪ P2 | SoundExchange registration | Digital performance royalties |
| ⚪ P2 | HFA/Songfile setup | Mechanical licensing feature |
| ⚪ P2 | MLC registration | Mechanical royalty claims |
| ⚪ P3 | TuneCore/CD Baby/Ditto partnerships | Multi-distributor support |
| ⚪ P3 | eCO workflow (engineering) | Copyright registration feature |

