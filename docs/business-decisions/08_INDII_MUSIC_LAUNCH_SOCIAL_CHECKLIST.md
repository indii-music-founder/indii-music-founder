# indii.music Launch, Social Media, and Campaign Checklist

**Campaign:** Launch indii.music using indii.music

**Authority:** Execution checklist subordinate to `07_FOUNDING_ARTIST_BETA_MARKETING.md`; it does not replace canonical founder decisions.

**Operating idea:** indii.music is its own first artist. The website, videos, social content, waitlist, launch, and measurement are managed as one real campaign inside indii.music.

**Primary message:** Run your music career without giving it away.

**Tagline:** music business at the speed of you.

**Proof statement:** We used indii.music to launch indii.music.

---

## Execution System: Direction Plus Two Stacks

This campaign is not executed from one giant mixed prompt. It has one direction layer and two separate execution stacks.

### Direction layer — wiil + ChatGPT

This conversation is the campaign control room. Its responsibilities are:

- Decide the goal, audience, message, order, and acceptance criteria.
- Inspect what already exists before requesting new work.
- Break the campaign into bounded jobs.
- Route each job to the correct execution stack.
- Write a complete, consolidated instruction for that executor.
- Review returned evidence and decide what happens next.
- Update the master campaign rather than relying on conversation memory.

The direction layer decides **what and why**. The execution stacks determine and report **how it was completed within their authorized boundaries**.

### Stack C — Codex coding stack

Use Stack C for repository, website, application, integration, analytics, and deployment work. These are normally handled through a dedicated long-form Codex coding session with repository access.

Stack C includes:

- Website structure, navigation, copy placement, and responsive implementation.
- Domain redirects, canonical URLs, metadata, and search presentation.
- Waitlist form, confirmation flow, storage, consent, and delivery behavior.
- Video player, captions, transcript, poster image, loading, and performance.
- Pricing/access presentation, including recurring access and the `$2,500 Founding Owner License`.
- Social profile links and Open Graph/social preview implementation.
- Analytics events, campaign attribution, and conversion measurement.
- Accessibility, performance, security, testing, deployment, and rollback protection.
- Product changes exposed by using indii.music to run its own campaign.

Stack C does **not** decide the campaign message, fabricate final creative assets, publish social content, or silently redesign existing product architecture.

### Stack M — indii marketing-operations stack

Use Stack M for campaign planning and execution through the tools built into indii.music. The direction layer writes an ordered instruction and passes it to indii.

Stack M includes:

- Create the **indii.music Public Launch** campaign.
- Build the campaign timeline, dependencies, milestones, and review gates.
- Audit and register social channels.
- Import and organize brand masters and platform derivatives.
- Produce and manage video, imagery, copy, captions, transcripts, and thumbnails.
- Create platform-specific social packages.
- Develop legitimate newsworthy angles, founder stories, demonstrations, and case studies.
- Schedule and publish approved material where connected and authorized.
- Record public URLs, results, audience questions, and repurposing decisions.
- Run the weekly operating review and prepare the next campaign cycle.

Stack M does **not** alter repository code, expose secrets, invent unsupported product claims, or publish unapproved material.

### Routing rule

| If the task changes… | Route to |
|---|---|
| Code, website behavior, product behavior, integrations, or deployment | Stack C — Codex |
| Timeline, creative production, channel preparation, publishing, or campaign measurement | Stack M — indii |
| Message, priority, scope, approval, or business decision | Direction layer — wiil + ChatGPT |
| Both code and campaign operations | Split into linked C and M jobs with an explicit handoff |

### Shared source of truth

- The master campaign inside indii.music owns the campaign timeline, assets, channel records, publication evidence, and results.
- Repository issues/tasks own coding implementation work.
- Each system links to the other by task ID; neither duplicates the other system’s detailed record.
- Conversations produce approved instructions and decisions, but are not the permanent source of truth.

---

## Ordered Stack Queues

### Stack C — initial coding queue

