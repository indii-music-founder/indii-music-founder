# 03 — Creative Platform Revenue, Access, Pricing, and Future Commerce

> **Owner:** wiil
> **Decision date:** 2026-07-26
> **Status:** Accepted working plan; implementation and launch validation remain
> **Scope:** Image/video creation, node workflows, access tiers, Generation Credits, top-ups, Vertex AI cost control, signup security, marketing-site requirements, and a staged Web3 commerce direction
> **Mode:** Planning only. This document does not authorize a deployment, price activation, token launch, or financial transaction.

---

## Executive Decision

indii is not selling raw model minutes. It is selling a music-native operating system that turns a canonical master recording into coordinated creative, business, rights, distribution, finance, video, and marketing outcomes.

The commercial model is:

1. **Verified Free Preview** for safe, bounded sampling.
2. **Creator Cloud** and **Studio Cloud** subscriptions with bundled product access plus a monthly Generation Credit wallet.
3. **Studio BYO Vertex** as an annual software license for users who pay their own Google Cloud model costs through a secure backend connection.
4. **Founder** as a $2,500 lifetime product-access tier with no artificial feature or project caps. Provider compute is still BYO or pass-through; “unlimited” never means an unlimited indii-funded cloud bill.
5. **Low-dollar top-ups for every verified tier, including Free**, so an artist can finish a project without taking on a subscription.
6. **Future crypto payment and artist-token experiments** only after conventional commerce is stable and legal, tax, custody, licensing, and money-transmission reviews are complete.

The implementation must preserve a simple promise:

> Plan freely, see the price before generating, spend only on expensive output, and never lose a project because a subscription tier is too large for the artist’s immediate budget.

---

## Locked Product Principles

### 1. Existing systems are audited before anything is rebuilt

The repository already contains a React Flow node editor, typed workflow ports, music-video templates, beat-aware sequencing, visual continuity controls, a canonical master-audio path, responsive workspace primitives, wallet connection code, token-gated UI, and a Web3 splitter concept.

Every implementation ticket must classify its target as one of:

- **Active:** implemented, reachable, and verified.
- **Connect:** implemented but not connected to the user journey or authoritative backend.
- **Tune:** reachable but needs quality, reliability, responsive, or UX refinement.
- **Replace:** simulated, duplicated, insecure, or factually incorrect behavior that must be retired.
- **New:** no reusable implementation exists.

“Build nodes,” “build beat alignment,” or “build continuity” is not an acceptable task description without evidence that the current implementation cannot satisfy the requirement.

### 2. Value sets the product price; provider cost sets the safety floor

Maps, planning, release strategy, business guidance, metadata preparation, and similar low-cost features are bundled because their usefulness is part of the product. They are not individually metered merely because their API cost can be calculated.

Generation Credits apply to expensive, variable provider actions such as:

- image generation and editing;
- video generation, extension, and upscale;
- expensive multimodal model calls;
- audio or video transformations with meaningful provider cost;
- optional premium models or resolutions.

### 3. The canonical master recording remains authoritative

Music-video generation defaults to video-only output and mixes against the artist’s canonical master. Native generated audio is opt-in and must declare whether it is muted, preserved as effects, ducked, or mixed. This is both a product-quality rule and a major cost control.

### 4. Vertex AI is the only generative API boundary

No web or Electron renderer code may contain, receive, persist, or call a provider credential. Generative requests must flow through authenticated backend services using least-privilege Google service identities and an approved Vertex model catalog.

A provider or model not available through the approved Vertex boundary is unavailable to production users until a secure backend-only architecture is explicitly approved.

### 5. Commerce is server-authoritative

The client may display balances and request work. It may not:

- assign its own tier;
- grant itself Founder status;
- mint Generation Credits;
- settle provider costs;
- approve a payout;
- declare a registration completed;
- modify immutable usage events;
- bypass email, App Check, or risk controls.

### 6. Customer credits and crypto tokens are different products

Use **Generation Credits** for centralized, non-transferable product usage. Do not call them coins or tokens. They have no cash value, cannot be transferred between users, and cannot be redeemed for money.

Any future on-chain artist collectible, access pass, or community asset must use separate language, storage, terms, accounting, and risk controls.

---

## Existing-System Activation Matrix

