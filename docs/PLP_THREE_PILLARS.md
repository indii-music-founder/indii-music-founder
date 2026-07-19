# PLP: The Three Pillars System

**PLP (Promote · Launch · Push)** is not just a creative generation pipeline. It is the foundational three-pillar system that orchestrates the entire artist lifecycle on indii — from campaign ideation through global distribution and continuous optimization.

---

## Overview

Each pillar represents a distinct phase of the artist's release and growth cycle, but they are deeply interconnected. The work within each pillar touches new systems, legacy systems, and cross-cutting concerns that span the entire platform.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLP: Three Pillars                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PROMOTE          LAUNCH           PUSH                          │
│  ───────          ───────          ────                          │
│  Campaign         Release          Distribution                  │
│  Strategy         Readiness        & Scaling                     │
│  & Testing        & Metadata                                     │
│                   Optimization                                   │
│                                                                   │
│  (Pre-Release)    (Release Day)    (Post-Release Growth)         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pillar 1: PROMOTE

### Purpose
Design, test, and optimize the creative assets and messaging that will drive the initial wave of engagement. This pillar focuses on **pre-release campaign strategy and variant testing**.

### What It Touches

#### New Systems
- **Creative Variant Generation**: 15-variant batch generation (10 images, 5 videos via Veo 3.1)
- **A/B Testing Engine**: Deploy variants simultaneously across Meta networks with independent performance tracking
- **Cost-Per-Save Optimization**: Autonomous kill-switch for underperforming creatives by Day 3
- **Audience Targeting Refinement**: Interest-based targeting evolution → Saver Lookalike audiences

#### Legacy Systems
- **Brand Kit Enforcement**: Ensure all variants comply with the artist's established brand guidelines
- **Audio Profile Integration**: Sonic DNA from the Audio Analyzer feeds creative direction (mood, tempo, key)
- **Project Asset Library**: Store and version-control generated variants within the project

#### Cross-Cutting
- **Firestore Tracking**: Campaign brief metadata, variant performance metrics, audience insights
- **Firebase Analytics**: Real-time CPS (Cost-Per-Save) tracking and decision logs
- **Agent Orchestration**: Creative Director + Marketing Agent collaboration on variant strategy

### Key Metrics
- **Save Rate**: 8%+ (healthy), 5-8% (warning), <5% (critical kill-switch)
- **Click-Through Rate (CTR)**: Variant performance ranking
- **Cost Per Save**: Primary KPI for optimization

### Phase Duration
**3-7 days before release** through **day 3 of paid spend** (kill underperformers)

---

## Pillar 2: LAUNCH

### Purpose
Execute the coordinated, metadata-optimized release of the track/project across all DSPs with full compliance, proper attribution, and release-ready asset packaging. This pillar focuses on **release day readiness and DSP distribution**.

### What It Touches

#### New Systems
- **Metadata Orchestration**: ISRC generation, UPC validation, DDEX XML compilation
- **DSP Delivery Pipeline**: Direct-to-Spotify, Apple Music for Artists, Amazon Music integration
- **Smart Contract Deployment** (optional): Split sheet automation via blockchain for co-artist attribution
- **Pre-Save Campaign Coordination**: Sync pre-save link generation with DSP submission timing

#### Legacy Systems
- **Distribution History**: Pull prior release patterns, identify gaps in platform coverage
- **Royalty Split Sheet Integration**: Ensure all collaborators are properly attributed in DSP metadata
- **Legal & Publishing Coordination**: Verify PRO registration, sync licenses, composition data
- **Financial Projection**: Estimate earnings based on genre, playlist velocity, and historical trends

#### Cross-Cutting
- **Firestore Release State Machine**: Track release progress (draft → submitted → live → indexed)
- **Distribution Agent**: Coordinate with distribution service integrations (DistroKid, TuneCore, CDBaby)
- **Music Agent**: Verify catalog integrity, BPM/key metadata, audio file quality
- **Legal Agent**: Confirm publishing splits, ensure no contract conflicts

