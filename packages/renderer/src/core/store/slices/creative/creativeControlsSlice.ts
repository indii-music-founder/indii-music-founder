import { StateCreator } from 'zustand';
import { HistoryItem } from '@/core/types/history';
import { StoreState } from '@/core/store';
import { z } from 'zod';
import { AspectRatioSchema, VideoResolutionSchema, VideoJobStatusSchema } from '@/modules/creative/video/schemas';

type AspectRatio = z.infer<typeof AspectRatioSchema>;
type VideoResolution = z.infer<typeof VideoResolutionSchema>;
export type VideoJobStatus = z.infer<typeof VideoJobStatusSchema>;

export interface ActiveVideoJob {
    id: string;
    status: VideoJobStatus;
    progress?: number; // 0-100
    videoUrl?: string;
    error?: string;
    createdAt: number;
}

export interface SavedPrompt {
    id: string;
    title: string;
    text: string;
    date: number;
}

export interface ClipboardItem {
    id: string;
    url: string;
    thumbnailUrl?: string;
    prompt?: string;
    type: 'image' | 'video';
    timestamp: number;
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
    type: 'text' | 'image' | 'video';
    content: string; // user text or original image data/url
    intelligenceCaption?: string; // Generated caption for images
    checked: boolean;
    category: WhiskCategory;
}

export interface WhiskState {
    subjects: WhiskItem[];
    scenes: WhiskItem[];
    styles: WhiskItem[];
    motion: WhiskItem[]; // Camera movements, speed, energy
    preciseReference: boolean;
    targetMedia: TargetMedia; // What to generate (image, video, or both)
}

export interface CreativeControlsSlice {
    // Studio Controls
    studioControls: {
        aspectRatio: AspectRatio;
        resolution: VideoResolution;
        negativePrompt: string;
        /** Seed for reproducible video generation (Veo 3.1 only — not supported by Gemini Image API). */
        seed: string;
        cameraMovement: string;
        motionStrength: number;
        fps: number;
        duration: number;
        shotList: ShotItem[];
        isCoverArtMode: boolean;
        model: 'lite' | 'fast' | 'pro';
        thinkingLevel: 'none' | 'minimal' | 'low' | 'medium' | 'high';
        mediaResolution: 'low' | 'medium' | 'high';
        generateAudio: boolean;
        useGrounding: boolean;
        personGeneration: 'allow_adult' | 'dont_allow' | 'allow_all';
        isTransitionMode: boolean;
        isPLPMode: boolean;

        // ── Nano Banana API Extensions ─────────────────────────────────────

        /** API-native image resolution: 0.5K (NB2 only), 1K, 2K, 4K. Uppercase K required. */
        imageSize: '0.5K' | '1K' | '2K' | '4K';
        /** Number of images to generate per prompt (1-4). */
        batchCount: number;
        /** Image Search grounding — NB2 (3.1 Flash) exclusive. Requires useGrounding=true. */
        useImageSearch: boolean;
        /** Output format: image only or interleaved text + image narration. */
        responseFormat: 'image_only' | 'image_and_text';
        /** Whether to include the model's thinking/reasoning in the response. */
        includeThoughts: boolean;

        // ── Gemini Omni API Extensions ──────────────────────────────────────
        posePreservation: number;
        beatPulse: number;
        characterXRay: boolean;
        omniReferenceVideo: string | null;
        activePosePreset: string;
        lyricsText: string;
        typographyStyle: 'cyberpunk' | 'kinetic-neon' | 'liquid-gold' | 'minimal-infographic';
        visualizerColor: string;
    };
    setStudioControls: (controls: Partial<CreativeControlsSlice['studioControls']>) => void;
    enableCoverArtMode: () => void;
    disableCoverArtMode: () => void;
    enablePLPMode: () => void;
    disablePLPMode: () => void;

    // Mode & Inputs
    generationMode: 'image' | 'video';
    setGenerationMode: (mode: 'image' | 'video') => void;

    // Persistence flag
    isSessionPersistent: boolean;
    setSessionPersistent: (persistent: boolean) => void;

    activeReferenceImage: HistoryItem | null;
    setActiveReferenceImage: (img: HistoryItem | null) => void;

    videoInputs: {
        firstFrame: HistoryItem | null;
        lastFrame: HistoryItem | null;
        maskFrame: HistoryItem | null;
        maskRange?: { startFrame: number; endFrame: number } | null;
        isTemporalInpaint: boolean;
        isDaisyChain: boolean;
        timeOffset: number;
        ingredients: HistoryItem[];
        sequenceDurations?: number[];
    };
    setVideoInput: <K extends keyof CreativeControlsSlice['videoInputs']>(key: K, value: CreativeControlsSlice['videoInputs'][K]) => void;
    setVideoInputs: (inputs: Partial<CreativeControlsSlice['videoInputs']>) => void;

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

