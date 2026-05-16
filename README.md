<div align="center">
  <img width="1280" height="560" alt="indii Banner" src="docs/assets/indii-banner.png" />
</div>

# indii: The Independent Creative Engine

**The First Intelligence-Native Operating System for Independent Artists & Producers.**

indii is not just a platform; it is a **Digital Handshake**. It is a multi-tenant, independent creative workspace designed to empower independent music producers, visual artists, and labels. By unifying Intelligent asset generation, automated distribution, and Autonomous business operations, indii enables creators to own their infrastructure, their data, and their future.

[![Version](https://img.shields.io/badge/Version-1.64.0-blue)](https://github.com/new-detroit-music-llc/indii-Alpha-Electron)
[![Firebase](https://img.shields.io/badge/Cloud-Firebase-FFCA28?logo=firebase)](https://indii-studio.web.app)
[![React](https://img.shields.io/badge/Framework-React_18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Electron](https://img.shields.io/badge/Desktop-Electron_33-47848F?logo=electron)](https://www.electronjs.org)
[![Intelligence](https://img.shields.io/badge/Intelligence-Gemini_3-4285F4?logo=google)](https://ai.google.dev)
[![Node](https://img.shields.io/badge/Node-%3E%3D22.0.0-339933?logo=node.js)](https://nodejs.org)

---

## â¡ Quick Start (15 minutes)

> **New contributor?** You should be running the app in under 15 minutes.
> If it takes longer, run `make doctor` and share the output â something is misconfigured.

```bash
# 1. Clone (1 min)
git clone https://github.com/new-detroit-music-llc/indii-Alpha-Electron.git
cd indii-Alpha-Electron

# 2. Bootstrap environment (5 min)
make prime                  # installs deps, runs health check

# 3. Configure secrets (3 min)
cp .env.example .env        # then fill in your VITE_API_KEY + Firebase keys

# 4. Launch (30 sec)
make dev-web                # Vite-only on :4243 â fastest iteration loop
# â OR â
make dev                    # Full Electron + Vite on :4242
```

| Step | Command | Expected Time |
|------|---------|---------------|
| Bootstrap | `make prime` | ~5 min (first run downloads deps) |
| Configure | Edit `.env` | ~3 min |
| Health check | `make doctor` | ~10 sec |
| Start dev | `make dev-web` | ~5 sec (hot reload) |
| Run tests | `make test` | ~15 sec (Vitest watch) |
| Ship to prod | `make ship` | ~4 min (lint â typecheck â test â build â deploy) |

> **Pro tip:** Use `make help` to see every available target.

---

## ð  The Vision

indii solves the "fragmentation trap" where artists lose 40% of their creative time managing 20+ different tools â and 20â30% of their revenue to aggregators who change their TOS whenever they feel like it. It provides a unified **Neural Cortex** that understands your brand, your sound, and your business goals across every module.

**indii is the platform of record. We hold sophisticated, proprietary system IP that interfaces directly with global distribution infrastructure. By bypassing traditional third-party aggregator layers, indii enables creators to maintain absolute control over their masters, royalties, and creative data through a direct-to-DSP transmission rail.**

---

## ðï¸ 3-Layer Architecture

To ensure 99.9% reliability in probabilistic AI workflows, indii operates on a rigorous 3-layer system:

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: DIRECTIVE (Managerial)                             │
│  Natural language SOPs that define goals and safety bounds   │
│  → directives/                                               │
├──────────────────────────────────────────────────────────────┤
│  Layer 2: ORCHESTRATION (Intelligence)                       │
│  A2A swarm protocol — reasons, routes, manages               │
│  → agents/ + src/services/agent/                             │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: EXECUTION (Deterministic)                          │
│  Hard-coded scripts for API calls, file ops, Proprietary Ingestion IP generation  │
│  → execution/ + python/tools/                                │
└──────────────────────────────────────────────────────────────┘

**The Multiplier Effect:** By pushing complexity into deterministic execution layers, we avoid the "compound error" trap (where 90% accuracy over 5 biological steps leads to 59% overall success). Determinism at the base allows for reliability at the peak.

**Omni-Aware Routing:** The orchestration layer is built with "Context-First" routing. Agents intelligently prioritize current conversation intent and user specific requests over the active document, preventing target collisions and ensuring a focused execution loop even in complex, multi-file workspaces.

---

## 🤖 indii: The A2A Swarm Protocol

The core of indii is the **Agent Swarm**, a decentralized orchestration protocol with **20 specialist agents** seeded with verifiable technical tools.

```
              ┌─────────────────────┐
              │indii Conductor (Swarm)│
              │    Orchestrator     │
              └──────────┬──────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │        │        │        │        │      │
  Creative  Brand   Music   Legal   Finance  Video
  Director  Agent   Agent   Agent   Agent   Agent
    │
  ┌─┴──────────────────────────────────────────┐
  Marketing  Social  Publishing  Licensing     │
  Agent      Agent   Agent       Agent         │
  │                                             │
  Publicist  Road    Generalist  Executor      │
  Agent      Agent   Agent       Agent         │
  │                                             │
  Merch      Analytics  IndiiOD  Strategy      │
  Agent      Agent      Agent    Agent         │
  └────────────────────────────────────────────┘
```

| Agent | Domain | Technical Core (Seeded Tools) |
|-------|--------|-------------------------------|
| **indii Conductor** | Swarm Orchestrator | Foundational Audit & Memory Skills |
| **Music Agent** | Audio Intelligence | `calculate_splits.py`, BPM/Key analysis |
| **Merchandise** | E-commerce Ops | `margin_calculator.py`, SKU generation |
| **Legal Agent** | Rights & Contracts | `nda_generator.py`, Contract Risk Audit |
| **Social Agent** | Social Media | `post_formatter.py`, Engagement optimization |
| **Finance Agent** | Revenue | `royalty_estimator.py`, Waterfall splits |
| **Creative Dir** | Visual Identity | Brand kit enforcement, Image synthesis |
| **Video Agent** | Video Production | Veo 3.1 synthesis, Director's Cut QA |
| **Analytics Agent**| Growth | Viral scoring, Breakout prediction |
| **All Others (11)** | Various | `domain_readiness.py` (Seeding ongoing) |

**Foundational Skills:**
- **Audit Skill**: Decentralized capability discovery via `scan_directory.py`.
- **Memory Skill**: Persistent procedural "Brain Surgery" via `update_knowledge.py`.
- **Capability Registry**: Centralized `agents/capability_registry.json` for tool discovery.
- **Swarm Dashboard**: Real-time visualization of agent capabilities in the Creative Studio UI.

For more details on the autonomous evolution, see [CAPABILITY_DEPLOYMENT.md](docs/CAPABILITY_DEPLOYMENT.md).

---

## ð± indiiREMOTE Edge Infrastructure

**indiiREMOTE** is a production-ready "Edge Computing" feature that allows users to control their indii desktop mainframe from any mobile device, instantly and securely.

Instead of routing sensitive, unreleased creative assets through a public cloud server, indiiREMOTE provisions a secure, encrypted **Ngrok tunnel** directly to a local Express server running inside the Electron main process.

### How It Works

1. **Device Pairing:** The Electron app generates a secure 6-digit cryptographic PIN and displays a QR code containing the active Ngrok tunnel URL.
2. **Thin-Client Dashboard:** Scanning the QR code opens a lightweight React SPA served directly by the user's desktop application.
3. **End-to-End Encryption:** After entering the PIN, the mobile device establishes a secure WebSocket connection over the Ngrok tunnel directly to the desktop.
4. **Live Execution:** The mobile dashboard displays a real-time feed of active AI agent actions and allows the user to trigger commands (Execute, Explain, Fix Bugs, etc.) without being physically present at their computer.

By keeping the "brain" on the desktop device and utilizing the phone strictly as a remote controller, indii enables true untethered mobility without compromising data independence or relying on external cloud storage.

---

## ð§  indii Cognitive Core: Always-On Memory Agent

Adapted from Google's [Always-On Memory Agent](https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/agents/always-on-memory-agent) reference architecture, indii's memory system is a native TypeScript **Neural Engine** built for absolute persistence and zero-latency recall.

The Memory Agent is a **state-of-the-art, autonomous cognitive system** that operates silently in the background â continuously ingesting, consolidating, and synthesizing information across your entire creative business. It functions as the platform's **Digital Hippocampus**: it converts raw daily interactions into a rich, structured knowledge graph during idle cycles, ensuring your agents are always grounded in the precise truth of your brand.

### â¨ The Memory Advantage

- **Infinite Recall:** Never repeat yourself. Every decision, stylistic preference, and business rule is etched into the long-term vector store.
- **Cross-Module Intelligence:** Knowledge generated in the *Legal* module (e.g., a specific royalty split) is instantly available to the *Finance* and *Social* agents.
- **Autonomous Consolidation:** During "sleep cycles," the engine automatically merges redundant facts and resolves contradictory information using high-thinking reasoning loops.
- **Temporal Awareness:** Navigate your brand's history with a visual timeline that shows how your creative identity has evolved over months and years.

### How It Works

```
User Input / Files / Sessions
        â
        â¼
âââââââââââââââââââââââ
â  Ingestion Pipeline  â  â Entity extraction, topic assignment, importance scoring
â  (Gemini Flash)      â  â Multimodal: text, images, audio, video, PDFs
ââââââââââ¬âââââââââââââ
         â
         â¼
âââââââââââââââââââââââ
â  Tiered Memory Store â  â working â shortTerm â longTerm â archived
â  (Firestore)         â  â Importance decay + reinforcement on access
ââââââââââ¬âââââââââââââ
         â
    ââââââ´âââââ
    â¼         â¼
ââââââââââ ââââââââââââââââ
â Query  â â Consolidation â  â Timer-based background loop (every 30min)
â Agent  â â Agent         â  â Cross-cutting insight generation
â(Pro)   â â(Flash)        â  â Connection discovery between memories
ââââââââââ ââââââââââââââââ
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Longitudinal Timeline** | Tracks facts over years with semantic supersession chains (`supersedes` / `supersededBy`). The system knows what was true 4 years ago vs. what is true today. |
| **Temporal Search** | Multi-mode retrieval: switch between `Recency-Weighted` (latest news) and `Temporal-Aware` (deep historical context) modes. |
| **Performance Lookback** | $O(1)$ write performance at scale. Semantic dedup only audits the last 30 days of high-density facts, maintaining speed even as history grows to 10k+ records. |
| **Metadata Preservation** | Automated consolidation preserves original categories. The system explicitly distinguishes between a raw `fact`, a system-generated `insight`, and a high-level `summary`. |
| **Tiered Memory Store** | Memories move through `working â shortTerm â longTerm â archived` based on importance decay and reinforcement on access. |
| **Semantic Supersession** | Detects when new information makes an old fact obsolete. Links the timeline automatically while preserving the archived "original" fact for provenance. |
| **Entity Graph** | Extracted entities (people, companies, products) are linked across memories to build a global relationship graph. |
| **Dashboard UI** | Premium React dashboard with a visual memory timeline, insight cards, and temporal query interface. |

### Usage

```typescript
import { alwaysOnMemoryEngine } from '@/services/agent/AlwaysOnMemoryEngine';

// Start the engine (called automatically on auth)
engine.start('user-123');

// Ingest text
await engine.ingestText('user-123', 'User prefers dark blue album art with minimal typography');

// Ingest a file (Electron desktop)
await engine.ingestFile('user-123', fileBytes, 'image/png', 'album-ref.png');

// Query with citations
const answer = await engine.queryMemory('user-123', 'What visual style does the user prefer?');

// Manual consolidation
await engine.runConsolidation('user-123');
```

---

## â±ï¸ Timeline Orchestrator (Autonomous Campaign Engine)

The **Timeline Orchestrator** is indii's progressive campaign automation system. It enables multi-month, fully autonomous marketing campaigns that escalate in intensity over time â from teaser posts in week 1 to daily multi-platform saturation by release day â all without manual intervention.

### How It Works

```
ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â  Cloud Scheduler (every 15 min)                              â
â  â pollTimelineMilestones (Cloud Function)                   â
â    â Dispatches timeline/milestone.due events to Inngest     â
â      â executeMilestoneFn calls Gemini server-side           â
â        â Result stored in Firestore + audit log              â
â                                                              â
â  Zero human in the loop. Campaigns run at 3am unattended.    â
ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Progressive Intensity** | Campaigns start with low-frequency "seed" posts and auto-escalate through phases to high-frequency saturation toward the climax |
| **4 Pre-Built Templates** | Single Release (8 weeks), Album Rollout (16 weeks), Merch Drop (4 weeks), Tour Promotion (12 weeks) |
| **Agent-Agnostic** | Works with any specialist agent â marketing, social, brand, publicist, distribution, video, etc. |
| **Smart Asset Strategy** | Each milestone can `create_new` assets via AI, `use_existing` pre-made assets, or `auto` mode (agent decides) |
| **Lifecycle Management** | Draft â Active â Paused â Resumed â Completed / Cancelled â full control |
| **Adaptive Cadence** | Adjust posting frequency per-phase in real-time without rebuilding the timeline |
| **Inngest Durability** | Built-in retries (2x), concurrency limits (5), step-based execution for crash recovery |
| **Audit Trail** | Every autonomous execution is logged to `timelineExecutionLogs` for transparency |

### 9 Agent Tools

Any agent can orchestrate timelines using these registered tools:

| Tool | Purpose |
|------|---------|
| `create_timeline` | Create from template or custom brief |
| `activate_timeline` | Start autonomous execution |
| `pause_timeline` / `resume_timeline` | Lifecycle control |
| `advance_phase` | Skip to next intensity phase |
| `adjust_cadence` | Change posting frequency |
| `get_timeline_status` | Progress metrics |
| `list_timelines` | All user timelines |
| `list_timeline_templates` | Available templates |

### Usage

```typescript
import { timelineOrchestrator } from '@/services/timeline/TimelineOrchestratorService';

// Create a progressive campaign from a template
const timeline = await timelineOrchestrator.createTimeline('user-123', {
  title: 'Spring Album Rollout',
  domain: 'marketing',
  templateId: 'album_rollout_16w',
  startDate: '2026-04-01',
  goal: 'Build anticipation and drive 100k first-week streams',
  assetStrategy: 'create_new',
});

// Activate it â from here, Cloud Scheduler + Inngest handle everything
await timelineOrchestrator.activateTimeline('user-123', timeline.id);
```

### Architecture

```
src/services/timeline/
âââ TimelineOrchestratorService.ts    # Core engine (creation, lifecycle, progress)
âââ TimelinePhaseTemplates.ts         # 4 pre-built campaign templates
âââ TimelineTypes.ts                  # Type definitions
âââ TimelineOrchestratorService.test.ts  # 25 unit tests

src/services/agent/tools/
âââ TimelineTools.ts                  # 9 agent tools (registered in TOOL_REGISTRY)

functions/src/timeline/
âââ pollTimelineMilestones.ts         # Cloud Scheduler: finds due milestones
âââ milestone_execution.ts            # Inngest: Gemini server-side execution
```

---

## ð Growth Intelligence Engine

The **Growth Intelligence Engine** is indii's production analytics system â a real-time viral scoring and breakout prediction pipeline that ingests data directly from your connected streaming and social platforms.

### How It Works

```
Connected Platforms (Spotify, YouTube, TikTok, Instagram)
        â
        â¼
âââââââââââââââââââââââââââââââââââââââââââââ
â  PlatformDataService                       â
â  Aggregates real API data â TrackAnalytics â
ââââââââââââââââââââ¬âââââââââââââââââââââââââ
                   â
                   â¼
âââââââââââââââââââââââââââââââââââââââââââââ
â  ViralScoreService                         â
â  Weighted composite score (0-100):         â
â  Save Rate (35%) + Completion (25%) +      â
â  Repeat Listeners (20%) + Playlist (10%)   â
â  + Shares (10%)                            â
ââââââââââââââââââââ¬âââââââââââââââââââââââââ
                   â
                   â¼
âââââââââââââââââââââââââââââââââââââââââââââ
â  GrowthPatternService                      â
â  8 pattern archetypes + confidence scores  â
â  Alerts: breakout_candidate, velocity,     â
â  creator_trend_detected                    â
ââââââââââââââââââââ¬âââââââââââââââââââââââââ
                   â
                   â¼
âââââââââââââââââââââââââââââââââââââââââââââ
â  14-Day Forecast (Logistic Growth Curve)   â
â  y = L / (1 + e^(-k(x - x0)))             â
â  Upper/lower confidence bounds             â
âââââââââââââââââââââââââââââââââââââââââââââ
```

### 8 Growth Pattern Archetypes

| Pattern | Trigger |
|---------|---------|
| `slow_burn_growth` | Consistent week-over-week compound growth |
| `72_hour_spike` | Sharp momentum spike within first 3 days |
| `creator_cascade` | TikTok/Reels creator adoption surge |
| `regional_spark` | Breakout in a specific geography before global |
| `playlist_ladder` | Accelerating playlist additions |
| `algorithm_cluster_expansion` | Viral algorithm recommendation cluster |
| `weekend_amplification` | Saturday/Sunday stream amplification pattern |
| `cross_platform_feedback_loop` | Synchronized multi-platform uplift |

### Platform Integrations

| Platform | API | Data |
|----------|-----|------|
| **Spotify** | Spotify Web API (PKCE OAuth) | Top tracks, audio features, recently played, stream history |
| **YouTube** | YouTube Analytics API v2 (Google OAuth) | Real views, watch time, subscribers, geographic breakdown |
| **TikTok** | TikTok Display API v2 (OAuth 2.0 via Cloud Functions) | Video views, likes, shares, account engagement |
| **Instagram** | Instagram Graph API (Facebook Login â long-lived token) | Reels plays, reach, impressions, saves |
| **Apple Music** | MusicKit JS *(coming soon)* | Streams, Shazam counts, radio airplay |

All platform OAuth tokens are stored encrypted in Firestore (`users/{uid}/analyticsTokens/{platform}`). The `PlatformConnector` UI provides a polished one-click connect/disconnect interface for each platform.

### Server-Side Token Security

```
Cloud Functions (functions/src/analytics/platformTokenExchange.ts)
âââ analyticsExchangeToken   â code â token exchange (Spotify PKCE, TikTok, Instagram)
âââ analyticsRefreshToken    â rotate expired tokens
âââ analyticsRevokeToken     â revoke + delete from Firestore

GCP Secret Manager secrets:
  SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
  TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
  META_APP_ID / META_APP_SECRET
```

Client secrets are **never exposed to the browser** â all token operations route through server-side Cloud Functions.

---

## ð indiiREMOTE: Global Edge Computing

indiiREMOTE transforms your desktop into a globally accessible, private edge server. It replaces the legacy Cloud Relay (Firebase) middleman with a true, low-latency, end-to-end encrypted connection between your mobile device and your Mac Studio.

### How It Works

Instead of relying on cloud databases to relay commands, the indii Electron app silently boots a native Node.js Express server on port `3333` and maps it directly to the global internet via an encrypted **Ngrok Tunnel**.

```
ð± Phone (Anywhere on Earth)
        â
        â¼ (HTTPS / WSS)
âââââââââââââââââââââââââââââââââââââââââââââ
â  Ngrok Secure Global Edge Network         â
â  End-to-End Encrypted Tunnel              â
ââââââââââââââââââââ¬âââââââââââââââââââââââââ
                   â
                   â¼ (localhost:3333)
âââââââââââââââââââââââââââââââââââââââââââââ
â  IndiiRemoteService (Electron Main)       â
â  Express Server + WebSocket Router        â
ââââââââââââââââââââ¬âââââââââââââââââââââââââ
                   â
                   â¼ (IPC Bus)
âââââââââââââââââââââââââââââââââââââââââââââ
â  indii Desktop React App                â
â  Mainframe Execution                      â
âââââââââââââââââââââââââââââââââââââââââââââ
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Zero-Install Thin Client** | The phone UI is a blazing-fast, standalone React SPA served directly from your Mac. No App Store download required. |
| **Direct WebSocket Sync** | Sub-millisecond latency. AI generation progress, memory utilization, and desktop state sync directly to your phone. |
| **Secure PIN Auth** | The IPC bridge generates a cryptographic, single-use 6-digit Session Passcode unique to each boot. |
| **No Cloud Database** | No Firebase reads/writes. The pipeline bypasses third-party databases, ensuring total privacy for unreleased assets. |
| **Instant QR Provisioning** | Navigating to the `Mobile Remote` tab visually generates the Ngrok QR code in real-time, masking complex IP routing from the user. |

---

## ð¦ Core Modules (36)

indii ships with 36 lazy-loaded modules organized across four domains:

### ð¨ Creative Studios

| Module | Route | Description |
|--------|-------|-------------|
| **Creative Director** | `/creative` | Infinite Fabric.js canvas for AI image generation (Gemini 3 Pro Image), product visualization, and asset editing |
| **Video Producer** | `/video` | Production-grade pipeline for **Veo 3.1** video synthesis with Director's Cut QA step |
| **Workflow Lab** | `/workflow` | Node-based automation editor (React Flow) to chain AI tasks into repeatable recipes. Fully wired: Art, Video (text-to-video / img2vid / extend), Marketing, Social, Campaign, Knowledge Base departments + Router, Gatekeeper, and Variables logic nodes |
| **Design Studio** | `/design` | Brand-first design system for consistent visual identity |
| **Capture** | `/capture` | Quick-capture tool for ideas, references, and inspiration |

### ð Business Operations

| Module | Route | Description |
|--------|-------|-------------|
| **Distribution** | `/distribution` | Direct Proprietary Ingestion delivery to DSPs (Merlin, Apple, Spotify, Amazon, Tidal) â no aggregator middlemen |
| **Release Manager** | `/release` | End-to-end release lifecycle: metadata, artwork, scheduling, delivery, and QC |
| **Finance** | `/finance` | Streaming revenue tracking, waterfall royalty splits, and automated payout calculations |
| **Royalty** | `/royalty` | Detailed royalty statement parsing, reconciliation, and split management |
| **Legal** | `/legal` | AI-powered contract review (score + risk extraction), rights management, IP protection. Analysis history is persisted to Firestore and restored on every page load |
| **Licensing** | `/licensing` | Sync licensing deal management and opportunity matching |
| **Publishing** | `/publishing` | Music publishing dashboard â song registration and rights administration |
| **Commerce** | `/commerce` | E-commerce integration for direct-to-fan sales |
| **Merchandise** | `/merch` | Merchandise and print-on-demand (POD) integration |

### ð£ Marketing & Growth

| Module | Route | Description |
|--------|-------|-------------|
| **Marketing** | `/marketing` | Campaign execution, AI copywriting, and brand asset management |
| **Brand Manager** | `/brand` | Brand kit management â logos, colors, fonts, voice guidelines |
| **Campaign Manager** | `/campaign` | Multi-channel campaign planning and execution |
| **Social** | `/social` | Cross-platform social media management and scheduling |
| **Publicist** | `/publicist` | Press release generation, media outreach, and PR management |
| **Showroom** | `/showroom` | Public-facing portfolio for showcasing releases and brand |

### ð ï¸ Intelligence & Tools

| Module | Route | Description |
|--------|-------|-------------|
| **Agent Tools** | `/agent` | Hub for Agent Swarm interactions and specialist agent routing |
| **Memory Agent** | `/memory` | Always-On Memory dashboard â memory timeline, insights, and query interface |
| **Knowledge Base** | `/knowledge` | Searchable knowledge repository for artists and labels |
| **Audio Analyzer** | `/audio-analyzer` | Deep audio analysis â BPM, key detection, timbre analysis via Essentia.js |
| **Road Manager** | `/road` | Tour logistics, fuel calculations, venue discovery, and route planning |
| **Files** | `/files` | Integrated file manager for project assets |
| **Marketplace** | `/marketplace` | Marketplace for beats, samples, presets, and services |
| **Web3** | `/web3` | Blockchain integration for NFTs and decentralized rights |
| **Analytics** | `/analytics` | **Growth Intelligence Engine** â viral scoring, growth pattern detection, 14-day breakout forecasts, cross-platform analytics (Spotify, YouTube, TikTok, Instagram) |
| **Dashboard** | `/dashboard` | Central command â KPIs, recent activity, and quick actions |
| **Investor** | `/investor` | Investor-facing data room and pitch materials |
| **Observability** | `/observability` | System health monitoring and AI agent performance tracking |
| **History** | `/history` | Full activity log and audit trail |
| **Settings** | `/settings` | User preferences, organization management, and integrations |
| **Onboarding** | `/onboarding` | AI-driven onboarding flow with brand kit setup |
| **Debug** | `/debug` | Developer tools and system diagnostics |

---

## ð Security & Compliance

### Privacy & Legal

- **GDPR Compliant** â Right to erasure, data portability, and explicit consent management
- **CCPA/CPRA Compliant** â "Do Not Sell My Personal Information" toggle with opt-out tracking
- **COPPA Aware** â Age verification gate during onboarding
- **Cookie Consent** â Granular consent banner with essential/analytics/marketing categories
- **Legal Pages** â Auto-generated Privacy Policy, Terms of Service, and Cookie Policy

### Security Hardening

- **HSTS Headers** â Strict Transport Security enforced via Firebase hosting
- **Sentry Integration** â Real-time error monitoring with PII scrubbing
- **Secret Scanning** â Automated gitleaks checks in CI/CD pipeline
- **App Check** â Firebase App Check for API abuse prevention
- **Context Isolation** â Electron runs with hardened sandbox and context isolation enabled
- **R2A2 Scanning** â Reflective Risk-Awareness scanning for prompt injection attacks

### API Credentials Policy

Firebase API keys are **identifiers, not secrets** â security is enforced via Firestore/Storage Security Rules. True secrets (Stripe keys, service accounts) are managed exclusively through environment variables and never committed to source control. See [`docs/API_CREDENTIALS_POLICY.md`](docs/API_CREDENTIALS_POLICY.md) for the full policy.

---

## ð Tech Stack

### Frontend & Desktop

| Category | Technology | Notes |
|----------|-----------|-------|
| UI Framework | React 18 | Lazy-loaded modules via `React.lazy()` |
| Build | Vite 6.4 | Port 4242 for dev, terser minification in prod |
| Styling | TailwindCSS 4.1 | CSS-first config with `tailwind-merge` + `clsx` |
| State | Zustand 5.0 | Slice-based store pattern with persistence |
| Animation | Framer Motion 12.x | Micro-animations and page transitions |
| Canvas | Fabric.js 6.9 | Infinite canvas image editing |
| Graph Editor | React Flow 11.11 | Node-based workflow automation |
| Audio | Wavesurfer.js 7.11 + Essentia.js | Analysis and visualization |
| Video | Remotion 4.0 | Programmatic video rendering |
| 3D | Three.js 0.182 | `@react-three/fiber` integration |
| Charts | Recharts 3.6 | Data visualization |
| Router | React Router 7.11 | URL-synced navigation |
| UI Kit | Radix UI + Lucide Icons | Accessible primitives |
| Desktop | Electron 33 | Hardened sandbox, context isolation |

### Backend & AI

| Category | Technology | Notes |
|----------|-----------|-------|
| Cloud Functions | Firebase Functions 7.0 (Gen 2) | Node.js 22 runtime |
| AI SDK | `@google/genai` 1.30 + Genkit 1.26 | Unified Google Gen AI SDK |
| AI Models | Gemini 3 Pro / Flash / Image | See [Model Policy](MODEL_POLICY.md) |
| Video AI | Veo 3.1 | `veo-3.1-generate-preview` |
| TTS | Gemini 2.5 Pro TTS | `gemini-2.5-pro-tts` |
| Embeddings | `text-embedding-004` | Vector similarity search |
| Jobs | Inngest 3.46 | Reliable background task orchestration |
| Payments | Stripe 20.1 | Subscription billing and payouts |
| Database | Firestore | Real-time sync with security rules |
| Storage | Firebase Storage | Media assets with security rules |
| Analytics | BigQuery | Revenue analytics pipeline |
| Distribution | Proprietary Ingestion IP 4.3 | Direct DSP delivery via SFTP |

### AI Model Policy

All AI interactions follow a strict model policy. Manual model string hardcoding is forbidden â always use `AI_MODELS` from `@/core/config/ai-models`.

| Task | Model | Thinking Level |
|------|-------|---------------|
| Complex Reasoning | `gemini-3-pro-preview` | HIGH |
| Fast Routing | `gemini-3-flash-preview` | MEDIUM |
| Image Generation | `gemini-3-pro-image-preview` | â |
| Video Generation | `veo-3.1-generate-preview` | â |
| Text-to-Speech | `gemini-2.5-pro-tts` | â |

> **Banned Models:** `gemini-1.5-*`, `gemini-2.0-*`, `gemini-pro`, `gemini-pro-vision` â runtime validation enforces this.

---

## ð ï¸ Getting Started

> **Fastest path:** See the [â¡ Quick Start](#-quick-start-15-minutes) section at the top.

### Prerequisites

- **Node.js:** >= 22.0.0
- **Make:** Pre-installed on macOS/Linux (Windows: use WSL or Git Bash)
- **Firebase CLI:** `npm install -g firebase-tools`
- **Docker:** (Optional) Required for Agent Zero Sidecar execution

### Installation

```bash
git clone https://github.com/new-detroit-music-llc/indii-Alpha-Electron.git
cd indii-Alpha-Electron
make prime                 # installs deps + runs health check
```

### Environment Setup

Copy `.env.example` to `.env` and provide your API keys:

```bash
cp .env.example .env
```

**Required:**

| Variable | Purpose |
|----------|---------|
| `VITE_API_KEY` | Gemini / Google AI key |
| `VITE_FIREBASE_API_KEY` | Firebase project identifier |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |

**Optional:**

| Variable | Purpose |
|----------|---------|
| `VITE_VERTEX_PROJECT_ID` | Vertex AI project |
| `VITE_VERTEX_LOCATION` | Vertex AI region |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps |
| `VITE_SKIP_ONBOARDING` | Skip onboarding in dev |
| `VITE_FIREBASE_APP_CHECK_KEY` | App Check (required in prod) |
| `VITE_SPOTIFY_CLIENT_ID` | Growth Intelligence: Spotify OAuth (PKCE) |
| `VITE_TIKTOK_CLIENT_KEY` | Growth Intelligence: TikTok OAuth public key |
| `VITE_META_APP_ID` | Growth Intelligence: Instagram/Facebook App ID |

### Development

```bash
# Fastest: Vite-only renderer (no Electron overhead)
make dev-web               # Port 4243, instant hot reload

# Full stack: Vite + Electron
make dev                   # Port 4242 + Electron shell

# Health check (run if anything feels wrong)
make doctor
```

### Building

```bash
make build                 # Fast production build (Vite only)
make build-ci              # Gated: typecheck + lint + build
make ship                  # Full pipeline: lint â typecheck â test â build â deploy

# Desktop targets
npm run build:desktop:mac  # macOS (DMG/ZIP)
npm run build:desktop:win  # Windows (NSIS)
npm run build:desktop:linux # Linux (AppImage)
```

### Task Runner (`Makefile`)

All common operations are wrapped in the root `Makefile`. Run `make help` to see every target:

```
  build           Production build (Vite + electron-vite, fast)
  build-ci        CI build: typecheck + lint + build (gated)
  clean           Remove build artifacts and caches
  dev             Start full Electron dev environment (:4242)
  dev-web         Start Vite renderer only â no Electron (:4243)
  doctor          Run unified environment health check
  fix             ESLint auto-fix all packages
  lint            ESLint all packages
  nuke            Nuclear clean: rm node_modules + dist + reinstall
  prime           Full setup â install, doctor check, start dev server
  ship            Full ship pipeline: lint â typecheck â test â build â deploy
  test            Run Vitest unit tests (watch mode)
  test-ci         Run Vitest once (CI mode, no watch)
  test-e2e        Run Playwright E2E tests (Chromium)
  typecheck       TypeScript type check (all packages)
```

---

## ð Automation & Scripts

The project includes a rich catalog of 20+ automation scripts for environment setup, data seeding, and diagnostics.

| Command | Action |
| :--- | :--- |
| `npm run doctor` | Run the unified health check (recommended after setup) |
| `npm run scripts` | View the full **[Scripts Catalog](scripts/SCRIPTS_CATALOG.md)** |
| `scripts/env-guardian.sh` | Backup/Restore your sensitive environment variables |

**Protip:** Use `npx ts-node scripts/FILENAME.ts` to run any TypeScript utility in the `scripts/` folder.

---

## ð§ª Testing & Quality

indii maintains a **"Zero-Regression"** policy with multi-layer testing:

```bash
npm test                   # Vitest in watch mode
npm test -- --run          # Vitest once (CI mode)
npm run test:e2e           # Playwright E2E (60+ specs)
npm run lint               # ESLint check
npm run typecheck          # TypeScript type checking
```

| Layer | Tool | Coverage |
|-------|------|----------|
| **Unit** | Vitest (jsdom) | Service logic, store slices, utilities |
| **E2E** | Playwright | 60+ critical path specs (agent flows, creative persistence, mobile responsiveness) |
| **Accessibility** | axe-core 4.11 | WCAG 2.1 AA compliance |
| **Security** | gitleaks | Automated secret scanning in CI |
| **AI Agent** | Custom stress tests | "The Gauntlet" protocol for agent reliability |

### The Two-Strike Pivot Rule

If a fix fails verification **twice**:

1. **STOP** the current approach
2. **Re-diagnose** with extensive logging
3. **Propose** a fundamentally different solution
4. **Never** pivot to the "easy way out"

---

## ð¢ Deployment

### CI/CD Pipeline (GitHub Actions)

```
Push to main â Lint â Unit Tests â E2E Tests â Build Landing â Build Studio â Deploy to Firebase
```

| Target | Platform | Hosting |
|--------|----------|---------|
| Studio App | Web (SPA) | Firebase Hosting â `dist/` |
| Landing Page | Web | Firebase Hosting â `landing-page/dist/` |
| Desktop (macOS) | Electron | DMG/ZIP distribution |
| Desktop (Windows) | Electron | NSIS installer |
| Desktop (Linux) | Electron | AppImage |
| Cloud Functions | Firebase Functions | GCP Cloud Run (Gen 2) |

---

## ð Project Structure

```
indii-Alpha-Electron/
âââ src/                    # React application source
â   âââ core/               # App infrastructure (store, contexts, themes)
â   âââ modules/            # 36 lazy-loaded feature modules
â   âââ services/           # 40+ business logic services
â   âââ components/         # Shared UI components (Radix-based)
â   âââ hooks/              # Custom React hooks
â   âââ lib/                # Utility libraries
â   âââ types/              # TypeScript type definitions
â   âââ config/             # App configuration
âââ agents/                 # 17 AI agent definitions (A2A swarm)
âââ execution/              # Deterministic scripts (Layer 3)
âââ directives/             # AI agent SOPs (Layer 1)
âââ python/                 # Python tools and API handlers
âââ functions/              # Firebase Cloud Functions (Gen 2)
âââ electron/               # Electron desktop wrapper
âââ e2e/                    # Playwright E2E tests (60+ specs)
âââ landing-page/           # Marketing site (React + Vite)
âââ docs/                   # Documentation
âââ scripts/                # Build and utility scripts
```

---

## ð Documentation

For deep-dives into specific subsystems:

| Document | Description |
|----------|-------------|
| [Architecture Standard](directives/architecture_standard.md) | 3-layer architecture guidelines |
| [Agent Stability Protocol](directives/agent_stability.md) | Agent reliability standards |
| [Proprietary Ingestion Implementation Plan](docs/PROPRIETARY_INGESTION_IMPLEMENTATION_PLAN.md) | Distribution engine specification |
| [Model Usage Policy](MODEL_POLICY.md) | AI model selection and enforcement |
| [API Credentials Policy](docs/API_CREDENTIALS_POLICY.md) | Security policy for credential management |
| [Production Checklist](docs/PRODUCTION_300.md) | 300+ item production readiness audit |

---

## ð Recent Updates

### v1.50.0 â Developer Experience & CI/CD Hardening (April 2026)

**42 commits, 196 files changed, +9,628 / â3,524 lines** â this release is a top-to-bottom engineering quality overhaul.

#### ð ï¸ 10/10 Developer Experience Overhaul

The entire development workflow has been rebuilt around a single `Makefile` entry point and automated quality gates:

| Tool | Purpose |
|------|---------|
| `Makefile` (15 targets) | `make prime`, `make dev-web`, `make ship` â zero guesswork |
| `scripts/doctor.sh` | Unified health checker â Node, Python, Git, .env, dep sanity |
| Husky `pre-push` hook | Gates every push behind `typecheck` + `lint` â broken code stays local |
| Husky `commit-msg` hook | Enforces Conventional Commits â non-conforming messages are rejected |
| `.editorconfig` | Consistent formatting across all editors |
| VS Code settings | Recommended extensions, format-on-save, import sorting |
| `CONTRIBUTING.md` | Complete contribution guide with branch naming, PR checklist, testing standards |
| `ONBOARDING.md` | Day-1 engineer onboarding â zero-to-running in 15 minutes |
| `SCRIPTS_CATALOG.md` | Documented catalog of 20+ automation scripts |

#### ð§ª CI/CD Pipeline Stabilization

The deployment pipeline has been hardened from end to end:

- **Vitest Workspace Migration** â Replaced fragile negative-include globs with an explicit `vitest.workspace.ts` pattern, eliminating stale test discovery
- **533 test files, 2,952 tests passing** â all unit tests green in CI mode
- **Deploy pipeline fixes** â Added missing `build:studio` script, corrected `dist/` paths, bumped bundle size threshold to 25MB for Electron builds
- **Legacy workflow cleanup** â Deleted duplicate `main_deploy.yml` to stop double pipeline triggers
- **firebase-admin / firebase-functions mocks** â Shared centralized mocks prevent import-time crashes in the test environment

#### ð¤ Autoagent Phase A â Sidecar Harness

Introduced the Conductor autoagent experiment loop â a sidecar harness that profiles prompt performance and generates optimization candidates for the indii Conductor routing prompt.

#### ð¥ï¸ Desktop Auto-Update Channel

Electron now supports a UI toggle for auto-update channels (stable/beta), enabling controlled staged rollouts for desktop releases.

#### ð Music Training Dataset Rewrite

Rewrote the music agent training dataset to remove DAW/mixing scenarios and enforce baseline audio intelligence capabilities.

#### ð Repository Sealing

- Added `LICENSE` (Proprietary, Â© 2026 New Detroit Music LLC)
- Added `/1percent` workflow â the "Final 1%" sealing protocol for release readiness
- Bundle size, branch protection, and secret scanning verified

---

### v1.49.0 â Production Hardening & TypeScript Strict Mode (MarchâApril 2026)

The codebase now enforces a zero-tolerance `any` ban across all production files.

**28 type casts eliminated** from the Road Manager module, introducing clean typed interfaces:

| Interface | Purpose |
|-----------|---------|
| `FuelLogistics` | Fuel cost and stop estimation for tour legs |
| `NearbyPlace` | Venue discovery result from Google Maps |
| `LogisticsReport` | Tour logistics summary object |

Chart tooltip handlers in `PlatformBreakdown` and `WaterfallChart` are now strictly typed â no silent `unknown` payloads in the render layer.

A `pre-push` git hook gates every push behind `npm run typecheck` + `npm run lint`. Broken code stays local.

**Memory Inbox** â approve or reject digital handshakes from the Dashboard without leaving your current module.

**Stripe Webhooks** â 10/10 test coverage now exists for all webhook event types (subscription lifecycle, payment events, trial expiry, checkout completion).

---

### v0.1.0-beta.2 â March 2026

**TypeScript Type Safety Sweep**

Systematic resolution of `possibly undefined` (TS18048, TS2532, TS2322) errors across the entire codebase â production services and test files alike. This eliminates an entire class of runtime risks where array indexing, `Record` lookups, and dynamic property access were unguarded.

| Category | Files Fixed | Errors Resolved |
|----------|-------------|-----------------|
| Service Layer | `SceneExtensionService`, `GrowthPatternService`, `DashboardService`, `ERNMapper`, `ISRCService`, `MasteringService`, `ENSIdentityService` | ~40 |
| UI Components | `BannerAnimations` (Remotion) | ~17 |
| Test Files | `VenueScoutService.test`, `AnnotationPalette.test`, `CreativeDaisychain12.test` | ~10 |

Key patterns addressed:

- **Array bounds assertions** â Non-null assertions (`!`) for loop-bounded index access where length is pre-validated
- **Record lookup narrowing** â Explicit type annotations and nullish coalescing for dynamic `Record<string, T>` access
- **Tuple destructuring** â `as const` and tuple-typed assertions for fixed-length array destructuring
- **Snapshot empty checks** â Non-null assertions after Firestore `snapshot.empty` guards

**Workflow Lab â Full Node Execution**

The `WorkflowEngine` now executes every node type with real service calls:

| Node | Handler |
|------|---------|
| Art Department | `ImageGenerationService.generateImages()` |
| Video Department | `VideoGenerationService.generateVideo()` â text-to-video, image-to-video (`img2vid`), and extend-video jobs |
| Marketing Department | Gemini AI copywriting (multimodal: text or image input) |
| Social Media Department | AI caption generation â `SocialService.createPost()` as a DRAFT |
| Campaign Manager | Gemini strategy generation |
| Knowledge Base | Agentic RAG workflow |
| Router (Logic) | Evaluates a `$data`-interpolated condition and routes the `true`/`false` edge |
| Gatekeeper (Logic) | Pauses execution at `WAITING_FOR_APPROVAL`; the UI calls `engine.resolveGatekeeper(nodeId, approved)` to resume. Auto-rejects after 5 minutes to prevent hung workflows |
| Variables set/get | Shared blackboard `Map` â store named values and retrieve them in downstream nodes |

**Legal Module â Persistent Analysis History**

- `LegalService.saveAnalysis()` / `getAnalyses()` added â contract analyses are now stored in Firestore under `users/{uid}/contract_analyses`.
- `LegalDashboard` loads the 20 most recent analyses on mount, so the history panel is populated immediately instead of being blank on every page load.
- Persistence is fire-and-forget â failures are logged as warnings and never surface to the user.

**Remote Relay Hardening & Telegram Bot Adapter**

- **Infrastructure Hardening:** Audited and corrected all GCS storage bucket references across 7+ files to point to the production `indii-alpha-electron` bucket, eliminating CI/CD deployment conflicts. Re-enabled and successfully deployed all 8 previously disabled Cloud Function exports (resolving Gen 1/Gen 2 conflicts).
- **Multi-Channel Architecture (Phase 2):** Designed and deployed a robust HTTPS webhook adapter for the Telegram Bot API (`telegramWebhook`), bridging external messages directly into the existing Firestore `remote-relay-commands` pipeline.
- **Secret Management:** Integrated `TELEGRAM_BOT_TOKEN` securely via GCP Secret Manager with Cloud Functions IAM bindings, ensuring no secrets are exposed in the codebase.

---

### v0.1.0-beta.3 â April 2026

**Indii Growth Protocol & Meta Andromeda Pipeline**

- **Creative Studio Integration**: Integrated the 15-variant (10 images, 5 videos via Veo 3.1) Meta Andromeda batch generation pipeline.
- **Automated Deployment**: Andromeda directly interfaces with `AdAutomationService` to seamlessly deploy variants to Meta networks (Instagram exclusively) for algorithmic A/B testing and stream-velocity spikes.
- **Dashboard Observability**: Real-time viral scoring, algorithmic velocity trends, and CPS Kill-Switch status indicators are now natively integrated into `PlatformCard.tsx`.

**Command Bar Enhancements (UI/UX)**

- **Slash Commands**: Introduced `/deploy-andromeda` and `/status-blitz` intercepts directly in the Command Bar (`PromptArea.tsx`).
- **Accessibility**: 100% WCAG 2.1 AA compliance achieved on dynamic UI elements and Delegate Menus, verified by automated `jest-axe` tests.

**Indii Conductor (Agentic Harness) Hardening**

- **Persistent Worflows (`WorkflowStateService`)**: Replaced in-memory orchestration with Firestore-backed execution tracks (`users/{userId}/workflowExecutions`). Multi-agent workflows are now fully resumable across session reloads and crash-resistant.
- **Risk-Aware Tool Governance (`ToolRiskRegistry`)**: Migrated boolean `isDestructive` checks to a centralized 3-tier framework (`read`, `write`, `destructive`). Secure digital handshakes automatically enforce appropriate user-approval gates based on tool severity, providing safety for 103+ autonomous capabilities.

## âï¸ License

Proprietary. Â© 2026 New Detroit Music LLC. All Rights Reserved.

<div align="center">
  <sub>Built by Artists, for Artists. Powered by High-Intelligence.</sub>
</div>
