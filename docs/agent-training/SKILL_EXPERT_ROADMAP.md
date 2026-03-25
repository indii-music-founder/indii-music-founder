# Agent Skill Expert Roadmap

**Last updated:** 2026-03-25
**Status:** Phase 4b ACTIVE — 36 expert examples added; 12/12 HIGH-priority gaps filled
**Owner:** indiiOS Training Program

---

## Purpose

This document is the living work queue for elevating every agent skill to **expert proficiency**. It identifies every skill domain across all 20 agents, shows its current training coverage, and provides a concrete expert-level example prompt for each gap.

Use this as the input queue for future dataset expansion sessions: pick a HIGH priority item, write 2–5 expert-difficulty examples for that skill, append them to the relevant `.jsonl` file, and check it off.

---

## How to Use This Document

1. **Pick a HIGH priority item** from the Master Work Queue at the bottom
2. **Read the "Example Expert Prompt"** — that's the target difficulty bar
3. **Write 2–5 new JSONL examples** at `difficulty: "expert"` for that skill
4. **Append to the relevant dataset** in `docs/agent-training/datasets/<agent>.jsonl`
5. **Update the status** in this doc from ❌ or 🟡 to ✅
6. **Re-export** via `execution/training/export_ft_dataset.ts` when a batch is ready

---

## Difficulty Framework Reference

| Level | What it means | Artist profile |
|-------|--------------|----------------|
| `entry` | Artist doesn't know the concept exists; needs plain-language explanation | "I just uploaded my track. What happens next?" |
| `intermediate` | Artist knows the concept; needs to understand tradeoffs and make decisions | "I want to release to Spotify and Apple Music next Friday." |
| `expert` | Artist knows the terrain; needs precision — specific numbers, clause language, negotiation tactics | "$50k advance, 20% royalty rate, 18-month recoup window — what's my breakeven?" |

### Status Key

| Symbol | Meaning |
|--------|---------|
| ❌ | **MISSING** — zero examples at any difficulty level |
| 🟡 | **ENTRY/INT ONLY** — has examples, but none tagged `expert` |
| ✅ | **HAS EXPERT** — verified expert-difficulty examples exist |

---

## Expert % by Agent (Current Baseline)

| Agent | Entry | Intermediate | Expert | Total | Expert % | Priority |
|-------|-------|--------------|--------|-------|----------|----------|
| distribution | 12 | 70 | 21 | 103 | 20% | 🔴 HIGH |
| finance | 13 | 68 | 22 | 103 | 21% | 🔴 HIGH |
| curriculum | 26 | 44 | 27 | 97 | 28% | 🟡 MEDIUM |
| licensing | 18 | 52 | 30 | 100 | 30% | 🟡 MEDIUM |
| marketing | 11 | 58 | 31 | 100 | 31% | 🟡 MEDIUM |
| road | 22 | 47 | 31 | 100 | 31% | 🟡 MEDIUM |
| music | 29 | 36 | 38 | 106 | 36% | 🟡 MEDIUM |
| generalist | 35 | 32 | 33 | 100 | 33% | 🟡 MEDIUM |
| brand | 16 | 51 | 36 | 103 | 35% | 🟡 MEDIUM |
| publishing | 17 | 51 | 38 | 106 | 36% | 🟡 MEDIUM |
| video | 21 | 43 | 33 | 97 | 34% | 🟢 LOW |
| devops | 26 | 37 | 32 | 95 | 34% | 🟢 LOW |
| merchandise | 23 | 43 | 34 | 100 | 34% | 🟢 LOW |
| director | 29 | 34 | 34 | 97 | 35% | 🟢 LOW |
| screenwriter | 22 | 41 | 34 | 97 | 35% | 🟢 LOW |
| social | 27 | 35 | 41 | 106 | 39% | 🟡 MEDIUM |
| publicist | 23 | 38 | 39 | 103 | 38% | 🟡 MEDIUM |
| legal | 8 | 58 | 40 | 106 | 38% | 🟡 MEDIUM |
| producer | 22 | 32 | 40 | 94 | 43% | 🟢 LOW |
| security | 12 | 39 | 46 | 97 | 47% | 🟢 LOW |

---

## Agent Skill Maps

---

### 1. Music Agent — Sonic Director
**Current expert %:** 36% (38/106 examples)
**Dataset:** `docs/agent-training/datasets/music.jsonl`
**Definition:** `src/services/agent/definitions/MusicAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Audio analysis (BPM, key, energy profiling) | ✅ HAS EXPERT | — | — |
| LUFS targeting / loudness mastering | ✅ HAS EXPERT | — | — |
| Dolby Atmos / spatial audio | ✅ HAS EXPERT | — | — |
| Mixing feedback (frequency clash, EQ, stereo) | ✅ HAS EXPERT | — | — |
| Lyric analysis / thematic consistency | 🟡 ENTRY/INT | 🟡 MEDIUM | "My hook structure uses an extended metaphor across all 3 verses but the bridge abandons it. Walk me through whether resolving or subverting the metaphor is the stronger compositional choice and why." |
| Sonic branding strategy | 🟡 ENTRY/INT | 🟡 MEDIUM | "I'm 4 albums in with a dark, lo-fi aesthetic but want to pivot to a cleaner pop sound for commercial viability without losing my core fanbase. What are the sonic transition strategies artists like Billie Eilish or Frank Ocean used, and how should I sequence this shift across my next 2 releases?" |
| Metadata generation (DDEX-compliant tags) | ✅ HAS EXPERT | — | — |
| Metadata verification (Golden Standard) | ✅ HAS EXPERT | — | — |
| **YouTube Content ID** | ✅ HAS EXPERT | — | "My distributor filed a Content ID claim on my original track and a third-party label is monetizing my YouTube streams. Walk me through the exact OAC (Official Artist Channel) dispute process, typical resolution timelines, the specific language I should use in my counter-notification, and how the outcome differs if it's a cover vs. original work vs. a sample-based track." |
| Mastering for vinyl / physical formats | ✅ HAS EXPERT | — | "I'm pressing my EP on vinyl. My master was optimized for streaming at -14 LUFS. What are the specific LUFS targets, dynamic range requirements, and inner groove distortion considerations I need to apply to the vinyl-specific master, and how do I handle the stereo width in the low frequencies?" |
| Instrumentation / sound design direction | 🟡 ENTRY/INT | 🟡 MEDIUM | "My production relies heavily on 808s in the 40–60 Hz range. My Essentia analysis shows a key of F# minor. Walk me through the exact sidechain compression settings, sub frequency tuning, and mono bass treatment I need to ensure the 808s translate on both consumer earbuds and club systems." |

**Top gap:** YouTube Content ID — zero examples at any level. Artists frequently encounter Content ID disputes; the Music Agent should be the definitive expert.

---

### 2. Distribution Agent — Distribution Chief
**Current expert %:** 20% (21/103 examples) — LOWEST among all agents
**Dataset:** `docs/agent-training/datasets/distribution.jsonl`
**Definition:** `src/services/agent/definitions/DistributionAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| DDEX ERN message construction | 🟡 ENTRY/INT | 🔴 HIGH | "My distributor rejected my DDEX ERN 4.3 message with error code C0023 (invalid territory code) and C0041 (missing sound recording ISRC). The track is a collaboration with a UK artist using a co-owned master. Walk me through the exact XML node changes I need to make to the `<TerritoryCode>`, `<SoundRecordingId>`, and `<ResourceList>` elements to resolve both errors simultaneously." |
| DDEX common rejection errors | ✅ HAS EXPERT | — | — |
| Audio forensics / spectral fraud detection | 🟡 ENTRY/INT | 🔴 HIGH | "My QC system flagged a track with a spectral anomaly: the content above 17 kHz is pure noise floor with no harmonic content, while the 16 kHz digital brick wall is perfectly flat. The artist claims it's a genuine 24-bit file. Walk me through the forensic analysis steps — spectral view, frequency histogram, ABX test — to definitively determine if this is an upsampled 44.1kHz-to-96kHz fake hi-res file." |
| Aspera FASP delivery | 🟡 ENTRY/INT | 🔴 HIGH | "My Aspera transfer to Spotify is failing mid-batch with a FASP timeout on the 3rd file of 12. The session log shows: 'Peer connection reset, ORTP timeout after 45s.' Walk me through diagnosing whether this is a UDP port blocking issue on the ISP side vs. a server-side queue problem, and the exact Aspera ascp CLI flags I should use to force TCP fallback while maintaining the correct credential chain." |
| W-8BEN / W-9 tax certification | ✅ HAS EXPERT | — | — |
| Chain of Title disputes | ✅ HAS EXPERT | — | "A major label is claiming a catalog I distributed has a broken Chain of Title because the original producer agreement was a verbal work-for-hire with no written documentation. The streaming revenue is now in escrow at the DSP. Walk me through the exact documentation I need to reconstruct the chain — affidavits, recording session logs, payment proof — and what legal standard (preponderance vs. clear and convincing evidence) applies at each DSP's dispute resolution process." |
| Royalty waterfall / co-pub splits | 🟡 ENTRY/INT | 🔴 HIGH | "I have a 3-party co-publishing agreement: artist owns 50%, co-publisher A owns 30%, and co-publisher B owns 20% — but co-publisher A has a sub-publishing deal in the UK at 75/25 in their favor. Walk me through the complete waterfall calculation for £10,000 of UK streaming mechanical income, showing the exact deduction at each stage and the final net to each party." |
| Merlin membership / compliance | 🟡 ENTRY/INT | 🟡 MEDIUM | "I want to claim Merlin membership to access premium DSP royalty rates. My catalog has 200 tracks across 3 labels with $80k in annual streaming revenue. Do I qualify? Walk me through the exact membership criteria, the application documentation required, and how the Merlin rate premium is calculated vs. the standard DSP rate for my catalog size." |
| UPC / barcode assignment | ✅ HAS EXPERT | — | — |
| Metadata QC standards | ✅ HAS EXPERT | — | — |
| Multi-distributor strategy | ✅ HAS EXPERT | — | — |
| Territory-specific distribution | ✅ HAS EXPERT | — | — |
| Catalog migration (switching distributors) | ✅ HAS EXPERT | — | — |

