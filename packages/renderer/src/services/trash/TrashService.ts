import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    writeBatch,
    type DocumentReference,
} from 'firebase/firestore';
import { auth, db, functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import {
    CreateTrashPurgeIntentResponseSchema,
    TrashItem,
    TrashTarget,
    TrashProvenance,
    TrashPurgeRequestSchema,
    TrashPurgeResult,
    TrashPurgeResultSchema,
    TrashResourceType,
    TrashItemSchema,
} from '@indii/shared';
import { desktopFileIndexService } from '@/services/agent/DesktopFileIndexService';

function pruneUndefined<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(item => pruneUndefined(item)) as T;
    }
    if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
        return value;
    }
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => [key, pruneUndefined(item)])
    ) as T;
}

export interface TrashAdapter {
    type: TrashResourceType;
    inspect(target: TrashTarget): Promise<{
        name: string;
        originalLocation: string;
        sizeBytes?: number;
        mimeType?: string;
        isRetentionLocked?: boolean;
        lockReason?: string;
        restoreData: Record<string, unknown>;
    }>;
    trash(trashId: string, target: TrashTarget, provenance: TrashProvenance, manifestRef?: DocumentReference): Promise<TrashItem>;
    restore(item: TrashItem, options?: { targetRelativePath?: string }, manifestRef?: DocumentReference): Promise<void>;
}

export class FileNodeTrashAdapter implements TrashAdapter {
    type: TrashResourceType = 'file_nodes';

    async inspect(target: TrashTarget) {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const nodeRef = doc(db, 'file_nodes', target.targetId);
        const snap = await getDoc(nodeRef);
        if (!snap.exists()) throw new Error(`FileNode '${target.targetId}' not found`);
        const data = snap.data();
        if (data.userId !== userId) throw new Error('Cannot trash a file node owned by another user.');
        if (data.isTrashed) throw new Error(`FileNode '${target.targetId}' is already in Trash.`);
        if (data.isRetentionLocked) {
            return {
                name: data.name || 'Untitled File',
                originalLocation: `fileNodes/${target.targetId}`,
                sizeBytes: data.size || 0,
                mimeType: data.mimeType,
                isRetentionLocked: true,
                lockReason: data.lockReason || 'Item is locked due to active release retention policy',
                restoreData: { ...data },
            };
        }
        return {
            name: data.name || 'Untitled File',
            originalLocation: `fileNodes/${target.targetId}`,
            sizeBytes: data.size || 0,
            mimeType: data.mimeType,
            restoreData: { ...data },
        };
    }

    async trash(trashId: string, target: TrashTarget, provenance: TrashProvenance, manifestRef?: DocumentReference): Promise<TrashItem> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const details = await this.inspect(target);
        if (details.isRetentionLocked) {
            throw new Error(`Cannot move to trash: ${details.lockReason}`);
        }

        const nodeRef = doc(db, 'file_nodes', target.targetId);
        const item: TrashItem = {
            id: trashId,
            userId,
            projectId: (details.restoreData.projectId as string) || undefined,
            type: 'file_nodes',
            targetId: target.targetId,
            name: details.name,
            originalLocation: details.originalLocation,
            mimeType: details.mimeType,
            sizeBytes: details.sizeBytes,
            provenance,
            state: 'trashed',
            idempotencyKey: `fn_${target.targetId}`,
            restoreData: details.restoreData,
            legalHold: { isLocked: false },
            hasEntries: false,
            trashedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const sourceUpdate = { isTrashed: true, trashedAt: new Date().toISOString() };
        if (manifestRef) {
            const batch = writeBatch(db);
            batch.update(nodeRef, sourceUpdate);
            batch.set(manifestRef, pruneUndefined(item));
            await batch.commit();
        } else {
            await updateDoc(nodeRef, sourceUpdate);
        }
        return item;
    }

