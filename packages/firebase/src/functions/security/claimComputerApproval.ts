import { randomUUID } from 'node:crypto';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

type ExpectedApproval = { agentId: string; toolName: string; args: Record<string, unknown>; createdAtMs: number };

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

export const claimComputerApproval = onCall({ memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 }, async request => {
    const uid = request.auth?.uid;
    if (!uid || request.auth?.token.email_verified !== true) throw new HttpsError('unauthenticated', 'A verified signed-in user is required.');
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
        if (data.agentId !== expected.agentId || data.toolName !== expected.toolName || createdAtMs !== expected.createdAtMs || canonical(data.args ?? {}) !== canonical(expected.args)) {
            throw new HttpsError('failed-precondition', 'Computer approval scope changed before it could be claimed.');
        }
        transaction.update(ref, { status: 'claimed', claimedAt: FieldValue.serverTimestamp(), claimId: randomUUID() });
        return { id: approvalId, userId: uid, agentId: data.agentId, toolName: data.toolName, args: data.args ?? {}, status: 'claimed', createdAtMs };
    });
});

export const denyComputerApproval = onCall({ memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1 }, async request => {
    const uid = request.auth?.uid;
    if (!uid || request.auth?.token.email_verified !== true) throw new HttpsError('unauthenticated', 'A verified signed-in user is required.');
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
