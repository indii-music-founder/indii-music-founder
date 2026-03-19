# 03 — Revenue Model & Pricing

> **Time to complete:** 45 minutes  
> **Who:** Founder  
> **What this unblocks:** Stripe configuration, subscription tier enforcement, Founders Pass activation, App Check enforcement  
> **Dependencies:** Complete `01_COMPANY_IDENTITY.md` first (you need an EIN for Stripe)

---

## Current State

The platform already has:
- ✅ Stripe integration (Cloud Functions)
- ✅ Subscription tier system (`SubscriptionTier.ts`)
- ✅ Storage quotas per tier (`StorageQuotaService.ts`)
- ✅ Founders Pass covenant file (`src/config/founders.ts`)
- ✅ Payment webhook handler (`functions/src/stripe/webhookHandler.ts`)

What's missing: **real Stripe price IDs** and **your final pricing decisions**.

---

## Decision B1: Subscription Tiers & Pricing

> The code supports these tiers. You need to decide the pricing.

| Tier | Current Code Name | Monthly Price | Annual Price | What's Included |
|------|------------------|---------------|--------------|----------------|
| **Free** | `FREE` | $0 | $0 | Basic creative tools, 1 GB storage, watermarked exports |
| **Pro** | `PRO` | `$____/mo` | `$____/yr` | Full creative suite, 50 GB storage, unwatermarked exports, basic distribution |
| **Studio** | `STUDIO` | `$____/mo` | `$____/yr` | Everything in Pro + unlimited storage, priority rendering, advanced analytics, multi-distributor support |
| **Founder** | `FOUNDER` | $2,500 (one-time) | Lifetime | Everything, forever. 10 seats total. |

### Pricing Research (Competitor Landscape)

| Competitor | Free Tier | Mid Tier | Pro Tier |
|-----------|-----------|----------|---------|
| DistroKid | — | $22.99/yr (1 artist) | $35.99/yr (2 artists) |
| TuneCore | Free (limited) | $14.99/yr/single | $49.99/yr/album |
| Splice | Free samples | $9.99/mo (100 credits) | $29.99/mo (unlimited) |
| BandLab | Free | $9.99/mo | $19.99/mo |
| LANDR | Free master | $12.49/mo | $35.99/mo |

> **Recommendation:** indiiOS does significantly more than any single competitor (AI generation + distribution + legal + finance + social). Pricing in the $15–30/mo range for Pro and $30–50/mo for Studio positions the platform as premium but accessible.

**Your pricing:**

| Tier | Monthly | Annual | Status |
|------|---------|--------|--------|
| Pro | `$____/mo` | `$____/yr` | 🔴 |
| Studio | `$____/mo` | `$____/yr` | 🔴 |

---

## Decision B2: API Cost Model

> **Question:** How should AI generation costs (Gemini tokens, image generation, video generation) be billed?

| Option | How it works | Pros | Cons |
|--------|-------------|------|------|
| **(a) Included in subscription** | Monthly tier includes X generations. Overage blocked or throttled. | Simple UX, predictable revenue | You absorb API costs; unpredictable expense |
| **(b) Credit system** | Users buy credits. Each generation costs Y credits. | Revenue matches costs; scales naturally | More complex UX; users resist "pay per use" |
| **(c) Bring Your Own Key (BYOK)** | Users provide their own Gemini API key in settings. Platform charges $0 for AI usage. | Zero API cost risk for you | Friction for users; limits casual adoption |
| **(d) Hybrid: included base + BYOK power mode** | Tier includes N free generations/month. Power users can add their own key for unlimited. | Best of both worlds | Slightly complex settings |

> **Recommendation:** 🟡 **Option (d) — Hybrid.**
> Free/Pro tiers get a monthly generation allowance (e.g., 50 images, 5 videos). Studio tier gets a higher allowance. Founders use their own keys (already decided in `FOUNDERS_PLAN.md`). This lets casual users enjoy the platform without API key friction, while heavy users scale up with their own keys.

| Tier | Monthly Generations Included | BYOK Available? |
|------|------------------------------|----------------|
| Free | `____` images, `____` videos | No |
| Pro | `____` images, `____` videos | Yes |
| Studio | `____` images, `____` videos | Yes |
| Founder | Own key only | Yes (required) |

**Your answer:** `_________________________________`

---

## Decision B3: Distribution Revenue Model

> **Question:** How does indiiOS make money from distribution?