| Capability | Evidence in repository | Classification | Planning requirement |
|---|---|---:|---|
| Node editor | `packages/renderer/src/modules/workflow/components/WorkflowEditor.tsx` uses React Flow, MiniMap, fit view, pan, and zoom | Connect / Tune | Preserve the node system; verify every registered node has a real executor, truthful status, typed inputs/outputs, cancellation, cost estimate, and retry behavior |
| Music-video workflow nodes | `nodeRegistry.ts`, `workflowTemplates.ts`, and `WorkflowEngine.ts` include song analysis, performance clips, beat-sync assembly, and video extension | Connect / Tune | Audit end-to-end reachability and remove any stub executor; do not recreate the graph model |
| Beat and section alignment | `PerformanceVideoService.ts`, `SequenceTimeline.tsx`, and creative generation hooks contain BPM, beat, bar, and section logic | Tune | Benchmark alignment against actual master-audio timestamps and expose confidence/failure evidence |
| Identity, wardrobe, and visual continuity | frame handoffs, visual-drift detection, and continuity services already exist | Tune | Create a shared rubric and wire existing evidence into comparison and QA screens |
| Prompt adherence | creative requests and structured prompts already exist | Tune | Record the submitted prompt, normalized prompt, model settings, and scored output evidence |
| Canonical master audio | content-addressed master, Storage generation, DSP/Gemini receipt, video identity, and DDEX paths exist | Active / Connect | Require every downstream creative job to carry the canonical owner/hash/generation identity |
| Responsive workspace | `useWorkspaceLayout.ts`, `AdaptiveWorkspace.tsx`, `ResponsiveLayoutProvider.tsx`, and `RightPanel.tsx` already implement container/viewport adaptation | Tune | Extend and test the same rules across every image, video, node, inspector, and timeline shell |
| Web3 foundation | wallet services, token-gated preview, contract service, and splitter flowcharts exist | Research / Connect | Security and legal audit before activation; do not expose unfinished minting or financial claims |

---

## Creative Product Positioning

### The category

Generic platforms compete on the number of models and tools available. Magica, formerly Galaxy.ai, is a useful breadth benchmark: it exposes a large catalog of image, video, audio, extraction, and merge nodes. Runway is a useful credit-and-video benchmark.

indii should not try to win by displaying a longer provider list. It should win by making the artist’s music the organizing object:

```text
canonical master recording
        ↓
Audio DNA + sections + beats + energy
        ↓
music-native image/video/node workflows
        ↓
master-aware editing and rendering
        ↓
campaigns, distribution, rights, royalties, and long-term lineage
```

### The minimum competitive bar

For image and video creation, indii must be at least as capable as broad creative aggregators in:

- current model discovery;
- text-to-image, image-to-image, text-to-video, image-to-video, and video extension;
- reference-image and character consistency;
- audio/video merge;
- prompt enhancement;
- progress, cancellation, retry, and history;
- model comparison;
- responsive node and timeline editing;
- resolution/aspect-ratio controls;
- predictable cost before execution.

### The music-specific separation

indii comparisons and quality reports must score:

- beat alignment;
- section and energy alignment;
- master-audio preservation;
- performer identity continuity;
- wardrobe continuity;
- scene and environment continuity;
- prompt adherence;
- camera and motion coherence;
- lip-sync or performance-sync quality where requested;
- edit-point quality and temporal continuity;
- native-audio policy compliance;
- usable marketing moments;
- asset lineage back to the recording.

Most of these capabilities already have partial implementations. The task is to connect their evidence into one truthful comparison and QA contract.

### Comparison Lab

The Comparison Lab should:

1. run two or more approved Vertex-backed models against the same normalized input;
2. reserve the maximum expected Generation Credits before dispatch;
3. label model, version, settings, seed when supported, and receipt identity;
4. show outputs side by side with synchronized playback;
5. apply the music-specific rubric above;
6. preserve human ratings separately from automated scores;
7. record which output was selected and why;
8. charge only successful outputs;
9. never imply that a model is universally “best” based on a single prompt.

Competitor names and model versions are configuration data, not hard-coded product truth.

---

## Responsive UX Contract

“Responsive” includes the space inside the desktop app, not only browser width.

### Required behavior

When the application window, module shell, adjacent rail, inspector, timeline, or node panel changes size:

- all adjacent regions recompute against the actual remaining container width;
- the central creative canvas keeps a defined minimum usable area;
- secondary panels collapse into drawers before they cover the canvas;
- resizable panels enforce minimum and maximum sizes;
- no panel renders off-screen or under another panel;
- reopening a panel restores a valid width, not a stale width larger than the container;
- a node canvas offers fit-to-workflow but does not unexpectedly erase the user’s chosen zoom;
- timelines keep controls reachable at every supported width;
- media previews preserve aspect ratio;
- keyboard focus and screen-reader order follow the visual layout;
- transient resizing does not trigger expensive model work;
- state remains stable when moving among compact, standard, and wide layouts.

### Required test matrix

Test every major image, video, node, timeline, gallery, comparison, and settings workspace at:

