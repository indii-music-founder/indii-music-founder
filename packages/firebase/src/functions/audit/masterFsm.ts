import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
    canTransitionMasterLifecycle,
    MasterAdminStateSchema,
    MASTER_ADMIN_STATE_SCHEMA_VERSION,
    type LifecycleActor,
    type MasterLifecycleStatus,
} from '@indii/shared';

/**
 * masterFsm — the ONLY writer of `users/{uid}/master_admin/{masterHash}`
 * (Post-Mastering Administrative Engine P2; plan §1.1 / §3).
 *
 * Every transition is a Firestore transaction that: reads current state,
 * validates the edge against the shared legal-edge table, appends the history
 * chain, and stamps timestamps. Illegal transitions throw; re-confirming the
 * current status is an idempotent no-op. Clients can never write this
 * collection (firestore.rules: read-only for the owner).
 */

// Lazy Firestore handle: a bare getFirestore() at module top level throws at
// import time in test environments (import-crash class, see 2179e43a).
function getDb() {
    return getFirestore();
}

export class MasterLifecycleTransitionError extends Error {
    constructor(
        public readonly userId: string,
        public readonly masterHash: string,
        public readonly from: MasterLifecycleStatus,
        public readonly to: MasterLifecycleStatus,
    ) {
        super(
            `Illegal master lifecycle transition ${from} → ${to} for ${masterHash} ` +
                `(owner ${userId}).`,
        );
        this.name = 'MasterLifecycleTransitionError';
    }
}

export interface MasterAdminSnapshot {
    lifecycle: MasterLifecycleStatus;
    generation: string;
    openTaskIds: string[];
    ledgerReceiptId?: string;
    raw: Record<string, unknown> | undefined;
}

const MAX_HISTORY = 200;

function docPath(userId: string, masterHash: string) {
    return getDb().collection('users').doc(userId).collection('master_admin').doc(masterHash);
}

export async function readMasterAdminState(
    userId: string,
    masterHash: string,
): Promise<MasterAdminSnapshot | undefined> {
    const snap = await docPath(userId, masterHash).get();
    if (!snap.exists) return undefined;
    const data = snap.data() ?? {};
    return {
        lifecycle: data['lifecycle'] as MasterLifecycleStatus,
        generation: String(data['generation'] ?? ''),
        openTaskIds: Array.isArray(data['openTaskIds']) ? (data['openTaskIds'] as string[]) : [],
        ledgerReceiptId: typeof data['ledgerReceiptId'] === 'string' ? data['ledgerReceiptId'] : undefined,
        raw: data,
    };
}

/** Create the DRAFT state document when absent. Idempotent. */
export async function ensureMasterAdminState(
    userId: string,
    params: { masterHash: string; storagePath: string; generation: string },
): Promise<{ created: boolean }> {
    const nowIso = new Date().toISOString();
    const reference = docPath(userId, params.masterHash);
    let created = false;
    await getDb().runTransaction(async (tx) => {
        const snap = await tx.get(reference);
        if (snap.exists) return;
        created = true;
        const state = MasterAdminStateSchema.parse({
            id: params.masterHash,
            userId,
            schemaVersion: MASTER_ADMIN_STATE_SCHEMA_VERSION,
            masterHash: params.masterHash,
            storagePath: params.storagePath,
            generation: params.generation,
            lifecycle: 'DRAFT',
            enteredAt: nowIso,
            history: [],
            openTaskIds: [],
            createdAt: nowIso,
            updatedAt: nowIso,
        });
        tx.set(reference, toFirestoreState(state));
    });
    return { created };
}

/**
 * Transactional, edge-validated transition. Returns the resulting edge.
 * Re-asserting the current status is an idempotent no-op (`changed: false`).
 */
export async function transitionMasterLifecycle(
    userId: string,
    masterHash: string,
    to: MasterLifecycleStatus,
    actor: LifecycleActor,
    reason?: string,
): Promise<{ from: MasterLifecycleStatus; to: MasterLifecycleStatus; changed: boolean }> {
    const reference = docPath(userId, masterHash);
    let result: { from: MasterLifecycleStatus; to: MasterLifecycleStatus; changed: boolean } =
        { from: to, to, changed: false };

    await getDb().runTransaction(async (tx) => {
        const snap = await tx.get(reference);
        if (!snap.exists) {
            throw new MasterLifecycleTransitionError(userId, masterHash, 'DRAFT', to);
        }
        const data = snap.data() ?? {};
        const from = data['lifecycle'] as MasterLifecycleStatus;
        if (!from) {
            throw new MasterLifecycleTransitionError(userId, masterHash, 'DRAFT', to);
        }
        if (from === to) {
            result = { from, to, changed: false };
            return;
        }
        if (!canTransitionMasterLifecycle(from, to)) {
            throw new MasterLifecycleTransitionError(userId, masterHash, from, to);
        }

        const now = Timestamp.now();
        const nowIso = now.toDate().toISOString();
        const history = Array.isArray(data['history']) ? [...(data['history'] as unknown[])] : [];
        history.push({ from, to, at: nowIso, actor, ...(reason ? { reason } : {}) });
        // Bounded history: keep the most recent MAX_HISTORY transitions.
        const trimmedHistory = history.slice(-MAX_HISTORY);

        tx.update(reference, {
            lifecycle: to,
            enteredAt: now,
            'history': trimmedHistory,
            updatedAt: now,
            serverUpdatedAt: now,
        });
        result = { from, to, changed: true };
    });

    return result;
}

/**
 * Replace the open-task pointer list. Separated from transitions so audits
 * can update bookkeeping without touching lifecycle state.
 */
export async function setMasterOpenTasks(userId: string, masterHash: string, openTaskIds: string[]): Promise<void> {
    await docPath(userId, masterHash).set(
        { openTaskIds, updatedAt: Timestamp.now(), serverUpdatedAt: FieldValue.serverTimestamp() },
        { merge: true },
    );
}

/** ISO-string domain object → Firestore document (timestamps where rules demand). */
function toFirestoreState(state: Record<string, unknown>): Record<string, unknown> {
    const now = Timestamp.now();
    return {
        ...state,
        createdAt: Timestamp.fromDate(new Date(state['createdAt'] as string)),
        updatedAt: Timestamp.fromDate(new Date(state['updatedAt'] as string)),
        enteredAt: Timestamp.fromDate(new Date(state['enteredAt'] as string)),
        serverUpdatedAt: now,
    };
}
