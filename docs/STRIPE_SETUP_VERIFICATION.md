# Stripe Setup Verification Checklist

**Date:** 2026-05-10  
**Status:** Pending Manual Verification by William  
**Goal:** Ensure production Stripe integration is fully configured and ready for live charges

---

## Required Firebase Cloud Functions Environment Variables

Before any live charges can process, set these in Firebase Console → Cloud Functions → Environment Variables:

### Secret Manager (Required)
- `STRIPE_SECRET_KEY` — Live mode key (starts with `sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` — Live webhook signing secret

### Regular Environment Variables (Required for pricing)
- `STRIPE_PRICE_PRO_MONTHLY` — Live Stripe Price ID for Pro monthly tier ($19/month)
- `STRIPE_PRICE_PRO_YEARLY` — Live Stripe Price ID for Pro yearly tier
- `STRIPE_PRICE_STUDIO_MONTHLY` — Live Stripe Price ID for Studio monthly tier ($49/month)
- `STRIPE_PRICE_STUDIO_YEARLY` — Live Stripe Price ID for Studio yearly tier
- `STRIPE_PRICE_FOUNDER_PASS` — Live Stripe Price ID for Founders Pass (one-time)

### Optional Live-Mode Product ID Overrides
- `STRIPE_PRODUCT_PRO` — Live product ID (if using different product than test)
- `STRIPE_PRODUCT_STUDIO` — Live product ID
- `STRIPE_PRODUCT_FOUNDER` — Live product ID

---

## Where to Find These Values

### 1. Stripe Dashboard (stripe.com/account)
- Navigate to: **Developers** → **API Keys**
- Copy: **Secret Key** (live mode, starts with `sk_live_`)
- Navigate to: **Webhooks**
- Copy: **Signing secret** for the webhook endpoint you've configured

### 2. Stripe Products & Pricing
- Navigate to: **Products**
- For each tier (Pro, Studio, Founder), find the live-mode price IDs:
  - Click product → **Pricing** → Copy the Price ID (starts with `price_`)

### 3. Webhook Endpoint
- Navigate to: **Developers** → **Webhooks**
- Ensure endpoint URL is set to: `https://<region>-<project>.cloudfunctions.net/stripeWebhook`
- Confirm these events are subscribed:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

---

## Setting Environment Variables in Firebase Console

1. Go to: **Firebase Console** → Project → **Functions**
2. Click **Manage Runtime Settings** (gear icon)
3. Under **Environment Variables**, add each key-value pair above
4. For **STRIPE_SECRET_KEY** and **STRIPE_WEBHOOK_SECRET**, use **Secret Manager** instead:
   - Click **Secret Manager** tab
   - Create new secret with the Stripe secret keys
   - Grant Cloud Functions access

---

## Testing Checklist

- [ ] `STRIPE_SECRET_KEY` set to live mode (`sk_live_*`)
- [ ] `STRIPE_PRICE_PRO_MONTHLY` set to live price ID
- [ ] `STRIPE_PRICE_STUDIO_MONTHLY` set to live price ID
- [ ] `STRIPE_PRICE_FOUNDER_PASS` set to live price ID
- [ ] `STRIPE_WEBHOOK_SECRET` set to live webhook signing secret
- [ ] Stripe webhook endpoint registered and receiving events
- [ ] Test checkout: use live card (Visa 4242 4242 4242 4242, any future expiry, any CVC)
- [ ] Verify Firestore `subscriptions` collection updated after test checkout
- [ ] Verify user gains access to Pro/Studio features after payment

---

## Code References

- **Stripe Config:** `packages/firebase/src/stripe/config.ts` — Shows which env vars are used
- **Secret Handling:** `packages/firebase/src/config/secrets.ts` — How secrets are retrieved
- **Webhook Handler:** `packages/firebase/src/stripe/webhook.ts` — Processes Stripe events
- **Checkout Session:** `packages/firebase/src/subscription/createCheckoutSession.ts` — Initiates payment

---

## Fallback Behavior (if env vars not set)

The code includes fallback test-mode price IDs so development doesn't break, but these are NOT suitable for production:

```typescript
PLACEHOLDER_PRICE_IDS = {
  STRIPE_PRICE_PRO_MONTHLY: 'price_1TC4ceECGAoF2ZTQOjOAzJMR',     // TEST
  STRIPE_PRICE_STUDIO_MONTHLY: 'price_1TC4cqECGAoF2ZTQdZiAsoXo', // TEST
  STRIPE_PRICE_FOUNDER_PASS: 'price_1TC4crECGAoF2ZTQ0rlpPs9q',    // TEST
}
```

If env vars are missing, the code logs warnings but continues. **Live charges will fail against test-mode price IDs.**

---

## Next Steps

1. Gather all live-mode Stripe keys and price IDs from Stripe Dashboard
2. Enter them into Firebase Console environment variables
3. Deploy Cloud Functions (or redeploy existing)
4. Run test checkout flow
5. Verify Firestore records created + user access granted

**Owner:** William Roberts  
**Status:** Awaiting manual Firebase Console configuration