### Key Metrics
- **Submission Success Rate**: 100% first-time acceptance on all platforms
- **Time-to-Live on DSPs**: All platforms live within 24-48 hours of submission
- **Metadata Accuracy**: Zero DSP rejections due to malformed DDEX or missing fields

### Phase Duration
**3-5 days before release** through **release day + 2 days** (full indexing across DSPs)

---

## Pillar 3: PUSH

### Purpose
Scale the initial momentum across paid channels, owned audiences, and organic growth loops. Continuously optimize spend allocation, refresh messaging, and drive sustained stream velocity through the critical first 28 days. This pillar focuses on **post-release scaling and audience expansion**.

### What It Touches

#### New Systems
- **Dynamic Budget Allocation**: Real-time rebalancing across Instagram Stories, Reels, and Feed
- **Lookalike Audience Evolution**: Expand from early-adopter savers to broader 1-3% lookalike cohorts
- **Organic Growth Multipliers**: Engage playlisting teams, seeder campaigns, influencer amplification
- **Stream Velocity Analytics**: Track trajectory against algorithmic thresholds (Spotify popularity score milestones)

#### Legacy Systems
- **Playlist Curator Database**: Reach out to independent curators once track hits score thresholds (20, 30, 40, 50+)
- **Social Media Campaign Archive**: Reference past successful messaging and audience segments
- **Revenue Forecasting**: Update earnings projections as real streaming data arrives
- **Artist Growth Metrics**: Build historical baseline for future campaign comparison

#### Cross-Cutting
- **Real-Time Viral Scoring**: Multi-factor algorithmic scoring (saves ÷ streams, playlist adds, repeat rate)
- **A2A Swarm Coordination**: Marketing Agent orchestrates spend adjustments; Music Agent tracks stream quality; Analytics Agent monitors breakout risk
- **Inngest Background Jobs**: Handle long-running paid spend adjustments, influencer outreach, curator pitching
- **Firestore Campaign Lifecycle**: Track 28-day front-loaded protocol state, kill-switch events, lookalike expansions

### Key Metrics
- **Stream Velocity**: Streams/day trajectory (normalized for release week)
- **Playlist Adds**: Algorithmic + curator-driven playlist placements
- **Listener Retention**: Repeat stream rate, listener loyalty cohort
- **Cost-Per-Stream**: Paid efficiency over time
- **Algorithmic Threshold Breaches**: Spotify Discover Weekly, Release Radar, New Music Daily inclusion

### Phase Duration
**Release day through day 28** (front-loaded spend) + **ongoing curator cultivation** (weeks 4+)

---

## Cross-Pillar Dynamics

### Information Flow
```
PROMOTE              LAUNCH              PUSH
   ↓                   ↓                   ↓
Variant          Release          Stream Velocity
Performance  +   Metadata     +   Audience Growth
   ↓                   ↓                   ↓
Inform Next Campaign Cycle & Future Artist Strategy
```

### Dependency Chain
- **PROMOTE** informs which creative variants to feature in LAUNCH messaging
- **LAUNCH** timing is determined by PROMOTE kill-switch events (Day 3)
- **PUSH** budget allocation is tuned by LAUNCH DSP velocity data
- **PUSH** results feed back into PROMOTE for the next release cycle

### Shared Infrastructure
- **Creative Studio**: Asset versioning and variant storage
- **Firestore**: Central state machine for all three pillars
- **Agent Orchestration**: A2A swarm with specialist agents (Creative, Marketing, Music, Analytics, Finance)
- **Analytics Dashboard**: Real-time observability across all three pillars
- **Firebase Functions**: Serverless workers for autonomous optimization (kill-switches, budget reallocations, curator outreach)

---

## Product Integration (What Users See)