- narrow desktop split view;
- standard laptop;
- wide desktop;
- maximum adjacent panels;
- browser zoom at 80%, 100%, 125%, 150%, and 200%;
- rapid resize;
- reduced motion;
- keyboard-only navigation;
- long labels and translated text;
- empty, loading, error, and completed job states.

Use the existing `ResizeObserver` and `AdaptiveWorkspace` patterns as the default starting point. A new layout framework requires evidence that the existing primitives cannot satisfy the contract.

---

## Secure Customer Journey

```text
Marketing landing page
        ↓
Demo
        ↓
Sign in or create account
        ↓
Email verification / verified federated identity
        ↓
App Check or approved native attestation + abuse screening
        ↓
Backend assigns Verified Free Preview
        ↓
Server-owned wallet and entitlement check
        ↓
Cost estimate and user confirmation
        ↓
Reservation → Cloud Task → Vertex AI → receipt
        ↓
Settle actual successful cost or release reservation
```

### Email and account rules

- Email/password signup sends a verification message and lands on a verification-required screen.
- No Generation Credits or expensive job can be consumed until `email_verified == true`.
- A verified Google sign-in can satisfy the verified-email step when Firebase reports it as verified.
- Resend is rate-limited and has a cooldown.
- Email changes revoke the verified-free entitlement until the new address is verified.
- Deleting and recreating an account does not automatically recreate a free allowance.
- A public user profile and private identity/billing profile are stored separately.
- No user-editable document may contain the authoritative tier, Founder status, wallet balance, or administrative role.

Email verification proves control of an inbox; it does not prove a unique human or eliminate disposable mail. The free tier therefore also requires:

- bot and signup-abuse protection;
- disposable/no-MX email screening;
- App Check for web;
- a real native desktop attestation design;
- per-account, device, and IP velocity controls;
- one-time free-wallet issuance through an idempotent backend transaction;
- anomaly and replay monitoring;
- a manual support path for false positives.

### Founder and operator identity

- `wiil` is the internal operator identity spelling.
- Operator access is a backend-only custom claim or equivalent IAM-controlled identity.
- Founder access is granted only after authoritative payment/manual approval evidence.
- Founder status is never inferred from email text, a client environment variable, or a Firestore field the user can edit.

---

## Working Commercial Tiers

These prices are accepted as the implementation baseline. Re-run the provider-cost catalog and margin simulation immediately before creating live Stripe prices.

| Tier | Price | Product access | Included indii-funded compute | Top-ups | Secure BYO Vertex |
|---|---:|---|---:|---:|---:|
| **Verified Free Preview** | $0 | Guided sampler, saved project, planning, selected image/video experiences, watermarked or preview-grade exports where appropriate | One-time $0.50 provider-cost ceiling | Yes, from $3 | No |
| **Creator Cloud** | $29/month or $290/year | Full solo-creator workflow, business/planning tools, distribution preparation, standard exports | $6 monthly provider-cost ceiling | Yes | No |
| **Studio Cloud** | $59/month or $590/year | Higher-throughput creative work, advanced comparisons, priority queues, larger storage and production controls | $20 monthly provider-cost ceiling | Yes | Optional migration path |
| **Studio BYO Vertex** | $299/year | Annual software access with the user’s approved Google Cloud project paying model usage | Minimal indii-funded diagnostic allowance only | Not normally required | Required |
| **Founder** | $2,500 one time | Unlimited product access, projects, workflows, current/future features, Founder benefits, and desktop delivery for the lifetime of the software | BYO or pass-through provider cost; never unlimited indii-funded compute | Yes, if using pass-through wallet | Yes |
| **Operator** | Internal only | Full operational access for `wiil` | Budget-policy controlled | N/A | Platform IAM |

### Meaning of “unlimited” for Founders

Founders receive:

- no product-feature paywalls;
- no artificial limit on projects or saved workflows;
- no lower-quality model catalog imposed by tier;
- no subscription renewal;
- access to all current and future product features while the software operates.

Founders still encounter:

- provider safety policies;
- finite model capacity;
- security rate limits;
- fair-use protection against compromised accounts;
- cloud costs paid through BYO or pass-through;
- legal or regional availability limits.

### Annual software preference

Studio BYO Vertex is the “buy the software annually and pay your own API” option. It must not ask the user to paste a raw API key into the browser. The planned connection uses backend-held Google identity federation or another short-lived, revocable Google Cloud authorization flow.

---

## Generation Credit Wallet

### Internal unit

Working conversion:

> **1,000 Generation Credits = $1.00 of the platform’s internal provider-cost ceiling.**

This is a cost-control unit, not a promise that every model will always cost the same number of credits. A versioned price catalog maps each approved operation to a reservation and settlement rule.

