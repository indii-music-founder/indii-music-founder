# Metadata, ISRC & UPC Codes

## Overview

Proper metadata and identification codes are essential for royalty collection, chart eligibility, and professional distribution. This guide covers ISRC codes (track identifiers), UPC codes (release identifiers), and metadata standards used in the music industry.

---

## ISRC: International Standard Recording Code

### What is ISRC?

ISRC is a unique 12-character alphanumeric code that identifies a specific sound recording. Every distinct recording of a song receives its own ISRC—even different versions (radio edit, remix, live) need separate codes.

### ISRC Structure

```
US-S1Z-24-00001
│   │   │  │
│   │   │  └── Unique identifier (5 digits)
│   │   └───── Year of reference (2 digits)
│   └───────── Registrant code (3 alphanumeric)
└───────────── Country code (2 letters)
```

| Component | Example | Description |
|-----------|---------|-------------|
| **Country** | US | ISO 3166-1 alpha-2 code |
| **Registrant** | S1Z | Unique to rights holder |
| **Year** | 24 | Year code was assigned |
| **Designation** | 00001 | Unique track number |

### Who Needs ISRC?

**Required for:**
- Digital distribution (Spotify, Apple Music, etc.)
- SoundExchange royalty collection (US)
- Neighboring rights collection (international)
- Chart eligibility (Billboard, etc.)
- Tracking plays for royalty statements

### How to Get ISRC Codes (US)

#### Option 1: Through Distributor (Easiest)
Most distributors (DistroKid, TuneCore, CD Baby) provide ISRC codes automatically:
- Free with distribution
- Automatically assigned
- No separate registration needed

#### Option 2: Direct from US ISRC Agency
**US ISRC Agency:** RIAA (Recording Industry Association of America)
- **Website:** usisrc.org
- **Cost:** $95 one-time fee for registrant code
- **Process:**
  1. Apply online at usisrc.org
  2. Receive unique registrant code (3 characters)
  3. Create your own ISRCs using the format

#### Option 3: Through Record Label
If signed to a label, they typically handle ISRC assignment.

### How to Get ISRC Codes (Canada)

**Canadian Agency:** CONNECT Music Licensing
- **Website:** connectmusic.ca
- **Cost:** Free for members
- **Membership:** Required for Canadian rights holders

### ISRC Assignment Rules

**Each of these needs a unique ISRC:**
- Original studio recording
- Radio edit (different length)
- Extended version
- Remix (any different production)
- Live recording
- Acoustic version
- Instrumental version
- Different language version

**Same ISRC can be used for:**
- Same recording on different releases (single, EP, album)
- Same file format changes (WAV → MP3)
- Same recording with different metadata

### ISRC Best Practices

1. **Assign sequentially** — Keep a spreadsheet of assigned codes
2. **Never reuse** — Once used, an ISRC is permanent
3. **Document everything** — Track which code goes to which recording
4. **Include in metadata** — Embed in ID3 tags and delivery sheets

### ISRC Spreadsheet Template

```
| ISRC         | Song Title    | Version    | Album/Release | Date Assigned |
|--------------|---------------|------------|---------------|---------------|
| US-S1Z-24-00001 | Midnight Drive | Original   | Debut Single  | 2024-01-15    |
| US-S1Z-24-00002 | Midnight Drive | Radio Edit | Radio Promo   | 2024-02-01    |
| US-S1Z-24-00003 | Summer Nights  | Original   | EP Title      | 2024-03-10    |
```

---

## UPC: Universal Product Code

### What is UPC?

UPC is a 12-digit barcode that uniquely identifies a product (release). In music, each distinct release (single, EP, album) gets its own UPC—even if it contains the same songs as another release.

### UPC Structure

```
6 012345 67890 5
│ │      │     │
│ │      │     └── Check digit
│ │      └──────── Product code (5 digits)
│ └─────────────── Manufacturer code (6 digits)
└───────────────── Number system (usually 6 or 7)
```

### Types of Music UPCs

| Release Type | Example | Notes |
|--------------|---------|-------|
| **Single** | 1–3 tracks | Each single gets unique UPC |
| **EP** | 4–6 tracks | Distinct from album UPC |
| **Album** | 7+ tracks | Full-length release |
| **Box Set** | Multiple discs | Single UPC for entire set |

