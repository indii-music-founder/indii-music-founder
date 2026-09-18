import {
    collection,
    doc,
    setDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { StorageService } from '@/services/StorageService';
import type { FieldEncounter, CreateEncounterInput, EncounterAsset } from '@/types/encounter';
import { logger } from '@/utils/logger';

export class EncounterService {
    private static getCollection(userId: string) {
        return collection(db, 'users', userId, 'encounters');
    }

    /**
     * Upload an asset blob to storage and return an EncounterAsset descriptor.
     */
    static async uploadAsset(
        userId: string,
        encounterId: string,
        file: Blob | File,
        type: EncounterAsset['type'],
        extension = 'bin'
    ): Promise<EncounterAsset> {
        const assetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const filename = `${type}_${assetId}.${extension}`;
        const path = `users/${userId}/encounters/${encounterId}/${filename}`;

        const downloadUrl = await StorageService.uploadFile(file, path);

        return {
            id: assetId,
            type,
            storagePath: path,
            downloadUrl,
            mimeType: file.type || 'application/octet-stream',
            filename,
            sizeBytes: file.size,
            createdAt: new Date().toISOString(),
        };
    }

    /**
     * Create a new FieldEncounter in Firestore with assets and trigger the cloud pipeline.
     */
    static async createEncounter(input: CreateEncounterInput): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated to create an encounter.');

        const encounterId = `enc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const docRef = doc(this.getCollection(userId), encounterId);

        const assetsWithIds: EncounterAsset[] = input.assets.map((asset, index) => ({
            ...asset,
            id: `asset_${index}_${Date.now()}`,
            createdAt: new Date().toISOString(),
        }));

        const encounterData = {
            id: encounterId,
            userId,
            status: 'pending',
            assets: assetsWithIds,
            location: input.location || null,
            clientContext: input.clientContext || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        await setDoc(docRef, encounterData);
        logger.info(`[EncounterService] Created FieldEncounter ${encounterId}`);
        return encounterId;
    }

    /**
     * Subscribe to the most recent encounters for the authenticated user (real-time stream).
     */
    static subscribeRecentEncounters(
        callback: (encounters: FieldEncounter[]) => void,
        limitCount = 20
    ): Unsubscribe {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            callback([]);
            return () => {};
        }

        const q = query(
            this.getCollection(userId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        return onSnapshot(
            q,
            (snapshot) => {
                const encounters: FieldEncounter[] = snapshot.docs.map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        userId: data.userId,
                        status: data.status,
                        title: data.title,
                        summary: data.summary,
                        assets: data.assets || [],
                        location: data.location || undefined,
                        extractedContact: data.extractedContact || undefined,
                        contactId: data.contactId || undefined,
                        noteId: data.noteId || undefined,
                        audioTranscript: data.audioTranscript || undefined,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
                        error: data.error,
                    };
                });
                callback(encounters);
            },
            (error) => {
                logger.error('[EncounterService] Snapshot error:', error);
            }
        );
    }
}