### Creative Studio
- **"PLP Mode" Toggle**: One-click activation to enter the three-pillar workflow
- **Three-Tab Dashboard**: 
  - **PROMOTE tab**: Variant generation, A/B test setup, CPS monitoring
  - **LAUNCH tab**: Metadata checklist, DSP readiness, submission status
  - **PUSH tab**: Budget dashboard, playlist tracker, stream velocity chart

### Command Bar
- `/deploy-plp`: Activate the full three-pillar workflow for a release
- `/promote-status`: Check current campaign performance and variant health
- `/launch-readiness`: DSP metadata validation checklist
- `/push-analytics`: Real-time stream velocity and audience growth metrics

### Analytics Module
- **PLP Performance Card**: Compare across all three pillars in one view
- **Release Calendar**: Timeline view of all releases with their PROMOTE/LAUNCH/PUSH phases
- **Cohort Analysis**: Track which releases succeeded, which variants won, which audiences converted

---

## Investor Pitch

### Why Three Pillars?
PLP is not a feature; it is **indii's operational backbone**. Every artist release is orchestrated through these three pillars, and the system learns and optimizes with each cycle. Unlike traditional DAWs or generic distribution platforms, indii's PLP system:

1. **Automates the entire lifecycle** — from creative testing through global scaling
2. **Eliminates manual coordination** — one-click orchestration across 21 agents
3. **Maximizes algorithmic reach** — front-loaded spend strategy and autonomous kill-switches
4. **Builds institutional knowledge** — each release informs the next; the system gets smarter

### Competitive Moat
No other platform offers **integrated creative generation + release coordination + autonomous growth scaling** as a unified system. This is proprietary IP that defends indii's position as the indie artist's operating system.

---

## Implementation Roadmap

### Phase 1: Core PLP (Current)
- ✅ Variant generation (15-variant batch)
- ✅ Basic A/B testing infrastructure
- ✅ Release metadata coordination
- ✅ Manual budget allocation

### Phase 2: Autonomous Optimization (Q3 2026)
- 🔄 Autonomous kill-switches (CPS < 5%)
- 🔄 Dynamic budget rebalancing (Inngest-driven)
- 🔄 Lookalike audience evolution (Post-2k conversion events)
- 🔄 Playlist curator outreach automation

### Phase 3: Predictive Intelligence (Q4 2026)
- 📋 Breakout prediction models (will this track hit Top 50?)
- 📋 Optimal PROMOTE duration (when to kill test and go live?)
- 📋 Creative variant winner prediction (which 3 variants to scale?)
- 📋 Audience cohort forecasting (lookalike expansion timing)

### Phase 4: Cross-Release Learning (2027+)
- 📋 Multi-release cohort analysis (genre trends, seasonal patterns)
- 📋 Artist growth trajectory modeling
- 📋 Long-term catalog strategy recommendation engine

---

## Documentation & Training

- **For Artists**: "PLP Quick Start" video (5 min) — how to activate and monitor all three pillars
- **For Investors**: "PLP: The Indie Artist's Playbook" — narrative deck emphasizing automation + reach
- **For Agents**: Architecture guide mapping PLP to agent responsibilities (Creative, Marketing, Music, Analytics, Finance)
- **For Engineers**: API contract specification for variant generation, metadata orchestration, and autonomous optimization

---

## Conclusion

PLP is the visible, tangible manifestation of indii's three-layer architecture. It is:
- **Lived** in the product (UI, dashboards, workflows)
- **Documented** in this file and marketing materials
- **Sung** in investor pitches as the core competitive differentiator
- **Built** across all 21 agents and cross-cutting platform systems

Every release that flows through indii goes through PROMOTE → LAUNCH → PUSH. This is how we scale indie artists from zero to Spotify algorithmic reach.

---

**Last Updated:** 2026-06-23
**Status:** Strategic Foundation Document
**Audience:** Internal team, investors, product partners