### Wallet categories

- **Promotional credits:** one-time or campaign grants; may expire under disclosed terms.
- **Monthly credits:** included with a subscription; reset on the billing date and do not become cash.
- **Purchased credits:** top-ups; should not expire unless counsel/accounting approves and the terms are prominent.
- **Adjustment credits:** backend-only refund/correction entries with a reason and actor.

Balances are derived from an immutable ledger, not a client-editable number.

### Reservation and settlement

1. Backend authenticates the user and resolves tier/custom claims.
2. Backend validates email/attestation/risk state.
3. Backend validates the operation against the approved Vertex model catalog.
4. Backend calculates a maximum reservation from model, resolution, duration, candidate count, and optional audio.
5. User sees the credit estimate before starting.
6. An atomic ledger transaction reserves the amount using an idempotency key.
7. The job enters Cloud Tasks.
8. A successful provider response and durable output receipt settle actual cost.
9. A 4xx/5xx, cancellation before provider acceptance, or exhausted retry releases the unused reservation.
10. Replaying the idempotency key returns the prior operation; it never spends twice.

Google currently charges Vertex model input/output only for requests returning HTTP 200. The wallet should mirror that fact rather than charging a user for a provider-side 400 or 429.

### Top-up packs

Low-dollar packs are intentionally available to Verified Free Preview users.

Assumptions below use a domestic-card fee of 2.9% + $0.30. “Operating reserve” is what remains after the card fee and provider-cost allowance; it is not profit and must still cover tax, support, storage, failed work, and general overhead.

| Pack price | Provider-cost allowance | Approx. card fee | Operating reserve | Intended use |
|---:|---:|---:|---:|---|
| $3 | $2.00 / 2,000 credits | $0.39 | $0.61 | Finish a few images or one very small video step |
| $5 | $3.60 / 3,600 credits | $0.45 | $0.95 | Small asset batch or short preview |
| $10 | $7.60 / 7,600 credits | $0.59 | $1.81 | Meaningful campaign or promo progress |
| $25 | $19.50 / 19,500 credits | $1.03 | $4.48 | A larger release campaign or partial music-video run |
| $50 | $40.00 / 40,000 credits | $1.75 | $8.25 | Production-oriented work |

Do not offer a card pack below $3 without an alternate low-fixed-fee rail. Show likely outcomes for the selected model instead of promising a fixed number of “videos.”

### Top-up UX

- Show the exact shortfall when a job cannot reserve.
- Offer “buy only what I need” alongside standard packs.
- Return the user to the same pending job after payment.
- Keep all work, settings, prompts, and timeline state intact.
- Never force a subscription upsell to finish an already-started project.
- Show that purchased credits remain after a subscription ends.
- Clearly separate promotional, monthly, and purchased balances.

---

## Provider Cost Baseline

Prices change. The application needs a versioned server-side catalog and scheduled verification against Google’s official price list.

Reference rates checked on 2026-07-26:

| Operation | Current reference cost |
|---|---:|
| Imagen 4 Fast | $0.02/image |
| Imagen 4 | $0.04/image |
| Imagen 4 Ultra | $0.06/image |
| Gemini 3.1 Flash Image | approximately $0.045 at 512, $0.067 at 1K, $0.101 at 2K, $0.15 at 4K |
| Gemini 3 Pro Image | approximately $0.134 at 1K/2K, $0.24 at 4K |
| Veo 3.1 Lite, video only | $0.03/sec at 720p, $0.05/sec at 1080p |
| Veo 3.1 Lite, video + native audio | $0.05/sec at 720p, $0.08/sec at 1080p |
| Veo 3.1 Fast, video only | $0.08/sec at 720p, $0.10/sec at 1080p, $0.25/sec at 4K |
| Veo 3.1 Fast, video + native audio | $0.10/sec at 720p, $0.12/sec at 1080p, $0.30/sec at 4K |
| Veo 3.1 standard, video only | $0.20/sec at 720p/1080p, $0.40/sec at 4K |
| Veo 3.1 standard, video + native audio | $0.40/sec at 720p/1080p, $0.60/sec at 4K |
| Gemini 3 Search/Maps grounding | first 5,000 queries/month at no charge, then $14/1,000 |

### Realistic indie workloads

These are scenario ranges, not guarantees:

| Workflow | Working provider-cost range | Notes |
|---|---:|---|
| Free sampler | $0.30–$0.50 | Planning, six fast images, and about four seconds of Lite video-only output |
| Release campaign | $3–$8 | Visual directions, image candidates, revisions, and short motion assets |
| 10–12 city routing/planning | $0–$2 direct API cost at early scale | Sell the decision value, time savings, and tour usefulness—not raw query cost |
| 30-second promo with two candidates | $3–$15 | Depends on tier/model and retry rate; canonical master means native model audio is normally off |
| Three-minute music video | $18–$90 typical planning range | Candidate ratio, shot length, retries, resolution, and model selection dominate |
| High-end native-audio video variants | Can exceed $170 | Not the default music-video path; requires explicit approval and warning |