    async restore(item: TrashItem, _options?: { targetRelativePath?: string }, manifestRef?: DocumentReference): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const nodeRef = doc(db, 'file_nodes', item.targetId);
        const snap = await getDoc(nodeRef);
        if (snap.exists() && !snap.data().isTrashed) {
            throw new Error(`Restore conflict: FileNode '${item.name}' already exists in active view.`);
        }
        const now = new Date().toISOString();
        const sourceUpdate = { isTrashed: false, restoredAt: now };
        if (snap.exists() && manifestRef) {
            const batch = writeBatch(db);
            batch.update(nodeRef, sourceUpdate);
            batch.update(manifestRef, { state: 'restored', restoredAt: now, updatedAt: now });
            await batch.commit();
        } else if (snap.exists()) {
            await updateDoc(nodeRef, sourceUpdate);
        } else {
            const restoredData = {
                ...item.restoreData,
                ...sourceUpdate,
            };
            if (manifestRef) {
                const batch = writeBatch(db);
                batch.set(nodeRef, restoredData);
                batch.update(manifestRef, { state: 'restored', restoredAt: now, updatedAt: now });
                await batch.commit();
            } else {
                await setDoc(nodeRef, restoredData);
            }
        }
    }
}

export class HistoryTrashAdapter implements TrashAdapter {
    type: TrashResourceType = 'history';

    async inspect(target: TrashTarget) {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const ref = doc(db, 'history', target.targetId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error(`History item '${target.targetId}' not found`);
        const data = snap.data();
        if (data.userId !== userId) throw new Error('Cannot trash history owned by another user.');
        if (data.isTrashed) throw new Error(`History item '${target.targetId}' is already in Trash.`);
        return {
            name: data.title || data.prompt || `History Output ${target.targetId.slice(0, 6)}`,
            originalLocation: `history/${target.targetId}`,
            mimeType: data.mimeType || 'image/png',
            restoreData: { ...data },
        };
    }

    async trash(trashId: string, target: TrashTarget, provenance: TrashProvenance, manifestRef?: DocumentReference): Promise<TrashItem> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const details = await this.inspect(target);
        const ref = doc(db, 'history', target.targetId);
        const item: TrashItem = {
            id: trashId,
            userId,
            projectId: (details.restoreData.projectId as string) || undefined,
            type: 'history',
            targetId: target.targetId,
            name: details.name,
            originalLocation: details.originalLocation,
            mimeType: details.mimeType,
            provenance,
            state: 'trashed',
            idempotencyKey: `hist_${target.targetId}`,
            restoreData: details.restoreData,
            legalHold: { isLocked: false },
            hasEntries: false,
            trashedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const sourceUpdate = { isTrashed: true, trashedAt: item.trashedAt };
        if (manifestRef) {
            const batch = writeBatch(db);
            batch.update(ref, sourceUpdate);
            batch.set(manifestRef, pruneUndefined(item));
            await batch.commit();
        } else {
            await updateDoc(ref, sourceUpdate);
        }
        return item;
    }

    async restore(item: TrashItem, _options?: { targetRelativePath?: string }, manifestRef?: DocumentReference): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const ref = doc(db, 'history', item.targetId);
        const now = new Date().toISOString();
        if (manifestRef) {
            const batch = writeBatch(db);
            batch.update(ref, { isTrashed: false, restoredAt: now });
            batch.update(manifestRef, { state: 'restored', restoredAt: now, updatedAt: now });
            await batch.commit();
        } else {
            await updateDoc(ref, { isTrashed: false, restoredAt: now });
        }
    }
}

export class BrandAssetTrashAdapter implements TrashAdapter {
    type: TrashResourceType = 'brand_assets';

