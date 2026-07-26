import { createHash } from 'node:crypto';

import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

import { SubscriptionTier } from '../../shared/subscription/types';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { arcjetKey } from '../../config/secrets';
import { policyClassForServerEntitlement, protectAuthenticatedApiRequest } from '../security/arcjet';

export const ACCOUNT_ENTITLEMENT_SCHEMA_VERSION = 'account-entitlement.v1' as const;

export type BudgetTier = 'free' | 'pro' | 'founder' | 'enterprise';
export type EntitlementSource = 'verified_email' | 'founder_registry_migration' | 'founder_activation';

export interface AccountEntitlement {
    schemaVersion: typeof ACCOUNT_ENTITLEMENT_SCHEMA_VERSION;
    uid: string;
    tier: SubscriptionTier;
    status: 'active';
    source: EntitlementSource;
    grantId: string;
}

export interface VerifiedAccountIdentity {
    uid: string;
    emailVerified: boolean;
}

export interface EntitlementRepository {
    provisionVerifiedAccount(uid: string): Promise<AccountEntitlement>;
}

export interface AccountIdentityDirectory {
    getUser(uid: string): Promise<{ uid: string; emailVerified: boolean }>;
}

function requireUid(value: string): string {
    const uid = value.trim();
    if (!uid || uid.length > 128 || uid.includes('/')) {
        throw new HttpsError('invalid-argument', 'Authenticated user identifier is invalid.');
    }
    return uid;
}

function isSubscriptionTier(value: unknown): value is SubscriptionTier {
    return Object.values(SubscriptionTier).includes(value as SubscriptionTier);
}

function entitlementFromUnknown(value: unknown): AccountEntitlement | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const data = value as Record<string, unknown>;
    if (
        data.schemaVersion !== ACCOUNT_ENTITLEMENT_SCHEMA_VERSION ||
        typeof data.uid !== 'string' ||
        !isSubscriptionTier(data.tier) ||
        data.status !== 'active' ||
        typeof data.source !== 'string' ||
        typeof data.grantId !== 'string'
    ) {
        return undefined;
    }
    if (!['verified_email', 'founder_registry_migration', 'founder_activation'].includes(data.source)) {
        return undefined;
    }
    return {
        schemaVersion: ACCOUNT_ENTITLEMENT_SCHEMA_VERSION,
        uid: data.uid,
        tier: data.tier,
        status: 'active',
        source: data.source as EntitlementSource,
        grantId: data.grantId,
    };
}

function grantId(uid: string, tier: SubscriptionTier, source: EntitlementSource, reference: string): string {
    return `ent_${createHash('sha256')
        .update(`${ACCOUNT_ENTITLEMENT_SCHEMA_VERSION}\0${uid}\0${tier}\0${source}\0${reference}`, 'utf8')
        .digest('hex')
        .slice(0, 48)}`;
}

function entitlementRefs(firestore: Firestore, uid: string) {
    const userRef = firestore.collection('users').doc(uid);
    return {
        current: userRef.collection('entitlements').doc('current'),
        audit: (id: string) => userRef.collection('entitlementAudit').doc(id),
        founder: firestore.collection('founders').doc(uid),
    };
}

function currentEntitlementOrThrow(value: unknown, uid: string): AccountEntitlement | undefined {
    const entitlement = entitlementFromUnknown(value);
    if (!entitlement) return undefined;
    if (entitlement.uid !== uid) {
        throw new HttpsError('failed-precondition', 'Entitlement ownership does not match the authenticated account.');
    }
    return entitlement;
}

function firestoreEntitlementRepository(firestore: Firestore): EntitlementRepository {
    return {
        async provisionVerifiedAccount(rawUid: string): Promise<AccountEntitlement> {
            const uid = requireUid(rawUid);
            const refs = entitlementRefs(firestore, uid);
            return firestore.runTransaction(async transaction => {
                const [currentSnapshot, founderSnapshot] = await Promise.all([
                    transaction.get(refs.current),
                    transaction.get(refs.founder),
                ]);
                const existing = currentSnapshot.exists
                    ? currentEntitlementOrThrow(currentSnapshot.data(), uid)
                    : undefined;
                if (existing) return existing;

                const isFounder = founderSnapshot.exists;
                const tier = isFounder ? SubscriptionTier.FOUNDER : SubscriptionTier.FREE;
                const source: EntitlementSource = isFounder ? 'founder_registry_migration' : 'verified_email';
                const reference = isFounder ? refs.founder.path : uid;
                const record: AccountEntitlement = {
                    schemaVersion: ACCOUNT_ENTITLEMENT_SCHEMA_VERSION,
                    uid,
                    tier,
                    status: 'active',
                    source,
                    grantId: grantId(uid, tier, source, reference),
                };

                transaction.create(refs.current, {
                    ...record,
                    issuedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                });
                transaction.create(refs.audit(record.grantId), {
                    ...record,
                    evidence: [{ type: isFounder ? 'founder_registry' : 'firebase_auth_email_verification', reference }],
                    issuedAt: FieldValue.serverTimestamp(),
                });
                return record;
            });
        },
    };
}

/**
 * Establishes the Free entitlement only after the server has verified the
 * account identity. Clients cannot choose a tier, grant source, or audit ID.
 */
