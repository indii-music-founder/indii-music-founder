import { StateCreator } from 'zustand';
import { HistoryItem } from '@/core/types/history';
import { logger } from '@/utils/logger';

export interface CanvasImage {
    id: string;
    base64: string;
    x: number;
    y: number;
    width: number;
    height: number;
    aspect: number;
    projectId: string;
}

export interface CreativeHistorySlice {
    // History
    generatedHistory: HistoryItem[];
    addToHistory: (item: HistoryItem) => void;
    initializeHistory: () => Promise<void>;
    updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => void;
    removeFromHistory: (id: string) => void;

    // Canvas
    canvasImages: CanvasImage[];
    selectedCanvasImageId: string | null;
    addCanvasImage: (img: CanvasImage) => void;
    updateCanvasImage: (id: string, updates: Partial<CanvasImage>) => void;
    removeCanvasImage: (id: string) => void;
    selectCanvasImage: (id: string | null) => void;

    // Uploads
    uploadedImages: HistoryItem[];
    addUploadedImage: (img: HistoryItem) => void;
    updateUploadedImage: (id: string, updates: Partial<HistoryItem>) => void;
    removeUploadedImage: (id: string) => void;

    uploadedAudio: HistoryItem[];
    addUploadedAudio: (audio: HistoryItem) => void;
    removeUploadedAudio: (id: string) => void;
}

/**
 * Factory that returns the history/uploads/canvas portion of the creative slice.
 */