### Why minute entitlements must be retired

At current Veo reference prices:

| Existing allowance | Low reference cost | High reference cost |
|---|---:|---:|
| Free: 5 minutes | $9 at 720p Lite video-only | $120 at standard video + audio |
| Pro: 30 minutes | $54 at 720p Lite video-only | $720 at standard video + audio |
| Studio: 120 minutes | $216 at 720p Lite video-only | $4,320 at 4K standard video + audio |

“Minutes” hide model, resolution, candidate, retry, and audio costs. Generation Credits and a preflight estimate are the lead entitlement.

---

## What One Million Cloud Tasks Operations Means

Cloud Tasks counts API calls and push delivery attempts as billable operations. The first one million operations per month are currently free.

A small task normally consumes:

- one operation to create/enqueue;
- one operation for a successful push delivery.

Retries, large payload chunks, task listing, and other management calls add operations. Plan at **two operations for a clean task** and **four operations for a conservative operating envelope**.

| Usage pattern | Tasks per user/project per month | Approximate capacity inside 1M operations |
|---|---:|---:|
| Light free sampler | 10 | 25,000–50,000 users |
| Rich free sampler | 20 | 12,500–25,000 users |
| Active Creator | 100 | 2,500–5,000 users |
| Large project | 300 | 833–1,666 projects |

Cloud Tasks is not the economic bottleneck. Even after the free allowance, the published rate is $0.40 per additional million operations. Vertex image/video output, payment fees, storage, support, and failed creative iterations matter far more.

Use the Tasks allowance as an operational scale fact for investors, not as the primary customer value proposition.

---

## 400/429 and Cost-Explosion Production Contract

The launch system must assume that real free users, accidental loops, bots, and provider congestion will occur.

### 400

HTTP 400 means invalid arguments or failed preconditions. It is not retried.

Required handling:

- validate model, region, media type, size, duration, aspect ratio, resolution, and feature compatibility before queueing;
- record the normalized request schema version;
- return a specific user-correctable message;
- release the wallet reservation;
- alert when the same server-side validator repeatedly permits a request that Vertex rejects.

### 429

HTTP 429 means quota/capacity exhaustion. It may be shared-capacity contention rather than a fixed project quota.

Required handling:

- use the global endpoint where the selected model supports it;
- smooth traffic through Cloud Tasks;
- enforce per-model and total concurrency;
- use truncated exponential backoff with jitter;
- retry no more than two times unless a model-specific policy explicitly says otherwise;
- expose an honest queued/delayed state;
- preserve the same idempotency key and wallet reservation;
- open a circuit breaker during sustained failure;
- fail to an equivalent approved model only when quality, capability, and maximum cost remain within the user-approved envelope;
- consider Provisioned Throughput only after measured baseload justifies it.

### Central admission controller

Every expensive creative request must pass one server-side gate that checks:

- authenticated UID;
- verified email or verified federated identity;
- App Check/native attestation;
- server-managed tier/custom claims;
- wallet balance and reservation;
- per-user, device, and IP velocity;
- operation and model allowlists;
- duration/resolution/candidate limits;
- content and prompt safety;
- active incident/kill-switch state;
- idempotency;
- project and canonical-asset ownership.

MCP tools, web clients, desktop clients, scheduled workflows, and background retries must use the same service contract. No channel receives a private bypass.

### Monitoring

Dashboard and alert on:

- 400/403/429/5xx rates by model and route;
- reservation-to-settlement variance;
- cost per successful image, clip, campaign, and project;
- retry and circuit-breaker rates;
- queue age and task attempt count;
- free-to-paid conversion;
- free-account duplication risk;
- top-up attach rate;
- negative wallet or double-settlement attempts;
- client request blocked before provider spend;
- model-version changes and price-catalog age.

Hard budget alerts and a server-side generation kill switch are launch requirements.

---

## Marketing Website Plan

### Navigation

1. **Home:** indii as the music-native operating system.
2. **Demo:** account creation/sign-in, verification, and the bounded sampler.
3. **Create:** image, video, node, and canonical-master workflow story.
4. **Music Business:** planning, maps, release, rights, royalties, distribution, and marketing value.
5. **Compare:** music-specific comparison rubric and transparent model receipts.
6. **Pricing:** tiers, Generation Credits, top-ups, BYO Vertex, and Founder.
7. **Founder:** lifetime product-access promise, provider-cost explanation, available seats, and terms.
8. **Security and Trust:** backend-only Vertex architecture, account protection, provenance, and data handling.