export async function requireVerifiedAccountEntitlement(
    identity: VerifiedAccountIdentity,
    repository: EntitlementRepository = firestoreEntitlementRepository(getFirestore()),
): Promise<AccountEntitlement> {
    const uid = requireUid(identity.uid);
    if (identity.emailVerified !== true) {
        throw new HttpsError('failed-precondition', 'Verify your email before activating an indii entitlement.');
    }
    return repository.provisionVerifiedAccount(uid);
}

/**
 * Resolves a spend authorization from the current Firebase Auth user, rather
 * than trusting a cached browser token or profile field. It is safe for queue
 * workers and Firestore triggers that do not carry the original request token.
 */
export async function requireVerifiedServerEntitlement(
    rawUid: string,
    identityDirectory: AccountIdentityDirectory = getAuth() as Auth,
    repository: EntitlementRepository = firestoreEntitlementRepository(getFirestore()),
): Promise<AccountEntitlement> {
    const uid = requireUid(rawUid);
    const account = await identityDirectory.getUser(uid);
    if (account.uid !== uid) {
        throw new HttpsError('failed-precondition', 'Resolved account identity does not match the requested entitlement.');
    }
    return requireVerifiedAccountEntitlement({ uid, emailVerified: account.emailVerified }, repository);
}

/** Converts canonical subscription tiers into the server budget policy vocabulary. */
export function entitlementTierToBudgetTier(tier: SubscriptionTier): BudgetTier {
    switch (tier) {
        case SubscriptionTier.FOUNDER:
            return 'founder';
        case SubscriptionTier.PRO_MONTHLY:
        case SubscriptionTier.PRO_YEARLY:
            return 'pro';
        case SubscriptionTier.STUDIO:
            return 'enterprise';
        case SubscriptionTier.FREE:
        default:
            return 'free';
    }
}

/**
 * Used by the existing founder activation transaction so paid Founder access
 * is materialized in the same server-owned entitlement model as Free access.
 */
export function writeFounderEntitlementGrant(
    transaction: Transaction,
    firestore: Firestore,
    rawUid: string,
    founderReference: string,
): AccountEntitlement {
    const uid = requireUid(rawUid);
    const source: EntitlementSource = 'founder_activation';
    const record: AccountEntitlement = {
        schemaVersion: ACCOUNT_ENTITLEMENT_SCHEMA_VERSION,
        uid,
        tier: SubscriptionTier.FOUNDER,
        status: 'active',
        source,
        grantId: grantId(uid, SubscriptionTier.FOUNDER, source, founderReference),
    };
    const refs = entitlementRefs(firestore, uid);
    transaction.set(refs.current, {
        ...record,
        issuedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(refs.audit(record.grantId), {
        ...record,
        evidence: [{ type: 'founder_activation', reference: founderReference }],
        issuedAt: FieldValue.serverTimestamp(),
    });
    return record;
}

/**
 * Admission for the low-cost entitlement-provisioning boundary. A verified
 * Firebase account is necessary but not sufficient: App Check protects the
 * callable from scripted browser abuse and Arcjet protects the request rate.
 * The resolved entitlement and policy never come from client input.
 */
export async function admitVerifiedEntitlementProvisioning(
    request: CallableRequest<unknown>,
    dependencies: {
        validateAppCheck?: typeof validateAppCheckV2;
        resolveEntitlement?: typeof requireVerifiedServerEntitlement;
        protect?: typeof protectAuthenticatedApiRequest;
        policyForEntitlement?: typeof policyClassForServerEntitlement;
    } = {},
): Promise<{ uid: string; entitlement: AccountEntitlement }> {
    const validateAppCheck = dependencies.validateAppCheck ?? validateAppCheckV2;
    const resolveEntitlement = dependencies.resolveEntitlement ?? requireVerifiedServerEntitlement;
    const protect = dependencies.protect ?? protectAuthenticatedApiRequest;
    const policyForEntitlement = dependencies.policyForEntitlement ?? policyClassForServerEntitlement;

    validateAppCheck(request);
    const uid = typeof request.auth?.uid === 'string' ? request.auth.uid : '';
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication is required.');

    const entitlement = await resolveEntitlement(uid);
    if (!request.rawRequest) {
        throw new HttpsError('unavailable', 'Request protection is temporarily unavailable.');
    }
    const protection = await protect(request.rawRequest, {
        userId: uid,
        policy: policyForEntitlement({
            tier: entitlement.tier,
            isAdmin: request.auth?.token.admin === true,
        }),
        operationId: `provision-entitlement:${crypto.randomUUID()}`,
    });
    if (!protection.allowed) {
        const code = protection.status === 429
            ? 'resource-exhausted'
            : protection.status === 403
                ? 'permission-denied'
                : 'unavailable';
        throw new HttpsError(code, protection.message, {
            code: protection.code,
            ...(protection.retryAfterSeconds ? { retryAfterSeconds: protection.retryAfterSeconds } : {}),
        });
    }
    return { uid, entitlement };
}

const verifiedEntitlementCallableOptions = {
    secrets: [arcjetKey],
    enforceAppCheck: false,
    region: 'us-central1',
    timeoutSeconds: 30,
    memory: '256MiB' as const,
};

/** Authenticated clients can request only their own verified Free entitlement. */
export const provisionVerifiedFreeEntitlement = onCall(
    verifiedEntitlementCallableOptions,
    async request => {
        const { entitlement } = await admitVerifiedEntitlementProvisioning(request);
        return {
            tier: entitlement.tier,
            status: entitlement.status,
            grantId: entitlement.grantId,
        };
    },
);
