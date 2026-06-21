import { v4 as uuidv4 } from 'uuid';

import { useStore } from '@/core/store';
import { UploadStatus } from '@/core/store/slices/uploadQueueSlice';

export class WhiteGloveIngestionService {
    /**
     * Enqueues an asset for ingestion, setting up a resumable Firebase storage upload.
     * @param file The file to upload.
     * @param assetType The category of the asset (e.g., 'audio', 'visual').
     * @param artistId The ID of the artist this asset belongs to.
     * @returns The unique ID generated for this upload task.
     */
    static async enqueueAsset(file: File, assetType: string, artistId: string): Promise<string> {
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
