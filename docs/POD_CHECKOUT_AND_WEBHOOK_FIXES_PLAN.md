# Execution Plan — POD Checkout UI, Phantom Prodigi, ISSUE-1410, Ledger Truth

**Plan of record:** 2026-08-28, DSH agent. Founder directive: plan everything I'm aware of, execution-ready.
**Preconditions verified by investigation (do not re-litigate):**
- ISSUE-1415 is already FIXED: run `33196608685` (success, head `dd3d72ed2`, tree includes `8edc335cb`) passed all 20 unit shards + rules-tests. Only the ledger entry is stale.
- ISSUE-1410 confirmed real: `handleInvoicePaid` in `packages/firebase/src/stripe/webhookHandler.ts` writes `status: 'active'` unconditionally.
- ProdigiProvider (`packages/renderer/src/services/pod/PrintOnDemandService.ts`, ~line 674) calls `pod_prodigiCreateOrder` etc. — **no Prodigi backend exists in `packages/firebase/src`**. Phantom capability, runtime failure if selected.
- POD Printful chain is backend-complete: `pod_printfulCreateOrder` returns drafts (confirm pinned false), `pod_createOrderCheckout` (`packages/firebase/src/pod/checkout.ts`) binds Stripe Checkout to a draft, webhook `handlePodOrderPaid` confirms only after verified payment. What is missing is entirely renderer-side.

**Hard constraints for the executor:**
1. Work on `main`, path-scoped commits, explicit refspec `git push origin HEAD:main`, inspect CI for the exact SHA.
2. NEVER touch foreign dirty files: `.agent/observations/2026-08-27-agent-watch.md`, untracked `videos/`, any BaseAgent/StreamPayloadGuard changes not yours.
3. NEVER set Printful `confirm: true` outside `stripe/webhookHandler.ts`. NEVER copy "Order Created" / success claims for unpaid or unconfirmed states (house rule: ISSUE-950/952/1129 lineage).
4. No `.env` edits. No secret values in code.
5. Each work package = one commit, with its tests green before commit. Full gates run in pre-commit hook (lint + typecheck + API-security scan); do not skip.

---

## WP-A — ISSUE-1410: derive subscription status from the live Stripe object

**File:** `packages/firebase/src/stripe/webhookHandler.ts`, function `handleInvoicePaid` (~line 655 post-refactor).

**Current (wrong):**
```ts
const updateData: Partial<LocalSubscription> = { status: 'active' };
if (currentPeriodEnd) {
  updateData.currentPeriodEnd = currentPeriodEnd;
}
await updateSubscriptionByCustomer(invoice.customer as string, 'handleInvoicePaid', updateData);
```
(The handler already retrieves the live subscription only to read `current_period_end`, then throws that information away and hardcodes `'active'`.)

**Required change:**
```ts
const invoiceSubscriptionId = (invoice as unknown as { subscription?: string }).subscription;

let updateData: Partial<LocalSubscription> = {};
if (invoiceSubscriptionId) {
  const subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
  // ISSUE-1410: the LIVE subscription object is the authority. A late invoice.paid
  // after cancellation must never resurrect the subscription to 'active'.
  updateData.status = mapStripeStatus((subscription as unknown as { status: Stripe.Subscription.Status }).status);
  updateData.currentPeriodEnd = (subscription as unknown as { current_period_end: number }).current_period_end * 1000;
  updateData.currentPeriodStart = (subscription as unknown as { current_period_start: number }).current_period_start * 1000;
  updateData.cancelAtPeriodEnd = (subscription as unknown as { cancel_at_period_end: boolean }).cancel_at_period_end;
}
if (Object.keys(updateData).length > 0) {
  await updateSubscriptionByCustomer(invoice.customer as string, 'handleInvoicePaid', updateData);
}
```
- Keep the ledger-entry write BELOW this, unchanged, for ALL invoices (one-time invoices still get payment history).
- Check `mapStripeStatus` in `packages/firebase/src/stripe/config.ts` first: it must map `canceled`/`unpaid`/`incomplete` to non-active local statuses. If it maps everything unknown to `'active'`, fix the mapping or guard explicitly (`if (subscription.status === 'canceled' || subscription.status === 'unpaid') updateData.status = mapStripeStatus(subscription.status)` — never fall back to `'active'`).