| Option | How it works | Industry standard |
|--------|-------------|-------------------|
| **(a) Flat fee per release** | User pays $X per single, $Y per album pushed to DSPs | TuneCore model |
| **(b) Revenue share** | indiiOS takes X% of all royalties collected through the platform | CD Baby model (9%) |
| **(c) Included in subscription** | Pro/Studio tiers include unlimited distribution | DistroKid model |
| **(d) Tiered: free tier = revenue share, paid tier = flat/unlimited** | Free users pay revenue share; paid users get unlimited | Hybrid model |

> **Recommendation:** 🟡 **Option (c) — Included in subscription.**
> This is the DistroKid model and is the most attractive to indie artists. "Unlimited distribution" is a strong selling point for Pro/Studio tiers. Revenue comes from subscriptions, not per-release fees.

**Your answer:** `_________________________________`

---

## Decision B4: Founders Pass Final Details

> Most of this is already designed in `docs/FOUNDERS_PLAN.md`. Confirm these:

| # | Item | Current Setting | Confirm? |
|---|------|----------------|----------|
| B4a | Price | $2,500 USD one-time | ✅ / Change: `$_____` |
| B4b | Total seats | 10 | ✅ / Change: `_____` |
| B4c | Access level | All features, forever | ✅ |
| B4d | API costs | Founders bring their own key | ✅ |
| B4e | Name in code | Permanent git entry in `src/config/founders.ts` | ✅ |
| B4f | Covenant verification | SHA-256 hash returned at checkout | ✅ |

**All items confirmed?** `[ ] Yes`

---

## Decision B5: Stripe Configuration

> This is a checklist of what needs to be created in the Stripe Dashboard (or via API).

### Products to Create in Stripe

| Product | Type | Price | Stripe Price ID | Status |
|---------|------|-------|----------------|--------|
| indiiOS Pro Monthly | Recurring | $__/mo | `price_________________` | 🔴 |
| indiiOS Pro Annual | Recurring | $__/yr | `price_________________` | 🔴 |
| indiiOS Studio Monthly | Recurring | $__/mo | `price_________________` | 🔴 |
| indiiOS Studio Annual | Recurring | $__/yr | `price_________________` | 🔴 |
| indiiOS Founders Pass | One-time | $2,500 | `price_________________` | 🔴 |

### After Creating Products

Run these commands to set the price IDs in Cloud Functions:

```bash
# Replace price_xxx with the actual Stripe price IDs from your dashboard
firebase functions:config:set \
  stripe.price_pro_monthly="price_xxx" \
  stripe.price_pro_annual="price_xxx" \
  stripe.price_studio_monthly="price_xxx" \
  stripe.price_studio_annual="price_xxx" \
  stripe.price_founder_pass="price_xxx"

# Deploy Cloud Functions with the new config
firebase deploy --only functions
```

**Also add to GitHub Secrets** for CI/CD:
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`
- `STRIPE_PRICE_STUDIO_MONTHLY`
- `STRIPE_PRICE_STUDIO_ANNUAL`
- `STRIPE_PRICE_FOUNDER_PASS`

---

## Decision B6: App Check Enforcement

> **Question:** When should App Check be enforced?

Firebase App Check prevents API abuse by verifying that requests come from your real app, not from scripts or bots. It's currently optional.

| Option | When |
|--------|------|
| **(a) Enforce at launch** | All API calls require App Check token. Strongest security but blocks any unofficial clients. |
| **(b) Enforce after beta** | Leave optional during beta testing. Enforce when you have paying users. |
| **(c) Monitor-only mode** | Log App Check failures but don't block. Gather data before enforcing. |

> **Recommendation:** 🟡 **Option (c) for launch, then (a) after 30 days.**
> Monitor-only mode lets you see if any legitimate clients would be blocked. After 30 days of data, enforce.

**Your answer:** `_________________________________`

### To implement:

1. Go to [Firebase Console → App Check](https://console.firebase.google.com/)
2. Register your web app with reCAPTCHA Enterprise
3. Copy the site key to `VITE_FIREBASE_APP_CHECK_KEY` in `.env.production`
4. Add the same key to GitHub Secrets for CI/CD

---

## What Happens After You Complete This

1. Create Stripe products with your pricing → get price IDs
2. Run the `firebase functions:config:set` commands above
3. Update GitHub Secrets
4. Deploy Cloud Functions
5. The Founders Pass, subscription checkout, and tier enforcement all go live