### Who Needs UPC?

**Required for:**
- Physical distribution (CD, vinyl)
- Digital distribution (as product identifier)
- Retail sales tracking (SoundScan)
- Chart eligibility
- Inventory management

### How to Get UPC Codes

#### Option 1: Through Distributor (Recommended)
Most distributors provide UPCs automatically:
- **DistroKid:** Included with all plans
- **TuneCore:** Included with distribution
- **CD Baby:** Included with signup
- **LANDR:** Included with distribution

#### Option 2: Purchase Direct
**GS1 US:**
- **Website:** gs1us.org
- **Cost:** $250 initial fee + $50 annual renewal
- **Best for:** Labels releasing many products

**Barcode resellers:**
- **Barcodes:** barcodes.com
- **Instant UPC:** instantupc.com
- **Cost:** $5–$20 per UPC
- **Note:** Ensure codes are GS1-compliant for major retailers

### UPC Assignment Rules

**Each of these needs a unique UPC:**
- Different format (CD vs. vinyl vs. digital)
- Different track listing
- Different territory release (if separate products)
- Deluxe/standard editions
- Explicit/clean versions (if sold separately)

**Same UPC for:**
- Same release across different digital platforms
- Same physical product in different stores
- Re-pressings of identical vinyl/CD

---

## DDEX: Digital Data Exchange

### What is DDEX?

DDEX is the international standard for exchanging metadata and media between record labels, distributors, and digital service providers (DSPs). It ensures consistent data across all platforms.

### DDEX Standards

| Standard | Purpose |
|----------|---------|
| **ERN (Release Notification)** | New release metadata |
| **MLC (Media Licensing Coordinator)** | Mechanical licensing data |
| **RDR (Recording Data Report)** | Usage/royalty reporting |
| **DSR (Distributor Status Report)** | Delivery status updates |

### Who Uses DDEX?

- Major labels and distributors
- DSPs (Spotify, Apple Music, Amazon)
- Collection societies
- Metadata aggregators

### For Independent Artists

Most independent artists don't interact with DDEX directly:
- Distributors handle DDEX formatting
- Upload through distributor dashboard
- Metadata converted to DDEX automatically

### Key DDEX Metadata Fields

```xml
<Release>
  <ReleaseId>
    <ICPN>123456789012</ICPN>  <!-- UPC -->
  </ReleaseId>
  <ReferenceTitle>
    <TitleText>Album Title</TitleText>
  </ReferenceTitle>
  <ReleaseCreator>
    <PartyName>
      <FullName>Artist Name</FullName>
    </PartyName>
  </ReleaseCreator>
</Release>
```

---

## CCDA: Canadian Common Digital Asset

### What is CCDA?

CCDA is Canada's standard for digital music metadata, similar to DDEX but with Canadian-specific requirements. Used for domestic distribution and rights management.

### CCDA Requirements

- **SOCAN** registration for performance rights
- **Connect Music** for reproduction rights
- **CIMA** (Canadian Independent Music Association) standards

### Key Differences from DDEX

- Bilingual requirements (English/French)
- Canadian territory specifications
- SOCAN/CCSOCA integration

---

## ID3 Tags: Embedded Metadata

### What are ID3 Tags?

ID3 tags are metadata embedded directly into audio files (MP3, AIFF). They display information in media players and are essential for organization.

### ID3 Tag Versions

| Version | Features | Support |
|---------|----------|---------|
| **ID3v1** | Basic fields (title, artist, album) | Universal |
| **ID3v2.3** | Extended fields, images | Most common |
| **ID3v2.4** | Unicode, enhanced fields | Modern players |

### Essential ID3 Tags

| Tag | Purpose | Example |
|-----|---------|---------|
| **TIT2** | Title | "Midnight Drive" |
| **TPE1** | Lead Artist | "The Night Riders" |
| **TALB** | Album | "Neon Highways" |
| **TYER** | Year | "2024" |
| **TCON** | Genre | "Electronic" |
| **TRCK** | Track Number | "3/10" |
| **TPUB** | Publisher | "Indie Label Records" |
| **TCOP** | Copyright | "2024 Indie Label" |
| **TSRC** | ISRC | "US-S1Z-24-00001" |