**Tests** — new file `packages/firebase/src/stripe/webhookHandler.invoice-paid.test.ts`, harness copied from `webhookHandler.fulfillment-guards.test.ts` (mocks + `deliver()` pattern; event type `invoice.paid`, object = invoice):
1. Invoice WITH `subscription: 'sub_1'`, live subscription status `'canceled'` → the subscription doc update written to Firestore has `status` equal to `mapStripeStatus('canceled')` (NOT `'active'`), ledger entry still written.
2. Invoice with NO `subscription` field → NO subscription doc update happens; ledger entry IS written.
3. Invoice WITH live subscription `'active'` → status `'active'` + `currentPeriodEnd` updated (no regression).
4. `stripe.subscriptions.retrieve` mock must exist in the `./config` mock (add `subscriptions: { retrieve: ... }`).

**Commit:** `fix(stripe): ISSUE-1410 — invoice.paid derives subscription status from live Stripe object`

---

## WP-B — kill the phantom Prodigi provider

**Files:** `packages/renderer/src/services/pod/PrintOnDemandService.ts`, `packages/renderer/src/modules/merchandise/components/ManufacturingPanel.tsx`, plus any file referencing `'prodigi'` (run `grep -rn "prodigi" packages/renderer/src --include=*.ts --include=*.tsx -i` and handle every hit except tests you delete/update).

**Changes:**
1. Delete the `ProdigiProvider` class (lines ~674–855) and its registration in the provider map / `getProvider()` switch inside `PrintOnDemandServiceClass`.
2. Update the `PODProvider` type union (wherever declared — grep `type PODProvider`) to remove `'prodigi'`; fix compile errors at call sites.
3. In `ManufacturingPanel.tsx`: remove Prodigi from the provider selector options and any `selectedPODProvider === 'prodigi'` branches. Printful becomes the only external provider.
4. Defensive guard: in `getProvider()`, an unknown provider throws `Error('POD provider not configured: ' + provider)` (fail loudly, never silently fall back to internal).

**Tests:**
- Update existing POD service tests that reference prodigi.
- New case in the service test: `expect(() => service.getProvider('prodigi' as never)).toThrow()`.

**Commit:** `fix(merch): remove phantom Prodigi provider (no backend exists; runtime failure if selected)`

---

## WP-C — POD checkout UI slice (honest copy + Stripe redirect + status)

**Order within WP-C matters.** Backend already deployed and CI-green; this is renderer-only.

### C1. Service: checkout method
`packages/renderer/src/services/pod/PrintOnDemandService.ts`, `PrintfulProvider`:
```ts
async createOrderCheckout(orderId: string, successUrl: string, cancelUrl: string): Promise<{
  checkoutUrl: string; sessionId: string; customerCents: number; currency: string;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await this.callFunction<any>('createOrderCheckout', {
    orderId, successUrl, cancelUrl,
  });
  if (!result?.checkoutUrl) throw new Error('Checkout session did not return a URL.');
  return result;
}
```
Expose it through `PrintOnDemandServiceClass` + the `PODProviderAdapter`/service interface (printful-only; internal provider throws NOT_IMPLEMENTED).