export function buildCreativeHistoryState(
    set: Parameters<StateCreator<CreativeHistorySlice>>[0],
    _get: Parameters<StateCreator<CreativeHistorySlice>>[1]
): CreativeHistorySlice {
    return {
        generatedHistory: [],
        addToHistory: (item: HistoryItem) => {
            // Use dynamic import to avoid circular dependency with store
            import('@/core/store').then(({ useStore }) => {
                logger.debug("CreativeSlice: addToHistory called", item.id);
                const { currentOrganizationId } = useStore.getState();
                const enrichedItem = { ...item, orgId: item.orgId || currentOrganizationId };

                set((state) => ({ generatedHistory: [enrichedItem, ...state.generatedHistory] }));
                logger.debug("CreativeSlice: generatedHistory updated", enrichedItem.id);

                import('@/services/StorageService').then(({ StorageService }) => {
                    StorageService.saveItem(enrichedItem)
                        .then(() => { logger.debug("CreativeSlice: Saved to Storage", enrichedItem.id); })
                        .catch((err) => { logger.error("CreativeSlice: Storage Save Error", err); });
                }).catch(err => logger.error("CreativeSlice: Failed to import StorageService", err));
            }).catch(err => logger.error("CreativeSlice: Failed to import store", err));
        },
        initializeHistory: async () => {
            const { StorageService } = await import('@/services/StorageService');

            const attemptSubscribe = (retryCount = 0): Promise<void> => {
                return new Promise<void>((resolve) => {
                    (async () => {
                        try {
                            const unsubscribe = await StorageService.subscribeToHistory(50, (history) => {
                                set((state) => {
                                    const historyMap = new Map(state.generatedHistory.map(item => [item.id, item]));

                                    history.forEach(remItem => {
                                        const localItem = historyMap.get(remItem.id);

                                        if (localItem && localItem.url) {
                                            if (localItem.url.startsWith('blob:') && remItem.url.startsWith('https://')) {
                                                // Always prefer the durable Storage URL over an ephemeral blob URL.
                                                // The blob URL was valid for immediate playback but dies on refresh.
                                                historyMap.set(remItem.id, remItem);
                                            } else if (localItem.url.startsWith('data:') && remItem.url === 'placeholder:dev-data-uri-too-large') {
                                                historyMap.set(remItem.id, { ...remItem, url: localItem.url });
                                            } else {
                                                historyMap.set(remItem.id, remItem);
                                            }
                                        } else {
                                            historyMap.set(remItem.id, remItem);
                                        }
                                    });

                                    const mergedHistory = Array.from(historyMap.values()).sort((a, b) => b.timestamp - a.timestamp);

                                    const generated: HistoryItem[] = [];
                                    const uploadedImages: HistoryItem[] = [];
                                    const uploadedAudio: HistoryItem[] = [];

                                    for (const item of mergedHistory) {
                                        if (item.origin !== 'uploaded') {
                                            generated.push(item);
                                        } else {
                                            if (item.type === 'image') {
                                                uploadedImages.push(item);
                                            } else if (item.type === 'music') {
                                                uploadedAudio.push(item);
                                            }
                                        }
                                    }

                                    return {
                                        generatedHistory: generated,
                                        uploadedImages: uploadedImages,
                                        uploadedAudio: uploadedAudio
                                    };
                                });

                                // Resolve after the first successful snapshot
                                resolve();
                            }, (error) => {
                                const isPermissionError = (error as Error)?.message?.includes('Missing or insufficient permissions');
                                const MAX_RETRIES = 3;

                                if (isPermissionError) {
                                    // Don't retry on permission errors — permissions won't change mid-session.
                                    // Just resolve to unblock UI; this is expected in dev.
                                    logger.debug(`[CreativeSlice] History subscription — insufficient permissions (expected in dev). Resolving.`);
                                    resolve();
                                } else if (retryCount < MAX_RETRIES) {
                                    // Resolve anyway to unblock UI; non-recoverable errors logged at warn level only
                                    if (!isPermissionError) {
                                        logger.error('[CreativeSlice] History subscription error:', error);
                                    }
                                    resolve();
                                }
                            });

                            // Register with SubscriptionManager
                            import('@/core/store').then(({ useStore }) => {
                                useStore.getState().registerSubscription('creative_history', unsubscribe);
                            });

                        } catch (err) {
                            logger.error('[CreativeSlice] Failed to initialize history:', err);
                            resolve();
                        }
                    })();
                });
            };

            return attemptSubscribe();
        },
        updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => {
            set((state) => {
                const updatedHistory = state.generatedHistory.map(item => item.id === id ? { ...item, ...updates } : item);
                const updatedItem = updatedHistory.find(item => item.id === id);

                if (updatedItem) {
                    import('@/services/StorageService').then(({ StorageService }) => {
                        StorageService.saveItem(updatedItem).catch((e) => logger.error('[Store] Async operation failed:', e));
                    });
                }

                return { generatedHistory: updatedHistory };
            });
        },
        removeFromHistory: (id: string) => {
            set((state) => ({ generatedHistory: state.generatedHistory.filter(i => i.id !== id) }));
            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.removeItem(id).catch(() => { /* Error handled silently */ });
            });
        },

        canvasImages: [],
        selectedCanvasImageId: null,
        addCanvasImage: (img: CanvasImage) => set((state) => ({ canvasImages: [...state.canvasImages, img] })),
        updateCanvasImage: (id: string, updates: Partial<CanvasImage>) => set((state) => ({
            canvasImages: state.canvasImages.map(img => img.id === id ? { ...img, ...updates } : img)
        })),
        removeCanvasImage: (id: string) => set((state) => ({ canvasImages: state.canvasImages.filter(i => i.id !== id) })),
        selectCanvasImage: (id: string | null) => set({ selectedCanvasImageId: id }),

        uploadedImages: [],
        addUploadedImage: (img: HistoryItem) => {
            set((state) => ({ uploadedImages: [img, ...state.uploadedImages] }));
            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.saveItem(img).catch(() => { /* Error handled silently */ });
            });
        },
        updateUploadedImage: (id: string, updates: Partial<HistoryItem>) => set((state) => ({
            uploadedImages: state.uploadedImages.map(img => img.id === id ? { ...img, ...updates } : img)
        })),
        removeUploadedImage: (id: string) => {
            set((state) => ({ uploadedImages: state.uploadedImages.filter(i => i.id !== id) }));
            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.removeItem(id).catch(() => { /* Error handled silently */ });
            });
        },

        uploadedAudio: [],
        addUploadedAudio: (audio: HistoryItem) => {
            set((state) => ({ uploadedAudio: [audio, ...state.uploadedAudio] }));
            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.saveItem(audio).catch(() => { /* Error handled silently */ });
            });
        },
        removeUploadedAudio: (id: string) => {
            set((state) => ({ uploadedAudio: state.uploadedAudio.filter(i => i.id !== id) }));
            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.removeItem(id).catch(() => { /* Error handled silently */ });
            });
        },
    };
}