**Top gap:** Overall expert% is critically low (18%). The agent handles highly technical workflows (DDEX XML, Aspera, Chain of Title) that are currently undertrained at expert level. Adding 15–20 expert examples here would have the highest impact.

---

### 3. Finance Agent — Finance Director
**Current expert %:** 21% (22/103 examples) — 2ND LOWEST
**Dataset:** `docs/agent-training/datasets/finance.jsonl`
**Definition:** `src/services/agent/definitions/FinanceAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Advance recoupment analysis | ✅ HAS EXPERT | — | — |
| 360 deal financial modeling | 🟡 ENTRY/INT | 🔴 HIGH | "I'm evaluating a 360 deal: $250k advance, 18-month recoup, 20% royalty on masters, 25% on touring, 20% on merch, 15% on publishing. My current run rate is: 2M streams/month, $12k/month touring net, $3k/month merch. Build me the complete recoupment model showing breakeven month, NPV of the deal at 3 years vs. staying independent, and the breakeven stream count where label income equals what I'd earn at a 15% distributor rate." |
| Royalty statement audit / underpayment detection | ✅ HAS EXPERT | — | — |
| Tour P&L with international / foreign currency | 🟡 ENTRY/INT | 🔴 HIGH | "My EU tour generated €48,000 gross. After venue splits (70/30), VAT (at various EU rates — 19% Germany, 21% Netherlands, 20% France), local crew costs, and euro-to-USD conversion at a rate that moved 3% against me during the tour, what's my net USD income? Walk me through the forex hedging strategies — forward contracts vs. spot rate timing — I should use on my next EU run to reduce currency risk." |
| MLC / mechanical royalty audit | 🟡 ENTRY/INT | 🟡 MEDIUM | "My distributor's mechanical royalty statement for Q3 shows $2,400 from the MLC, but my streaming data shows 11 million on-demand streams in the US. At the current CRB mechanical rate of $0.091 per download-equivalent, I should be collecting roughly $X. Walk me through calculating whether I'm being underpaid, what data discrepancies I should flag to the MLC, and how to file a formal inquiry with supporting evidence." |
| Touring income tax (nexus / withholding) | 🟡 ENTRY/INT | 🔴 HIGH | "I'm playing 8 US states on a 3-week tour. My attorney says I've created tax nexus in 3 states (California, New York, Illinois) because I exceeded their $250k gross threshold. Walk me through the specific tax filing obligations in each state, the withholding requirements if I'm on the promoter's check vs. my own entity, and whether forming a single-member LLC in Nevada before the tour would change my exposure." |
| Sync licensing deal negotiation | ✅ HAS EXPERT | — | — |
| Label deal comparison (indie vs. signed) | ✅ HAS EXPERT | — | — |
| Catalog valuation (NPV analysis) | ✅ HAS EXPERT | — | — |
| International royalty withholding (W-8BEN) | ✅ HAS EXPERT | — | — |
| Streaming fraud detection | ✅ HAS EXPERT | — | — |
| Receipt OCR / expense categorization | 🟡 ENTRY/INT | 🟢 LOW | "I spent $14,800 on a music video. Walk me through how to allocate this across Schedule C categories (Line 22: Advertising, Line 14: Depreciation, Line 27a: Other expenses) for maximum deductibility, and which portion — if any — must be amortized as a Section 181 production expense vs. expensed immediately." |

**Top gap:** 360 deal modeling and touring tax nexus are high-value expert scenarios that artists at the $500k+ revenue level face constantly — and the current dataset heavily favors simpler scenarios.

---

### 4. Legal Agent — Music Industry Legal Specialist
**Current expert %:** 38% (40/106 examples)
**Dataset:** `docs/agent-training/datasets/legal.jsonl`
**Definition:** `src/services/agent/definitions/LegalAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Recording agreement analysis | ✅ HAS EXPERT | — | — |
| Publishing deal review | ✅ HAS EXPERT | — | — |
| Sample clearance / interpolation | ✅ HAS EXPERT | — | — |
| Split sheet generation | ✅ HAS EXPERT | — | — |
| Sync & licensing review | ✅ HAS EXPERT | — | — |
| Copyright registration (USCO) | ✅ HAS EXPERT | — | — |
| 360 deal clause analysis | 🟡 ENTRY/INT | 🟡 MEDIUM | "The label's 360 deal has a clause: 'Company shall be entitled to 20% of Artist's Gross Live Performance Revenue for Performances where Company's efforts were a material contributing factor.' Walk me through how courts have interpreted 'material contributing factor' in Hanley v. Republic Records and similar cases, what contract language I should add to create a bright-line test (e.g., tied to booking agent origination), and the negotiating leverage I have if the label's track record shows they've never booked a single live date." |
| Copyright reversion / 35-year rule | ✅ HAS EXPERT | — | — |
| DMCA counter-notification | ✅ HAS EXPERT | — | — |
| "Work for hire" in producer agreements | ✅ HAS EXPERT | — | — |
| Trademark protection for artist name | 🟡 ENTRY/INT | 🟡 MEDIUM | "I've been releasing music as 'Solara' for 3 years and just discovered there's a pending USPTO trademark for 'Solara' in Class 41 (entertainment) filed by a DJ in Miami. Walk me through the opposition proceeding timeline, the 'likelihood of confusion' test applied to music acts in the same genre, the evidence I need to establish priority of use, and whether I should file my own application first or wait for the opposition window." |
| Neighboring rights registration | 🟡 ENTRY/INT | 🟡 MEDIUM | "I'm a featured vocalist on 12 tracks released between 2018 and 2024. I've never registered for neighboring rights. Walk me through registering with SoundExchange and PPL, the retroactive collection period I'm eligible for, what documentation proves my featured status, and how to handle tracks where I'm credited as 'Additional Vocals' vs. primary featured artist — since SoundExchange has different royalty splits for each." |

