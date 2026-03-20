import { logger } from '@/utils/logger';
import { StateCreator } from 'zustand';
import { HistoryItem } from '@/core/types/history';

export type { HistoryItem };
import { z } from 'zod';
import { VideoAspectRatioSchema, VideoResolutionSchema } from '@/modules/video/schemas';

type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>;
type VideoResolution = z.infer<typeof VideoResolutionSchema>;

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

export interface SavedPrompt {
    id: string;
    title: string;
    text: string;
    date: number;
}

export interface ShotItem {
    id: string;
    title: string;
    description: string;
    duration: number;
    cameraMovement?: string;
}

export type WhiskCategory = 'subject' | 'scene' | 'style' | 'motion';
export type TargetMedia = 'image' | 'video' | 'both';

export interface WhiskItem {
    id: string;
    type: 'text' | 'image';
    content: string; // user text or original image data/url
    aiCaption?: string; // Generated caption for images
    checked: boolean;
    category: WhiskCategory;
}

export interface WhiskState {
    subjects: WhiskItem[];
    scenes: WhiskItem[];
    styles: WhiskItem[];
    motion: WhiskItem[]; // NEW: Camera movements, speed, energy
    preciseReference: boolean;
    targetMedia: TargetMedia; // NEW: What to generate (image, video, or both)
}

export interface CreativeSlice {
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

    // Studio Controls
    studioControls: {
        aspectRatio: VideoAspectRatio;
        resolution: VideoResolution;
        negativePrompt: string;
        seed: string;
        cameraMovement: string;
        motionStrength: number;
        fps: number;
        duration: number; // Duration in seconds
        shotList: ShotItem[];
        isCoverArtMode: boolean; // When true, enforces distributor cover art specs
        // Gemini 3 / Veo 3.1 Upgrades
        model: 'fast' | 'pro';
        thinking: boolean;
        mediaResolution: 'low' | 'medium' | 'high';
        // Feature Parity
        generateAudio: boolean;
        useGrounding: boolean;
        personGeneration: 'allow_adult' | 'dont_allow' | 'allow_all';
        isTransitionMode: boolean;
    };
    setStudioControls: (controls: Partial<CreativeSlice['studioControls']>) => void;
    enableCoverArtMode: () => void; // Sets 1:1 aspect for cover art
    disableCoverArtMode: () => void; // Reverts to previous aspect ratio

    // Mode & Inputs
    generationMode: 'image' | 'video';
    setGenerationMode: (mode: 'image' | 'video') => void;

    activeReferenceImage: HistoryItem | null;
    setActiveReferenceImage: (img: HistoryItem | null) => void;

    videoInputs: {
        firstFrame: HistoryItem | null;
        lastFrame: HistoryItem | null;
        isDaisyChain: boolean;
        timeOffset: number;
        ingredients: HistoryItem[];
    };
    setVideoInput: <K extends keyof CreativeSlice['videoInputs']>(key: K, value: CreativeSlice['videoInputs'][K]) => void;
    setVideoInputs: (inputs: Partial<CreativeSlice['videoInputs']>) => void;

    // Character/Entity References (Veo 3.1 multiple-image consistency)
    characterReferences: Array<{
        image: HistoryItem;
        referenceType: 'subject' | 'style' | 'reference';
        name?: string;
    }>;
    addCharacterReference: (ref: { image: HistoryItem; referenceType: 'subject' | 'style' | 'reference'; name?: string }) => void;
    removeCharacterReference: (id: string) => void;
    clearCharacterReferences: () => void;
    updateCharacterReference: (id: string, updates: Partial<{ referenceType: 'subject' | 'style' | 'reference'; name: string }>) => void;
    viewMode: 'gallery' | 'canvas' | 'video_production' | 'showroom' | 'direct' | 'lab' | 'editor' | 'release';
    setViewMode: (mode: 'gallery' | 'canvas' | 'video_production' | 'showroom' | 'direct' | 'lab' | 'editor' | 'release') => void;

    prompt: string;
    setPrompt: (prompt: string) => void;

    selectedItem: HistoryItem | null;
    setSelectedItem: (item: HistoryItem | null) => void;

    savedPrompts: SavedPrompt[];
    savePrompt: (prompt: SavedPrompt) => void;
    deletePrompt: (id: string) => void;

    // Whisk
    whiskState: WhiskState;
    addWhiskItem: (category: WhiskCategory, type: 'text' | 'image', content: string, aiCaption?: string, explicitId?: string) => void;
    updateWhiskItem: (category: WhiskCategory, id: string, updates: Partial<WhiskItem>) => void;
    removeWhiskItem: (category: WhiskCategory, id: string) => void;
    toggleWhiskItem: (category: WhiskCategory, id: string) => void;
    setPreciseReference: (precise: boolean) => void;
    setTargetMedia: (target: TargetMedia) => void; // NEW

    isGenerating: boolean;
    setIsGenerating: (isGenerating: boolean) => void;
}