    async inspect(target: TrashTarget) {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const ref = doc(db, 'users', userId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('User profile not found');
        const data = snap.data();
        const brandKit = (data.brandKit || {}) as Record<string, unknown>;
        const collections = ['brandAssets', 'referenceImages'] as const;
        for (const collectionName of collections) {
            const assets = Array.isArray(brandKit[collectionName])
                ? brandKit[collectionName] as Array<Record<string, unknown>>
                : [];
            const asset = assets.find(candidate => candidate.id === target.targetId || candidate.url === target.targetId);
            if (!asset) continue;
            return {
                name: String(asset.description || asset.name || 'Brand Asset'),
                originalLocation: `brandKit/${collectionName}`,
                mimeType: typeof asset.mimeType === 'string' ? asset.mimeType : undefined,
                restoreData: { collectionName, asset },
            };
        }
        throw new Error(`Brand asset '${target.targetId}' not found`);
    }

    async trash(trashId: string, target: TrashTarget, provenance: TrashProvenance, manifestRef?: DocumentReference): Promise<TrashItem> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const details = await this.inspect(target);
        const profileRef = doc(db, 'users', userId);
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) throw new Error('User profile not found');
        const collectionName = details.restoreData.collectionName as 'brandAssets' | 'referenceImages';
        const asset = details.restoreData.asset as Record<string, unknown>;
        const currentAssets = ((profileSnap.data().brandKit?.[collectionName] || []) as Array<Record<string, unknown>>);
        const nextAssets = currentAssets.filter(candidate => candidate.id !== asset.id && candidate.url !== asset.url);
        const item: TrashItem = {
            id: trashId,
            userId,
            projectId: ((details.restoreData.asset as Record<string, unknown>)?.projectId as string) || undefined,
            type: 'brand_assets',
            targetId: target.targetId,
            name: details.name,
            originalLocation: details.originalLocation,
            provenance,
            state: 'trashed',
            idempotencyKey: `ba_${target.targetId}`,
            restoreData: details.restoreData,
            legalHold: { isLocked: false },
            hasEntries: false,
            trashedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        if (manifestRef) {
            const batch = writeBatch(db);
            batch.update(profileRef, { [`brandKit.${collectionName}`]: nextAssets });
            batch.set(manifestRef, pruneUndefined(item));
            await batch.commit();
        } else {
            await updateDoc(profileRef, { [`brandKit.${collectionName}`]: nextAssets });
        }
        return item;
    }

    async restore(item: TrashItem, _options?: { targetRelativePath?: string }, manifestRef?: DocumentReference): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const profileRef = doc(db, 'users', userId);
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) throw new Error('User profile not found');
        const collectionName = item.restoreData.collectionName as 'brandAssets' | 'referenceImages';
        const asset = item.restoreData.asset as Record<string, unknown>;
        if (!['brandAssets', 'referenceImages'].includes(collectionName) || !asset || typeof asset !== 'object') {
            throw new Error('Invalid brand asset restore data.');
        }
        const currentAssets = ((profileSnap.data().brandKit?.[collectionName] || []) as Array<Record<string, unknown>>);
        const conflict = currentAssets.some(candidate => candidate.id === asset.id || candidate.url === asset.url);
        const now = new Date().toISOString();
        if (manifestRef) {
            const batch = writeBatch(db);
            if (!conflict) batch.update(profileRef, { [`brandKit.${collectionName}`]: [...currentAssets, asset] });
            batch.update(manifestRef, { state: 'restored', restoredAt: now, updatedAt: now });
            await batch.commit();
        } else if (!conflict) {
            await updateDoc(profileRef, { [`brandKit.${collectionName}`]: [...currentAssets, asset] });
        }
    }
}

export class KnowledgeTrashAdapter implements TrashAdapter {
    type: TrashResourceType = 'knowledge_docs';

    async inspect(target: TrashTarget) {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const ref = doc(db, 'users', userId, 'ragDocuments', target.targetId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error(`Knowledge document '${target.targetId}' not found`);
        const data = snap.data();
        if (data.uid !== userId) throw new Error('Cannot trash a knowledge document owned by another user.');
        if (data.isTrashed) throw new Error(`Knowledge document '${target.targetId}' is already in Trash.`);
        return {
            name: data.title || data.filename || 'Knowledge Doc',
            originalLocation: `ragDocuments/${target.targetId}`,
            restoreData: { ...data },
        };
    }

    async trash(trashId: string, target: TrashTarget, provenance: TrashProvenance, manifestRef?: DocumentReference): Promise<TrashItem> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const details = await this.inspect(target);
        const ref = doc(db, 'users', userId, 'ragDocuments', target.targetId);
        const item: TrashItem = {
            id: trashId,
            userId,
            projectId: (details.restoreData.projectId as string) || undefined,
            type: 'knowledge_docs',
            targetId: target.targetId,
            name: details.name,
            originalLocation: details.originalLocation,
            provenance,
            state: 'trashed',
            idempotencyKey: `kd_${target.targetId}`,
            restoreData: details.restoreData,
            legalHold: { isLocked: false },
            hasEntries: false,
            trashedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        const sourceUpdate = { isTrashed: true, isIndexed: false, state: 'failed', trashedAt: item.trashedAt, updatedAt: item.updatedAt };
        if (manifestRef) {
            const batch = writeBatch(db);
            batch.update(ref, sourceUpdate);
            batch.set(manifestRef, pruneUndefined(item));
            await batch.commit();
        } else {
            await updateDoc(ref, sourceUpdate);
        }
        return item;
    }

    async restore(item: TrashItem, _options?: { targetRelativePath?: string }, manifestRef?: DocumentReference): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Unauthenticated');
        const ref = doc(db, 'users', userId, 'ragDocuments', item.targetId);
        const now = new Date().toISOString();
        const sourceUpdate = {
            isTrashed: false,
            state: item.restoreData.state || 'ready',
            restoredAt: now,
            updatedAt: now,
        };
        if (manifestRef) {
            const batch = writeBatch(db);
            batch.update(ref, sourceUpdate);
            batch.update(manifestRef, { state: 'restored', restoredAt: now, updatedAt: now });
            await batch.commit();
        } else {
            await updateDoc(ref, sourceUpdate);
        }
    }
}