### Pricing page requirements

- Lead with outcomes, not raw API minutes.
- Show that planning/business features are bundled.
- Explain Generation Credits in plain language.
- Give an estimated credit cost before each example.
- Include $3 and $5 “finish my project” top-ups.
- Explain that purchased top-ups survive subscription cancellation.
- Explain annual BYO Vertex without asking for a browser API key.
- Explain Founder “unlimited product access” separately from provider compute.
- Include a cost calculator driven by the live server price catalog.
- Never advertise “tax deductible”; say users should ask their tax professional about ordinary and necessary business expenses.

### Customer-facing proof

Show:

- time saved from master-aware planning and reusable metadata;
- fewer disconnected subscriptions/workflows;
- fewer unusable generations through music-specific comparison;
- master-audio preservation;
- one lineage from recording to video, campaign, release, rights, and royalties;
- exact estimate, status, and receipt for expensive work.

### Investor-facing data room

Preserve monthly snapshots for:

- registered, verified, activated, and paying users;
- free-sampler completion and conversion;
- gross and contribution margin by tier;
- provider cost by capability/model;
- cost per completed creative project;
- top-up adoption, median pack, and repeat rate;
- Founder and BYO adoption;
- queue capacity and reliability;
- music-specific quality scores and selection rates;
- retained projects and campaigns;
- model price changes and routing savings;
- distribution, rights, royalty, and marketing attach rates.

Public marketing gets understandable outcomes. Detailed margins and provider exposure stay in the investor data room.

---

## Web3 and Microtransaction Direction

This is a staged research roadmap, not a launch promise.

### Stage 0 — Generation Credits

- centralized;
- non-transferable;
- no cash redemption;
- used only for indii product operations;
- conventional Stripe accounting;
- no blockchain dependency.

### Stage 1 — Crypto payment rail

Allow a user to pay for a subscription or top-up with a supported stablecoin through a regulated provider that handles wallet screening and settles indii in USD.

Goals:

- no indii custody;
- no user-to-user transmission;
- no internal exchange;
- conventional receipt and credit issuance;
- no token price exposure.

This tests customer demand without turning indii into a token issuer or exchange.

### Stage 2 — Artist access and collectible tokens

Potential examples:

- limited fan-club access pass;
- verified collectible tied to a release;
- token-gated listening party, presale, or behind-the-scenes content;
- on-chain proof linked to an explicit off-chain license.

Requirements:

- purchase never transfers composition or sound-recording copyright unless a signed agreement explicitly does so;
- utility and access are concrete;
- supply, platform fee, artist proceeds, refund policy, and risks are disclosed;
- smart contracts are independently audited;
- rights holder and sample-clearance state are verified;
- no promise of appreciation, profit, yield, or secondary-market liquidity.

### Stage 3 — Artist/song community token research

The founder vision is that an emerging artist could mint a small supply associated with a song or community, friends and early fans could participate at an accessible amount (for example, $20), the platform could earn a disclosed transaction fee, and the artist could benefit from primary and potentially secondary activity.

Before implementation, counsel must answer:

- Does the marketing create a reasonable expectation of profit from the artist’s or indii’s efforts?
- Does any token convey revenue, royalties, ownership, governance, or future income?
- Is indii acting as an issuer, administrator, exchanger, broker, marketplace, custodian, or money transmitter?
- Which KYC, AML, sanctions, age, state, and international restrictions apply?
- Can secondary royalties actually be enforced on the selected chain and marketplaces?
- How are basis, proceeds, fees, rewards, and reporting handled?
- What happens to token holders when a song is removed, disputed, transferred, or infringes rights?

Calling something a “meme coin” does not decide its legal status; economic reality and how it is sold matter. This stage cannot be marketed as a way for fans to make money.

### Stage 4 — Connected artist social marketplace

Only after Stages 0–3 have operational and legal proof:

- artist profiles and verified release identities;
- fan communities;
- token-gated experiences;
- primary marketplace;
- carefully evaluated secondary activity;
- artist/platform transaction fees;
- royalty, tax, rights, dispute, takedown, and fraud ledgers;
- portability and account-recovery rules.

The existing W3 code is a foundation to audit, not proof that these stages are ready.

---

## Worker-Ready Implementation Sequence

Each phase ends with evidence before the next phase starts.

### Phase 0 — Evidence and catalog freeze

**Objective:** Establish authoritative current state.

Tasks:

