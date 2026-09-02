# Firebase Billing Rules & Security Standards (indiiOS Layer 1)

Defines the zero-client-trust security architecture, access control boundaries, and server-authoritative models for financial transactions, subscription records, and credit balances in Firestore.

## 1. Zero-Client-Trust Invariant
Client-side SDKs (`cloud.firestore`) must never be granted direct read or write permissions to financial ledgers, subscription status records, or webhook processing metadata.
All financial state updates must be executed via Cloud Functions v2 using the Firebase Admin SDK.

## 2. Server-Authoritative Collections (`allow read, write: if false;`)
The following collections must remain closed to direct client SDK access:
- `subscriptions/{userId}`: Contains subscription tiers, status, renewal dates, and billing IDs. Clients read exclusively via the `getSubscription` callable Cloud Function.
- `user_credits/{userId}`: Contains user credit balances.
- `user_credits/{userId}/transactions/{txId}`: Contains credit purchase/spend ledgers.
- `stripe_webhook_deliveries/{deliveryId}`: Webhook event receipt log and idempotency locks.
- `finance_reversal_failures/{chargeId}`: Unresolved refund or chargeback reversal records.
- `payment_disputes/{disputeId}`: Formal dispute evidence and status tracking.
- `dunning_notifications/{notificationId}`: Past-due payment notifications.
- `founder_fulfillment_queue/{sessionId}`: Backend queue for physical fulfillment orders.

## 3. Marketplace & Direct Transaction Rules (`transactions/{transactionId}`)
Where direct client interaction is required for marketplace order initiation:
- **Read Access:** Limited strictly to authenticated buyers or sellers:
  `resource.data.buyerId == request.auth.uid || resource.data.sellerId == request.auth.uid`
- **Creation:** Only verified users can initiate a purchase; must enforce:
  - `request.resource.data.buyerId == request.auth.uid`
  - `request.resource.data.status == 'pending'`
  - `request.resource.data.amount >= 0`
  - `request.resource.data.createdAt == request.time`
- **Updates:** Strictly limited to status progression:
  - Authority fields (`buyerId`, `sellerId`, `amount`, `createdAt`) are immutable:
    `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedAt'])`
  - Allowed status transitions:
    - Buyer can cancel pending order: `resource.data.status == 'pending' && request.resource.data.status == 'cancelled'`
    - Seller can mark fulfilled order shipped: `resource.data.status == 'completed' && request.resource.data.status == 'shipped'`
- **Deletion:** Permanent audit records; deletions are strictly forbidden: `allow delete: if false;`.

## 4. User Profile Field Protection (`users/{userId}`)
Ensure client-side profile writes cannot manipulate billing metadata:
- Block writes to `subscriptionTier`, `billing`, and `stripeCustomerId` in user profile documents:
  `!('subscriptionTier' in request.resource.data) && !('billing' in request.resource.data) && !('stripeCustomerId' in request.resource.data)`
