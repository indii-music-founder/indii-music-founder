---
name: finance_royalties
description: Master guide to music revenue streams, DSP payouts, recoupment math, advance structures, and global royalty collection.
---

# Finance, Royalties & Revenue (Agent Zero Skill)

**Domain Expert:** Music Business Manager / Royalty Accountant  
**Goal:** Track micro-pennies, audit distributors, model recoupment strategies, and ensure the artist's financial longevity.

## 1. The Revenue Matrix

- **Master Royalties:** Revenue generated from the sound recording (DSPs, physical sales).
- **Mechanical Royalties:** Revenue generated from the reproduction of the composition. Every stream pays a fraction of a cent in mechanicals.
  - *Collection:* The MLC (US), Harry Fox Agency, or global equivalents (PRS, MCPS).
- **Performance Royalties:** Revenue generated from the public performance of the composition (radio, TV, live shows, streaming).
  - *Collection:* PROs (ASCAP, BMI, SESAC, PRS, SOCAN). 50% Writers Share, 50% Publishers Share.
- **Neighboring Rights (Sound Recording Performance):** Revenue from digital/satellite radio (SiriusXM, Pandora) and international public performance of the *master*.
  - *Collection:* SoundExchange (US) or PPL (UK). Direct payout to the featured artist (45%), master owner (50%), and non-featured musicians (5%).

## 2. Unrecouped Balances & The Advance Trap

- **Recoupment:** The process of a label paying back their advance and expenses from the artist's royalty share.
  - Example: Label gives a $100k advance. Marketing costs $50k. Total recoupable = $150k.
  - If the artist's royalty rate is 20%, the master must generate $750k in revenue before the artist sees a single penny ($750k * 20% = $150k).
  - **The "Unrecouped" State:** Over 90% of signed artists never recoup.
- **Cross-Collateralization:** Never accept cross-collateralization across multiple albums. If Album 1 is unrecouped by $50k, those debts should NOT carry over to Album 2's royalties.

## 3. Streaming Math (The "Penny Pool")

- **Per-Stream Rate (Pro-Rata System):**
  - Spotify: ~$0.003 - $0.005 per stream.
  - Apple Music: ~$0.005 - $0.008 per stream.
  - YouTube (Content ID): Highly variable, often <$0.001 per stream.
  - **1 Million Streams on Spotify = ~$4,000 Total Master Revenue.**
- **The Threshold Rule (Spotify 2024):** Tracks with under 1,000 streams in a 12-month period no longer generate royalties.

## 4. indiiOS App Integration (Finance Dept)

- Always analyze the artist's `FinanceSlice` to flag uncollected revenue streams.
- If they have DSP streams but no PRO listed, alert them they are losing Performance Royalties.
- Generate Waterfall calculation estimates when users input stream goals, warning them of distributor cuts (e.g., DistroKid flat fee vs. AWAL 15%).
