import { randomUUID } from 'node:crypto';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { arcjetKey } from '../../config/secrets';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { protectAuthenticatedApiRequest } from '../security/arcjet';

type ExpectedApproval = { agentId: string; toolName: string; args: Record<string, unknown>; createdAtMs: number };
const COMPUTER_APPROVAL_MAX_AGE_MS = 5 * 60_000;

function canonical(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function parseExpected(value: unknown): ExpectedApproval {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpsError('invalid-argument', 'Expected approval scope is required.');
    const expected = value as Partial<ExpectedApproval>;
    if (typeof expected.agentId !== 'string' || typeof expected.toolName !== 'string' || !expected.toolName.startsWith('computer_') || !expected.args || typeof expected.args !== 'object' || Array.isArray(expected.args) || typeof expected.createdAtMs !== 'number') {
        throw new HttpsError('invalid-argument', 'Expected approval scope is invalid.');
    }
    return expected as ExpectedApproval;
}

export const claimComputerApproval = onCall({ memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, secrets: [arcjetKey] }, async request => {
    validateAppCheckV2(request);
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'A signed-in user is required.');
    if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
        throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
    }
    if (request.auth?.token?.email_verified !== true) {
        throw new HttpsError('permission-denied', 'A verified signed-in user is required.');
    }
    if (request.rawRequest) {
        const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
            userId: uid,
            policy: 'verified-free',
            operationId: `claim-computer-approval:${randomUUID()}`,
        });
        if (!protection.allowed) {
            throw new HttpsError(
                protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                protection.message,
            );
        }
    }
    const approvalId = request.data?.approvalId;
    if (typeof approvalId !== 'string' || approvalId.length < 1 || approvalId.length > 256) throw new HttpsError('invalid-argument', 'A valid approval ID is required.');
    const expected = parseExpected(request.data?.expected);
    const ref = getFirestore().doc(`users/${uid}/tool_approvals/${approvalId}`);

    return getFirestore().runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new HttpsError('not-found', 'Computer approval was not found.');
        const data = snapshot.data() ?? {};
        const createdAtMs = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Number.NaN;
        if (data.status !== 'pending') throw new HttpsError('failed-precondition', `Computer approval is not pending (status: ${String(data.status)}).`);
        const ageMs = Date.now() - createdAtMs;
        if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > COMPUTER_APPROVAL_MAX_AGE_MS) {
            throw new HttpsError('failed-precondition', 'Computer approval is expired or has an invalid creation time.');
        }
        if (data.agentId !== expected.agentId || data.toolName !== expected.toolName || createdAtMs !== expected.createdAtMs || canonical(data.args ?? {}) !== canonical(expected.args)) {
            throw new HttpsError('failed-precondition', 'Computer approval scope changed before it could be claimed.');
        }
        transaction.update(ref, { status: 'claimed', claimedAt: FieldValue.serverTimestamp(), claimId: randomUUID() });
        return { id: approvalId, userId: uid, agentId: data.agentId, toolName: data.toolName, args: data.args ?? {}, status: 'claimed', createdAtMs };
    });
});

export const denyComputerApproval = onCall({ memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, secrets: [arcjetKey] }, async request => {
    validateAppCheckV2(request);
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'A signed-in user is required.');
    if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
        throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
    }
    if (request.auth?.token?.email_verified !== true) {
        throw new HttpsError('permission-denied', 'A verified signed-in user is required.');
    }
    if (request.rawRequest) {
        const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
            userId: uid,
            policy: 'verified-free',
            operationId: `deny-computer-approval:${randomUUID()}`,
        });
        if (!protection.allowed) {
            throw new HttpsError(
                protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                protection.message,
            );
        }
    }
    const approvalId = request.data?.approvalId;
    if (typeof approvalId !== 'string' || approvalId.length < 1 || approvalId.length > 256) throw new HttpsError('invalid-argument', 'A valid approval ID is required.');
    const ref = getFirestore().doc(`users/${uid}/tool_approvals/${approvalId}`);
    await getFirestore().runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new HttpsError('not-found', 'Computer approval was not found.');
        const data = snapshot.data() ?? {};
        if (data.status !== 'pending' || typeof data.toolName !== 'string' || !data.toolName.startsWith('computer_')) throw new HttpsError('failed-precondition', 'Computer approval is not pending.');
        transaction.update(ref, { status: 'denied', deniedAt: FieldValue.serverTimestamp() });
    });
    return { denied: true };
});

export const completeComputerApproval = onCall({ memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, secrets: [arcjetKey] }, async request => {
    validateAppCheckV2(request);
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'A signed-in user is required.');
    if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
        throw new HttpsError('permission-denied', 'Anonymous accounts may not perform this operation.');
    }
    if (request.auth?.token?.email_verified !== true) {
        throw new HttpsError('permission-denied', 'A verified signed-in user is required.');
    }
    if (request.rawRequest) {
        const protection = await protectAuthenticatedApiRequest(request.rawRequest as never, {
            userId: uid,
            policy: 'verified-free',
            operationId: `complete-computer-approval:${randomUUID()}`,
        });
        if (!protection.allowed) {
            throw new HttpsError(
                protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable',
                protection.message,
            );
        }
    }
    const approvalId = request.data?.approvalId;
    if (typeof approvalId !== 'string' || approvalId.length < 1 || approvalId.length > 256) {
        throw new HttpsError('invalid-argument', 'A valid approval ID is required.');
    }
    const success = Boolean(request.data?.success);
    const error = typeof request.data?.error === 'string' ? request.data.error.slice(0, 1000) : undefined;
    const ref = getFirestore().doc(`users/${uid}/tool_approvals/${approvalId}`);

    return getFirestore().runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new HttpsError('not-found', 'Computer approval was not found.');
        const data = snapshot.data() ?? {};
        if (data.status !== 'claimed') {
            throw new HttpsError('failed-precondition', `Computer approval is not claimed (status: ${String(data.status)}).`);
        }
        const newStatus = success ? 'executed' : 'failed';
        transaction.update(ref, {
            status: newStatus,
            completedAt: FieldValue.serverTimestamp(),
            result: {
                success,
                ...(error ? { error } : {}),
            },
        });
        return { id: approvalId, status: newStatus, success };
    });
});