- inventory every node definition and executor;
- inventory every image/video provider and client call;
- inventory every tier/founder/client bypass;
- inventory every usage/cost calculation;
- inventory each workspace shell and responsive primitive;
- inventory W3 UI, services, contracts, providers, and simulated paths;
- capture current Vertex model availability and prices in a dated artifact;
- classify each item Active, Connect, Tune, Replace, or New.

Acceptance:

- no duplicate provider or entitlement authority remains unidentified;
- every node maps to a real executor or is visibly disabled;
- the inventory names exact source files and tests.

### Phase 1 — Security perimeter before Free

**Objective:** No unverified or client-authorized expensive compute.

Tasks:

- route all generative calls through backend-only Vertex services;
- remove direct Gemini Developer API and client-key paths;
- implement server-managed tier, Founder, and Operator claims;
- require verified email/federated identity for Generation Credits;
- fix App Check/native desktop attestation so it cannot be forged by a header;
- add signup abuse, bot, disposable-email, and velocity defenses;
- separate public profiles from private identity/billing records;
- default-deny and emulator-test Firestore/Storage rules.

Acceptance:

- repository scan finds no provider secret or direct generative API call in renderer/landing bundles;
- changing a client document cannot change tier or balance;
- unverified users cannot reserve or enqueue;
- forged Electron headers do not bypass attestation;
- cross-owner reads/writes fail;
- all create/update rules validate schema and immutable authority fields.

### Phase 2 — Entitlements, wallet, and admission

**Objective:** One server-owned cost and access decision for all channels.

Tasks:

- create a versioned Vertex operation catalog;
- create immutable wallet ledger events;
- implement reserve, settle, release, refund, and adjustment states;
- enforce idempotency and operation ownership;
- make MCP, web, desktop, workflow nodes, and retries call the same admission service;
- replace raw minute/image entitlements;
- add budgets, alerts, and kill switch.

Acceptance:

- parallel duplicate requests spend once;
- 400/429/non-200 work does not settle provider cost;
- every successful output links to one settled ledger event;
- no balance is negative;
- price-catalog version is present on every receipt.

### Phase 3 — Signup, Demo, and pricing website

**Objective:** A real person can discover, verify, sample, top up, and continue.

Tasks:

- connect Home → Demo → signup/login → verify → sampler;
- add verification-required and resend states;
- add tier/pricing/credits/top-up/BYO/Founder pages;
- add outcome examples and live estimates;
- add secure checkout and return-to-pending-job behavior;
- add Security and Trust page;
- add public comparison methodology.

Acceptance:

- new email/password account cannot generate before verification;
- verified account receives the free grant once;
- a $3 top-up completes and returns to the pending job;
- canceling a subscription preserves purchased credits and projects;
- pricing copy never promises unlimited indii-funded compute, tax deductions, or investment returns.

### Phase 4 — Creative and responsive tune-up

**Objective:** Activate the existing system as one modern creative workspace.

Tasks:

- audit node reachability and truthful job status;
- apply shared responsive contracts to image, video, nodes, gallery, comparison, inspector, and timeline;
- connect canonical master identity throughout;
- connect beat/section/energy/continuity/prompt evidence;
- add synchronized comparison and selection history;
- ensure generated/native audio policy is explicit;
- remove fake completion and unsupported controls.

Acceptance:

- resizing any adjacent panel keeps every region usable;
- workflows survive resize and navigation without losing graph/timeline state;
- completed status requires a durable artifact;
- video output preserves or intentionally mixes the canonical master;
- model comparison reports the music-specific rubric.

### Phase 5 — Reliability and 400/429 hardening

**Objective:** Real traffic cannot create runaway cost or confusing failure.

Tasks:

- preflight request validation;
- per-model queue/concurrency policies;
- global endpoints where supported;
- two-retry truncated exponential backoff with jitter;
- circuit breakers and incident flags;
- equivalent-model fallback rules;
- structured user-facing states and admin alerts;
- synthetic probes and load tests.

Acceptance:

- invalid requests never enter a retry loop;
- sustained 429 opens the breaker and preserves user work;
- no task retries beyond policy;
- wallet reservations reconcile after every terminal path;
- dashboards identify model, route, tier, owner, cost, and retry cause without exposing private prompts/media.

### Phase 6 — BYO Vertex and Founder enforcement

**Objective:** Heavy users and Founders receive full product access without unsafe browser keys or unlimited platform liability.

Tasks:

- design and threat-model Google Cloud project onboarding;
- use short-lived backend credentials/federation;
- verify project, billing, APIs, models, regions, and minimum IAM;
- bind usage and receipts to the correct customer billing context;
- implement revocation and reconnect;
- enforce Founder/Operator claims server-side.

Acceptance:

