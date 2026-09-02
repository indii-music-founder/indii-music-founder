# Payment Gateway Schema & Event Contract (indiiOS Layer 1)

Defines strict schemas, idempotency patterns, and verification standards for Stripe payment gateways, subscription lifecycles, and micro-transaction credit ledgers across indiiOS Layer 1.

## 1. Webhook Signature & Ingestion Security
- **HMAC Verification:** All Stripe webhook payloads must be verified using `stripe.webhooks.constructEvent(rawBody, signature, secret)`. Never parse JSON prior to cryptographic signature verification.
- **Delivery Idempotency:** Webhook events must be registered in the `stripe_webhook_deliveries/{eventId}` collection before processing.
  - Structure:
    ```typescript
    interface StripeWebhookDelivery {
      eventId: string;
      eventType: string;
      status: 'processing' | 'processed' | 'failed' | 'ignored';
      createdAt: number; // Date.now()
      processedAt?: number;
      error?: string;
    }
    ```
  - Lock expiration: Concurrent duplicate requests must be dropped if a record exists and is either 'processed' or currently 'processing' (within a 5-minute lease window).

## 2. Credit Packs & Defense-in-Depth Verification
- **Anti-Tamper Session Inspection:** Session metadata (`metadata.credits`, `metadata.userId`) is untrusted. Before minting credits:
  1. Retrieve live session from Stripe: `stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] })`.
  2. Verify exactly 1 line item exists.
  3. Validate `singleLineItem.price.id === process.env.STRIPE_PRICE_CREDIT_PACK`.
  4. Validate `singleLineItem.quantity === credits`.
- **Atomic Credit Ledger Mutation:**
  - Execute mutations inside `db.runTransaction()`.
  - Check `user_credits/{userId}/transactions/{sessionId}` exists; if present, abort to guarantee exact-once delivery.
  - Atomically increment `user_credits/{userId}.balance` and write transaction record:
    ```typescript
    interface UserCreditTransaction {
      amount: number;
      type: 'purchase' | 'spend' | 'refund' | 'adjustment';
      sessionId?: string;
      timestamp: number;
    }
    ```

## 3. Subscription State Mapping
Map Stripe subscription statuses deterministically to indiiOS subscription tiers and statuses:
- **Tiers:** `free` | `pro` | `studio` | `label`
- **Statuses:**
  - `active` | `trialing` -> `active`
  - `past_due` -> `past_due` (grace period active, dunning initiated)
  - `canceled` | `unpaid` | `incomplete_expired` -> `cancelled`
- **Customer Binding:** Map `customer.id` to `userId` via metadata or lookup in `users/{userId}.stripeCustomerId`.

## 4. Refund, Dispute & POD Order Gates
- **POD Printful Gate:** For `checkout.session.completed` targeting print-on-demand orders (`pod_orders/{orderId}`), confirm `orderDoc.checkoutSessionId === session.id` before calling Printful API (`confirmPrintfulOrder`).
- **Disputes & Reversals:** When `charge.dispute.created` or `charge.refunded` occurs, immediately freeze or reverse the corresponding escrow allocations in `split_escrow/{splitId}` and log failures in `finance_reversal_failures/{chargeId}`.
