import { StateCreator } from 'zustand';
import { HistoryItem } from '@/core/types/history';
import { z } from 'zod';
import { VideoAspectRatioSchema, VideoResolutionSchema } from '@/modules/video/schemas';

type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>;
type VideoResolution = z.infer<typeof VideoResolutionSchema>;

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
    motion: WhiskItem[]; // Camera movements, speed, energy
    preciseReference: boolean;
    targetMedia: TargetMedia; // What to generate (image, video, or both)
}

export interface CreativeControlsSlice {
    // Studio Controls
    studioControls: {
        aspectRatio: VideoAspectRatio;
        resolution: VideoResolution;
        negativePrompt: string;
        seed: string;
        cameraMovement: string;
        motionStrength: number;
        fps: number;
        duration: number;
        shotList: ShotItem[];
        isCoverArtMode: boolean;
        model: 'fast' | 'pro';
        thinking: boolean;
        mediaResolution: 'low' | 'medium' | 'high';
        generateAudio: boolean;
        useGrounding: boolean;
        personGeneration: 'allow_adult' | 'dont_allow' | 'allow_all';
        isTransitionMode: boolean;
    };
    setStudioControls: (controls: Partial<CreativeControlsSlice['studioControls']>) => void;
    enableCoverArtMode: () => void;
    disableCoverArtMode: () => void;

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
    setTargetMedia: (target: TargetMedia) => void;

    isGenerating: boolean;
    setIsGenerating: (isGenerating: boolean) => void;
}

/**
 * Factory that returns the controls/inputs portion of the creative slice.
 */
export function buildCreativeControlsState(
    set: Parameters<StateCreator<CreativeControlsSlice>>[0],
    _get: Parameters<StateCreator<CreativeControlsSlice>>[1]
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
            model: 'pro',
            thinking: false,
            mediaResolution: 'medium',
            generateAudio: true,
            useGrounding: false,
            personGeneration: 'allow_adult',
            isTransitionMode: false
        },
        setStudioControls: (controls) => set((state) => ({ studioControls: { ...state.studioControls, ...controls } })),
        enableCoverArtMode: () => set((state) => ({
            studioControls: {
                ...state.studioControls,
                aspectRatio: '1:1',
                isCoverArtMode: true
            }
        })),
        disableCoverArtMode: () => set((state) => ({
            studioControls: {
                ...state.studioControls,
                aspectRatio: '16:9',
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
            motion: [],
            preciseReference: false,
            targetMedia: 'image' as TargetMedia
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
            const key = whiskKeyMap[category];
            return {
                whiskState: {
                    ...state.whiskState,
                    [key]: [...(state.whiskState[key] as WhiskItem[]), newItem]
                }
            };
        }),
        updateWhiskItem: (category, id, updates) => set((state) => {
            const key = whiskKeyMap[category];
            return {
                whiskState: {
                    ...state.whiskState,
                    [key]: (state.whiskState[key] as WhiskItem[]).map(item => item.id === id ? { ...item, ...updates } : item)
                }
            };
        }),
        removeWhiskItem: (category, id) => set((state) => {
            const key = whiskKeyMap[category];
            return {
                whiskState: {
                    ...state.whiskState,
                    [key]: (state.whiskState[key] as WhiskItem[]).filter(item => item.id !== id)
                }
            };
        }),
        toggleWhiskItem: (category, id) => set((state) => {
            const key = whiskKeyMap[category];
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
    };
}
