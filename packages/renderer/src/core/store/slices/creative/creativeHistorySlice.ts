import { StateCreator } from 'zustand';
import { HistoryItem } from '@/core/types/history';
import { logger } from '@/utils/logger';
import { StoreState } from '@/core/store';

let creativeHistoryUnsubscribe: (() => void) | null = null;

// ISSUE-922 (remainder): the in-memory gallery keeps only the most recent
// uploads (data-URI items are memory-heavy). Evicted items remain durable in
// the cloud library and reappear through the uncapped Firestore snapshot
// rebuild in loadHistory — but trimming the visible list must never be silent.
export const UPLOAD_MEMORY_CAP = 50;
let lastEvictionNoticeAt = 0;
function notifyUploadEviction(kind: 'image' | 'audio'): void {
    logger.info(`[CreativeSlice] Upload list exceeded ${UPLOAD_MEMORY_CAP} ${kind} items — oldest trimmed from view (cloud copies remain).`);
    const now = Date.now();
    if (now - lastEvictionNoticeAt < 30_000) return; // one notice per batch, not per file
    lastEvictionNoticeAt = now;
    import('@/core/events').then(({ events }) => {
        events.emit('SYSTEM_ALERT', {
            level: 'info',
            message: `Showing your ${UPLOAD_MEMORY_CAP} most recent uploads — older uploads stay in your cloud library and reappear after sync.`
        });
    }).catch(() => { /* events module unavailable in some test contexts */ });
}

const KNOWN_MEDIA_EXTENSIONS: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
};

/**
 * ISSUE-810: file-node sync previously hardcoded every generated asset's
 * filename as `.png`, even for videos. Prefer the real extension found in
 * the asset's own URL/storage URI; only fall back to a per-type default
 * when no recognizable extension is present.
 */
