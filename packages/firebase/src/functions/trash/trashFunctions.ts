import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import crypto from 'crypto';

if (!admin.apps.length) {
    admin.initializeApp();
}

const TRASH_ID_PATTERN = /^trash_[A-Za-z0-9_-]{1,120}$/;
const MAX_PURGE_ITEMS = 100;

type TrashResourceType = 'file_nodes' | 'history' | 'brand_assets' | 'knowledge_docs' | 'local_files';

interface PurgeRequest {
    trashIds: string[];
    confirmation?: string;
    intentToken?: string;
}

interface TrashManifest {
    type: TrashResourceType;
    targetId: string;
    quarantinePath?: string;
    restoreData?: Record<string, unknown>;
}

function parseTrashIds(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PURGE_ITEMS) {
        throw new HttpsError('invalid-argument', `trashIds must contain between 1 and ${MAX_PURGE_ITEMS} items.`);
    }
    const ids = value.map(id => {
        if (typeof id !== 'string' || !TRASH_ID_PATTERN.test(id)) {
            throw new HttpsError('invalid-argument', 'One or more trash IDs are invalid.');
        }
        return id;
    });
    if (new Set(ids).size !== ids.length) {
        throw new HttpsError('invalid-argument', 'trashIds cannot contain duplicates.');
    }
    return ids;
}

function sameIds(left: unknown, right: string[]): boolean {
    if (!Array.isArray(left) || left.length !== right.length) return false;
    const expected = [...right].sort();
    const actual = left.every(value => typeof value === 'string') ? [...left].sort() : [];
    return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function storagePathFromReference(value: unknown, bucketName: string): string | null {
    if (typeof value !== 'string' || value.length === 0) return null;
    if (value.startsWith('gs://')) {
        const withoutScheme = value.slice(5);
        const slash = withoutScheme.indexOf('/');
        if (slash < 0 || withoutScheme.slice(0, slash) !== bucketName) return null;
        return withoutScheme.slice(slash + 1);
    }
    try {
        const parsed = new URL(value);
        if (parsed.hostname === 'firebasestorage.googleapis.com') {
            const marker = '/o/';
            const markerIndex = parsed.pathname.indexOf(marker);
            return markerIndex >= 0 ? decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length)) : null;
        }
        if (parsed.hostname === 'storage.googleapis.com') {
            const prefix = `/${bucketName}/`;
            return parsed.pathname.startsWith(prefix) ? decodeURIComponent(parsed.pathname.slice(prefix.length)) : null;
        }
    } catch {
        return null;
    }
    return null;
}

function assertOwnedStoragePath(path: string, uid: string, trashId: string, type: TrashResourceType): void {
    const allowedPrefixes = type === 'knowledge_docs'
        ? [`rag-sources/${uid}/`, `users/${uid}/trash/${trashId}/`]
        : type === 'brand_assets'
            ? [`users/${uid}/brand_assets/`, `users/${uid}/reference_images/`, `users/${uid}/trash/${trashId}/`]
            : type === 'local_files'
                ? []
                : [`users/${uid}/`, `videos/${uid}/`, `users/${uid}/trash/${trashId}/`];
    if (!allowedPrefixes.some(prefix => path.startsWith(prefix))) {
        throw new HttpsError('permission-denied', 'Trash payload path is outside the authenticated user scope.');
    }
}

function collectStoragePaths(
    manifest: TrashManifest,
    sourceData: Record<string, unknown> | undefined,
    uid: string,
    trashId: string,
    bucketName: string,
): string[] {
    const paths = new Set<string>();
    if (manifest.quarantinePath) {
        const expectedPrefix = `users/${uid}/trash/${trashId}/`;
        if (!manifest.quarantinePath.startsWith(expectedPrefix)) {
            throw new HttpsError('permission-denied', 'Invalid quarantine payload path.');
        }
        paths.add(manifest.quarantinePath);
    }

    const candidates: unknown[] = [];
    if (sourceData) {
        for (const key of ['storagePath', 'storageUri', 'url', 'thumbnailUrl', 'downloadUrl']) {
            candidates.push(sourceData[key]);
        }
        const nestedData = sourceData.data;
        if (nestedData && typeof nestedData === 'object') {
            for (const key of ['storagePath', 'storageUri', 'url', 'thumbnailUrl', 'downloadUrl']) {
                candidates.push((nestedData as Record<string, unknown>)[key]);
            }
        }
    }
    const restoredAsset = manifest.restoreData?.asset;
    if (restoredAsset && typeof restoredAsset === 'object') {
        candidates.push((restoredAsset as Record<string, unknown>).url);
    }

    for (const candidate of candidates) {
        const path = storagePathFromReference(candidate, bucketName);
        if (!path) continue;
        assertOwnedStoragePath(path, uid, trashId, manifest.type);
        paths.add(path);
    }
    return [...paths];
}