| ID | Job | Depends on | Completion evidence |
|---|---|---|---|
| C-01 | Audit the current marketing site before changing it | Approved campaign direction | Current-state report and protected boundaries |
| C-02 | Implement primary-domain, `www`, canonical, and specialized-route behavior | C-01 | Redirect/canonical tests |
| C-03 | Implement the landing-page information and conversion flow | C-01; approved copy architecture | Responsive page and validation |
| C-04 | Implement waitlist signup, confirmation, consent, and tracking | C-03 | Successful end-to-end test |
| C-05 | Implement video presentation, captions, transcript, poster, and performance behavior | M-04 specifications or approved placeholders | Mobile/desktop playback and performance tests |
| C-06 | Implement access/pricing presentation | Approved pricing decision | Correct recurring/Founding Owner License display |
| C-07 | Implement social links, Open Graph data, previews, and campaign attribution | M-02 verified channel URLs | Verified previews and tracked links |
| C-08 | Run accessibility, performance, security, regression, and deployment validation | C-02 through C-07 | Test results, branch/SHA, deployed result or handoff |

### Stack M — initial indii queue

| ID | Job | Depends on | Completion evidence |
|---|---|---|---|
| M-01 | Create the Public Launch campaign and timeline | Approved campaign direction | Campaign record, stages, milestones, owners |
| M-02 | Audit, verify, and register every social account | M-01 | Channel registry with status and verified URLs |
| M-03 | Import and organize the brand/marketing asset system | M-01 | Masters, derivatives, rights, and approval states |
| M-04 | Produce eight 15–30 second lifecycle clips | M-01; approved treatment; current product access | Approved masters, derivatives, captions, transcripts |
| M-05 | Produce the guided demonstration and any approved longer product cut | M-04 visual system | Approved demonstration package |
| M-06 | Create the initial platform-specific social package | M-02 through M-05 | Approved posts mapped to channels and dates |
| M-07 | Develop newsworthy content and outreach angles | M-01; verified claims | Approved story angles, supporting proof, target list |
| M-08 | Schedule and publish approved launch material | C-04/C-05 ready; M-06 approved | Publication records and public URLs |
| M-09 | Measure, review, improve, and repeat | M-08 | Weekly review and next-cycle decisions |

### Critical handoffs

1. **M-01 → C-03:** Campaign direction supplies the approved page goal, audience, message hierarchy, and call to action.
2. **C-03 → M-04:** Website layout supplies the eight lifecycle placements, 15–30 second duration targets, aspect ratios, poster-image dimensions, and copy limits.
3. **M-02 → C-07:** The verified channel registry supplies canonical social URLs; coding never guesses them.
4. **M-04/M-05 → C-05:** indii supplies approved video masters, captions, transcripts, thumbnails, and metadata.
5. **C-04/C-05 → M-08:** Coding confirms the waitlist and video destinations work before indii publishes traffic-driving content.
6. **M-09 → Direction layer:** Results and audience questions determine the next creative, website, or product job.

---

## Required Handoff Packet

Every Codex or indii instruction must contain:

- **Task ID and stack:** for example, `C-04` or `M-04`.
- **Objective:** one clear outcome.
- **Reason:** why it matters to the campaign.
- **Current state:** what already exists and must be preserved.
- **Inputs:** approved copy, assets, URLs, data, references, and product access.
- **Dependencies:** work or decisions that must be complete first.
- **Ordered actions:** what the executor should do, in sequence.
- **Destination:** exact repository area or exact indii campaign/project location.
- **Approval gates:** what requires wiil’s review before continuation or publication.
- **Constraints:** secrets, exclusions, architecture boundaries, rights, and claims.
- **Deliverables:** files, records, timelines, posts, code, or reports expected back.
- **Acceptance criteria:** observable definition of done.
- **Evidence:** final URLs, screenshots, tests, asset IDs, publication records, branch/SHA, or analytics.
- **Follow-up:** what stack receives the output next.

### Prompt-building workflow

1. Discuss and decide the job in the direction layer.
2. Inspect current state and gather the real inputs.
3. Assign a stack and task ID.
4. Resolve dependencies before execution.
5. Produce one consolidated copy-and-paste instruction for the selected executor.
6. Executor works only within that instruction and returns evidence.
7. Direction layer reviews the evidence.
8. Update the permanent source of truth and prepare the next handoff.

---

## 1. Definition of Done

The launch system is complete when:

