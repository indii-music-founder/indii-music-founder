import { randomUUID } from 'node:crypto';

import {
    ORGANIZATION_ACCESS_MODULES,
    ORGANIZATION_ROLES,
    defaultModulesForOrganizationRole,
    type OrganizationAccessModule,
    type OrganizationAccessMatrix,
    type OrganizationAccessRow,
    type OrganizationRole,
} from '@indii/shared';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { arcjetKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { requireVerifiedServerEntitlement } from '../auth/entitlements';
import {
    policyClassForServerEntitlement,
    protectAuthenticatedApiRequest,
} from './arcjet';

const getAccessMatrixSchema = z.object({
    orgId: z.string().trim().min(1).max(128),
}).strict();

const updateMemberAccessSchema = z.object({
    orgId: z.string().trim().min(1).max(128),
    targetUserId: z.string().trim().min(1).max(128),
    role: z.enum(ORGANIZATION_ROLES).exclude(['owner']),
    allowedModules: z.array(z.enum(ORGANIZATION_ACCESS_MODULES))
        .max(ORGANIZATION_ACCESS_MODULES.length),
}).strict();

interface OrganizationRecord {
    ownerId: string;
    members: string[];
    memberRoles?: Record<string, unknown>;
}

interface StoredAccessPolicy {
    role?: unknown;
    allowedModules?: unknown;
    updatedAt?: unknown;
}

export interface OrganizationAccessStore {
    getOrganization(orgId: string): Promise<OrganizationRecord | null>;
    getPolicies(orgId: string, userIds: string[]): Promise<Map<string, StoredAccessPolicy>>;
    updateMemberPolicy(input: {
        orgId: string;
        actorUserId: string;
        targetUserId: string;
        role: Exclude<OrganizationRole, 'owner'>;
        allowedModules: OrganizationAccessModule[];
        nowIso: string;
    }): Promise<void>;
}

function isOrganizationRole(value: unknown): value is OrganizationRole {
    return typeof value === 'string' && (ORGANIZATION_ROLES as readonly string[]).includes(value);
}

function normalizeAllowedModules(value: unknown): OrganizationAccessModule[] | null {
    if (!Array.isArray(value)) return null;
    const allowed = new Set<string>(ORGANIZATION_ACCESS_MODULES);
    if (!value.every(moduleId => typeof moduleId === 'string' && allowed.has(moduleId))) return null;
    return ORGANIZATION_ACCESS_MODULES.filter(moduleId => value.includes(moduleId));
}

function timestampToIso(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate !== 'function') return null;
    const date = toDate.call(value);
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function roleForMember(org: OrganizationRecord, userId: string): OrganizationRole {
    if (userId === org.ownerId) return 'owner';
    const configured = org.memberRoles?.[userId];
    return isOrganizationRole(configured) && configured !== 'owner' ? configured : 'member';
}

function rowForMember(
    org: OrganizationRecord,
    userId: string,
    policy: StoredAccessPolicy | undefined,
): OrganizationAccessRow {
    const role = roleForMember(org, userId);
    // Do not hydrate arbitrary member UIDs from /users. Membership can be
    // owner-managed, so profile lookup here would turn this callable into a
    // UID-to-email directory oracle. An accepted-invite identity record can
    // supply safe display metadata when that workflow exists.
    if (role === 'owner') {
        return {
            userId,
            displayName: null,
            email: null,
            role,
            allowedModules: defaultModulesForOrganizationRole('owner'),
            source: 'owner',
            updatedAt: null,
        };
    }

    const storedModules = policy?.role === role
        ? normalizeAllowedModules(policy.allowedModules)
        : null;
    return {
        userId,
        displayName: null,
        email: null,
        role,
        allowedModules: storedModules ?? defaultModulesForOrganizationRole(role),
        source: storedModules ? 'explicit' : 'role-default',
        updatedAt: storedModules ? timestampToIso(policy?.updatedAt) : null,
    };
}

function firestoreOrganizationAccessStore(firestore: Firestore): OrganizationAccessStore {
    return {
        async getOrganization(orgId) {
            const snapshot = await firestore.collection('organizations').doc(orgId).get();
            if (!snapshot.exists) return null;
            const data = snapshot.data() ?? {};
            return {
                ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
                members: Array.isArray(data.members)
                    ? data.members.filter((member): member is string => typeof member === 'string')
                    : [],
                memberRoles: data.memberRoles && typeof data.memberRoles === 'object'
                    ? data.memberRoles as Record<string, unknown>
                    : undefined,
            };
        },
        async getPolicies(orgId, userIds) {
            const references = userIds.map(userId => firestore
                .collection('organizations').doc(orgId)
                .collection('accessPolicies').doc(userId));
            const snapshots = references.length > 0 ? await firestore.getAll(...references) : [];
            return new Map(snapshots
                .filter(snapshot => snapshot.exists)
                .map(snapshot => [snapshot.id, snapshot.data() as StoredAccessPolicy]));
        },
        async updateMemberPolicy(input) {
            const orgRef = firestore.collection('organizations').doc(input.orgId);
            const policyRef = orgRef.collection('accessPolicies').doc(input.targetUserId);
            const auditRef = orgRef.collection('accessAudit').doc();
            await firestore.runTransaction(async transaction => {
                const orgSnapshot = await transaction.get(orgRef);
                if (!orgSnapshot.exists) throw new HttpsError('not-found', 'Organization not found.');
                const data = orgSnapshot.data() ?? {};
                const ownerId = typeof data.ownerId === 'string' ? data.ownerId : '';
                const members = Array.isArray(data.members) ? data.members : [];
                if (ownerId !== input.actorUserId) {
                    throw new HttpsError('permission-denied', 'Only the organization owner can change access.');
                }
                if (input.targetUserId === ownerId) {
                    throw new HttpsError('failed-precondition', 'Organization owner access cannot be reduced.');
                }
                if (!members.includes(input.targetUserId)) {
                    throw new HttpsError('not-found', 'Organization member not found.');
                }

                transaction.update(orgRef, {
                    [`memberRoles.${input.targetUserId}`]: input.role,
                });
                transaction.set(policyRef, {
                    orgId: input.orgId,
                    userId: input.targetUserId,
                    role: input.role,
                    allowedModules: input.allowedModules,
                    version: 1,
                    updatedBy: input.actorUserId,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                transaction.create(auditRef, {
                    action: 'organization_access_updated',
                    orgId: input.orgId,
                    actorUserId: input.actorUserId,
                    targetUserId: input.targetUserId,
                    role: input.role,
                    allowedModules: input.allowedModules,
                    occurredAt: FieldValue.serverTimestamp(),
                    requestedAt: input.nowIso,
                });
            });
        },
    };
}

type RequestAdmission = (request: CallableRequest<unknown>, operation: string) => Promise<string>;

export async function admitOrganizationAccessRequest(
    request: CallableRequest<unknown>,
    operation: string,
    dependencies: {
        validateAppCheck?: typeof validateAppCheckV2;
        resolveEntitlement?: typeof requireVerifiedServerEntitlement;
        protect?: typeof protectAuthenticatedApiRequest;
        policyForEntitlement?: typeof policyClassForServerEntitlement;
    } = {},
): Promise<string> {
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
        operationId: `${operation}:${randomUUID()}`,
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
    return uid;
}

export async function resolveOrganizationAccessMatrix(
    request: CallableRequest<unknown>,
    dependencies: {
        admit?: RequestAdmission;
        store?: OrganizationAccessStore;
    } = {},
): Promise<OrganizationAccessMatrix> {
    const parsed = getAccessMatrixSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'A valid organization ID is required.');
    const uid = await (dependencies.admit ?? admitOrganizationAccessRequest)(request, 'organization-access-read');
    const store = dependencies.store ?? firestoreOrganizationAccessStore(getFirestore());
    const organization = await store.getOrganization(parsed.data.orgId);
    if (!organization) throw new HttpsError('not-found', 'Organization not found.');
    if (!organization.members.includes(uid)) {
        throw new HttpsError('permission-denied', 'You are not a member of this organization.');
    }

    const canManage = organization.ownerId === uid;
    const visibleUserIds = canManage ? organization.members : [uid];
    const policies = await store.getPolicies(parsed.data.orgId, visibleUserIds);
    return {
        orgId: parsed.data.orgId,
        canManage,
        viewerUserId: uid,
        members: visibleUserIds.map(userId => rowForMember(
            organization,
            userId,
            policies.get(userId),
        )),
    };
}

export async function resolveUpdateOrganizationMemberAccess(
    request: CallableRequest<unknown>,
    dependencies: {
        admit?: RequestAdmission;
        store?: OrganizationAccessStore;
        now?: () => Date;
    } = {},
): Promise<OrganizationAccessRow> {
    const parsed = updateMemberAccessSchema.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'The access policy is invalid.');
    const uid = await (dependencies.admit ?? admitOrganizationAccessRequest)(request, 'organization-access-update');
    const store = dependencies.store ?? firestoreOrganizationAccessStore(getFirestore());
    const organization = await store.getOrganization(parsed.data.orgId);
    if (!organization) throw new HttpsError('not-found', 'Organization not found.');
    if (organization.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'Only the organization owner can change access.');
    }
    if (parsed.data.targetUserId === organization.ownerId) {
        throw new HttpsError('failed-precondition', 'Organization owner access cannot be reduced.');
    }
    if (!organization.members.includes(parsed.data.targetUserId)) {
        throw new HttpsError('not-found', 'Organization member not found.');
    }

    const requestedModules = new Set(parsed.data.allowedModules);
    const allowedModules = ORGANIZATION_ACCESS_MODULES.filter(moduleId =>
        requestedModules.has(moduleId));
    const nowIso = (dependencies.now ?? (() => new Date()))().toISOString();
    await store.updateMemberPolicy({
        orgId: parsed.data.orgId,
        actorUserId: uid,
        targetUserId: parsed.data.targetUserId,
        role: parsed.data.role,
        allowedModules,
        nowIso,
    });
    return {
        userId: parsed.data.targetUserId,
        displayName: null,
        email: null,
        role: parsed.data.role,
        allowedModules,
        source: 'explicit',
        updatedAt: nowIso,
    };
}

export const organizationAccessCallableOptions = {
    secrets: [arcjetKey],
    enforceAppCheck: true,
    region: 'us-central1',
    timeoutSeconds: 15,
    memory: '512MiB' as const,
};

export const getOrganizationAccessMatrix = onCall(
    organizationAccessCallableOptions,
    request => resolveOrganizationAccessMatrix(request),
);

export const updateOrganizationMemberAccess = onCall(
    organizationAccessCallableOptions,
    request => resolveUpdateOrganizationMemberAccess(request),
);