function isNotFoundStorageError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { code?: unknown; statusCode?: unknown };
    return candidate.code === 404 || candidate.statusCode === 404;
}

export const createPurgeIntent = onCall({ enforceAppCheck: true }, async (request: CallableRequest<PurgeRequest>) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to create a purge intent.');
    }

    const uid = request.auth.uid;
    const trashIds = parseTrashIds(request.data?.trashIds);
    if (request.data?.confirmation !== 'DELETE') {
        throw new HttpsError('invalid-argument', 'Confirmation string must explicitly match "DELETE".');
    }

    const authTime = request.auth.token.auth_time;
    const currentTime = Math.floor(Date.now() / 1000);
    if (typeof authTime !== 'number' || authTime > currentTime + 60 || currentTime - authTime > 600) {
        throw new HttpsError('unauthenticated', 'Fresh re-authentication required before creating a purge intent.');
    }

    const intentId = `intent_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = Date.now() + 5 * 60 * 1000;
    await admin.firestore().collection('users').doc(uid).collection('purgeIntents').doc(intentId).set({
        intentId,
        uid,
        trashIds,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, intentToken: intentId, expiresAt };
});

export const purgeTrashItems = onCall({ enforceAppCheck: true }, async (request: CallableRequest<PurgeRequest>) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated to execute purge.');
    }

    const uid = request.auth.uid;
    const trashIds = parseTrashIds(request.data?.trashIds);
    const intentToken = request.data?.intentToken;
    if (typeof intentToken !== 'string' || !/^intent_[a-f0-9]{32}$/.test(intentToken)) {
        throw new HttpsError('invalid-argument', 'Invalid purge intent token.');
    }

    const db = admin.firestore();
    const intentRef = db.collection('users').doc(uid).collection('purgeIntents').doc(intentToken);
    await db.runTransaction(async transaction => {
        const intentSnap = await transaction.get(intentRef);
        if (!intentSnap.exists) {
            throw new HttpsError('permission-denied', 'Invalid or expired purge intent token.');
        }
        const intent = intentSnap.data()!;
        if (intent.uid !== uid || Date.now() > intent.expiresAt || !sameIds(intent.trashIds, trashIds)) {
            throw new HttpsError('permission-denied', 'Purge intent is expired or is not bound to this exact item set.');
        }
        transaction.delete(intentRef);
    });

    const purgedIds: string[] = [];
    const failedIds: Array<{ id: string; error: string }> = [];
    const bucket = admin.storage().bucket();

    for (const trashId of trashIds) {
        try {
            const trashDocRef = db.collection('users').doc(uid).collection('trashItems').doc(trashId);
            const trashSnap = await trashDocRef.get();
            if (!trashSnap.exists) {
                failedIds.push({ id: trashId, error: 'Trash record not found' });
                continue;
            }

            const manifest = trashSnap.data() as TrashManifest;
            if (!['file_nodes', 'history', 'brand_assets', 'knowledge_docs', 'local_files'].includes(manifest.type)) {
                throw new HttpsError('failed-precondition', 'Trash record has an unsupported resource type.');
            }

            let sourceRef: admin.firestore.DocumentReference | undefined;
            if (manifest.type === 'file_nodes') sourceRef = db.collection('file_nodes').doc(manifest.targetId);
            if (manifest.type === 'history') sourceRef = db.collection('history').doc(manifest.targetId);
            if (manifest.type === 'knowledge_docs') sourceRef = db.collection('users').doc(uid).collection('ragDocuments').doc(manifest.targetId);

            const sourceSnap = sourceRef ? await sourceRef.get() : undefined;
            const sourceData = sourceSnap?.exists ? sourceSnap.data() as Record<string, unknown> : undefined;
            if (sourceData) {
                const owner = manifest.type === 'knowledge_docs' ? sourceData.uid : sourceData.userId;
                if (owner !== uid) throw new HttpsError('permission-denied', 'Trash source is not owned by the authenticated user.');
            }

            const storagePaths = collectStoragePaths(manifest, sourceData, uid, trashId, bucket.name);
            for (const storagePath of storagePaths) {
                try {
                    await bucket.file(storagePath).delete();
                } catch (error: unknown) {
                    if (!isNotFoundStorageError(error)) throw error;
                }
            }

            if (manifest.type === 'knowledge_docs' && sourceRef && sourceSnap?.exists) {
                await db.recursiveDelete(sourceRef);
            }

            const auditRef = db.collection('users').doc(uid).collection('auditLogs').doc();
            const batch = db.batch();
            if (sourceRef) batch.delete(sourceRef);
            batch.delete(trashDocRef);
            batch.set(auditRef, {
                action: 'TRASH_PERMANENT_PURGE',
                trashId,
                type: manifest.type,
                actorUid: uid,
                purgedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await batch.commit();
            purgedIds.push(trashId);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            failedIds.push({ id: trashId, error: message });
        }
    }

    return { success: failedIds.length === 0, purgedIds, failedIds };
});