---

### 5. Publishing Agent — Publishing Director
**Current expert %:** 36% (38/106 examples)
**Dataset:** `docs/agent-training/datasets/publishing.jsonl`
**Definition:** `src/services/agent/definitions/PublishingAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| PRO registration (ASCAP, BMI, SESAC, PRS) | ✅ HAS EXPERT | — | — |
| ISWC assignment and management | ✅ HAS EXPERT | — | — |
| Split sheet administration | ✅ HAS EXPERT | — | — |
| Publishing contract analysis | ✅ HAS EXPERT | — | — |
| DDEX metadata for distribution | ✅ HAS EXPERT | — | — |
| Black Box royalty recovery | ✅ HAS EXPERT | — | — |
| Sub-publishing deal analysis | ✅ HAS EXPERT | — | — |
| Mechanical licensing (MLC, Harry Fox) | 🟡 ENTRY/INT | 🟡 MEDIUM | "I want to issue a compulsory mechanical license for an artist covering my song without going through the MLC. Walk me through the Section 115 notice requirements — exact timing relative to release, the specific information I must include in the Notice of Intent, the CRB rate calculation for a streaming vs. download license, and how to issue a direct license instead that supersedes the compulsory rate and what terms I can negotiate." |
| **ISWC collision resolution** | ✅ HAS EXPERT | — | "My track 'Amber Light' was registered with BMI and received ISWC T-123.456.789-0. I just discovered another songwriter registered a different composition with the same ISWC through SESAC. Both registrations appear in the CISAC database. Walk me through the CISAC collision resolution procedure, the documentation I need to establish my registration priority, the timeframe for correction, and how to ensure the correct ISWC is propagated to all DSPs and collection societies before the next royalty period closes." |
| PRO catalog audit procedures | ✅ HAS EXPERT | — | "I have 180 compositions registered with ASCAP but my annual statement shows only 94 earning royalties. Walk me through the catalog audit process: how to cross-reference my ASCAP Works database against streaming data, what reporting threshold determines whether a work earns vs. goes to the common pool, and how to flag specific underperforming works for manual review with ASCAP's Writer Services team." |
| Co-publishing vs. admin publishing | 🟡 ENTRY/INT | 🟡 MEDIUM | "A publisher is offering me two deal structures: (A) Co-publishing: 50/50 copyright split, 75/25 income split in my favor, 5-year term, 10-year reversion. (B) Admin publishing: I retain 100% copyright, publisher takes 15% of gross collections, 3-year term. At my current income of $40k/year in publishing royalties, walk me through the 5-year financial comparison and the non-financial factors (catalog control, sync connections, creative approvals) that should weigh into my decision." |

---

### 6. Licensing Agent — Licensing Department
**Current expert %:** 30% (30/100 examples)
**Dataset:** `docs/agent-training/datasets/licensing.jsonl`
**Definition:** `src/services/agent/definitions/LicensingAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| License availability checking | ✅ HAS EXPERT | — | — |
| Sync licensing contract analysis | ✅ HAS EXPERT | — | — |
| License drafting | ✅ HAS EXPERT | — | — |
| Sync fee negotiation (library vs. direct) | ✅ HAS EXPERT | — | — |
| Master vs. sync license distinction | ✅ HAS EXPERT | — | — |
| Blanket vs. per-use licensing | ✅ HAS EXPERT | — | — |
| Music supervisor outreach strategy | 🟡 ENTRY/INT | 🟡 MEDIUM | "I want to pitch a specific track to the music supervisor for 'Euphoria' Season 3. Walk me through: the correct pitch format (cold email vs. approved licensing portal), what metadata the supervisor expects in the first touchpoint, how to position an indie track against major label competition for a placement that requires both master and sync rights, and what fee range to quote for a 60-second episodic placement on a premium HBO series in 2026." |
| Clearance fee negotiation | 🟡 ENTRY/INT | 🟡 MEDIUM | "I want to sample a 4-bar loop from a James Brown record (master owned by Universal, publishing co-owned by BMI and ASCAP). The sample is clearly identifiable. Walk me through the negotiation starting point for a fully-independent release at 10,000 projected unit sales vs. a major-label-backed release, the typical split between master clearance and publishing clearance fees, and the 'replay vs. clear' decision point where it becomes cheaper to re-record the element." |
| Film / TV deal review | 🟡 ENTRY/INT | 🟡 MEDIUM | "A Netflix documentary has offered a one-time buy-out fee of $3,500 for my track in perpetuity across all platforms, all territories. Walk me through evaluating this against a per-use royalty structure (and what rate I should counter-propose), whether to carve out streaming rights for my own DSP catalog, and what 'all platforms' means for my sync income if the documentary goes on to be licensed to airlines, educational institutions, and rebroadcast on linear TV." |

---