### C2. ManufacturingPanel: honest flow
In `handleSubmission` (POD branch), replace the success toasts:
- AFTER `createOrder` succeeds: `toast.info('Draft created with Printful — payment is required to send it to production.')`. DELETE the `"POD Order Created!"` success toast and the estimated-delivery toast (false until confirmed).
- THEN:
```ts
const returnBase = `${window.location.origin}${window.location.pathname}`;
sessionStorage.setItem('podCheckoutOrderId', order.id);
const { checkoutUrl } = await PrintOnDemandService.createOrderCheckout(
  order.id, `${returnBase}?podCheckout=success`, `${returnBase}?podCheckout=cancelled`,
);
window.location.assign(checkoutUrl); // leave the app for Stripe
```
- On mount (useEffect): if `?podCheckout=success|cancelled` is present, clear the param from the URL (history.replaceState), read `podCheckoutOrderId`, and call `PrintOnDemandService.getOrder(orderId)`:
  - order status maps to confirmed → `toast.success('Payment received — order sent to production.')`
  - still awaiting/draft → `toast.info('Payment pending — the order will be confirmed automatically after checkout completes.')`
  - `?podCheckout=cancelled` → `toast.info('Checkout cancelled — your Printful draft is saved and unpaid.')`
- NEVER display "in production" based on the draft alone; confirmation authority is the backend-updated `pod_orders` doc / Printful order status.

### C3. Rules check
`users/{uid}/pod_orders` rules must accept the new fields the backend already writes (`status`, `checkoutSessionId`, `customerCents`, ...). Run `npm run test:rules -w packages/firebase` with the emulator (CI runs it regardless). If a schema-pinned rule rejects the new shape, extend the rule + its test in the same commit.

### C4. Tests
`packages/renderer/src/modules/merchandise/components/ManufacturingPanel.test.tsx` (extend or create; mock `PrintOnDemandService` and `firebase/functions`):
1. After successful `createOrder`, NO "POD Order Created" success toast; copy mentions draft + payment required.
2. `createOrderCheckout` called with the returned order id and origin-derived URLs; `window.location.assign` called with the checkout URL.
3. `?podCheckout=cancelled` path never claims production/confirmation.
4. Prodigi does not appear in provider options.
Service test: `createOrderCheckout` passes args through the `pod_createOrderCheckout` callable and surfaces `checkoutUrl`.

**Commit:** `feat(merch): POD checkout redirect + honest draft copy (ISSUE-1407 UI slice)`

---

## WP-D — ledger + docs truth (do LAST, after A–C land)

Append to `.agent/test_ledger/OPEN_ISSUES_V3.md` (append-only, same format):
1. **ISSUE-1415** → `✅ FIXED (2026-08-28)` — evidence: run `33196608685` success on `dd3d72ed2` (tree contains `8edc335cb`'s Arcjet/rules fixes); all unit shards + rules-tests green; production deployed. The original failing tests do not reproduce on main.
2. **ISSUE-1410** → `✅ FIXED (WP-A commit sha)` — live-object derivation + invoice-without-subscription guard + tests.
3. **NEW ISSUE-1417** → document the phantom ProdigiProvider finding + `✅ FIXED (WP-B commit sha)` with the grep evidence.
4. **ISSUE-1407** → append: UI slice landed (WP-C sha); POD loop closed end-to-end (draft → paid checkout → webhook confirm → UI status).

**Commit:** `docs(ledger): ISSUE-1415 fixed w/ CI evidence; 1410 fixed; ISSUE-1417 phantom prodigi recorded`

---

## Execution order & validation

`WP-A` → `WP-B` → `WP-C` → `WP-D` (A and B are independent; C depends on nothing new but touches the same panel as B, so run B first; D last).

Validation before each push (executor checklist):
```
cd packages/firebase && npx tsc --noEmit -p tsconfig.json
npx vitest run src/stripe src/pod        # WP-A/C backend surface
cd ../.. && npm test -- --run src/services/pod src/modules/merchandise 2>/dev/null || npx vitest run <touched renderer test paths>
git push origin HEAD:main && gh run list --branch main --limit 1
```
Then watch the run for the exact pushed SHA; fix only logged root causes; never declare victory on partial green.