function inferMediaExtension(item: HistoryItem): { extension: string; mimeType: string } {
    const source = item.storageUri || item.url || '';
    const match = /\.([a-zA-Z0-9]{2,4})(?:[?#]|$)/.exec(source);
    const rawExt = match?.[1]?.toLowerCase();
    if (rawExt && KNOWN_MEDIA_EXTENSIONS[rawExt]) {
        return { extension: rawExt, mimeType: KNOWN_MEDIA_EXTENSIONS[rawExt] };
    }

    switch (item.type) {
        case 'video':
            return { extension: 'mp4', mimeType: 'video/mp4' };
        case 'music':
            return { extension: 'mp3', mimeType: 'audio/mpeg' };
        case 'image':
            return { extension: 'png', mimeType: 'image/png' };
        default:
            return { extension: 'bin', mimeType: 'application/octet-stream' };
    }
}

export interface CanvasImage {
    id: string;
    base64: string;
    x: number;
    y: number;
    width: number;
    height: number;
    aspect: number;
    projectId: string;
    prompt?: string;
    parentId?: string;
    originalX?: number;
    originalY?: number;
    originalWidth?: number;
    originalHeight?: number;
    parentOffsetX?: number;
    parentOffsetY?: number;
}

export interface FailedVariationBatch {
    source: CanvasImage;
    prompt: string;
    mimeType: string;
    base64Data: string;
    projectId: string;
    slots: number[];
}

export interface CreativeHistorySlice {
    // History
    generatedHistory: HistoryItem[];
    /** Non-null when the cloud history subscription failed — the gallery may be showing device-local data only (ISSUE-772). */
    historySyncError: string | null;
    addToHistory: (item: HistoryItem) => void;
    initializeHistory: () => Promise<void>;
    updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => void;
    removeFromHistory: (id: string) => void;
    removeItemFromProject: (id: string) => void;

    // Canvas
    canvasImages: CanvasImage[];
    selectedCanvasImageId: string | null;
    addCanvasImage: (img: CanvasImage) => void;
    updateCanvasImage: (id: string, updates: Partial<CanvasImage>) => void;
    removeCanvasImage: (id: string) => void;
    selectCanvasImage: (id: string | null) => void;

    // Variations
    failedVariationBatch: FailedVariationBatch | null;
    setFailedVariationBatch: (batch: FailedVariationBatch | null) => void;

    // Chat Import
    chatImportContext: { messageId: string; agentId: string; prompt: string } | null;
    clearChatImportContext: () => void;
    openImageInStudio: (params: { imageId: string; sourceUrl: string; sourceMessageId: string; agentId: string; prompt: string }) => void;

    // Uploads
    uploadedImages: HistoryItem[];
    addUploadedImage: (img: HistoryItem) => Promise<boolean>;
    updateUploadedImage: (id: string, updates: Partial<HistoryItem>) => void;
    removeUploadedImage: (id: string) => void;

    uploadedAudio: HistoryItem[];
    addUploadedAudio: (audio: HistoryItem) => Promise<boolean>;
    removeUploadedAudio: (id: string) => void;

    // Soft delete from project view
    removeUploadedImageFromProject: (id: string) => void;
    removeUploadedAudioFromProject: (id: string) => void;
}

export function buildCreativeHistoryState(
    set: Parameters<StateCreator<StoreState, [], [], CreativeHistorySlice>>[0],
    _get: Parameters<StateCreator<StoreState, [], [], CreativeHistorySlice>>[1]
): CreativeHistorySlice {
    return {
        generatedHistory: [],
        historySyncError: null,
        failedVariationBatch: null,
        setFailedVariationBatch: (batch) => set({ failedVariationBatch: batch }),
        addToHistory: (item: HistoryItem) => {
            // Use dynamic import to avoid circular dependency with store
            import('@/core/store').then(({ useStore }) => {
                logger.debug("CreativeSlice: addToHistory called", item.id);
                const { currentOrganizationId, currentProjectId, createFileNode, user } = useStore.getState();
                const enrichedItem = { ...item, orgId: item.orgId || currentOrganizationId };
                // Eviction policy: cap at 50 items to prevent memory bloat from base64 images
                set((state) => ({ generatedHistory: [enrichedItem, ...state.generatedHistory].slice(0, 50) }));
                logger.debug("CreativeSlice: generatedHistory updated", enrichedItem.id);

                // Auto-persistence to project asset folder
                if (enrichedItem.type === 'image' || enrichedItem.type === 'video') {
                    if (!user?.uid) {
                        logger.error("CreativeSlice: Cannot sync generated asset to file system without an authenticated user");
                    } else {
                        const { extension, mimeType } = inferMediaExtension(enrichedItem);
                        const filename = `${enrichedItem.origin || 'generation'}-${enrichedItem.id.slice(0, 8)}.${extension}`;
                        const persistedUrl = enrichedItem.storageUri || enrichedItem.url;
                        createFileNode(
                            filename,
                            null, // root
                            currentProjectId,
                            user.uid,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            enrichedItem.type as any,
                            {
                                url: persistedUrl,
                                storagePath: enrichedItem.storageUri || undefined,
                                origin: enrichedItem.origin,
                                mimeType
                            }
                        ).catch(err => logger.error("CreativeSlice: File system sync error", err));
                    }
                }

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
                            if (creativeHistoryUnsubscribe) {
                                creativeHistoryUnsubscribe();
                                creativeHistoryUnsubscribe = null;
                            }
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
                                        generatedHistory: generated.slice(0, 50),
                                        uploadedImages: uploadedImages,
                                        uploadedAudio: uploadedAudio,
                                        historySyncError: null
                                    };
                                });

                                // Resolve after the first successful snapshot
                                resolve();
                            }, (error) => {
                                const isPermissionError = (error as Error)?.message?.includes('Missing or insufficient permissions');
                                const MAX_RETRIES = 3;

                                if (isPermissionError) {
                                    // Don't retry on permission errors — permissions won't change mid-session.
                                    // ISSUE-772: this failure mode silently hid a dead cross-device sync for
                                    // months. Surface it loudly — an empty gallery must never masquerade as truth.
                                    logger.error('[CreativeSlice] History subscription denied by Firestore rules — cloud library will NOT sync on this device.', error);
                                    set({ historySyncError: 'Your creations library could not sync from the cloud on this device.' });
                                    import('@/core/events').then(({ events }) => {
                                        events.emit('SYSTEM_ALERT', { level: 'error', message: 'Creations library failed to sync from the cloud.' });
                                    }).catch(() => { /* events module unavailable in some test contexts */ });
                                    resolve();
                                } else if (retryCount < MAX_RETRIES) {
                                    // Resolve anyway to unblock UI; non-recoverable errors logged at warn level only
                                    logger.error('[CreativeSlice] History subscription error:', error);
                                    set({ historySyncError: 'Cloud sync for your creations library is temporarily unavailable.' });
                                    resolve();
                                }
                            });

                            creativeHistoryUnsubscribe = unsubscribe;

                        } catch (err: unknown) {
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
                StorageService.removeItem(id).catch((e) => { logger.error('[Store] Failed to remove item:', e); });
            });
        },
        removeItemFromProject: (id: string) => {
            set((state) => ({ generatedHistory: state.generatedHistory.filter(i => i.id !== id) }));
            // Soft delete - removes from local state/project view, but leaves in master storage
            logger.debug(`[CreativeSlice] Soft removed item ${id} from project view.`);
        },

        canvasImages: [],
        selectedCanvasImageId: null,
        addCanvasImage: (img: CanvasImage) => set((state) => ({
            // Cap at 20 canvas images to prevent unbounded base64 memory accumulation.
            // Evict the oldest entries (at the end of the array) when the limit is reached.
            canvasImages: [...state.canvasImages, img].slice(-20)
        })),
        updateCanvasImage: (id: string, updates: Partial<CanvasImage>) => set((state) => ({
            canvasImages: state.canvasImages.map(img => img.id === id ? { ...img, ...updates } : img)
        })),
        removeCanvasImage: (id: string) => set((state) => ({
            canvasImages: state.canvasImages.filter(i => i.id !== id),
            selectedCanvasImageId: state.selectedCanvasImageId === id ? null : state.selectedCanvasImageId,
            failedVariationBatch: state.failedVariationBatch?.source.id === id ? null : state.failedVariationBatch,
        })),
        selectCanvasImage: (id: string | null) => set({ selectedCanvasImageId: id }),

        chatImportContext: null,
        clearChatImportContext: () => set({ chatImportContext: null }),
        openImageInStudio: ({ imageId, sourceUrl, sourceMessageId, agentId, prompt }) => {
            // Stage the image as a new canvas layer. ISSUE-1362: every import
            // previously landed at the fixed (100,100), so repeated sends
            // stacked invisibly on top of each other — the user could only see
            // the top layer. Position each new import visibly offset from the
            // last existing layer so only the selected image moves in, and it
            // lands where the user can actually see and grab it.
            const existing = _get().canvasImages || [];
            const baseX = 100;
            const baseY = 100;
            const CASCADE_STEP = 32;
            let x = baseX;
            let y = baseY;
            if (existing.length > 0) {
                const last = existing[existing.length - 1];
                const lastX = typeof last?.x === 'number' ? last.x : baseX;
                const lastY = typeof last?.y === 'number' ? last.y : baseY;
                x = lastX + CASCADE_STEP;
                y = lastY + CASCADE_STEP;
            }
            // Keep imports on-canvas: if the cascade walks off the visible
            // area, wrap back to a clean offset near the origin.
            if (x > 1400 || y > 1400) {
                x = baseX + CASCADE_STEP;
                y = baseY + CASCADE_STEP;
            }
            const newCanvasImage: CanvasImage = {
                id: `layer_${imageId}_${Date.now()}`,
                base64: sourceUrl, // URL or data URI
                x,
                y,
                width: 512,
                height: 512,
                aspect: 1,
                projectId: 'chat_import', // Temporary or default
                prompt: prompt
            };
            
            set((state) => ({
                canvasImages: [...state.canvasImages, newCanvasImage],
                selectedCanvasImageId: newCanvasImage.id,
                chatImportContext: {
                    messageId: sourceMessageId,
                    agentId,
                    prompt
                }
            }));
            
            // Route-switch to creative module using dynamic import of store
            import('@/core/store').then(({ useStore }) => {
                useStore.getState().setViewMode('canvas');
                useStore.getState().setModule('creative');
            });
        },

        uploadedImages: [],
        // ISSUE-922: returns whether durable persistence succeeded so callers
        // can report honest per-file outcomes. Never rejects — legacy
        // fire-and-forget callers stay safe.
        addUploadedImage: (img: HistoryItem) => {
            // Eviction policy: keep the 50 most recent in memory (data-URI
            // items are heavy). Evicted items are durable in the cloud and
            // reappear via the Firestore snapshot rebuild (which is uncapped)
            // — but the trim must never be silent (ISSUE-922 remainder).
            set((state) => {
                const next = [img, ...state.uploadedImages];
                if (next.length > UPLOAD_MEMORY_CAP) notifyUploadEviction('image');
                return { uploadedImages: next.slice(0, UPLOAD_MEMORY_CAP) };
            });
            return import('@/services/StorageService')
                .then(({ StorageService }) => StorageService.saveItem(img))
                .then((savedInfo) => {
                    import('@/core/store').then(({ useStore }) => {
                        const { currentProjectId, createFileNode, user } = useStore.getState();
                        if (user?.uid) {
                            const { extension, mimeType } = inferMediaExtension(img);
                            const filename = `uploaded-${img.id.slice(0, 8)}.${extension}`;
                            createFileNode(
                                filename,
                                null,
                                currentProjectId,
                                user.uid,
                                'image',
                                {
                                    url: savedInfo.url,
                                    storagePath: savedInfo.storageUri,
                                    origin: 'uploaded',
                                    mimeType
                                }
                            ).catch(err => logger.error("[CreativeSlice] File system sync error", err));
                        }
                    });
                    return true;
                })
                .catch((e) => { logger.error('[Store] Failed to save item:', e); return false; });
        },
        updateUploadedImage: (id: string, updates: Partial<HistoryItem>) => set((state) => ({
            uploadedImages: state.uploadedImages.map(img => img.id === id ? { ...img, ...updates } : img)
        })),
        removeUploadedImage: (id: string) => {
            set((state) => ({ uploadedImages: state.uploadedImages.filter(i => i.id !== id) }));
            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.removeItem(id).catch((e) => { logger.error('[Store] Failed to remove item:', e); });
            });
        },

        uploadedAudio: [],
        // ISSUE-922: same honest-persistence + explicit-eviction contract as
        // addUploadedImage.
        addUploadedAudio: (audio: HistoryItem) => {
            set((state) => {
                const next = [audio, ...state.uploadedAudio];
                if (next.length > UPLOAD_MEMORY_CAP) notifyUploadEviction('audio');
                return { uploadedAudio: next.slice(0, UPLOAD_MEMORY_CAP) };
            });
            return import('@/services/StorageService')
                .then(({ StorageService }) => StorageService.saveItem(audio))
                .then((savedInfo) => {
                    import('@/core/store').then(({ useStore }) => {
                        const { currentProjectId, createFileNode, user } = useStore.getState();
                        if (user?.uid) {
                            const { extension, mimeType } = inferMediaExtension(audio);
                            const filename = `uploaded-${audio.id.slice(0, 8)}.${extension}`;
                            createFileNode(
                                filename,
                                null,
                                currentProjectId,
                                user.uid,
                                'audio',
                                {
                                    url: savedInfo.url,
                                    storagePath: savedInfo.storageUri,
                                    origin: 'uploaded',
                                    mimeType
                                }
                            ).catch(err => logger.error("[CreativeSlice] File system sync error", err));
                        }
                    });
                    return true;
                })
                .catch((e) => { logger.error('[Store] Failed to save item:', e); return false; });
        },
        removeUploadedAudio: (id: string) => {
            set((state) => ({ uploadedAudio: state.uploadedAudio.filter(i => i.id !== id) }));
            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.removeItem(id).catch((e: unknown) => { logger.error('[Store] Failed to remove audio item:', e); });
            });
        },
        removeUploadedImageFromProject: (id: string) => {
            set((state) => ({ uploadedImages: state.uploadedImages.filter(i => i.id !== id) }));
            logger.debug(`[CreativeSlice] Soft removed uploaded image ${id} from project view.`);
        },
        removeUploadedAudioFromProject: (id: string) => {
            set((state) => ({ uploadedAudio: state.uploadedAudio.filter(i => i.id !== id) }));
            logger.debug(`[CreativeSlice] Soft removed uploaded audio ${id} from project view.`);
        },
    };
}

export function resetCreativeHistoryListener() {
    if (creativeHistoryUnsubscribe) {
        creativeHistoryUnsubscribe();
        creativeHistoryUnsubscribe = null;
    }
}