### 7. Marketing Agent — Campaign Manager
**Current expert %:** 31% (31/100 examples)
**Dataset:** `docs/agent-training/datasets/marketing.jsonl`
**Definition:** `src/services/agent/definitions/MarketingAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Release strategy (Waterfall rollout) | ✅ HAS EXPERT | — | — |
| DSP editorial playlist pitching | ✅ HAS EXPERT | — | — |
| Pre-save campaign creation | ✅ HAS EXPERT | — | — |
| A/B ad creative testing | 🟡 ENTRY/INT | 🟡 MEDIUM | "I'm running a Meta ad campaign for my release with a $500 budget. I have 3 video creatives (45s visualizer, 15s hook clip, 30s behind-the-scenes) and 2 copy angles (emotional/story vs. achievement/social proof). Design an A/B testing framework that controls for audience overlap, tells me the minimum CPM and CTR thresholds to call a winner vs. kill a variant, and how to allocate budget across a 7-day test window without blowing the budget on the losing creative." |
| TikTok sound campaign strategy | 🟡 ENTRY/INT | 🟡 MEDIUM | "My track has a 12-second hook section starting at 0:47 that could go viral on TikTok. Walk me through the exact audio clip registration process in TikTok Creator Marketplace, how to brief 25 micro-influencers (10k–100k followers) using a bounty campaign, the optimal TikTok post timing for a hip-hop track targeting 18–24 in the EST timezone, and how to track whether the sound's viral coefficient is growing vs. plateauing in real time." |
| Micro-budget ad deployment ($10/day) | ✅ HAS EXPERT | — | — |
| Fan engagement funnels | ✅ HAS EXPERT | — | — |
| Email newsletter campaigns | ✅ HAS EXPERT | — | — |
| Influencer bounty campaigns | ✅ HAS EXPERT | — | — |
| Fan data enrichment / CRM strategy | 🟡 ENTRY/INT | 🔴 HIGH | "I have 4,200 Bandcamp buyers, 12,000 email subscribers, and 89,000 TikTok followers. Walk me through building a unified fan database: which fields to capture for each source, how to segment by LTV (high-value buyers vs. engaged non-buyers vs. passive followers), the tools I should use to de-duplicate across sources, and the 3 highest-ROI automations I should set up first to convert TikTok followers into email subscribers and email subscribers into buyers." |
| Streaming analytics → campaign optimization | 🟡 ENTRY/INT | 🟡 MEDIUM | "My Spotify for Artists shows: 78% new listeners this month, 15% saves rate, 2.3% playlist adds, and a sharp drop-off at 1:42 on my 3:20 track. Walk me through interpreting these signals: is the 78% new listener rate a growth signal or a retention problem? What does the 1:42 drop-off tell me about arrangement or production? And what 3 specific campaign actions should I take in the next 30 days based purely on these data points?" |

---

### 8. Brand Agent — Brand Manager
**Current expert %:** 35% (36/103 examples)
**Dataset:** `docs/agent-training/datasets/brand.jsonl`
**Definition:** `src/services/agent/definitions/BrandAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Brand Bible creation | ✅ HAS EXPERT | — | — |
| Visual consistency audits | ✅ HAS EXPERT | — | — |
| Tone of voice enforcement | ✅ HAS EXPERT | — | — |
| Brand scoring (0–100 consistency) | ✅ HAS EXPERT | — | — |
| Cross-era brand evolution strategy | ✅ HAS EXPERT | — | — |
| Brand kit verification (colors, typography) | ✅ HAS EXPERT | — | — |
| Audio-to-brand analysis | ✅ HAS EXPERT | — | — |
| Content critique vs. brand guidelines | ✅ HAS EXPERT | — | — |
| Brand equity valuation / licensing deals | 🟡 ENTRY/INT | 🟡 MEDIUM | "I've been offered a brand partnership by a fashion label that wants to co-produce a limited capsule collection using my visual identity. They're proposing: $40k upfront, 8% royalty on net sales, 2-year term, brand approval rights on our side. Walk me through evaluating whether $40k fairly values my brand equity at my current 2.1M followers, how to negotiate approval rights to include a 'kill switch' if their brand reputation deteriorates, and what precedent Virgil Abloh's Off-White collaborations set for artist brand licensing fee structures." |
| Brand crisis / identity misuse response | ✅ HAS EXPERT | — | "A counterfeit merchandise operation in China is selling products using my logo and likeness without authorization, generating an estimated $80k/year in revenue. Walk me through the IP enforcement options — WIPO domain dispute, Alibaba IPP portal, DMCA takedown, and C&D letter — ranked by cost, timeline, and effectiveness for an independent artist without a label behind them." |

---

### 9. Social Agent — Social Media Director
**Current expert %:** 39% (41/106 examples)
**Dataset:** `docs/agent-training/datasets/social.jsonl`
**Definition:** `src/services/agent/definitions/SocialAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Content calendar generation | ✅ HAS EXPERT | — | — |
| Post scheduling / timing optimization | ✅ HAS EXPERT | — | — |
| Trend analysis | ✅ HAS EXPERT | — | — |
| Thread drafting (X/Twitter) | ✅ HAS EXPERT | — | — |
| Multi-platform auto-posting | ✅ HAS EXPERT | — | — |
| Sentiment analysis | ✅ HAS EXPERT | — | — |
| Discord / Telegram community webhooks | ✅ HAS EXPERT | — | — |
| UGC strategy | ✅ HAS EXPERT | — | — |
| TikTok algorithm / FYP optimization | 🟡 ENTRY/INT | 🟡 MEDIUM | "My last 8 TikTok posts averaged 2,400 views despite 89k followers — significantly below my historical average of 15k. Walk me through diagnosing the suppression cause: the difference between shadowbanning (violating community guidelines), organic reach decline (algorithm deprioritization), and audience churn (followers became inactive). For each diagnosis, give me the 3-step recovery playbook with specific post types, posting frequency, and the exact watch-time percentage I need to hit on my next 5 posts to signal recovery to the algorithm." |
| **Community crisis / moderation response** | ✅ HAS EXPERT | — | "My comments section is flooded with coordinated harassment targeting my female collaborators after I posted about a political topic. The rate is 200+ comments/hour across TikTok, Instagram, and YouTube. Walk me through: the immediate moderation triage (what to delete vs. hide vs. report), the platform-specific tools for each (Instagram Restrict, TikTok filtered comments, YouTube held-for-review), how to communicate to my audience without amplifying the harassment, and when to involve platform trust-and-safety teams vs. law enforcement for doxxing threats." |
| **YouTube channel optimization** | ✅ HAS EXPERT | — | "I have 47 music videos on YouTube with 2.3M total channel views but only 8,200 subscribers. My subscriber-to-view conversion rate is 0.36% which is far below the 2–4% benchmark. Walk me through a complete channel audit: optimal thumbnail style (A/B testing framework), end screen CTA placement at the exact timestamp for music videos, YouTube SEO for artist channels (title structure, description keyword density, chapter markers for lyrics), and how to use YouTube Studio's 'Audience' tab to identify and target my best-performing demographic segment." |
| Social asset generation (memes, quote cards) | ✅ HAS EXPERT | — | — |

---

### 10. Publicist Agent — PR Director
**Current expert %:** 38% (39/103 examples)
**Dataset:** `docs/agent-training/datasets/publicist.jsonl`
**Definition:** `src/services/agent/definitions/PublicistAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Press release drafting | ✅ HAS EXPERT | — | — |
| EPK creation and management | ✅ HAS EXPERT | — | — |
| Media outreach / pitch creation | ✅ HAS EXPERT | — | — |
| Crisis management | ✅ HAS EXPERT | — | — |
| Interview preparation | ✅ HAS EXPERT | — | — |
| Publicity campaign creation | ✅ HAS EXPERT | — | — |
| PDF / press kit generation | ✅ HAS EXPERT | — | — |
| Embargo management with media | 🟡 ENTRY/INT | 🔴 HIGH | "I'm releasing a collaborative project with a major artist. My PR firm has embargo agreements with 5 publications (Pitchfork, The FADER, Billboard, Rolling Stone, Stereogum) set to lift simultaneously at 9am EST on Friday. At 7:23am, one outlet broke the embargo early and published. Walk me through the exact 90-minute crisis response: what I say to the other 4 outlets to preserve the remaining coverage, whether to officially confirm or stay silent before the embargo lifts, how to handle the broke-embargo outlet's future relationship, and what contractual remedies I have against them." |
| Long-lead print placement strategy | 🟡 ENTRY/INT | 🟡 MEDIUM | "I want a feature in a major print magazine (Rolling Stone, Vogue, Complex) for my album dropping in 4 months. Walk me through the long-lead timeline (typical 3–4 month lead time for print), how to find the right editor vs. music section contact at each publication, what the pitch needs to include that's different from a digital pitch (hook, exclusivity offer, photo availability), and how to sequence my outreach so my Rolling Stone pitch doesn't cannibalize my Complex pitch on the same release cycle." |
| Podcast booking strategy | ✅ HAS EXPERT | — | "I want to build a podcast press tour for my album release targeting music-adjacent podcasts (Joe Budden, No Jumper, Million Dollaz Worth of Game, Flagrant, Club Shay Shay). Walk me through: the booking approach for each (direct DM vs. agency vs. publicist-to-publicist), what narrative hook from my story makes me bookable at each show's specific audience angle, ideal booking timing relative to release date (2 weeks before vs. day of vs. post-release), and how to maximize clip virality from long-form podcast appearances." |