- [ ] Every existing indii.music social account has been found and ownership verified.
- [ ] Every active account has the correct name, handle, biography, logo, header, and primary link.
- [ ] Important handles have been reserved even when the channel will not be actively operated yet.
- [ ] Each verified channel has one canonical record inside indii.music.
- [ ] Each channel record identifies its owner, public URL, recovery method, publishing status, and content requirements.
- [ ] Credentials and recovery codes are stored securely outside ordinary campaign records.
- [ ] All launch assets are stored once as masters, with platform derivatives linked to the masters.
- [ ] The website, waitlist, eight lifecycle clips, guided demo, and initial social package are ready.
- [ ] Every published item has a final URL, publication date, campaign association, and performance record.
- [ ] A weekly follow-through process is active so accounts do not become abandoned profiles.
- [ ] Every job has a Stack C, Stack M, or direction-layer assignment.
- [ ] Every cross-stack dependency has a recorded handoff and completion evidence.

---

## 2. Create the Master Campaign Inside indii.music

- [ ] Create project: **indii.music Public Launch**.
- [ ] Set campaign owner.
- [ ] Define launch phase: private preview, waitlist, early access, or public launch.
- [ ] Record campaign goal: qualified waitlist signups and product understanding.
- [ ] Record primary audience: independent artists managing releases, rights, distribution, marketing, catalog, and finances.
- [ ] Add primary website: `https://indii.music`.
- [ ] Add permanent local presentation route: `https://founder.indii.music/local`.
- [ ] Keep `founder.indii.music` assigned to its specialized founder/early-access purpose.
- [ ] Confirm `www.indii.music` redirects to `indii.music`.
- [ ] Add the waitlist destination and success/confirmation page.
- [ ] Add campaign start date, target launch date, review dates, and campaign owner.
- [ ] Create campaign stages: Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat.

---

## 3. Social Account Inventory

Use these statuses: **Not searched / Located / Ownership verified / Profile ready / Connected / Publishing / Reserved only / Intentionally inactive**.

### Core operating channels

| Channel | Status | Handle or URL | Role in campaign | Priority |
|---|---|---|---|---|
| Instagram — primary/active account | Ownership confirmed by wiil | `@indii_music` | Reels, visual product proof, behind-the-scenes work, founder updates | Active now |
| Instagram — alternate/reserved account | Ownership confirmed by wiil; exact public URL/profile state still needs audit | `@indii.music` | Protect the brand name; redirect/profile-copy decision still required | Reserve pending audit |
| YouTube | Not yet verified |  | Lifecycle clips, guided demonstrations, workflow videos, Shorts | Active now |
| TikTok | Not yet verified |  | Short demonstrations, artist-business education, development/launch story | Active now |
| Facebook Page | Ownership indicated by wiil; exact Page/handle still needs audit | Possible `indii_music` and/or `indii.music`; verify before use | Detroit network, older artists, events, reposted launch material | Active after verification |
| LinkedIn Company Page | Not yet verified |  | Industry credibility, partnerships, product development, founder story | Active now |

### Conversation and community channels

| Channel | Status | Handle or URL | Role in campaign | Priority |
|---|---|---|---|---|
| Threads | Not yet verified |  | Conversation, short founder observations, Instagram-adjacent distribution | Evaluate after core setup |
| Bluesky | Not yet verified |  | Artist-control, independent technology, founder and developer conversation | Reserve; test selectively |
| X | Not yet verified |  | Music-business and technology conversation | Reserve; activate only with a clear purpose |
| Reddit | Not yet verified |  | Genuine participation in relevant communities; never mass-promotional posting | Community participation only |
| Discord | Not yet verified |  | Early-user community, feedback, launch support | Create when moderation capacity exists |

### Visual, live, and long-form channels

| Channel | Status | Handle or URL | Role in campaign | Priority |
|---|---|---|---|---|
| Pinterest | Not yet verified |  | Marketing design, workflow visuals, brand and artist-business resources | Optional |
| Twitch | Not yet verified |  | Live product builds, demonstrations, question-and-answer sessions | Optional |
| Newsletter/email | Not yet verified |  | Owned audience, waitlist updates, launch announcements | Active now |
| Long-form publishing | Not yet verified |  | Founder thesis, product reasoning, case studies | Use the website first; syndicate later |

### Explicit exclusions

- [ ] Do not create campaign requirements for Spotify.
- [ ] Do not create campaign requirements for BandLab.
- [ ] Do not create campaign requirements for Splice.
- [ ] Do not add a traditional distributor or rights administrator merely to complete a marketing checklist.

### Discovery pass for every possible existing account

