import { v4 as uuidv4 } from 'uuid';

import { collection, limit, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useStore } from '@/core/store';
import { UploadStatus } from '@/core/store/slices/uploadQueueSlice';

/** Matches the `/ingest/white-glove` storage rule (`isUnderSizeLimit(500)`). */
export const WHITE_GLOVE_MAX_BYTES = 500 * 1024 * 1024;

export type WhiteGloveAssetType = 'music' | 'video' | 'image' | 'archive' | 'document';

/** Analysis result written by the `onWhiteGloveAssetUploaded` storage trigger. */
export interface WhiteGloveImportResult {
    id: string;
    fileName: string;
    assetType: string;
    size?: number;
    status: 'processing' | 'processed' | 'error';
    metadata?: {
        bpm?: number;
        key?: string;
        genre?: string;
        mood?: string;
        files?: string[];
    };
    createdAtMs?: number;
}

/** Classify a file the same way the backend trigger expects. Only ZIP archives are accepted. */
export function detectWhiteGloveAssetType(file: File): WhiteGloveAssetType {
    if (file.type.startsWith('audio/')) return 'music';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.includes('zip') || file.name.toLowerCase().endsWith('.zip')) return 'archive';
    return 'document';
}

function toResult(id: string, data: Record<string, unknown>): WhiteGloveImportResult {
    const status = data.status === 'processed' || data.status === 'error' ? data.status : 'processing';
    const created = data.createdAt as { toMillis?: () => number } | undefined;
    return {
        id,
        fileName: typeof data.fileName === 'string' ? data.fileName : id,
        assetType: typeof data.assetType === 'string' ? data.assetType : 'document',
        size: typeof data.size === 'number' ? data.size : Number(data.size) || undefined,
        status,
        metadata: (data.metadata as WhiteGloveImportResult['metadata']) ?? undefined,
        createdAtMs: created?.toMillis?.(),
    };
}

export class WhiteGloveIngestionService {
    /**
     * Enqueues an asset for ingestion, setting up a resumable Firebase storage upload.
     * @param file The file to upload.
     * @param assetType The category of the asset (e.g., 'audio', 'visual').
     * @param artistId The ID of the artist this asset belongs to.
     * @returns The unique ID generated for this upload task.
     */
    static async enqueueAsset(file: File, assetType: string, artistId: string): Promise<string> {
        if (file.size >= WHITE_GLOVE_MAX_BYTES) {
            throw new Error(`${file.name} is larger than 500 MB.`);
        }
        const uploadId = uuidv4();
        const { getStorage, ref, uploadBytesResumable } = await import('firebase/storage');
        
        const storage = getStorage();
        const storageRef = ref(storage, `ingest/white-glove/${artistId}/${assetType}/${file.name}`);
        
        // Initiate the resumable upload
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        // Map the string to the correct type for UploadQueueItem
        const queueType = ['image', 'video', 'music', 'document', 'archive'].includes(assetType) 
            ? assetType as 'image' | 'video' | 'music' | 'document' | 'archive' 
            : 'document';
            
        // Push initial task to the store
        useStore.getState().addUploadItems([{
            id: uploadId,
            fileName: file.name,
            fileSize: file.size,
            progress: 0,
            status: 'pending',
            type: queueType,
            uploadTask
        }]);
        
        // Listen to state changes
        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                useStore.getState().updateUploadProgress(uploadId, progress);
                
                let status: UploadStatus = 'uploading';
                switch (snapshot.state) {
                    case 'paused':
                        status = 'paused';
                        break;
                    case 'running':
                        status = 'uploading';
                        break;
                }
                // Only update status if it's different to avoid unnecessary renders
                // In a real implementation we might just push the update always
                useStore.getState().updateUploadStatus(uploadId, status);
            },
            (error) => {
                useStore.getState().updateUploadStatus(uploadId, 'error', error.message);
            },
            () => {
                useStore.getState().updateUploadStatus(uploadId, 'post-processing');
            }
        );
        
        return uploadId;
    }

    /**
     * Live list of the artist's most recent import results (newest first).
     * Firestore rules allow only the uploading artist to read them.
     */
    static subscribeToResults(
        artistId: string,
        onChange: (results: WhiteGloveImportResult[]) => void,
        onError: (error: Error) => void,
    ): Unsubscribe {
        const q = query(collection(db, 'artists', artistId, 'assets'), orderBy('createdAt', 'desc'), limit(50));
        return onSnapshot(
            q,
            (snapshot) => onChange(snapshot.docs.map((d) => toResult(d.id, d.data()))),
            (error) => onError(error),
        );
    }

    /**
     * Pauses an active upload task.
     * @param uploadId The unique ID of the upload to pause.
     */
    static pauseUpload(uploadId: string): void {
        const item = useStore.getState().uploadQueue.find(i => i.id === uploadId);
        if (item && item.uploadTask) {
            item.uploadTask.pause();
        }
    }

    /**
     * Resumes a paused upload task.
     * @param uploadId The unique ID of the upload to resume.
     */
    static resumeUpload(uploadId: string): void {
        const item = useStore.getState().uploadQueue.find(i => i.id === uploadId);
        if (item && item.uploadTask) {
            item.uploadTask.resume();
        }
    }

    /**
     * Cancels an active or paused upload task.
     * @param uploadId The unique ID of the upload to cancel.
     */
    static cancelUpload(uploadId: string): void {
        const item = useStore.getState().uploadQueue.find(i => i.id === uploadId);
        if (item && item.uploadTask) {
            item.uploadTask.cancel();
        }
    }
}