---

### 11. Road Manager Agent — Road Manager
**Current expert %:** 31% (31/100 examples)
**Dataset:** `docs/agent-training/datasets/road.jsonl`
**Definition:** `src/services/agent/definitions/RoadAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Tour route optimization | ✅ HAS EXPERT | — | — |
| Venue advancing (tech rider, load-in) | ✅ HAS EXPERT | — | — |
| Travel logistics (flights, hotels, transport) | ✅ HAS EXPERT | — | — |
| Tour budget estimation | ✅ HAS EXPERT | — | — |
| Promoter contract deal points | ✅ HAS EXPERT | — | — |
| Rider management (tech + hospitality) | ✅ HAS EXPERT | — | — |
| ATA Carnet (touring equipment) | 🟡 ENTRY/INT | 🟡 MEDIUM | "I'm taking a 3-piece touring rig to Europe (2 guitars, 1 bass, full backline, 4 flight cases of equipment — total customs value $38,000). I need an ATA Carnet. Walk me through: which US Carnet issuing organization to use (US Council for International Business), the required documentation per item (serial numbers, purchase receipts, photos), the security deposit calculation, how to handle a single customs officer stamping error on entry to Germany that could invalidate the entire Carnet on exit to France, and what insurance policy I need to cover the Carnet liability." |
| International visa strategy (P-1, O-1) | 🟡 ENTRY/INT | 🟡 MEDIUM | "I want to tour the UK, EU, and Australia in the same 3-month period. Walk me through the specific visa requirements for each: UK's Certificate of Sponsorship (Tier 5) with 30-day advance requirement, EU's no-visa-required-but-still-complicated cabotage and work permit rules in Germany/France, and Australia's Entertainment Visa (subclass 420). For the EU specifically, explain where the 'short-term work permit' rules vary by country and which 3 EU countries will create the biggest delay in my routing." |
| Emergency force majeure / tour cancellation | 🟡 ENTRY/INT | 🟡 MEDIUM | "My headline tour has 8 dates remaining. My touring vocalist just had an emergency appendectomy and can't perform for 6 weeks. Walk me through the force majeure clause analysis in my standard promoter contracts to determine which cancellations are covered vs. require a refund, how to calculate the kill fee owed to support acts and crews who are already en route, the insurance claim process for tour cancellation insurance, and how to communicate the situation to ticket buyers across 8 markets simultaneously without triggering a mass refund demand." |
| Tour project management / scheduling | ✅ HAS EXPERT | — | — |
| Visa checklist generation | ✅ HAS EXPERT | — | — |

---

### 12. Merchandise Agent — Merchandise Director
**Current expert %:** 34% (34/100 examples)
**Dataset:** `docs/agent-training/datasets/merchandise.jsonl`
**Definition:** `src/services/agent/MerchandiseAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Product mockup generation | ✅ HAS EXPERT | — | — |
| POD (Print-on-Demand) strategy | ✅ HAS EXPERT | — | — |
| Production / manufacturing submission | ✅ HAS EXPERT | — | — |
| Merch licensing deals | ✅ HAS EXPERT | — | — |
| Product video generation | ✅ HAS EXPERT | — | — |
| Asset discovery from Creative Studio | ✅ HAS EXPERT | — | — |
| Tour merch bundle strategy | 🟡 ENTRY/INT | 🟡 MEDIUM | "I'm headlining a 22-date tour with average crowd of 800. Walk me through the optimal venue merch table strategy: SKU count (how many products), sizing ratios (S/M/L/XL/2XL percentage breakdown based on music venue demographics), pricing strategy for a premium headliner vs. support act, sell-through rate targets to avoid dead inventory, and how to calculate the break-even point for a 200-unit minimum print run at $14/unit on a $40 retail T-shirt after venue commission (typically 25–35%)." |
| Merchandise store (e-commerce) setup | 🟡 ENTRY/INT | 🟢 LOW | "I want to launch a direct-to-fan merch store on my own domain using Shopify + Printful. Walk me through the full integration: connecting product variants across both platforms, setting up automatic order fulfillment so Printful ships directly to fans, configuring Shopify's abandoned cart email sequence for merch buyers, and optimizing my product page for Google Shopping ads targeting fans who've already searched my artist name." |
| Limited drop / scarcity strategy | 🟡 ENTRY/INT | 🟡 MEDIUM | "I want to release 100 numbered, signed lithographs from my album artwork for $150 each. Walk me through: the presale vs. launch-day drop debate (pre-orders reduce risk but kill FOMO), how to set up an email countdown sequence optimized for a 48-hour drop window, the certificate of authenticity documentation I should include, and whether to use Bandcamp's limited-edition feature, my own Shopify, or a marketplace like Whatnot for maximum visibility." |

---

