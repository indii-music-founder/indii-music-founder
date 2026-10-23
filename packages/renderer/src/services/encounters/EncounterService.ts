import {
    collection,
    doc,
    setDoc,
    runTransaction,
    writeBatch,
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
import type { FieldContactRole } from '@/types/contacts';
import { manualContactRecord, type ManualContactFields } from './manualContact';

export class EncounterService {
    /** Save both sides of the manual capture atomically, without scheduling AI analysis. */
    static async saveManualContact(fields: ManualContactFields, assets: CreateEncounterInput['assets'] = [], expectedUid?: string): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in to save this contact.');
        if (expectedUid && userId !== expectedUid) throw new Error('The signed-in account changed. Sign in again before saving.');
        const record = manualContactRecord(fields);
        const encounterId = `enc_${crypto.randomUUID()}`;
        const contactId = `contact_encounter_${encounterId}`;
        const timestamp = serverTimestamp();
        const encounterAssets = assets.map((asset, index) => ({ ...asset, id: `asset_${index}_${encounterId}`, createdAt: new Date().toISOString() }));
        const batch = writeBatch(db);
        batch.set(doc(this.getCollection(userId), encounterId), {
            id: encounterId, userId, status: record.status,
            title: record.fields.name, summary: record.fields.notes,
            assets: encounterAssets, extractedContact: record.fields,
            contactId, contactReviewStatus: record.reviewStatus,
            analysisCoverage: record.analysisCoverage,
            createdAt: timestamp, updatedAt: timestamp,
        });
        batch.set(doc(db, 'users', userId, 'fieldContacts', contactId), {
            ...record.fields, source: record.source, encounterId,
            reviewStatus: record.reviewStatus, reviewedAt: timestamp, capturedAt: timestamp,
            photoUrl: encounterAssets.find(asset => asset.type === 'photo')?.downloadUrl || null,
        });
        await batch.commit();
        if (auth.currentUser?.uid !== userId) throw new Error('The contact was saved to the original account. Sign in again to view it.');
        return contactId;
    }

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
    static async createEncounter(input: CreateEncounterInput, expectedUid?: string): Promise<string> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('User must be authenticated to create an encounter.');
        if (expectedUid && userId !== expectedUid) throw new Error('The signed-in account changed. Sign in again before saving.');

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

    /** Confirm or correct a candidate through the signed-in user's normal write path. */
    static async reviewContact(encounterId: string, fields: { name: string; phone: string; email: string; organization: string; notes: string; role: FieldContactRole }): Promise<void> {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in to review this contact.');
        const name = fields.name.trim();
        if (!name || name.length > 200) throw new Error('Enter a contact name (up to 200 characters).');
        const contactFields = {
            name, phone: fields.phone.trim().slice(0, 80), email: fields.email.trim().slice(0, 320),
            organization: fields.organization.trim().slice(0, 300), notes: fields.notes.trim().slice(0, 2000),
        };
        const encounterRef = doc(this.getCollection(userId), encounterId);
        await runTransaction(db, async transaction => {
            const snapshot = await transaction.get(encounterRef);
            const encounter = snapshot.data();
            if (!encounter || encounter.status !== 'completed' || !encounter.extractedContact?.name) {
                throw new Error('This encounter has no completed contact analysis to review.');
            }
            const contactId = `contact_encounter_${encounterId}`;
            const role = fields.role;
            transaction.set(doc(db, 'users', userId, 'fieldContacts', contactId), {
                ...contactFields, role, encounterId, source: 'encounter_ai',
                reviewStatus: 'confirmed', reviewedAt: serverTimestamp(),
                capturedAt: encounter.createdAt || serverTimestamp(),
                photoUrl: encounter.assets?.find((asset: EncounterAsset) => asset.type === 'photo')?.downloadUrl || null,
                audioMemoUrl: encounter.assets?.find((asset: EncounterAsset) => asset.type === 'audio')?.downloadUrl || null,
            }, { merge: true });
            transaction.update(encounterRef, {
                extractedContact: { ...contactFields, role }, contactId,
                contactReviewStatus: 'confirmed', updatedAt: serverTimestamp(),
            });
        });
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
                        contactReviewStatus: data.contactReviewStatus || undefined,
                        analysisCoverage: data.analysisCoverage || undefined,
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
