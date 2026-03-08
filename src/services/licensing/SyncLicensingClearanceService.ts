import { db, storage } from '@/services/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Item 310: Sync Licensing Usage Clearance Service
 *
 * Before a sync brief match is delivered, requires the artist to upload
 * proof of clearance for any sampled elements. Adds a document upload
 * step to the sync licensing workflow.
 *
 * Data model:
 *   clearance_docs/{docId} → metadata, status, file references
 */

export type ClearanceDocType =
    | 'sample_clearance'
    | 'interpolation_license'
    | 'master_use_license'
    | 'sync_license'
    | 'mechanical_license'
    | 'public_domain_proof'
    | 'original_composition_affidavit';

export type ClearanceStatus =
    | 'pending_upload'
    | 'uploaded'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'expired';

export interface ClearanceDocument {
    id: string;
    userId: string;
    releaseId: string;
    trackId: string;
    trackTitle: string;
    docType: ClearanceDocType;
    status: ClearanceStatus;
    /** Storage path for the uploaded document */
    storagePath: string | null;
    /** Public download URL */
    downloadUrl: string | null;
    /** Original filename */
    originalFilename: string | null;
    /** Description of what is being cleared */
    description: string;
    /** Name of the sample/interpolation source */
    sourcework?: string;
    /** Original rights holder */
    originalRightsHolder?: string;
    /** Reviewer notes (populated during review) */
    reviewNotes?: string;
    /** Review timestamp */
    reviewedAt?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface ClearanceCheckResult {
    trackId: string;
    trackTitle: string;
    isCleared: boolean;
    pendingDocs: ClearanceDocument[];
    approvedDocs: ClearanceDocument[];
    rejectedDocs: ClearanceDocument[];
}

class SyncLicensingClearanceService {
    private readonly collectionName = 'clearance_docs';

    /**
     * Create a clearance requirement for a track
     */
    async createClearanceRequirement(
        userId: string,
        releaseId: string,
        trackId: string,
        trackTitle: string,
        docType: ClearanceDocType,
        description: string,
        sourcework?: string,
        originalRightsHolder?: string
    ): Promise<ClearanceDocument> {
        const id = uuidv4();
        const clearanceDoc: ClearanceDocument = {
            id,
            userId,
            releaseId,
            trackId,
            trackTitle,
            docType,
            status: 'pending_upload',
            storagePath: null,
            downloadUrl: null,
            originalFilename: null,
            description,
            sourcework,
            originalRightsHolder,
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
        };

        await setDoc(doc(db, this.collectionName, id), clearanceDoc);
        logger.info(`[SyncClearance] Created requirement ${id} for track "${trackTitle}": ${docType}`);
        return clearanceDoc;
    }

    /**
     * Upload a clearance document file
     */
    async uploadClearanceFile(
        clearanceId: string,
        file: File
    ): Promise<ClearanceDocument | null> {
        const docRef = doc(db, this.collectionName, clearanceId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;

        const clearanceDoc = snap.data() as ClearanceDocument;

        // Upload to Firebase Storage
        const storagePath = `clearance/${clearanceDoc.userId}/${clearanceDoc.releaseId}/${clearanceId}/${file.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // Update the document
        await setDoc(docRef, {
            storagePath,
            downloadUrl,
            originalFilename: file.name,
            status: 'uploaded',
            updatedAt: serverTimestamp(),
        }, { merge: true });

        logger.info(`[SyncClearance] Uploaded file for ${clearanceId}: ${file.name}`);

        return {
            ...clearanceDoc,
            storagePath,
            downloadUrl,
            originalFilename: file.name,
            status: 'uploaded',
        };
    }

    /**
     * Check if a track is fully cleared for sync delivery
     */
    async checkTrackClearance(
        releaseId: string,
        trackId: string
    ): Promise<ClearanceCheckResult> {
        const q = query(
            collection(db, this.collectionName),
            where('releaseId', '==', releaseId),
            where('trackId', '==', trackId)
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => d.data() as ClearanceDocument);

        const pendingDocs = docs.filter(d =>
            d.status === 'pending_upload' || d.status === 'uploaded' || d.status === 'under_review'
        );
        const approvedDocs = docs.filter(d => d.status === 'approved');
        const rejectedDocs = docs.filter(d => d.status === 'rejected');

        const isCleared = docs.length > 0 && pendingDocs.length === 0 && rejectedDocs.length === 0;

        return {
            trackId,
            trackTitle: docs[0]?.trackTitle || '',
            isCleared,
            pendingDocs,
            approvedDocs,
            rejectedDocs,
        };
    }

    /**
     * Check clearance status for all tracks in a release
     */
    async checkReleaseClearance(releaseId: string): Promise<ClearanceCheckResult[]> {
        const q = query(
            collection(db, this.collectionName),
            where('releaseId', '==', releaseId),
            orderBy('createdAt', 'asc')
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => d.data() as ClearanceDocument);

        // Group by trackId
        const trackMap = new Map<string, ClearanceDocument[]>();
        for (const clearanceDoc of docs) {
            const existing = trackMap.get(clearanceDoc.trackId) || [];
            existing.push(clearanceDoc);
            trackMap.set(clearanceDoc.trackId, existing);
        }

        const results: ClearanceCheckResult[] = [];
        for (const [trackId, trackDocs] of trackMap) {
            const pendingDocs = trackDocs.filter(d =>
                d.status === 'pending_upload' || d.status === 'uploaded' || d.status === 'under_review'
            );
            const approvedDocs = trackDocs.filter(d => d.status === 'approved');
            const rejectedDocs = trackDocs.filter(d => d.status === 'rejected');

            results.push({
                trackId,
                trackTitle: trackDocs[0]?.trackTitle || '',
                isCleared: trackDocs.length > 0 && pendingDocs.length === 0 && rejectedDocs.length === 0,
                pendingDocs,
                approvedDocs,
                rejectedDocs,
            });
        }

        return results;
    }

    /**
     * Update clearance document review status
     */
    async reviewClearance(
        clearanceId: string,
        status: 'approved' | 'rejected',
        reviewNotes?: string
    ): Promise<void> {
        const docRef = doc(db, this.collectionName, clearanceId);
        await setDoc(docRef, {
            status,
            reviewNotes: reviewNotes || null,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });

        logger.info(`[SyncClearance] ${clearanceId} → ${status}`);
    }

    /**
     * Get all clearance docs for a user
     */
    async getUserClearanceDocs(userId: string): Promise<ClearanceDocument[]> {
        const q = query(
            collection(db, this.collectionName),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ClearanceDocument);
    }
}

export const syncLicensingClearanceService = new SyncLicensingClearanceService();