### 13. Video Agent — Video Director
**Current expert %:** 34% (33/97 examples)
**Dataset:** `docs/agent-training/datasets/video.jsonl`
**Definition:** `src/services/agent/definitions/VideoAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Text-to-video generation (Veo 3.1) | ✅ HAS EXPERT | — | — |
| Image-to-video (start-frame) | ✅ HAS EXPERT | — | — |
| Video extension (forward/backward) | ✅ HAS EXPERT | — | — |
| Timeline orchestration (5-second clips) | ✅ HAS EXPERT | — | — |
| Camera movement definition | ✅ HAS EXPERT | — | — |
| Color grading direction | ✅ HAS EXPERT | — | — |
| Storyboard keyframe generation | ✅ HAS EXPERT | — | — |
| Multi-scene narrative continuity | 🟡 ENTRY/INT | 🟡 MEDIUM | "I'm directing a 4-minute narrative music video with 3 distinct scenes: a childhood memory (warm, golden-hour color grade), a present-day confrontation (cold, fluorescent), and a surreal dream sequence (desaturated with oversaturated reds). Walk me through the prompt engineering strategy for Veo 3.1 to: maintain visual continuity across the wardrobe changes between the childhood and present versions of the same character, handle the eyeline match cut between Scene 1 and Scene 2, and use consistent camera movement grammar (all handheld in Scene 1, all locked-off in Scene 2, all slow-zoom in Scene 3) to reinforce the tonal shift across all 48 generated clips." |
| Batch editing / color consistency | ✅ HAS EXPERT | — | — |
| VFX / special effects direction | 🟡 ENTRY/INT | 🟢 LOW | "I want a shot where the subject appears to dissolve into shards of light at the climax of my video. Walk me through prompting Veo 3.1 for this effect: the exact particle description language (glass shard vs. light beam vs. pixel dissolution), how to use the extend-forward tool to build the effect across 3 sequential clips so it looks continuous, and the color grading adjustments I need on each clip to make the light shards feel motivated by the source lighting in the previous shot." |
| Vertical / short-form video optimization | 🟡 ENTRY/INT | 🟢 LOW | "I need to repurpose my 4:3 music video into a 9:16 vertical format for TikTok and Instagram Reels. Walk me through the automated reframing strategy for Veo: which clips need manual attention-point adjustment vs. can be auto-cropped, how to re-time the edit to hit the TikTok 3-second hook threshold, and how to generate a custom 9:16 version of the thumbnail that carries the same visual identity as the horizontal YouTube thumbnail." |

---

### 14. Generalist Agent — indii Conductor (Hub)
**Current expert %:** 33% (33/100 examples)
**Dataset:** `docs/agent-training/datasets/generalist.jsonl`
**Definition:** `src/services/agent/specialists/GeneralistAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Intelligent routing to specialists | ✅ HAS EXPERT | — | — |
| Multi-agent task coordination | ✅ HAS EXPERT | — | — |
| Context synthesis from artist profile | ✅ HAS EXPERT | — | — |
| Ambiguous intent resolution | ✅ HAS EXPERT | — | — |
| Cross-domain workflow orchestration | 🟡 ENTRY/INT | 🟡 MEDIUM | "I have an album dropping in 6 weeks. I need a distribution deal, a press push, a sync pitch, a merch drop, and a social media strategy — all coordinated to the same release date. Build me the sequenced handoff plan: which agents need to fire in what order, what outputs from each agent are inputs to the next, and what my weekly critical-path milestones are for weeks 1–6. Then route the first batch of tasks." |
| Jailbreak / prompt injection defense | ✅ HAS EXPERT | — | — |
| Persona lock / identity defense | ✅ HAS EXPERT | — | — |
| Escalation to human review | 🟡 ENTRY/INT | 🟡 MEDIUM | "An artist is asking me to approve a $250,000 advance offer from a label that wants exclusive rights to their entire back catalog plus 3 future albums. This is outside the platform's normal decision scope. Walk me through what criteria would trigger me to route this to a human advisor, how I communicate the limitation to the artist without making them feel abandoned, and what information I should gather and document before escalating." |

---

### 15. DevOps Agent — SRE Engineer
**Current expert %:** 34% (32/95 examples)
**Dataset:** `docs/agent-training/datasets/devops.jsonl`
**Definition:** `src/services/agent/definitions/DevOpsAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| GKE cluster monitoring | ✅ HAS EXPERT | — | — |
| Kubernetes deployment scaling | ✅ HAS EXPERT | — | — |
| GCE instance monitoring | ✅ HAS EXPERT | — | — |
| Service restarts / incident response | ✅ HAS EXPERT | — | — |
| Credential management | ✅ HAS EXPERT | — | — |
| IAM / security hardening | 🟡 ENTRY/INT | 🟡 MEDIUM | "My GKE cluster's default service account has `roles/editor` bound to it. Walk me through rotating to principle-of-least-privilege: auditing current resource access patterns via Cloud Audit Logs to determine the minimum required permissions, creating custom IAM roles with only the observed permissions, rolling this out via Workload Identity Federation without causing downtime for the 3 running deployments, and verifying the change with a 24-hour audit log review." |
| Post-incident runbook creation | 🟡 ENTRY/INT | 🟢 LOW | "After a 47-minute Firebase Functions outage caused by a cold start cascade during a traffic spike, walk me through writing a runbook that: defines the exact monitoring signals (pending instance count, invocation latency P99, error rate threshold) that should trigger the incident, the 5-step diagnostic checklist in order, the rollback procedure if the fix makes things worse, and the blameless postmortem format we should use in the 24-hour review." |
| Cost optimization (GCP billing) | 🟡 ENTRY/INT | 🟢 LOW | "My GCP bill jumped 40% month-over-month to $8,200. Cloud Billing shows the top 3 cost drivers: BigQuery queries ($2,400), Cloud Storage egress ($1,800), and Firestore reads ($1,100). Walk me through diagnosing each: which BigQuery queries are scanning full tables instead of using partitioning, how to identify the top egress consumers and add CDN caching, and how to find the Firestore collection doing unbounded reads and add query pagination." |

---

### 16. Security Agent — Security Guardian
**Current expert %:** 47% (46/97 examples) — HIGHEST among all agents
**Dataset:** `docs/agent-training/datasets/security.jsonl`
**Definition:** `src/services/agent/definitions/SecurityAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| API security / gateway status | ✅ HAS EXPERT | — | — |
| PII / secret detection (content scanning) | ✅ HAS EXPERT | — | — |
| Credential rotation | ✅ HAS EXPERT | — | — |
| Permission audits / RBAC | ✅ HAS EXPERT | — | — |
| Vulnerability assessment | ✅ HAS EXPERT | — | — |
| Incident triage | ✅ HAS EXPERT | — | — |
| GDPR / CCPA compliance | ✅ HAS EXPERT | — | — |
| LLM prompt injection defense | ✅ HAS EXPERT | — | — |
| Supply chain security (npm/pip audit) | 🟡 ENTRY/INT | 🟢 LOW | "I've received a GitHub Dependabot alert: `axios` has a CVSS 7.5 prototype pollution vulnerability in versions < 1.6.0, but my production bundle is pinned to 1.5.1 as a transitive dependency of 3 different packages. Walk me through the impact assessment: does this vulnerability apply to my server-side or client-side usage, what payload would actually trigger it, and how to force a resolution override in `package.json` without breaking the 3 dependent packages that constrain the version." |

**Status:** Security is the best-covered agent at 47% expert. Minimal intervention needed.

---