- [ ] Search email for account-registration and verification messages containing `indii`, `indii.music`, and likely handles.
- [ ] Search saved password/credential records for indii.music accounts without copying secrets into campaign notes.
- [ ] Search each platform directly for `indii.music`, `indii_music`, `indiimusic`, and prior brand spellings.
- [ ] Search Google/Bing for indexed indii.music profiles.
- [ ] Check old bios and link pages for forgotten accounts.
- [ ] Ask collaborators whether they created or control any account.
- [ ] Record conflicting names or impersonation risks.
- [ ] Record unavailable handles and the approved fallback handle.
- [ ] Reserve matching handles on important platforms before announcing the launch.

---

## 4. Required Record for Every Channel Inside indii.music

Create one canonical channel record per platform. Do not create duplicate records for the same account.

- [ ] Platform name.
- [ ] Public display name: **indii.music**.
- [ ] Exact handle.
- [ ] Canonical public profile URL.
- [ ] Account status.
- [ ] Account owner.
- [ ] Backup owner or recovery contact.
- [ ] Business email associated with the account.
- [ ] Date ownership was verified.
- [ ] Two-factor authentication status.
- [ ] Recovery method confirmed.
- [ ] Publishing connection status.
- [ ] Permissions granted to indii.music.
- [ ] Profile image asset link.
- [ ] Header/banner asset link.
- [ ] Approved biography.
- [ ] Approved primary link.
- [ ] UTM/link-tracking convention.
- [ ] Native analytics location or connection.
- [ ] Posting formats supported.
- [ ] Posting frequency.
- [ ] Assigned content owner.
- [ ] Last published date.
- [ ] Next scheduled item.
- [ ] Notes about platform restrictions or unresolved problems.

**Security rule:** Store only the credential-system reference or connection status in the channel record. Never store a password, API secret, recovery code, or session token in ordinary campaign notes.

---

## 5. Universal Profile Setup Checklist

Complete this for every active or reserved account:

- [ ] Correct spelling: **indii.music**.
- [ ] Best available consistent handle selected.
- [ ] Correct category: software, music business, creator tools, or the nearest accurate platform category.
- [ ] Square `ii` logo uploaded and visually checked.
- [ ] Platform-specific header uploaded and checked on mobile and desktop.
- [ ] Short biography approved.
- [ ] Long biography approved where supported.
- [ ] Location added when useful: Detroit, Michigan.
- [ ] Website set to the correct campaign destination.
- [ ] Waitlist call to action included.
- [ ] Contact email confirmed.
- [ ] Account made public when ready.
- [ ] Old or conflicting language removed.
- [ ] Old “preview coming soon” language updated when no longer accurate.
- [ ] Pinned/featured launch item prepared.
- [ ] Accessibility text added to profile images where supported.
- [ ] Public profile opened in a logged-out browser and verified.

### Approved message bank

- [ ] “Run your music career without giving it away.”
- [ ] “music business at the speed of you.”
- [ ] “100% artist controlled.”
- [ ] “100% rights.”
- [ ] “0% royalty cut.”
- [ ] “The operating system for your music independence.”
- [ ] “We used indii.music to launch indii.music.”
- [ ] “The 20-app scavenger hunt is over.” only where the surrounding copy explains the claim.
- [ ] Claims about department counts match the current working product before publication.

---

## 6. Brand and Asset Library Inside indii.music

### Source assets

- [ ] Primary `ii` logo master.
- [ ] Horizontal indii.music wordmark.
- [ ] Light-background versions.
- [ ] Dark-background versions.
- [ ] Monochrome versions.
- [ ] Transparent versions.
- [ ] Brand color definitions.
- [ ] Font names, licenses, and approved uses.
- [ ] Photography and illustration direction.
- [ ] Approved artist-archetype group image.
- [ ] T-shirt front and back mockups.
- [ ] Permanent `/local` QR code master.
- [ ] QR code destination tested on a phone.

### Social derivatives

- [ ] Square profile image.
- [ ] Instagram portrait and square post templates.
- [ ] Story/Reel/TikTok/Shorts vertical template.
- [ ] YouTube thumbnail template.
- [ ] YouTube channel banner.
- [ ] Facebook Page cover.
- [ ] LinkedIn company banner.
- [ ] X header.
- [ ] Bluesky/Threads profile assets.
- [ ] Link-preview/Open Graph image for the website.
- [ ] Email header and footer.