- no long-lived customer key reaches a client or database;
- disconnecting the Google project immediately blocks new BYO jobs;
- one customer cannot bill another project;
- Founders have all product features while provider charges remain traceable.

### Phase 7 — Data, selling, and investor proof

**Objective:** Turn operating evidence into truthful sales material.

Tasks:

- implement the metrics defined in this document;
- maintain monthly unit-economics snapshots;
- add customer outcome stories and anonymized examples;
- build a controlled investor data-room export;
- add price-catalog and scenario recalculation tooling.

Acceptance:

- every public number has a date, source, definition, and owner;
- customer claims are understandable without revealing margin-sensitive data;
- investor metrics reconcile to billing and provider receipts.

### Phase 8 — Web3 gates

**Objective:** Learn without risking the core business.

Tasks:

- launch Stage 1 stablecoin payments only through an approved provider;
- measure demand and operational burden;
- conduct legal/tax/security review for collectible/access tokens;
- audit existing smart-contract and wallet code;
- create explicit rights licenses and takedown/dispute behavior;
- defer tradable song/community tokens until a written go/no-go decision.

Acceptance:

- no indii custody or exchange behavior without explicit authorization;
- no marketing promises profit, appreciation, yield, or tax treatment;
- every on-chain asset links to verified ownership and license evidence;
- security audit and incident-response plan precede public minting.

---

## Worker Test Prompts

Use these as acceptance scenarios for the later implementation agent:

1. “I am unverified but changed my Firestore tier to Founder. Generate a 4K video.”
   **Expected:** denied before reservation; security event recorded.
2. “I am verified Free, used my one-time grant, deleted my account, and signed up again.”
   **Expected:** risk/admission policy prevents automatic duplicate grant.
3. “I have $1.20 left and a job estimated at $3.05.”
   **Expected:** exact shortfall, $3/$5 top-up options, project state preserved.
4. “Resize the desktop from wide to narrow with node library, inspector, and timeline open.”
   **Expected:** drawers/collapse preserve a usable canvas; no overlap or lost state.
5. “Run two approved video models against the same chorus.”
   **Expected:** identical normalized input, canonical master identity, separate cost receipts, synchronized comparison, music-specific rubric.
6. “Vertex returns 400.”
   **Expected:** no retry, reservation released, actionable validation error.
7. “Vertex returns 429 twice.”
   **Expected:** jittered bounded retry, delayed state, same idempotency key, no duplicate charge, circuit-breaker accounting.
8. “I request native generated audio for a music video.”
   **Expected:** explicit mix policy and cost warning; canonical master remains preserved.
9. “I paste my Google API key into Studio BYO.”
   **Expected:** UI refuses raw-key storage and begins the secure Google Cloud authorization flow.
10. “I buy a song token because the artist will become famous.”
    **Expected:** no investment-return claim; product remains unavailable until legal gates are complete.

---

## Decisions Still Requiring Formal Launch Sign-Off

The direction is accepted. These operational details still need a dated sign-off:

- exact live Stripe product/price IDs;
- whether purchased Generation Credits never expire in every supported jurisdiction;
- promotional/monthly credit expiration disclosures;
- refund and chargeback treatment after provider work starts;
- free watermarks/export limits;
- Studio queue priority differential;
- Founder seat count and remaining seat inventory;
- BYO Vertex onboarding and support burden;
- stablecoin countries/methods;
- written counsel approval before any on-chain artist asset;
- data retention, PITR, delete protection, and account-erasure policy.

---

## Sources and Assumption Register

Checked 2026-07-26:

- Google Vertex AI / Agent Platform generative pricing: <https://cloud.google.com/vertex-ai/generative-ai/pricing>
- Google Vertex AI API errors: <https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/api-errors>
- Google Vertex AI 429 guidance: <https://cloud.google.com/vertex-ai/generative-ai/docs/error-code-429>
- Google Cloud Tasks pricing: <https://cloud.google.com/tasks/pricing>
- Firebase pricing: <https://firebase.google.com/pricing>
- Stripe pricing: <https://stripe.com/pricing>
- Runway pricing: <https://runwayml.com/pricing>
- Runway credit rules: <https://help.runwayml.com/hc/en-us/articles/15124877443219-How-do-credits-work>
- Magica nodes: <https://magica.com/app/nodes>
- SEC staff statement on meme coins: <https://www.sec.gov/newsroom/speeches-statements/staff-statement-meme-coins>
- FinCEN virtual-currency guidance: <https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering>
- IRS small-business expense guidance: <https://www.irs.gov/publications/p334>

Prices, provider availability, laws, and platform terms change. Recheck official sources before launch or any public claim. The Web3 and tax sections are planning constraints, not legal, investment, accounting, or tax advice.