### 17. Director Agent — Creative Director
**Current expert %:** 35% (34/97 examples)
**Dataset:** `docs/agent-training/datasets/director.jsonl`
**Tools:** `src/services/agent/tools/DirectorTools.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Creative concept development | ✅ HAS EXPERT | — | — |
| Visual direction (moodboards, storyboards) | ✅ HAS EXPERT | — | — |
| Image generation direction | ✅ HAS EXPERT | — | — |
| Artistic style consistency | ✅ HAS EXPERT | — | — |
| Campaign visual identity | ✅ HAS EXPERT | — | — |
| Audio-driven visual concept | ✅ HAS EXPERT | — | — |
| Cross-medium visual coherence | 🟡 ENTRY/INT | 🟢 LOW | "My album visual world needs to be consistent across: a 4-panel vinyl gatefold, 10 individual single covers, 3 music videos, a 15-item merch collection, and a live show stage design. Walk me through the visual grammar document I should create first — the 5–7 core visual rules (color palette, typographic treatment, photographic style, texture language, compositional rule) — and then show me how to use those rules to generate a brief for each medium that ensures a fan can identify all 28 assets as belonging to the same artist without seeing the name." |
| Album art direction | ✅ HAS EXPERT | — | — |

---

### 18. Producer Agent — Unit Production Manager
**Current expert %:** 43% (40/94 examples) — 2ND HIGHEST
**Dataset:** `docs/agent-training/datasets/producer.jsonl`
**Tools:** `src/services/agent/tools/ProducerTools.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Call sheet generation | ✅ HAS EXPERT | — | — |
| Script breakdown | ✅ HAS EXPERT | — | — |
| Production budget estimation | ✅ HAS EXPERT | — | — |
| Location scouting logistics | ✅ HAS EXPERT | — | — |
| Crew management / hiring | ✅ HAS EXPERT | — | — |
| Equipment procurement | ✅ HAS EXPERT | — | — |
| Production insurance | 🟡 ENTRY/INT | 🟢 LOW | "I'm producing a music video with a $45,000 budget that includes a drone sequence, 2 child actors (ages 8 and 11), and a vintage car (1967 Mustang owned by a third party). Walk me through the exact insurance coverage I need: the minimum Equipment & Props coverage for the rental gear value, the Errors & Omissions policy for SAG-AFTRA child performer compliance, the vehicle liability extension for the third-party car, and what the typical combined deductible structure looks like for a 2-day shoot at this budget level." |
| SAG-AFTRA compliance | 🟡 ENTRY/INT | 🟡 MEDIUM | "My music video production wants to cast 2 SAG-AFTRA background performers alongside 8 non-union extras. Am I required to go fully union if I cast any SAG performer? Walk me through: the SAG-AFTRA Music Video Agreement terms for low-budget productions (under $75k), whether I can use a mix under the Modified Low Budget Agreement, the specific paperwork I need to file (Start Card, W-4, SAG Standard Core paperwork), and what happens if I go non-SAG and a union member later files a grievance." |

---