### Asset-control requirements

- [ ] Every asset has a clear master/source file.
- [ ] Every derivative links back to its master.
- [ ] Version number or approval state is visible.
- [ ] Owner and creator are recorded.
- [ ] Font, stock, music, footage, and image licenses are recorded.
- [ ] Expiration or usage restrictions are recorded.
- [ ] Final approved exports cannot be confused with drafts.
- [ ] Old versions are retained but not offered for publishing.

---

## 7. Video Production Package

### Master videos

- [ ] Eight 15–30 second lifecycle clips narrated by the founder over real product capture.
- [ ] 3–5 minute real guided product demonstration.
- [ ] Founder story.
- [ ] “indii.music launched using indii.music” case study.
- [ ] Individual workflow demonstrations.
- [ ] Artist-use demonstrations when real outside artists are ready.

### Required exports from each suitable master

- [ ] 16:9 landscape master.
- [ ] 9:16 vertical version.
- [ ] 1:1 square version when useful.
- [ ] 30–60 second cut.
- [ ] 15-second cut.
- [ ] Clean version without burned-in captions.
- [ ] Captioned version.
- [ ] `.srt` or equivalent caption file.
- [ ] Full transcript.
- [ ] Thumbnail/cover frame.
- [ ] Audio-described or text-equivalent information where necessary.
- [ ] Platform title, description, tags, primary link, and call to action.

### Video proof requirements

- [ ] Use real working-product screen capture.
- [ ] Use real campaign data wherever public disclosure is safe.
- [ ] Make important interface text readable on a phone.
- [ ] Show one understandable workflow rather than random feature switching.
- [ ] Explain why each visible action matters to an artist.
- [ ] Remove private data, API keys, customer information, and internal secrets.
- [ ] Confirm every displayed claim against the current product.

---

## 8. Initial Launch Content Package

- [ ] Launch announcement.
- [ ] Waitlist announcement.
- [ ] Eight-part lifecycle clip series.
- [ ] Full demonstration post.
- [ ] “We used indii.music to launch indii.music” post.
- [ ] Founder explanation: why indii exists.
- [ ] Artist-control post.
- [ ] Rights and 0% royalty-cut post.
- [ ] Release-workflow demonstration.
- [ ] Remote phone/desktop workflow demonstration.
- [ ] Catalog and finance workflow demonstration.
- [ ] Marketing-asset workflow demonstration.
- [ ] Pricing-direction explanation: recurring access versus $2,500 Founding Owner License.
- [ ] Frequently asked questions post.
- [ ] Detroit/founder story post.
- [ ] Behind-the-scenes development material.
- [ ] T-shirt/tagline visual.
- [ ] Waitlist reminder.
- [ ] Early-user invitation.

For every content item:

- [ ] Assign campaign and objective.
- [ ] Identify intended audience.
- [ ] Select platform(s).
- [ ] Create the source/master.
- [ ] Create platform derivatives.
- [ ] Review factual claims.
- [ ] Review rights and licenses.
- [ ] Approve copy and media.
- [ ] Add captions and accessibility text.
- [ ] Add tracked destination link.
- [ ] Schedule or publish.
- [ ] Capture final public URL.
- [ ] Record results.
- [ ] Identify repurposing opportunities.

---

## 9. Website and Waitlist Checklist

- [ ] Main landing page explains indii.music immediately.
- [ ] Waitlist button appears in the hero.
- [ ] Waitlist button remains available throughout the page.
- [ ] Short visual product proof loads quickly.
- [ ] Every lifecycle clip has a poster image, captions, and transcript.
- [ ] Extended demonstration has a dedicated location.
- [ ] Website copy explains the real workflow shown in the video.
- [ ] Ownership positioning is clear: artist controlled, rights retained, 0% royalty cut.
- [ ] Access choices are explained without forcing a purchase during waitlist phase.
- [ ] `$2,500 Founding Owner License` is distinguished from recurring access.
- [ ] Waitlist form is short enough to complete on a phone.
- [ ] Optional follow-up gathers artist type, career stage, primary need, preferred payment rhythm, early-testing interest, and Founding Owner License interest.
- [ ] Confirmation page explains what happens next.
- [ ] Confirmation email is delivered and tested.
- [ ] Social link icons point to verified profiles only.
- [ ] Open Graph/social preview is correct.
- [ ] Analytics and conversion events work.
- [ ] Privacy, terms, and consent language are ready.
- [ ] Mobile, tablet, and desktop versions are checked.
- [ ] Page speed is checked with the videos enabled.

