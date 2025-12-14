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
}

export const createCreativeSlice: StateCreator<CreativeSlice> = (set, get) => ({
    generatedHistory: [],
    addToHistory: (item) => {
        // Use dynamic import to avoid circular dependency with store
        import('@/core/store').then(({ useStore }) => {
            const { currentOrganizationId } = useStore.getState();
            const enrichedItem = { ...item, orgId: item.orgId || currentOrganizationId };

            set((state) => ({ generatedHistory: [enrichedItem, ...state.generatedHistory] }));

            import('@/services/StorageService').then(({ StorageService }) => {
                StorageService.saveItem(enrichedItem)
                    .then(() => console.log("Saved to Firestore"))
                    .catch(e => console.error("Save failed", e));
            });
        });
    },
    initializeHistory: async () => {
        const { auth } = await import('@/services/firebase');
        const { onAuthStateChanged, signInAnonymously } = await import('firebase/auth');
        const { StorageService } = await import('@/services/StorageService');

        return new Promise<void>((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    try {
                        const history = await StorageService.loadHistory();
                        set({ generatedHistory: history });
                    } catch (error) {
                        console.error("Error loading history:", error);
                    }
                    unsubscribe();
                    resolve();
                } else {
                    try {
                        await signInAnonymously(auth);
                        // The onAuthStateChanged will fire again, so we don't need to do anything here
                        // but for safety in this specific promise logic:
                        if (auth.currentUser) {
                            const history = await StorageService.loadHistory();
                            set({ generatedHistory: history });
                            unsubscribe();
                            resolve();
                        }
                    } catch (e: any) {
                        if (e.code === 'auth/admin-restricted-operation') {
                            console.debug("Anonymous authentication disabled. Proceeding as Guest.");
                        } else {
                            console.error("Anonymous sign-in failed:", e);
                        }
                        unsubscribe();
                        resolve();
                    }
                }
            });
        });
    },
    updateHistoryItem: (id, updates) => set((state) => ({
        generatedHistory: state.generatedHistory.map(item => item.id === id ? { ...item, ...updates } : item)
    })),
    removeFromHistory: (id) => set((state) => ({ generatedHistory: state.generatedHistory.filter(i => i.id !== id) })),

    canvasImages: [],
    selectedCanvasImageId: null,
    addCanvasImage: (img) => set((state) => ({ canvasImages: [...state.canvasImages, img] })),
    updateCanvasImage: (id, updates) => set((state) => ({
        canvasImages: state.canvasImages.map(img => img.id === id ? { ...img, ...updates } : img)
    })),
    removeCanvasImage: (id) => set((state) => ({ canvasImages: state.canvasImages.filter(i => i.id !== id) })),
    selectCanvasImage: (id) => set({ selectedCanvasImageId: id }),

    uploadedImages: [],
    addUploadedImage: (img) => set((state) => ({ uploadedImages: [img, ...state.uploadedImages] })),
    updateUploadedImage: (id, updates) => set((state) => ({
        uploadedImages: state.uploadedImages.map(img => img.id === id ? { ...img, ...updates } : img)
    })),
    removeUploadedImage: (id) => set((state) => ({ uploadedImages: state.uploadedImages.filter(i => i.id !== id) })),

    studioControls: {
        aspectRatio: '16:9',
        resolution: '4K',
        negativePrompt: '',
        seed: '',
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
});
