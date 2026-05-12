# Founders Pass Activation SOP

**Date:** 2026-05-10  
**Audience:** William Roberts (admin)  
**Purpose:** Manual activation workflow for founder payments outside Stripe

---

## Background

Founders Pay via cash transfer methods (Cash App, wire, check), NOT Stripe. When a founder payment is received, they need manual activation to unlock their Founders Pass tier ($2,500 one-time, lifetime access).

The activation flow:
1. Founder sends payment via Cash App/wire/check
2. William confirms receipt (off-channel, e.g., email, Slack)
3. William runs the activation script
4. Founder's account is upgraded to `FOUNDER` tier in Firestore
5. Founder can now access all premium features

---

## Prerequisites

- Admin access to Firebase Console (Firestore write permission)
- GitHub token with `contents:write` access to the repo (for committing founder entry)
- Access to `packages/renderer/src/config/founders.ts` in the codebase
- Node.js 22+ installed locally
- `npm` available in PATH

---

## Step-by-Step Activation

### 1. Record Founder Entry in Config

Edit `packages/renderer/src/config/founders.ts`:

```typescript
// Current state (example)
export const FOUNDERS: FounderEntry[] = [
    {
        uid: 'user123',
        displayName: 'Jane Smith',
        email: 'jane@example.com',
        joinedAt: new Date('2026-01-15').getTime(),
    },
    // Add new founder here:
    {
        uid: '<NEW_UID>',
        displayName: '<FOUNDER_NAME>',
        email: '<FOUNDER_EMAIL>',
        joinedAt: new Date().getTime(),
    },
];
```

**Where to get `uid`?**
- Ask founder for their account email
- Go to Firebase Console → Authentication
- Search for the user by email
- Copy the `User UID` field

### 2. Commit the Change

```bash
cd /path/to/indii-Clean
git add packages/renderer/src/config/founders.ts
git commit -m "chore(founders): activate [FOUNDER_NAME] Founders Pass"
git push origin main
```

### 3. Verify Activation in Firebase

**Step 3A: Firestore Custom Claim**

Go to **Firebase Console** → **Authentication** → Select the founder user:

1. Click the user row
2. Scroll to **Custom Claims**
3. Verify `{"founderTier": "founder"}` is present

If not present, add it manually:
1. Click **Edit Custom Claims**
2. Paste: `{"founderTier": "founder"}`
3. Click **Save**

**Step 3B: Subscription Record**

Go to **Firebase Console** → **Firestore** → `subscriptions` collection:

1. Click **Add document**
2. Document ID: `<NEW_UID>` (the founder's Firebase UID)
3. Add these fields:
   ```
   userId: <NEW_UID> (string)
   tier: "founder" (string)
   status: "active" (string)
   currentPeriodStart: 1715337600000 (timestamp in ms, e.g., today)
   currentPeriodEnd: 9999999999999 (timestamp far in future for "lifetime")
   cancelAtPeriodEnd: false (boolean)
   stripeCustomerId: null (or omit)
   stripeSubscriptionId: null (or omit)
   createdAt: 1715337600000 (timestamp in ms, today)
   updatedAt: 1715337600000 (timestamp in ms, today)
   ```

### 4. Test Activation

Ask the founder to:

1. **Log out** and **log back in** (to refresh auth claims)
2. **Navigate to a premium module** (e.g., Distribution, Finance)
3. **Verify they see the module**, not the UpgradeGate

---

## Troubleshooting

### Founder Still Sees UpgradeGate

**Root Cause:** Custom claim not refreshed in client token  
**Solution:** Founder logs out → closes all browser tabs → logs back in

**Root Cause:** Subscription record not created in Firestore  
**Solution:** Manually add subscription document per Step 3B above

### Firebase Authentication Page Won't Load

**Root Cause:** Browser cache or session issue  
**Solution:** Open Firebase Console in incognito/private window

### git push fails

**Root Cause:** Branch protection or merge conflict  
**Solution:** Ensure you're on `main`, all local changes committed, and branch is up-to-date

```bash
git pull origin main
git push origin main
```

---

## Founder Tier Details

| Setting | Value | Notes |
|---------|-------|-------|
| **Tier Name** | `founder` | Defined in SubscriptionTier enum |
| **Price** | $2,500 | One-time, lifetime |
| **Max Seats** | 10 | Hard limit per terms |
| **Billing Period** | `once` | Never renews |
| **Features** | All (unlimited) | Unrestricted access to all modules |

---

## Audit Trail

When a founder is activated, it creates:

1. **Git commit** in `packages/renderer/src/config/founders.ts` with message `chore(founders): activate [NAME]`
2. **Firestore record** in `subscriptions/{uid}` with activation timestamp
3. **Custom claim** in Firebase Auth with `{"founderTier": "founder"}`

All three should match to confirm clean activation.

---

## Quick Checklist

- [ ] Payment received and confirmed (Cash App/wire/check)
- [ ] Founder's Firebase UID retrieved
- [ ] Entry added to `founders.ts`
- [ ] Change committed and pushed to main
- [ ] Custom claim set in Firebase Auth
- [ ] Subscription document created in Firestore
- [ ] Founder tested and confirmed access

---

## Owner & Contact

**Owner:** William Roberts  
**Last Updated:** 2026-05-10  
**Related Docs:**
- `docs/NEPHEW_COFOUNDER_PLAY.md` — Co-founder strategy
- `docs/STRIPE_SETUP_VERIFICATION.md` — Stripe integration checklist