export class LocalFileTrashAdapter implements TrashAdapter {
    type: TrashResourceType = 'local_files';

    async inspect(target: TrashTarget) {
        if (!target.folderId) throw new Error("Local file trash target requires 'folderId'");
        return {
            name: target.targetId.split(/[\\/]/).pop() || target.targetId,
            originalLocation: target.targetId,
            restoreData: { folderId: target.folderId, relativePath: target.targetId },
        };
    }

    async trash(trashId: string, target: TrashTarget, provenance: TrashProvenance): Promise<TrashItem> {
        if (!target.folderId) throw new Error("Local file trash target requires 'folderId'");
        const details = await this.inspect(target);
        const result = await desktopFileIndexService.moveToTrash(target.folderId, target.targetId, trashId);

        return {
            id: trashId,
            userId: auth.currentUser?.uid || 'local_user',
            type: 'local_files',
            targetId: target.targetId,
            name: result.name || details.name,
            originalLocation: target.targetId,
            sizeBytes: result.sizeBytes,
            provenance,
            state: 'trashed',
            idempotencyKey: `lf_${target.folderId}_${target.targetId}`,
            restoreData: details.restoreData,
            deviceInfo: {
                deviceId: 'local_studio_executor',
                isAvailable: true,
                approvedFolderId: target.folderId,
            },
            legalHold: { isLocked: false },
            hasEntries: result.isDirectory,
            trashedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    async restore(item: TrashItem, options?: { targetRelativePath?: string }): Promise<void> {
        const folderId = item.restoreData.folderId as string;
        const relativePath = item.restoreData.relativePath as string;
        if (!folderId || !relativePath) throw new Error('Invalid local file restore data');

        const result = await desktopFileIndexService.restoreFromTrash(
            folderId,
            item.id,
            relativePath,
            options?.targetRelativePath
        );

        if (result.conflict) {
            throw new Error(result.error || `Restore conflict: '${relativePath}' already exists.`);
        }
    }
}

export class TrashService {
    public adapters = new Map<TrashResourceType, TrashAdapter>();

    constructor() {
        this.registerAdapter(new FileNodeTrashAdapter());
        this.registerAdapter(new HistoryTrashAdapter());
        this.registerAdapter(new BrandAssetTrashAdapter());
        this.registerAdapter(new KnowledgeTrashAdapter());
        this.registerAdapter(new LocalFileTrashAdapter());
    }

    registerAdapter(adapter: TrashAdapter) {
        this.adapters.set(adapter.type, adapter);
    }

    private getTrashCollection(userId: string) {
        return collection(db, 'users', userId, 'trashItems');
    }

    async listTrash(filters?: { type?: TrashResourceType; projectId?: string; searchQuery?: string }): Promise<TrashItem[]> {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        const snap = await getDocs(query(this.getTrashCollection(userId), where('state', '==', 'trashed'), orderBy('trashedAt', 'desc')));
        let items = snap.docs.flatMap(docSnap => {
            const parsed = TrashItemSchema.safeParse({ id: docSnap.id, ...docSnap.data() });
            return parsed.success ? [parsed.data] : [];
        });

        if (filters?.type) {
            items = items.filter(item => item.type === filters.type);
        }
        if (filters?.projectId) {
            items = items.filter(item => !item.projectId || item.projectId === filters.projectId);
        }
        if (filters?.searchQuery) {
            const q = filters.searchQuery.toLowerCase();
            items = items.filter(item => item.name.toLowerCase().includes(q) || item.originalLocation.toLowerCase().includes(q));
        }
        return items;
    }

    async moveToTrash(
        target: TrashTarget,
        provenance: TrashProvenance,
        projectId?: string
    ): Promise<TrashItem> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in before moving items to trash.');

        const adapter = this.adapters.get(target.type);
        if (!adapter) throw new Error(`No trash adapter registered for type '${target.type}'`);

        const trashId = `trash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const docRef = doc(db, 'users', userId, 'trashItems', trashId);
        const isLocalFile = target.type === 'local_files';
        const trashItem = await adapter.trash(trashId, target, provenance, isLocalFile ? undefined : docRef);
        if (projectId && isLocalFile) trashItem.projectId = projectId;

        // Cloud adapters commit their source mutation and manifest atomically.
        // Local filesystem moves use compensation because IPC and Firestore
        // cannot participate in one transaction.
        if (!isLocalFile) return trashItem;
        try {
            await setDoc(docRef, pruneUndefined(trashItem));
        } catch (manifestError: unknown) {
            try {
                await adapter.restore(trashItem);
            } catch (rollbackError: unknown) {
                const manifestMessage = manifestError instanceof Error ? manifestError.message : String(manifestError);
                const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
                throw new Error(`Trash manifest failed (${manifestMessage}) and rollback failed (${rollbackMessage}). The item may remain quarantined and needs user recovery.`);
            }
            throw manifestError;
        }

        return trashItem;
    }

    async restoreFromTrash(trashId: string, options?: { targetRelativePath?: string }): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in before restoring items from trash.');

        const docRef = doc(db, 'users', userId, 'trashItems', trashId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) throw new Error(`Trash manifest record '${trashId}' not found.`);

        const item = TrashItemSchema.parse(snap.data());
        if (item.state === 'restored') return;

        const adapter = this.adapters.get(item.type);
        if (!adapter) throw new Error(`No trash adapter registered for type '${item.type}'`);

        const isLocalFile = item.type === 'local_files';
        if (!isLocalFile) {
            await adapter.restore(item, options, docRef);
            return;
        }

        await adapter.restore(item, options);
        try {
            await updateDoc(docRef, {
                state: 'restored',
                restoredAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        } catch (manifestError: unknown) {
            try {
                await adapter.trash(item.id, {
                    type: item.type,
                    targetId: options?.targetRelativePath || item.targetId,
                    folderId: item.deviceInfo?.approvedFolderId,
                }, item.provenance);
            } catch (rollbackError: unknown) {
                const manifestMessage = manifestError instanceof Error ? manifestError.message : String(manifestError);
                const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
                throw new Error(`Restore manifest update failed (${manifestMessage}) and rollback failed (${rollbackMessage}). Refresh Trash before retrying.`);
            }
            throw manifestError;
        }
    }

    async permanentlyPurge(trashIds: string[]): Promise<TrashPurgeResult> {
        const request = TrashPurgeRequestSchema.parse({ trashIds });
        const createIntent = httpsCallable<
            { trashIds: string[]; confirmation: 'DELETE' },
            unknown
        >(functions, 'createPurgeIntent');
        const intentResult = await createIntent({
            trashIds: request.trashIds,
            confirmation: 'DELETE',
        });
        const intent = CreateTrashPurgeIntentResponseSchema.parse(intentResult.data);

        const executePurge = httpsCallable<
            { trashIds: string[]; intentToken: string },
            unknown
        >(functions, 'purgeTrashItems');
        const purgeResult = await executePurge({
            trashIds: request.trashIds,
            intentToken: intent.intentToken,
        });
        return TrashPurgeResultSchema.parse(purgeResult.data);
    }
}

export const trashService = new TrashService();