### 19. Screenwriter Agent — Script Specialist
**Current expert %:** 35% (34/97 examples)
**Dataset:** `docs/agent-training/datasets/screenwriter.jsonl`
**Tools:** `src/services/agent/tools/ScreenwriterTools.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Screenplay formatting | ✅ HAS EXPERT | — | — |
| Script structure analysis (3-act, beats) | ✅ HAS EXPERT | — | — |
| Dialogue writing | ✅ HAS EXPERT | — | — |
| Character development | ✅ HAS EXPERT | — | — |
| Music video script / treatment | ✅ HAS EXPERT | — | — |
| Short film script | ✅ HAS EXPERT | — | — |
| Premise development / logline | ✅ HAS EXPERT | — | — |
| Query letter / pitch document | 🟡 ENTRY/INT | 🟢 LOW | "I've written a 24-page short film script about a touring musician confronting their estranged parent backstage after a show. Walk me through writing the query letter for submission to Sundance Short Film Fund: the correct logline format (character + inciting incident + stakes), how to position the script's theme against the fund's current focus areas, what to include vs. exclude in the writer's bio section for a first-time short filmmaker, and the follow-up timeline after submission." |
| Series bible creation | 🟡 ENTRY/INT | 🟢 LOW | "I want to develop a docuseries concept following 5 independent artists through their first year with indiiOS. Walk me through writing a 10-page series bible: the format sections (logline, format/tone, episode structure, character overviews, season arc, sample episode beats), the difference between a pitch bible and a production bible, and what streaming platforms are actively acquiring music-themed docuseries formats in 2026 and what their acquisition criteria look like." |

---

### 20. Curriculum Agent — Education Specialist
**Current expert %:** 28% (27/97 examples) — 3RD LOWEST
**Dataset:** `docs/agent-training/datasets/curriculum.jsonl`
**Definition:** `src/services/agent/specialists/CurriculumAgent.ts`

| Skill Domain | Status | Priority | Example Expert Prompt |
|---|---|---|---|
| Learning path design | ✅ HAS EXPERT | — | — |
| Module curriculum structure | ✅ HAS EXPERT | — | — |
| Knowledge assessment / quizzes | ✅ HAS EXPERT | — | — |
| Educational content generation | ✅ HAS EXPERT | — | — |
| Skill gap identification | 🟡 ENTRY/INT | 🟡 MEDIUM | "An artist has been in the music business for 3 years with $120k in total streaming income but has never registered with a PRO, doesn't know their ISRC numbers, and has signed 2 producer agreements without reading them. Design a structured learning plan: identify the knowledge gaps by domain (legal, finance, distribution, publishing), prioritize them by revenue impact (what would have made them the most money if known earlier), and create a 6-week curriculum with 1 actionable task per week that closes the highest-value gaps first." |
| Pedagogical approach differentiation | 🟡 ENTRY/INT | 🟡 MEDIUM | "I need to teach the concept of 'recoupment' to 3 types of artists: (A) a 19-year-old TikTok-native with no business background, (B) a 35-year-old who spent 8 years at a mid-size label and thinks they understand it, and (C) a music business professor who's writing a textbook chapter. Design 3 different explanations of the same concept, each optimized for the prior knowledge and framing that will make it land most effectively for each audience." |
| Adaptive learning / progress tracking | 🟡 ENTRY/INT | 🟢 LOW | "A user has completed 12 of 20 modules but their quiz scores show: 90%+ on streaming/distribution, 85%+ on social media, but only 52% on publishing/PROs and 48% on legal contracts. Design an adaptive curriculum that: identifies the specific sub-topics within those weak areas where they're failing (from quiz item analysis), routes them to targeted remedial content, and then re-tests only the failed items rather than the full module." |
| Music industry onboarding flows | ✅ HAS EXPERT | — | — |

---

## Master Work Queue

Sorted by impact tier. Work through HIGH priority first, then MEDIUM.

### 🔴 HIGH PRIORITY — Add These Expert Examples First

| # | Agent | Skill | Gap Type | Example Expert Prompt (abbreviated) |
|---|-------|-------|----------|--------------------------------------|
| 1 | Music | YouTube Content ID | ✅ FILLED | Dispute process, OAC appeal language, cover vs. original, distributor claim vs. label claim |
| 2 | Social | Community crisis / coordinated harassment | ✅ FILLED | Platform-specific moderation triage, escalation to trust-and-safety, when to involve law enforcement |
| 3 | Publishing | ISWC collision resolution | ✅ FILLED | CISAC collision procedure, priority documentation, cross-society propagation fix |
| 4 | Distribution | Chain of Title disputes | ✅ FILLED | Verbal work-for-hire reconstruction, DSP escrow resolution, evidence standards |
| 5 | Distribution | Aspera FASP delivery troubleshooting | 🟡 ENTRY/INT | ORTP timeout diagnosis, TCP fallback flags, credential chain |
| 6 | Distribution | DDEX ERN 4.3 full message construction | 🟡 ENTRY/INT | Multi-party collaboration XML, error code resolution, UpdateIndicator usage |
| 7 | Distribution | Audio forensics / spectral fraud detection | 🟡 ENTRY/INT | Upsampled hi-res detection, ABX test, forensic analysis steps |
| 8 | Finance | 360 deal financial modeling | 🟡 ENTRY/INT | Full recoupment model, NPV vs. staying indie, breakeven stream count |
| 9 | Finance | Touring tax / state nexus | 🟡 ENTRY/INT | Multi-state filing obligations, withholding on promoter check, LLC strategies |
| 10 | Finance | Foreign currency / tour P&L | 🟡 ENTRY/INT | EU tour VAT calculation, forex hedging, forward contract strategy |
| 11 | Publicist | Embargo breach management | 🟡 ENTRY/INT | 90-minute crisis response, preserve remaining coverage, contractual remedies |
| 12 | Marketing | Fan data enrichment / CRM | 🟡 ENTRY/INT | Unified fan database, LTV segmentation, de-duplication, top 3 automations |

### 🟡 MEDIUM PRIORITY — High-Value Additions

| # | Agent | Skill | Gap Type | Notes |
|---|-------|-------|----------|-------|
| 13 | Music | Sonic branding strategy | 🟡 ENTRY/INT | Cross-era transition strategies |
| 14 | Music | Vinyl mastering specs | ✅ FILLED | LUFS targets, inner groove distortion, stereo width |
| 15 | Publishing | Co-publishing vs. admin deal | 🟡 ENTRY/INT | 5-year financial comparison, control tradeoffs |
| 16 | Publishing | Mechanical licensing (compulsory vs. direct) | 🟡 ENTRY/INT | Section 115 notice requirements, CRB rate calc |
| 17 | Legal | Trademark opposition (artist name) | 🟡 ENTRY/INT | USPTO opposition, priority of use, likelihood of confusion |
| 18 | Legal | Neighboring rights registration | 🟡 ENTRY/INT | SoundExchange + PPL retroactive collection |
| 19 | Marketing | A/B ad testing framework | 🟡 ENTRY/INT | Budget allocation, winner threshold, 7-day test window |
| 20 | Marketing | TikTok sound campaign | 🟡 ENTRY/INT | Bounty campaign brief, timing strategy, viral coefficient tracking |
| 21 | Marketing | Streaming analytics → campaign action | 🟡 ENTRY/INT | Drop-off diagnosis, save rate interpretation, 3 campaign actions |
| 22 | Road | ATA Carnet full procedure | 🟡 ENTRY/INT | Documentation per item, security deposit, single-officer error handling |
| 23 | Road | Force majeure / cancellation | 🟡 ENTRY/INT | Kill fee calc, insurance claim, multi-market communication |
| 24 | Licensing | Music supervisor outreach | 🟡 ENTRY/INT | Pitch format, metadata expected, fee range for HBO-tier placement |
| 25 | Licensing | Sample clearance negotiation | 🟡 ENTRY/INT | Negotiation starting point, master vs. publishing split, replay decision |
| 26 | Curriculum | Skill gap identification / learning plan | 🟡 ENTRY/INT | Revenue-impact prioritization, 6-week plan |
| 27 | Curriculum | Pedagogical differentiation | 🟡 ENTRY/INT | Same concept, 3 different audience levels |
| 28 | Brand | Brand equity / licensing deals | 🟡 ENTRY/INT | Fee valuation at 2M followers, approval rights negotiation |
| 29 | Social | TikTok algorithm recovery | 🟡 ENTRY/INT | Shadowban vs. organic decline diagnosis, 5-post recovery playbook |
| 30 | Social | YouTube channel optimization | ✅ FILLED | Subscriber conversion rate, thumbnail A/B, SEO for artist channels |
| 31 | Generalist | Cross-domain workflow orchestration | 🟡 ENTRY/INT | 6-week release critical path, multi-agent sequencing |
| 32 | Distribution | Merlin membership compliance | 🟡 ENTRY/INT | Qualification criteria, application docs, rate premium calc |
| 33 | Distribution | Royalty waterfall edge cases | 🟡 ENTRY/INT | Co-pub + sub-publishing waterfall, UK mechanical calculation |
| 34 | Producer | SAG-AFTRA compliance | 🟡 ENTRY/INT | Mixed union/non-union production, Music Video Agreement |
| 35 | Publicist | Long-lead print placement | 🟡 ENTRY/INT | 4-month timeline, exclusivity positioning, editor contact strategy |

### 🟢 LOWER PRIORITY — Polish Pass

| Agent | Skills | Notes |
|-------|--------|-------|
| Video | Multi-scene narrative continuity, VFX direction, vertical reformat | Nice-to-have; core tools are well-covered |
| DevOps | IAM hardening, postmortem runbooks, cost optimization | Already at 34% expert; functional for platform use |
| Screenwriter | Query letters, series bibles | Narrow use case for most artists |
| Director | Cross-medium visual coherence | Already strong; single gap |
| Merchandise | Tour merch bundle strategy, limited drop mechanics | Solid coverage; incremental additions |
| Security | Supply chain security | Best-covered agent; minimal gaps |
| Producer | Production insurance | Low artist-facing value |

---

## Dataset File Quick Reference

| Agent | Dataset File | Definition |
|-------|-------------|------------|
| brand | `datasets/brand.jsonl` | `definitions/BrandAgent.ts` |
| curriculum | `datasets/curriculum.jsonl` | `specialists/CurriculumAgent.ts` |
| devops | `datasets/devops.jsonl` | `definitions/DevOpsAgent.ts` |
| director | `datasets/director.jsonl` | `tools/DirectorTools.ts` |
| distribution | `datasets/distribution.jsonl` | `definitions/DistributionAgent.ts` |
| finance | `datasets/finance.jsonl` | `definitions/FinanceAgent.ts` |
| generalist | `datasets/generalist.jsonl` | `specialists/GeneralistAgent.ts` |
| legal | `datasets/legal.jsonl` | `definitions/LegalAgent.ts` |
| licensing | `datasets/licensing.jsonl` | `definitions/LicensingAgent.ts` |
| marketing | `datasets/marketing.jsonl` | `definitions/MarketingAgent.ts` |
| merchandise | `datasets/merchandise.jsonl` | `MerchandiseAgent.ts` |
| music | `datasets/music.jsonl` | `definitions/MusicAgent.ts` |
| producer | `datasets/producer.jsonl` | `tools/ProducerTools.ts` |
| publicist | `datasets/publicist.jsonl` | `definitions/PublicistAgent.ts` |
| publishing | `datasets/publishing.jsonl` | `definitions/PublishingAgent.ts` |
| road | `datasets/road.jsonl` | `definitions/RoadAgent.ts` |
| screenwriter | `datasets/screenwriter.jsonl` | `tools/ScreenwriterTools.ts` |
| security | `datasets/security.jsonl` | `definitions/SecurityAgent.ts` |
| social | `datasets/social.jsonl` | `definitions/SocialAgent.ts` |
| video | `datasets/video.jsonl` | `definitions/VideoAgent.ts` |

All dataset paths are relative to `docs/agent-training/`.
All definition paths are relative to `src/services/agent/`.

---

*This document is updated as expert examples are added. Check items off in the Master Work Queue and update status in the Agent Skill Maps above.*
