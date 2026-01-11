import { StateCreator } from 'zustand';

export interface HistoryItem {
    id: string;
    type: 'image' | 'video' | 'music' | 'text';
    url: string;
    prompt: string;
    timestamp: number;
    projectId: string;
    orgId?: string;
    meta?: string;
    mask?: string;
    category?: 'headshot' | 'bodyshot' | 'clothing' | 'environment' | 'logo' | 'other';
    tags?: string[];
    subject?: string;
    origin?: 'generated' | 'uploaded';
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

export interface WhiskItem {
    id: string;
    type: 'text' | 'image';
    content: string; // user text or original image data/url
    aiCaption?: string; // Generated caption for images
    checked: boolean;
    category: 'subject' | 'scene' | 'style';
}

export interface WhiskState {
    subjects: WhiskItem[];
    scenes: WhiskItem[];
    styles: WhiskItem[];
    preciseReference: boolean;
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

    // Studio Controls
    studioControls: {
        aspectRatio: string;
        resolution: string;
        negativePrompt: string;
        seed: string;
        cameraMovement: string;
        motionStrength: number;
        fps: number;
        duration: number; // Duration in seconds
        shotList: ShotItem[];
        isCoverArtMode: boolean; // When true, enforces distributor cover art specs
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

    // Entity Anchor (Character Consistency)
    entityAnchor: HistoryItem | null;
    setEntityAnchor: (img: HistoryItem | null) => void;

    viewMode: 'gallery' | 'canvas' | 'showroom' | 'video_production';
    setViewMode: (mode: 'gallery' | 'canvas' | 'showroom' | 'video_production') => void;

    prompt: string;
    setPrompt: (prompt: string) => void;

    selectedItem: HistoryItem | null;
    setSelectedItem: (item: HistoryItem | null) => void;

    savedPrompts: SavedPrompt[];
    savePrompt: (prompt: SavedPrompt) => void;
    deletePrompt: (id: string) => void;

    // Whisk
    whiskState: WhiskState;
    addWhiskItem: (category: 'subject' | 'scene' | 'style', type: 'text' | 'image', content: string, aiCaption?: string, explicitId?: string) => void;
    updateWhiskItem: (category: 'subject' | 'scene' | 'style', id: string, updates: Partial<WhiskItem>) => void;
    removeWhiskItem: (category: 'subject' | 'scene' | 'style', id: string) => void;
    toggleWhiskItem: (category: 'subject' | 'scene' | 'style', id: string) => void;
    setPreciseReference: (precise: boolean) => void;

    isGenerating: boolean;
    setIsGenerating: (isGenerating: boolean) => void;
}

export const createCreativeSlice: StateCreator<CreativeSlice> = (set, get) => ({
    generatedHistory: [],
    addToHistory: (item: HistoryItem) => {
        // Use dynamic import to avoid circular dependency with store
        import('@/core/store').then(({ useStore }) => {
            console.log("CreativeSlice: addToHistory called", item.id);
            const { currentOrganizationId } = useStore.getState();
            const enrichedItem = { ...item, orgId: item.orgId || currentOrganizationId };

            set((state) => ({ generatedHistory: [enrichedItem, ...state.generatedHistory] }));
            console.log("CreativeSlice: generatedHistory updated", enrichedItem.id);

            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.saveItem(enrichedItem)
                    .then(() => { console.log("CreativeSlice: Saved to Storage", enrichedItem.id) })
                    .catch((err) => { console.error("CreativeSlice: Storage Save Error", err) });
            }).catch(err => console.error("CreativeSlice: Failed to import StorageService", err));
        }).catch(err => console.error("CreativeSlice: Failed to import store", err));
    },
    initializeHistory: async () => {
        const { StorageService } = await import('@/services/StorageService');

        return new Promise<void>((resolve) => {
            // bypass auth check for Ground Zero
            StorageService.loadHistory()
                .then(history => {
                    set((state) => {
                        // Merge logic: If an item exists locally with a full data URI, 
                        // and Firestore has a placeholder, keep the local one.
                        const mergedHistory = [...state.generatedHistory];

                        history.forEach(remItem => {
                            const localIndex = mergedHistory.findIndex(loc => loc.id === remItem.id);
                            if (localIndex !== -1) {
                                // If local has data:uri and remote has placeholder, don't overwrite the URL
                                if (mergedHistory[localIndex].url.startsWith('data:') && remItem.url === 'placeholder:dev-data-uri-too-large') {
                                    mergedHistory[localIndex] = { ...remItem, url: mergedHistory[localIndex].url };
                                } else {
                                    mergedHistory[localIndex] = remItem;
                                }
                            } else {
                                mergedHistory.push(remItem);
                            }
                        });

                        const generated = mergedHistory.filter(item => item.origin !== 'uploaded');
                        const uploaded = mergedHistory.filter(item => item.origin === 'uploaded');

                        return {
                            generatedHistory: generated,
                            uploadedImages: uploaded
                        };
                    });
                    resolve();
                })
                .catch(() => {
                    resolve();
                });
        });
    },
    updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => set((state) => ({
        generatedHistory: state.generatedHistory.map(item => item.id === id ? { ...item, ...updates } : item)
    })),
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

    studioControls: {
        aspectRatio: '16:9',
        resolution: '4K',
        negativePrompt: '',
        seed: '',
        cameraMovement: 'Static',
        motionStrength: 0.7,
        fps: 24,
        duration: 5, // Default to 5 seconds
        shotList: [],
        isCoverArtMode: false
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

    entityAnchor: null,
    setEntityAnchor: (img) => set({ entityAnchor: img }),

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
        preciseReference: false
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
        const key = category === 'subject' ? 'subjects' : category === 'scene' ? 'scenes' : 'styles';
        return {
            whiskState: {
                ...state.whiskState,
                [key]: [...state.whiskState[key], newItem]
            }
        };
    }),
    updateWhiskItem: (category, id, updates) => set((state) => {
        const key = category === 'subject' ? 'subjects' : category === 'scene' ? 'scenes' : 'styles';
        return {
            whiskState: {
                ...state.whiskState,
                [key]: state.whiskState[key].map(item => item.id === id ? { ...item, ...updates } : item)
            }
        };
    }),
    removeWhiskItem: (category, id) => set((state) => {
        const key = category === 'subject' ? 'subjects' : category === 'scene' ? 'scenes' : 'styles';
        return {
            whiskState: {
                ...state.whiskState,
                [key]: state.whiskState[key].filter(item => item.id !== id)
            }
        };
    }),
    toggleWhiskItem: (category, id) => set((state) => {
        const key = category === 'subject' ? 'subjects' : category === 'scene' ? 'scenes' : 'styles';
        return {
            whiskState: {
                ...state.whiskState,
                [key]: state.whiskState[key].map(item => item.id === id ? { ...item, checked: !item.checked } : item)
            }
        };
    }),
    setPreciseReference: (precise) => set((state) => ({
        whiskState: { ...state.whiskState, preciseReference: precise }
    })),

    isGenerating: false,
    setIsGenerating: (isGenerating) => set({ isGenerating }),
});
