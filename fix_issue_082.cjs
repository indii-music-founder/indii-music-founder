const fs = require('fs');

let configPath = 'packages/firebase/src/stripe/config.ts';
let config = fs.readFileSync(configPath, 'utf8');

config = config.replace(
`  [SubscriptionTier.FOUNDER]: {
    oneTime: resolvePriceId('STRIPE_PRICE_FOUNDER_PASS'),
  },`, 
  ''
);

config = config.replace(
`/** Price ID for the Founders Pass one-time checkout */
export const STRIPE_FOUNDER_PRICE_ID = resolvePriceId('STRIPE_PRICE_FOUNDER_PASS');`,
  ''
);

config = config.replace(
` * For FOUNDER tier, returns the oneTime price regardless of isYearly.`,
  ` * Returns the oneTime price if present.`
);

config = config.replace(
`  // Founder pass is a one-time purchase — return oneTime if present
  if (prices.oneTime) return prices.oneTime;`,
  `  if (prices.oneTime) return prices.oneTime;`
);

config = config.replace(
`  // Founder (one-time — no interval)
  if (process.env.STRIPE_PRODUCT_FOUNDER && productId === process.env.STRIPE_PRODUCT_FOUNDER) return SubscriptionTier.FOUNDER;`,
  ``
);

fs.writeFileSync(configPath, config);


let webhookPath = 'packages/firebase/src/stripe/webhookHandler.ts';
let webhook = fs.readFileSync(webhookPath, 'utf8');

const webhookFounderFunc = `/**
 * Handle checkout.session.completed for a founders pass (one-time payment).
 * Writes the pending activation record to Firestore so activateFounderPass
 * can be called by the client after redirect.
 */
async function handleFounderPassCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

  if (!userId || !paymentIntentId) {
    console.error(
      \`[handleFounderPassCheckoutCompleted] Missing userId or paymentIntentId. \` +
      \`sessionId=\${session.id}, userId=\${userId ?? 'MISSING'}, \` +
      \`paymentIntentId=\${paymentIntentId ?? 'MISSING'}, \` +
      \`metadataKeys=\${session.metadata ? Object.keys(session.metadata).join(',') : 'NONE'}\`
    );
    return;
  }

  const db = getFirestore();
  // Write a pending activation record. The client will call activateFounderPass()
  // after reading this (passing the paymentIntentId + their chosen display name).
  await db.collection('founder_pending_activations').doc(userId).set({
    userId,
    paymentIntentId,
    checkoutSessionId: session.id,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(\`[handleFounderPassCheckoutCompleted] Pending activation written for user \${userId}\`);
}
`;

webhook = webhook.replace(webhookFounderFunc, '');

const webhookRoute = `  // Route founder pass payments separately
  if (session.metadata?.type === 'founder_pass') {
    await handleFounderPassCheckoutCompleted(session);
    return;
  }`;

webhook = webhook.replace(webhookRoute, '');

fs.writeFileSync(webhookPath, webhook);


let testPath = 'packages/firebase/src/__tests__/stripeWebhook.test.ts';
let testStr = fs.readFileSync(testPath, 'utf8');

const testFounderBlock = `    // ── checkout.session.completed — Founder Pass ────────────────────────────

    it('should handle checkout.session.completed for a founder pass', async () => {
        const session: Partial<Stripe.Checkout.Session> = {
            id: 'cs_founder_001',
            payment_intent: 'pi_founder_001',
            metadata: { userId: 'user-123', type: 'founder_pass' },
        };
        const event: Partial<Stripe.Event> = {
            id: 'evt_checkout_founder',
            type: 'checkout.session.completed',
            data: { object: session as Stripe.Checkout.Session },
        };
        mocks.mockConstructEvent.mockReturnValue(event);

        const { req, res, jsonFn } = makeReqRes(event);
        await stripeWebhook(req, res);

        expect(jsonFn).toHaveBeenCalledWith({ received: true });
        expect(mocks.mockDb.collection).toHaveBeenCalledWith('founder_pending_activations');
    });

`;

testStr = testStr.replace(testFounderBlock, '');

// also remove ` * - checkout.session.completed (subscription + founder pass)`
testStr = testStr.replace(` * - checkout.session.completed (subscription + founder pass)`, ` * - checkout.session.completed (subscription)`);

fs.writeFileSync(testPath, testStr);

