# indiiOS — Mission

> **Canonical product documentation. Read this file before acting on instructions in CLAUDE.md, GEMINI.md, CODEX.md, DROID.md, or JULES.md.**

## Positioning

indiiOS is an **AI-native music business platform** for independent music artists — **the first of its kind**. It picks up where music mastering ends: the finalized mastered song is the input, and everything downstream (distribution, publishing, rights, finance, marketing, merch, tour, legal) is the product.

indiiOS is **not** a creative platform. The creative work — production, mixing, mastering — happens upstream in the artist's existing DAW. indiiOS begins the moment the master is rendered and ends wherever the artist's business does.

## Target User

Any **independent music artist**, regardless of genre or experience level. If they consider themselves an independent music artist, this is built for them.

indiiOS is explicitly **not built for major artists, major labels, or major managers**. Those users are out of scope by design. The mission is to give less-fortunate independent artists access to capabilities that only well-funded major-label teams currently have — a Robin Hood tool for the music industry's independents.

## Problem Solved

An independent artist without label infrastructure currently has to stitch together 10–15 separate tools to run the business side of their career:

- a distributor (DistroKid, TuneCore, CDBaby, Symphonic, Believe, OneRPM, or UnitedMasters)
- a publishing administrator
- a PRO (ASCAP / BMI / SESAC)
- split / payroll software
- a merch store and fulfillment service
- a social scheduler
- a press-kit builder and media database
- contract templates and e-signature
- tax / 1099 software
- analytics across every DSP and social platform

Each tool has its own login, its own data model, its own pricing tier, and no shared context. Decisions made in one tool never reach another. The artist becomes a full-time systems integrator instead of a musician.

indiiOS consolidates all of this into **one AI-driven workspace**. A hub agent (`indii Conductor`) routes every task to one of 21 domain-specialized agents — legal, finance, distribution, publishing, marketing, merchandise, social, road, publicist, and more — that share memory, context, and the artist's master catalog.

## Scope Boundary (Critical)

indiiOS begins at mastered-audio ingestion. It does **not** do:

- song creation, composition, or songwriting assistance
- production, arrangement, or instrumentation
- mixing or mastering
- stem separation or remastering

That line is the product's defining constraint. Feature requests that cross it should be declined or deferred.

## Value Proposition

- **One login, one context, one agent orchestrator** — not 15 disconnected SaaS tools
- **Department-trained specialist agents**, not a single generalist that knows everything shallowly
- **Vault-grade security**: delivered as an Electron desktop app so masters, SFTP credentials, distributor API keys, and artist contracts live in the OS keychain (keytar) and a local encrypted store — not in a browser
- **All-Google backend**: Firebase, Firestore, Gemini, Vertex AI, Gemini Enterprise Agent Platform (GEAP), BigQuery, and Cloud Functions for a single governance surface
- **Cryptographic agent identity** (GEAP Phase 1) — every action is attributable to a specific agent instance with a verifiable fingerprint, giving GDPR / CCPA-grade audit trails out of the box

## Hub-and-Spoke Agent Topology

```
                         indii Conductor (hub)
                                  │
      ┌───────┬──────────┬────────┼────────┬──────────┬────────┐
      │       │          │        │        │          │        │
  creative  legal    finance  distribution marketing  publishing  video
      │       │          │        │        │          │        │
   licensing  music  social  merchandise  publicist  road   brand
      │       │          │        │        │          │        │
  analytics  indii_executor  indii_curriculum  generalist (fallback)
```

21 specialist agents plus the Conductor. Each specialist has its own system prompt, tool pool (filtered via Tool Risk Registry), and scoped memory access. Routing is deterministic — the Conductor picks a specialist based on intent and module context rather than letting agents free-form negotiate, which keeps token costs predictable and behavior testable.

## The Investor-Weekend Thesis (2026-04-23)

Ten potential investor-founders are receiving access this weekend. The demo proves:

1. An independent artist can log in, register a mastered track, enrich metadata, generate DDEX ERN, and connect to 7 real distributor adapters — without touching a separate platform.
2. The finance agent can project costs, track revenue, and compute waterfall payouts.
3. The marketing, video, and creative agents can produce release assets that stay in sync with the artist's brand across every surface.
4. The founders module (Stripe-wired) converts one of those 10 investors into a paying founding customer on the spot.