export const createCreativeSlice: StateCreator<CreativeSlice> = (set, get) => ({
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
                    .then(() => { logger.debug("CreativeSlice: Saved to Storage", enrichedItem.id) })
                    .catch((err) => { logger.error("CreativeSlice: Storage Save Error", err) });
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

                            if (isPermissionError && retryCount < MAX_RETRIES) {
                                const backoffMs = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
                                logger.warn(`[CreativeSlice] Permission error on history subscription, retrying in ${backoffMs / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                                setTimeout(() => {
                                    attemptSubscribe(retryCount + 1).then(resolve);
                                }, backoffMs);
                            } else {
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

    studioControls: {
        aspectRatio: '16:9',
        resolution: '720p',
        negativePrompt: '',
        seed: '',
        cameraMovement: 'Static',
        motionStrength: 0.7,
        fps: 24,
        duration: 6, // Default to 6 seconds (Veo API rejects 5)
        shotList: [],
        isCoverArtMode: false,
        model: 'pro',
        thinking: false,
        mediaResolution: 'medium',
        // Feature Parity Defaults
        generateAudio: true,
        useGrounding: false,
        personGeneration: 'allow_adult',
        isTransitionMode: false
    },
    setStudioControls: (controls) => set((state) => ({ studioControls: { ...state.studioControls, ...controls } })),
    enableCoverArtMode: () => set((state) => ({
        studioControls: {
            ...state.studioControls,
            aspectRatio: '1:1', // Cover art is always square
            isCoverArtMode: true
        }
    })),
    disableCoverArtMode: () => set((state) => ({
        studioControls: {
            ...state.studioControls,
            aspectRatio: '16:9', // Revert to default
            isCoverArtMode: false
        }
    })),

    generationMode: 'image',
    setGenerationMode: (mode) => set({ generationMode: mode }),

    activeReferenceImage: null,
    setActiveReferenceImage: (img) => set({ activeReferenceImage: img }),

    videoInputs: {
        firstFrame: null,
        lastFrame: null,
        isDaisyChain: false,
        timeOffset: 0,
        ingredients: []
    },
    setVideoInput: (key, value) => set(state => ({
        videoInputs: { ...state.videoInputs, [key]: value }
    })),
    setVideoInputs: (inputs) => set(state => ({
        videoInputs: { ...state.videoInputs, ...inputs }
    })),

    characterReferences: [],
    addCharacterReference: (ref) => set((state) => {
        if (state.characterReferences.length >= 3) return state;
        return { characterReferences: [...state.characterReferences, ref] };
    }),
    removeCharacterReference: (id) => set((state) => ({
        characterReferences: state.characterReferences.filter(r => r.image.id !== id)
    })),
    clearCharacterReferences: () => set({ characterReferences: [] }),
    updateCharacterReference: (id, updates) => set((state) => ({
        characterReferences: state.characterReferences.map(r => r.image.id === id ? { ...r, ...updates } : r)
    })),

    viewMode: 'gallery',
    setViewMode: (mode) => set({ viewMode: mode }),

    prompt: '',
    setPrompt: (prompt) => set({ prompt }),

    selectedItem: null,
    setSelectedItem: (item) => set({ selectedItem: item }),

    savedPrompts: [],
    savePrompt: (prompt) => set((state) => ({ savedPrompts: [prompt, ...state.savedPrompts] })),
    deletePrompt: (id) => set((state) => ({ savedPrompts: state.savedPrompts.filter(p => p.id !== id) })),

    whiskState: {
        subjects: [],
        scenes: [],
        styles: [],
        motion: [], // NEW: Camera movements, speed, energy
        preciseReference: false,
        targetMedia: 'image' as TargetMedia // NEW: Default to image generation
    },
    addWhiskItem: (category, type, content, aiCaption, explicitId) => set((state) => {
        const newItem: WhiskItem = {
            id: explicitId || crypto.randomUUID(),
            type,
            content,
            aiCaption,
            checked: true,
            category
        };
        const keyMap: Record<WhiskCategory, keyof WhiskState> = {
            subject: 'subjects',
            scene: 'scenes',
            style: 'styles',
            motion: 'motion'
        };
        const key = keyMap[category];
        return {
            whiskState: {
                ...state.whiskState,
                [key]: [...(state.whiskState[key] as WhiskItem[]), newItem]
            }
        };
    }),
    updateWhiskItem: (category, id, updates) => set((state) => {
        const keyMap: Record<WhiskCategory, keyof WhiskState> = {
            subject: 'subjects',
            scene: 'scenes',
            style: 'styles',
            motion: 'motion'
        };
        const key = keyMap[category];
        return {
            whiskState: {
                ...state.whiskState,
                [key]: (state.whiskState[key] as WhiskItem[]).map(item => item.id === id ? { ...item, ...updates } : item)
            }
        };
    }),
    removeWhiskItem: (category, id) => set((state) => {
        const keyMap: Record<WhiskCategory, keyof WhiskState> = {
            subject: 'subjects',
            scene: 'scenes',
            style: 'styles',
            motion: 'motion'
        };
        const key = keyMap[category];
        return {
            whiskState: {
                ...state.whiskState,
                [key]: (state.whiskState[key] as WhiskItem[]).filter(item => item.id !== id)
            }
        };
    }),
    toggleWhiskItem: (category, id) => set((state) => {
        const keyMap: Record<WhiskCategory, keyof WhiskState> = {
            subject: 'subjects',
            scene: 'scenes',
            style: 'styles',
            motion: 'motion'
        };
        const key = keyMap[category];
        return {
            whiskState: {
                ...state.whiskState,
                [key]: (state.whiskState[key] as WhiskItem[]).map(item => item.id === id ? { ...item, checked: !item.checked } : item)
            }
        };
    }),
    setPreciseReference: (precise) => set((state) => ({
        whiskState: { ...state.whiskState, preciseReference: precise }
    })),
    setTargetMedia: (target) => set((state) => ({
        whiskState: { ...state.whiskState, targetMedia: target }
    })),

    isGenerating: false,
    setIsGenerating: (isGenerating) => set({ isGenerating }),
});