    viewMode: 'gallery' | 'canvas' | 'video_production' | 'showroom' | 'direct' | 'lab' | 'editor' | 'release' | 'omni';
    setViewMode: (mode: 'gallery' | 'canvas' | 'video_production' | 'showroom' | 'direct' | 'lab' | 'editor' | 'release' | 'omni') => void;

    // ISSUE-1375: view-mode navigation history — Back/Forward between the
    // image studio (direct), canvas, and every other creative view the user
    // actually visits, so leaving the canvas for the studio is one click.
    _viewModeHistory: string[];
    _viewModeIndex: number;
    viewModeBack: () => void;
    viewModeForward: () => void;

    // Showroom Mode State
    showroomState: {
        productAsset: HistoryItem | null;
        productType: 'T-Shirt' | 'Hoodie' | 'Mug' | 'Bottle' | 'Poster' | 'Phone Screen';
        placementHint: string;
        sceneDescription: string;
        motionDescription: string;
        mockupResult: HistoryItem | null;
        isGeneratingMockup: boolean;
        isGeneratingVideo: boolean;
    };
    setShowroomState: (updates: Partial<CreativeControlsSlice['showroomState']>) => void;

    prompt: string;
    setPrompt: (prompt: string) => void;

    /**
     * Creative-module-scoped prompt. Used by the Generate input, Canvas,
     * Gallery "reuse prompt", Prompt History, and the top-nav Prompt Builder.
     * Non-creative surfaces (e.g. video workflow, right-panel video controls)
     * continue to use `prompt`/`setPrompt` until they are migrated.
     */
    creativePrompt: string;
    setCreativePrompt: (prompt: string) => void;

    isPromptBuilderOpen: boolean;
    setPromptBuilderOpen: (open: boolean) => void;
    togglePromptBuilder: () => void;

    selectedItem: HistoryItem | null;
    setSelectedItem: (item: HistoryItem | null) => void;

    savedPrompts: SavedPrompt[];
    savePrompt: (prompt: SavedPrompt) => void;
    deletePrompt: (id: string) => void;

    // Whisk
    whiskState: WhiskState;
    addWhiskItem: (category: WhiskCategory, type: 'text' | 'image', content: string, intelligenceCaption?: string, explicitId?: string) => void;
    updateWhiskItem: (category: WhiskCategory, id: string, updates: Partial<WhiskItem>) => void;
    removeWhiskItem: (category: WhiskCategory, id: string) => void;
    toggleWhiskItem: (category: WhiskCategory, id: string) => void;
    setPreciseReference: (precise: boolean) => void;
    setTargetMedia: (target: TargetMedia) => void;

    isGenerating: boolean;
    setIsGenerating: (isGenerating: boolean) => void;

    // Background Video Jobs
    activeVideoJobs: Record<string, ActiveVideoJob>;
    addVideoJob: (job: ActiveVideoJob) => void;
    updateVideoJob: (id: string, updates: Partial<ActiveVideoJob>) => void;
    removeVideoJob: (id: string) => void;

    // Clipboard State
    clipboardItems: ClipboardItem[];
    pinToClipboard: (item: HistoryItem | ClipboardItem) => void;
    unpinFromClipboard: (id: string) => void;
    clearClipboard: () => void;
}

/**
 * Factory that returns the controls/inputs portion of the creative slice.
 */
