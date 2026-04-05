import { StateCreator } from 'zustand';

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface UploadQueueItem {
    id: string;
    fileName: string;
    fileSize: number;
    progress: number; // 0 to 100
    status: UploadStatus;
    error?: string;
    type: 'image' | 'video' | 'music' | 'document';
}

export interface UploadQueueSlice {
    uploadQueue: UploadQueueItem[];
    isUploadQueueOpen: boolean;

    addUploadItems: (items: UploadQueueItem[]) => void;
    updateUploadProgress: (id: string, progress: number) => void;
    updateUploadStatus: (id: string, status: UploadStatus, error?: string) => void;
    removeUploadItem: (id: string) => void;
    clearCompletedUploads: () => void;
    toggleUploadQueue: (isOpen?: boolean) => void;
}

export const createUploadQueueSlice: StateCreator<UploadQueueSlice> = (set) => ({
    uploadQueue: [],
    isUploadQueueOpen: false,

    addUploadItems: (items) => set((state) => ({
        uploadQueue: [...state.uploadQueue, ...items],
        isUploadQueueOpen: true // Auto-open when items are added
    })),

    updateUploadProgress: (id, progress) => set((state) => ({
        uploadQueue: state.uploadQueue.map(item =>
            item.id === id ? { ...item, progress } : item
        )
    })),

    updateUploadStatus: (id, status, error) => set((state) => ({
        uploadQueue: state.uploadQueue.map(item =>
            item.id === id ? { ...item, status, error } : item
        )
    })),

    removeUploadItem: (id) => set((state) => ({
        uploadQueue: state.uploadQueue.filter(item => item.id !== id)
    })),

    clearCompletedUploads: () => set((state) => ({
        uploadQueue: state.uploadQueue.filter(item => item.status !== 'success')
    })),

    toggleUploadQueue: (isOpen) => set((state) => ({
        isUploadQueueOpen: isOpen !== undefined ? isOpen : !state.isUploadQueueOpen
    }))
});
