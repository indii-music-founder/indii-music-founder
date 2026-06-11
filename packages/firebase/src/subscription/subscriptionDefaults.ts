import type { Firestore } from 'firebase-admin/firestore';
import { Subscription, SubscriptionTier } from '../shared/subscription/types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const VALID_STATUSES: Subscription['status'][] = [
  'active',
  'past_due',
  'canceled',
  'trialing',
  'incomplete',
];

const LEGACY_TIER_MAP: Record<string, SubscriptionTier> = {
  pro: SubscriptionTier.PRO_MONTHLY,
  enterprise: SubscriptionTier.STUDIO,
  studio_monthly: SubscriptionTier.STUDIO,
  studio_yearly: SubscriptionTier.STUDIO,
};

export function createDefaultSubscription(userId: string, now = Date.now()): Subscription {
  return {
    id: `free_${userId}`,
    userId,
    tier: SubscriptionTier.FREE,
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: now + THIRTY_DAYS_MS,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeSubscriptionTier(tier: unknown): SubscriptionTier {
  if (typeof tier !== 'string') {
    return SubscriptionTier.FREE;
  }

  if (Object.values(SubscriptionTier).includes(tier as SubscriptionTier)) {
    return tier as SubscriptionTier;
  }

  return LEGACY_TIER_MAP[tier.toLowerCase()] ?? SubscriptionTier.FREE;
}

function normalizeStatus(status: unknown): Subscription['status'] {
  return VALID_STATUSES.includes(status as Subscription['status'])
    ? status as Subscription['status']
    : 'active';
}

function toMillis(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof maybeTimestamp.toMillis === 'function') {
      return maybeTimestamp.toMillis();
    }
    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate().getTime();
    }
  }

  return fallback;
}

export function normalizeSubscriptionData(
  userId: string,
  data: Record<string, unknown> | undefined,
  now = Date.now(),
): Subscription {
  const defaults = createDefaultSubscription(userId, now);
  const source = data ?? {};
  const tier = normalizeSubscriptionTier(source.tier ?? source.subscriptionTier ?? source.plan);

  return {
    id: typeof source.id === 'string' && source.id ? source.id : defaults.id,
    userId: typeof source.userId === 'string' && source.userId ? source.userId : userId,
    tier,
    status: normalizeStatus(source.status),
    currentPeriodStart: toMillis(source.currentPeriodStart, defaults.currentPeriodStart),
    currentPeriodEnd: toMillis(source.currentPeriodEnd, defaults.currentPeriodEnd),
    cancelAtPeriodEnd: typeof source.cancelAtPeriodEnd === 'boolean' ? source.cancelAtPeriodEnd : false,
    ...(typeof source.trialEnd === 'number' ? { trialEnd: source.trialEnd } : {}),
    ...(typeof source.stripeCustomerId === 'string' ? { stripeCustomerId: source.stripeCustomerId } : {}),
    ...(typeof source.stripeSubscriptionId === 'string' ? { stripeSubscriptionId: source.stripeSubscriptionId } : {}),
    ...(typeof source.cancelReason === 'string' ? { cancelReason: source.cancelReason } : {}),
    createdAt: toMillis(source.createdAt, defaults.createdAt),
    updatedAt: toMillis(source.updatedAt, now),
  };
}

export async function getOrCreateSubscription(db: Firestore, userId: string): Promise<Subscription> {
  const ref = db.collection('subscriptions').doc(userId);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const subscription = normalizeSubscriptionData(
      userId,
      snapshot.exists ? snapshot.data() as Record<string, unknown> | undefined : undefined,
    );

    tx.set(ref, subscription, { merge: true });
    return subscription;
  });
}