---

## 10. Publishing and Quality-Control Checklist

- [ ] Correct account selected.
- [ ] Correct final asset selected.
- [ ] Correct aspect ratio and resolution.
- [ ] Text stays within platform-safe areas.
- [ ] Captions are accurate and synchronized.
- [ ] Thumbnail is readable on a phone.
- [ ] Post copy is platform-appropriate rather than blindly duplicated.
- [ ] Brand spelling is exactly `indii.music`.
- [ ] Website link works.
- [ ] Tracking parameters identify campaign, platform, and content item.
- [ ] Waitlist destination works.
- [ ] Mentions and tags are correct.
- [ ] Rights and licenses are approved.
- [ ] No confidential screen content is visible.
- [ ] Publication date and time are recorded.
- [ ] Final public URL is added to the content record.
- [ ] First comments or questions receive a response.
- [ ] Errors are corrected and logged.

---

## 11. Measurement and Follow-Through

### Record for every published item

- [ ] Views or impressions.
- [ ] Meaningful watch time or completion rate.
- [ ] Saves and shares.
- [ ] Comments and direct questions.
- [ ] Profile visits.
- [ ] Website visits.
- [ ] Waitlist starts.
- [ ] Waitlist completions.
- [ ] Cost, if paid promotion was used.
- [ ] Qualitative feedback.
- [ ] Product questions revealed by the audience.
- [ ] Decision: repeat, revise, repurpose, or retire.

### Weekly operating review

- [ ] Confirm all scheduled items actually published.
- [ ] Respond to meaningful comments and messages.
- [ ] Update last-published dates for active channels.
- [ ] Review waitlist growth and source attribution.
- [ ] Identify the best-performing message and format.
- [ ] Convert audience questions into FAQ or demonstration content.
- [ ] Record product friction exposed while producing the campaign.
- [ ] Create product issues for real workflow problems.
- [ ] Select next week’s content from the campaign backlog.
- [ ] Ensure no active account has gone unintentionally silent.

---

## 12. Account Audit Worksheet

Duplicate this block for every account discovered.

- **Platform:**
- **Handle:**
- **Public URL:**
- **Current status:**
- **Ownership verified by:**
- **Primary owner:**
- **Backup/recovery owner:**
- **2FA confirmed:**
- **Recovery confirmed:**
- **Profile image ready:**
- **Header ready:**
- **Biography ready:**
- **Primary link ready:**
- **Publishing connection ready:**
- **Analytics connection ready:**
- **Pinned launch item ready:**
- **Last post date:**
- **Next planned item:**
- **Inside-indii record location:**
- **Problems or decisions:**

---

## 13. Immediate Next Actions

- [ ] **Direction:** Approve the two-stack execution model and the first jobs to release.
- [ ] **M-01:** Create the **indii.music Public Launch** campaign and timeline inside indii.music.
- [x] **M-02:** Record wiil's confirmed ownership of Instagram `@indii_music` and `@indii.music`.
- [ ] **M-02:** Decide which Instagram account is primary and what the alternate account should display or redirect people toward.
- [ ] **M-02:** Verify the exact Facebook Page/handle and inventory YouTube, TikTok, LinkedIn, Threads, Bluesky, X, Reddit, and Discord.
- [ ] **M-02:** Choose the consistent fallback handle on platforms where neither `indii_music` nor `indii.music` is available.
- [ ] **M-02:** Create one Social Channel Registry record for every verified account.
- [ ] **M-03:** Import approved logos, taglines, QR code, website visuals, and apparel mockups into the campaign asset library.
- [ ] **C-01:** Audit the existing website and produce its protected-boundaries/current-state report.
- [ ] **Direction:** Use the C-01 and M-01 findings to approve the final landing-page structure and lifecycle-clip treatment.
- [ ] **M-04:** Build the eight 15–30 second lifecycle clips as the first major campaign assets and record the real process inside indii.music.
- [ ] **C-03/C-04:** Implement the approved landing-page and waitlist flow.
- [ ] **M-06:** Prepare the social launch package from the same campaign.
- [ ] **M-09:** Begin the weekly operating review before public posting starts.