### ID3 Tag Editors

**Desktop:**
- **Mp3tag** (Windows) — Free, comprehensive
- **Meta** (macOS) — $25, elegant interface
- **Yate** (macOS) — $25, advanced features
- **TagScanner** (Windows) — Free

**Online:**
- **TagMP3.net** — Browser-based
- **ID3v2.org** — Reference implementation

### Best Practices

1. **Be consistent** — Same spelling across all files
2. **Include ISRC** — Essential for tracking
3. **Add artwork** — 3000x3000 JPG minimum
4. **Use standard genres** — Check distributor requirements
5. **Fill all fields** — Complete metadata looks professional

---

## Sample Clearance & Rights Management

### When You Need Clearance

| Sample Type | Clearance Required? |
|-------------|---------------------|
| **Direct audio sample** | Yes (master and publishing) |
| **Interpolation** (re-recording melody/lyrics) | Yes (publishing only) |
| **Sound-alike** | No (if sufficiently different) |
| **Public domain** | No (verify status) |
| **Original creation** | No |

### The Clearance Process

1. **Identify rights holders**
   - Master rights: Record label
   - Publishing rights: Publisher or songwriter

2. **Contact rights holders**
   - Use services like **Sample Clearance Services** (sampleclearance.com)
   - Or contact directly via label/publisher

3. **Negotiate terms**
   - Upfront fee vs. royalty split
   - Territory and term limits
   - Credit requirements

4. **Get written agreement**
   - Signed by all parties
   - Specifies usage rights

### Clearance Costs

| Sample Type | Typical Cost | Notes |
|-------------|--------------|-------|
| **Obscure/sample pack** | $1,000–$5,000 | Often easier to clear |
| **Moderately known** | $5,000–$25,000 | Negotiation required |
| **Famous/major artist** | $25,000–$100,000+ | Difficult, time-consuming |
| **Interpolation** | $5,000–$50,000 | Publishing only |

### Alternatives to Sampling

1. **Sample libraries** — Royalty-free samples (Splice, Loopmasters)
2. **Replay/interpolation** — Re-record the element yourself
3. **Sound-alike** — Create similar vibe without copying
4. **Public domain** — Pre-1928 recordings (US)
5. **Original composition** — Create from scratch

### Legal Risks

**Without clearance:**
- Distribution platforms may reject release
- Takedown notices (DMCA)
- Lawsuits for copyright infringement
- Statutory damages: $750–$30,000 per work
- Willful infringement: Up to $150,000

---

## Metadata Checklist for Release

### Before Distribution

- [ ] All tracks have ISRC codes assigned
- [ ] Release has UPC code
- [ ] ID3 tags complete and consistent
- [ ] Album artwork meets specs (3000x3000 JPG)
- [ ] All samples cleared (if applicable)
- [ ] Songwriter and publisher info documented
- [ ] Release date confirmed
- [ ] Territory restrictions noted (if any)

### Documentation to Maintain

1. **ISRC log** — Spreadsheet of all assigned codes
2. **UPC log** — All product codes with release details
3. **Clearance files** — Signed agreements for samples
4. **Writer splits** — Ownership percentages documented
5. **Registration confirmations** — PRO, MLC, SoundExchange

---

## Resources

### ISRC
- **US:** usisrc.org — RIAA ISRC agency
- **Canada:** connectmusic.ca — CONNECT Music Licensing
- **International:** isrc.ifpi.org — IFPI global registry

### UPC
- **GS1 US:** gs1us.org — Official UPC issuer
- **GS1 Canada:** gs1ca.org — Canadian UPCs

### DDEX
- **DDEX:** ddex.net — Standards and documentation

### Rights Organizations
- **SoundExchange:** soundexchange.com — Digital performance royalties (US)
- **SOCAN:** socan.ca — Canadian performance rights
- **CMRRRA:** cmrra.ca — Canadian mechanical rights
- **MLC:** themlc.com — US mechanical licensing collective

---

*Last updated: 2025*