export function buildCreativeControlsState(
    set: Parameters<StateCreator<StoreState, [], [], CreativeControlsSlice>>[0],
    _get: Parameters<StateCreator<StoreState, [], [], CreativeControlsSlice>>[1]
): CreativeControlsSlice {
    const whiskKeyMap: Record<WhiskCategory, keyof WhiskState> = {
        subject: 'subjects',
        scene: 'scenes',
        style: 'styles',
        motion: 'motion'
    };

    return {
        studioControls: {
            aspectRatio: '16:9',
            resolution: '720p',
            negativePrompt: '',
            seed: '',
            cameraMovement: 'Static',
            motionStrength: 0.7,
            fps: 24,
            duration: 6,
            shotList: [],
            isCoverArtMode: false,
            model: 'fast',
            thinkingLevel: 'none',
            mediaResolution: 'medium',
            generateAudio: true,
            useGrounding: false,
            personGeneration: 'allow_adult',
            isTransitionMode: false,
            isPLPMode: false,
            // Nano Banana API defaults
            imageSize: '2K',
            batchCount: 1,
            useImageSearch: false,
            responseFormat: 'image_only',
            includeThoughts: false,
            // Gemini Omni defaults
            posePreservation: 0.8,
            beatPulse: 0.5,
            characterXRay: true,
            omniReferenceVideo: null,
            activePosePreset: 'guitar_solo',
            lyricsText: '',
            typographyStyle: 'cyberpunk',
            visualizerColor: '#8B5CF6',
        },
        setStudioControls: (controls) => set((state: StoreState) => ({ studioControls: { ...state.studioControls, ...controls } })),
        enableCoverArtMode: () => set((state: StoreState) => ({
            studioControls: {
                ...state.studioControls,
                aspectRatio: '1:1', // Cover art mode enforces 1:1 format
                isCoverArtMode: true
            }
        })),
        disableCoverArtMode: () => set((state: StoreState) => ({
            studioControls: {
                ...state.studioControls,
                aspectRatio: '16:9',
                isCoverArtMode: false
            }
        })),
        enablePLPMode: () => set((state: StoreState) => ({
            studioControls: {
                ...state.studioControls,
                isPLPMode: true
            }
        })),
        disablePLPMode: () => set((state: StoreState) => ({
            studioControls: {
                ...state.studioControls,
                isPLPMode: false
            }
        })),

        generationMode: 'image',
        setGenerationMode: (mode) => set({ generationMode: mode }),

        isSessionPersistent: true,
        setSessionPersistent: (persistent) => set({ isSessionPersistent: persistent }),

        activeReferenceImage: null,
        setActiveReferenceImage: (img) => set({ activeReferenceImage: img }),

        videoInputs: {
            firstFrame: null,
            lastFrame: null,
            maskFrame: null,
            maskRange: null,
            isTemporalInpaint: false,
            isDaisyChain: false,
            timeOffset: 0,
            ingredients: []
        },
        setVideoInput: (key, value) => set((state: StoreState) => ({
            videoInputs: { ...state.videoInputs, [key]: value }
        })),
        setVideoInputs: (inputs) => set((state: StoreState) => ({
            videoInputs: { ...state.videoInputs, ...inputs }
        })),

        characterReferences: [],
        addCharacterReference: (ref) => set((state: StoreState) => {
            if (state.characterReferences.length >= 3) return state;
            return { characterReferences: [...state.characterReferences, ref] };
        }),
        removeCharacterReference: (id) => set((state: StoreState) => ({
            characterReferences: state.characterReferences.filter((r) => r.image.id !== id)
        })),
        clearCharacterReferences: () => set({ characterReferences: [] }),
        updateCharacterReference: (id, updates) => set((state: StoreState) => ({
            characterReferences: state.characterReferences.map((r) => r.image.id === id ? { ...r, ...updates } : r)
        })),

        viewMode: 'direct',
        // ISSUE-1375: Back/Forward navigation over visited views. Standard
        // undo semantics: a new switch trims any forward entries, appends the
        // target, and moves the pointer to the end; Back/Forward only move
        // the pointer (they never create new entries).
        _viewModeHistory: ['direct'],
        _viewModeIndex: 0,
        setViewMode: (mode) => set((state: StoreState) => {
            if (state.viewMode === mode) return state;
            const history = state._viewModeHistory.slice(0, state._viewModeIndex + 1);
            if (history[history.length - 1] !== mode) history.push(mode);
            const trimmed = history.slice(-30);
            return {
                viewMode: mode,
                _viewModeHistory: trimmed,
                _viewModeIndex: trimmed.length - 1,
            };
        }),
        viewModeBack: () => set((state: StoreState) => {
            if (state._viewModeIndex <= 0) return state;
            const index = state._viewModeIndex - 1;
            return {
                viewMode: state._viewModeHistory[index] as StoreState['viewMode'],
                _viewModeIndex: index,
            };
        }),
        viewModeForward: () => set((state: StoreState) => {
            if (state._viewModeIndex >= state._viewModeHistory.length - 1) return state;
            const index = state._viewModeIndex + 1;
            return {
                viewMode: state._viewModeHistory[index] as StoreState['viewMode'],
                _viewModeIndex: index,
            };
        }),

        showroomState: {
            productAsset: null,
            productType: 'T-Shirt',
            placementHint: 'Center Chest',
            sceneDescription: '',
            motionDescription: '',
            mockupResult: null,
            isGeneratingMockup: false,
            isGeneratingVideo: false,
        },
        setShowroomState: (updates) => set((state: StoreState) => ({
            showroomState: { ...state.showroomState, ...updates }
        })),

        prompt: '',
        setPrompt: (prompt) => set({ prompt }),

        creativePrompt: '',
        setCreativePrompt: (creativePrompt) => set({ creativePrompt }),

        isPromptBuilderOpen: false,
        setPromptBuilderOpen: (open) => set({ isPromptBuilderOpen: open }),
        togglePromptBuilder: () => set((state: StoreState) => ({ isPromptBuilderOpen: !state.isPromptBuilderOpen })),

        selectedItem: null,
        setSelectedItem: (item) => set({ selectedItem: item }),

        savedPrompts: [],
        savePrompt: (prompt) => set((state: StoreState) => ({ savedPrompts: [prompt, ...state.savedPrompts] })),
        deletePrompt: (id) => set((state: StoreState) => ({ savedPrompts: state.savedPrompts.filter((p) => p.id !== id) })),

        whiskState: {
            subjects: [],
            scenes: [],
            styles: [],
            motion: [],
            preciseReference: false,
            targetMedia: 'image' as TargetMedia
        },
        addWhiskItem: (category, type, content, intelligenceCaption, explicitId) => set((state: StoreState) => {
            const newItem: WhiskItem = {
                id: explicitId || crypto.randomUUID(),
                type,
                content,
                intelligenceCaption,
                checked: true,
                category
            };
            const key = whiskKeyMap[category];
            return {
                whiskState: {
                    ...state.whiskState,
                    [key]: [...(state.whiskState[key] as WhiskItem[]), newItem]
                }
            };
        }),
        updateWhiskItem: (category, id, updates) => set((state: StoreState) => {
            const key = whiskKeyMap[category];
            return {
                whiskState: {
                    ...state.whiskState,
                    [key]: (state.whiskState[key] as WhiskItem[]).map(item => item.id === id ? { ...item, ...updates } : item)
                }
            };
        }),
        removeWhiskItem: (category, id) => set((state: StoreState) => {
            const key = whiskKeyMap[category];
            return {
                whiskState: {
                    ...state.whiskState,
                    [key]: (state.whiskState[key] as WhiskItem[]).filter(item => item.id !== id)
                }
            };
        }),
        toggleWhiskItem: (category, id) => set((state: StoreState) => {
            const key = whiskKeyMap[category];
            return {
                whiskState: {
                    ...state.whiskState,
                    [key]: (state.whiskState[key] as WhiskItem[]).map(item => item.id === id ? { ...item, checked: !item.checked } : item)
                }
            };
        }),
        setPreciseReference: (precise) => set((state: StoreState) => ({
            whiskState: { ...state.whiskState, preciseReference: precise }
        })),
        setTargetMedia: (target) => set((state: StoreState) => ({
            whiskState: { ...state.whiskState, targetMedia: target }
        })),

        isGenerating: false,
        setIsGenerating: (isGenerating) => set({ isGenerating }),

        activeVideoJobs: {},
        addVideoJob: (job) => set((state: StoreState) => ({
            activeVideoJobs: { ...state.activeVideoJobs, [job.id]: job }
        })),
        updateVideoJob: (id, updates) => set((state: StoreState) => {
            const existingJob = state.activeVideoJobs[id];
            if (!existingJob) return state;
            return {
                activeVideoJobs: {
                    ...state.activeVideoJobs,
                    [id]: { ...existingJob, ...updates }
                }
            };
        }),
        removeVideoJob: (id) => set((state: StoreState) => {
            const newJobs = { ...state.activeVideoJobs };
            delete newJobs[id];
            return { activeVideoJobs: newJobs };
        }),

        // Clipboard Actions
        clipboardItems: [],
        pinToClipboard: (item) => set((state: StoreState) => {
            if (state.clipboardItems.some((i) => i.id === item.id)) return state;
            const newItem: ClipboardItem = {
                id: item.id,
                url: item.url,
                thumbnailUrl: item.thumbnailUrl || item.url,
                prompt: item.prompt || 'Untitled Asset',
                type: item.type as 'image' | 'video',
                timestamp: Date.now()
            };
            return { clipboardItems: [newItem, ...state.clipboardItems] };
        }),
        unpinFromClipboard: (id) => set((state: StoreState) => ({
            clipboardItems: state.clipboardItems.filter((i) => i.id !== id)
        })),
        clearClipboard: () => set({ clipboardItems: [] }),
    };
}
