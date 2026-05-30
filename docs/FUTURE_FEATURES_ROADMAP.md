# indii Future Features Roadmap

> **Status:** High-level vision — not yet in development.
> These features extend the indii ecosystem beyond the core studio/distribution platform.

---

## 1. Social Music Platform — "Music 4.0 Community"

**Philosophy:** Based on the **1,000 True Fans theory**. Most music artists will never reach superstardom — indii is about building a *career*. The social platform extends that thesis by giving artists a direct relationship with their audience.

**Concept:**

- MySpace-style social network rebuilt for the modern era — super civil, all about the music
- Artists use Web3 features to create digital assets (token-gated content, collectibles)
- Integrated merch creator lets artists design and sell directly to fans on the platform
- Fan discovery driven by audio DNA: mood, energy, genre matching connects listeners to new artists
- No algorithmic suppression — artist-to-fan relationship is the core mechanic

**Revenue model:** Platform takes a percentage of merch/asset sales; subscription tiers for enhanced artist profiles.

---

## 2. Sync Licensing Marketplace

**Problem:** Content creators (YouTube, TikTok, podcasters) need quality music. Artists need income. Current licensing is opaque, expensive, and Content ID causes false strikes.

**Concept:**

- Transparent, upfront licensing deals — no Content ID surprises
- **Business model:** If a creator licenses a track for $1,000, they pay $1,100. The artist gets their *full* $1,000, indii takes a flat $100 service fee on top
- Targets YouTube creators, TikTok creators, and other content producers
- Easy deal placement → collection → done. No chasing, no disputes
- AI-driven matching: creator describes their video/content mood, DNA pipeline matches tracks from the artist catalog

**Differentiator:** Artist always gets 100% of the license price. Platform fee is transparent and additive, never subtractive.

---

## 3. Professional Services Marketplace

**Concept:** A music-industry-specific Fiverr — but curated and within the indii network.

**How it works:**

- indii members who offer professional services can list themselves:
  - Mastering engineers
  - Music attorneys
  - Session musicians
  - Graphic designers (album art)
  - Producers who offer mix/production services
  - PR specialists
- When AI-driven tools aren't enough, users can find a vetted human professional through the platform
- Booking, payment, and delivery all happen within the indii ecosystem
- Trust scores, portfolio verification, and member ratings

**Philosophy:** If we can do it with AI, we offer it. If you need a human, we connect you to one in our network.

---

## 4. Micro-Transactions & Credit-Based Purchases

**Problem:** A lower-tier user runs slightly over their quota — they don't need to upgrade their entire subscription, they just need a small top-up. 

**Concept:**

- Pay-as-you-go credit system for overages and one-off needs.
- **Credit Packs:** Users purchase "Indii Credits" via Stripe (e.g. $5 for 500 credits, $20 for 2500 credits).
- **Consumption Model:**
  - AI Generation (Image/Video): 10-50 credits per generation based on complexity.
  - Proprietary Ingestion IP submission (Distribution): 100 credits per track.
  - Audio Analysis/Mastering: 50 credits per track.
- **Ledger Integration:** The `MembershipService` ledger tracks credit balances alongside subscription quotas. A negative quota triggers the circuit breaker, prompting a credit purchase.
- **Auto-Top Up:** Optional setting to auto-purchase a credit pack when balance falls below a threshold.
- No forced upselling — respect the user's current tier choice.

**Implementation Architecture:** 
- **Stripe:** Use Stripe Payment Intents for one-off credit pack purchases.
- **Firestore:** `users/{uid}/wallet` collection to track credit balance. `users/{uid}/ledger` to log credit consumption and purchase events.
- **Security:** Cloud Functions enforce credit deduction atomically using transactions before fulfilling AI generation or distribution tasks.

---

## Priority & Sequencing

These features are all high-level and may develop in parallel or sequence depending on market demand and resource availability. They share infrastructure with the existing platform:

| Feature | Existing Foundation | New Build Required |
|---------|--------------------|--------------------|
| Social Platform | Web3 services, merch module, audio DNA | Full social frontend, fan profiles, feed system |
| Sync Licensing | Distribution pipeline, audio DNA matching | Licensing marketplace UI, contract automation |
| Services Marketplace | Legal module, payment infrastructure | Marketplace listings, booking, ratings |
| Micro-Transactions | Stripe integration, MembershipService | Credit system, per-feature pricing, usage metering |
