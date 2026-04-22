import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useToast } from '@/core/context/ToastContext';
import { WhiskService } from '@/services/WhiskService';
import { logger } from '@/utils/logger';
import { Ingredient } from '../components/IngredientDropZone';
import { SequenceBlock } from '../components/SequenceTimeline';

export function useDirectGeneration() {
    const {
        studioControls,
        prompt,
        setPrompt,
        addToHistory,
        currentProjectId,
        whiskState,
        setSelectedItem,
        setViewMode,
        videoInputs,
        setVideoInputs
    } = useStore(useShallow(state => ({
        studioControls: state.studioControls,
        prompt: state.prompt,
        setPrompt: state.setPrompt,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId,
        whiskState: state.whiskState,
        setSelectedItem: state.setSelectedItem,
        setViewMode: state.setViewMode,
        videoInputs: state.videoInputs,
        setVideoInputs: state.setVideoInputs
    })));
    const toast = useToast();

    const [localPrompt, setLocalPromptState] = useState(prompt ?? '');
    const [mode, setMode] = useState<'image' | 'video'>('image');

    // Keep local input in sync with global prompt updates (e.g. top-nav Builder pills).
    useEffect(() => {
        const next = prompt ?? '';
        setLocalPromptState(prev => (prev === next ? prev : next));
    }, [prompt]);

    const setLocalPrompt = useCallback((value: string) => {
        setLocalPromptState(value);
        setPrompt(value);
    }, [setPrompt]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<HistoryItem[]>([]);
    const [sequence, setSequence] = useState<SequenceBlock[]>([]);
    const [bpm, setBpm] = useState<number>(120);

    // Guard against double-submit while a generation is in-flight
    const generatingRef = useRef(false);

    const handleModeSwitch = useCallback((newMode: 'image' | 'video') => {
        if (newMode !== mode) {
            setLocalPrompt('');
            setMode(newMode);
        }
    }, [mode, setLocalPrompt]);

    const mappedIngredients: Ingredient[] = videoInputs?.ingredients?.map(hi => ({
        id: hi.id,
        dataUrl: hi.url,
        type: hi.type as 'image' | 'video',
        file: new File([], 'placeholder') // Placeholder since we already have the dataUrl
    })) || [];

    const handleIngredientsChange = useCallback((newIngredients: Ingredient[]) => {
        const state = useStore.getState();
        const allItems = [
            ...(state.generatedHistory || []),
            ...(state.uploadedImages || []),
            ...(state.uploadedAudio || [])
        ];

        const newHistoryItems: HistoryItem[] = newIngredients.map(ing => {
            const foundItem = allItems.find(item => item.id === ing.id);
            if (foundItem) {
                return foundItem;
            }
            return {
                id: ing.id,
                type: ing.type,
                url: ing.dataUrl,
                prompt: 'Uploaded Reference',
                timestamp: Date.now(),
                projectId: currentProjectId,
                origin: 'uploaded'
            };
        });
        setVideoInputs({ ingredients: newHistoryItems });
    }, [setVideoInputs, currentProjectId]);

    const handleImageGenerate = useCallback(async (finalPrompt: string) => {
        const { generateImageDirectly } = await import('@/services/ai/generators/DirectImageGenerator');
        const { AI_MODELS } = await import('@/core/config/ai-models');

        const resolvedModel = studioControls.model === 'pro'
            ? AI_MODELS.IMAGE.DIRECT_PRO
            : AI_MODELS.IMAGE.DIRECT_FAST;

        const generatedUrls = await generateImageDirectly({
            prompt: finalPrompt,
            aspectRatio: studioControls.aspectRatio,
            model: resolvedModel,
            numberOfImages: 1
        });

        if (generatedUrls.length > 0) {
            const newItems: HistoryItem[] = generatedUrls.map(url => ({
                id: crypto.randomUUID(),
                url: url, // Directly returns the data URI
                type: 'image' as const,
                prompt: localPrompt,
                timestamp: Date.now(),
                projectId: currentProjectId,
                origin: 'generated' as const
            }));
            
            setResults(prev => [...newItems, ...prev]);
            newItems.forEach(item => addToHistory({ ...item }));

            setSelectedItem(newItems[0] || null);
            setViewMode('editor');

            toast.success('Image generated directly successfully');
        }
    }, [studioControls.model, studioControls.aspectRatio, localPrompt, currentProjectId, addToHistory, setSelectedItem, setViewMode, toast]);

    const handleVideoGenerate = useCallback(async (finalPrompt: string) => {
        // ISSUE-008 FIX: Auto-downscale 4K to 1080p for video (Veo doesn't support 4K)
        let effectiveResolution = studioControls.resolution;
        if (effectiveResolution === '4k') {
            effectiveResolution = '1080p';
            toast.info('4K is not yet supported for video. Generating at 1080p instead.');
        }

        const sequenceTotalBeats = sequence.length > 0 ? sequence.reduce((a, b) => a + b.beats, 0) : 0;
        const secondsPerBeat = 60 / bpm;
        const sequenceTotalSeconds = sequenceTotalBeats * secondsPerBeat;
        
        const finalDuration = sequenceTotalSeconds > 0 ? sequenceTotalSeconds : Math.max(6, studioControls.duration || 6);
        
        let sequencePrompt = finalPrompt;
        if (sequence.length > 0) {
            const sequenceDetails = sequence.map(block => `${block.beats} beats (${(block.beats * secondsPerBeat).toFixed(2)}s) [${block.section || 'Uncategorized'}, ${block.energy || 'Medium'} Energy]`).join(', ');
            sequencePrompt = `[SEQUENCE: ${sequenceDetails} at ${bpm} BPM] ${finalPrompt}`;
        }

        const ingredientsList = videoInputs?.ingredients || [];

        const generated = await VideoGeneration.generateVideo({
            prompt: sequencePrompt,
            resolution: effectiveResolution,
            aspectRatio: (studioControls.aspectRatio === '16:9' || studioControls.aspectRatio === '9:16') ? studioControls.aspectRatio : '16:9',
            duration: finalDuration,
            durationSeconds: finalDuration,
            model: studioControls.model, // Will be resolved by FirebaseAIService
            fps: 24,
            orgId: 'personal', // Force personal for direct test
            referenceImages: ingredientsList.map(ing => {
                let bytes = ing.url;
                const commaIndex = bytes.indexOf(',');
                if (bytes.startsWith('data:') && commaIndex !== -1) {
                    bytes = bytes.substring(commaIndex + 1);
                }
                return {
                    image: { imageBytes: bytes, mimeType: ing.type === 'video' ? 'video/mp4' : 'image/jpeg' },
                    referenceType: 'asset' as const
                };
            })
        });

        if (generated && generated.length > 0) {
            const newItems: HistoryItem[] = generated.map(g => ({
                id: g.id || crypto.randomUUID(),
                url: g.url || '', // Might be empty if queued
                type: 'video' as const,
                prompt: localPrompt,
                timestamp: Date.now(),
                projectId: currentProjectId,
                origin: 'generated' as const
            }));

            if (newItems.every(i => !i.url)) {
                toast.info('Video job queued. Check gallery for results.');
            } else {
                setResults(prev => [...newItems, ...prev]);
                newItems.forEach(item => addToHistory({ ...item }));
                toast.success('Video generated successfully');
            }
        }
    }, [studioControls, localPrompt, currentProjectId, addToHistory, toast, sequence, bpm, videoInputs?.ingredients]);

    const handleGenerate = useCallback(async () => {
        if (!localPrompt.trim()) return;
        if (generatingRef.current) return; // Prevent double-submit

        generatingRef.current = true;
        setIsGenerating(true);

        try {
            if (mode === 'image') {
                const finalPrompt = WhiskService.synthesizeWhiskPrompt(localPrompt, whiskState);
                await handleImageGenerate(finalPrompt);
            } else {
                const finalPrompt = WhiskService.synthesizeVideoPrompt(localPrompt, whiskState);
                await handleVideoGenerate(finalPrompt);
            }
        } catch (error: unknown) {
            logger.error("Direct Generation Failed:", error);

            const errObj = error as Record<string, unknown> | null;
            const errMessage = error instanceof Error ? error.message : String(error);

            if (errObj?.code === 'deadline-exceeded' || errMessage?.includes('timeout')) {
                toast.error('Generation timed out. The API may be busy - please try again.');
            } else if (errObj?.code === 'resource-exhausted') {
                toast.error(errMessage || 'Quota exceeded. Please upgrade your plan.');
            } else if (errObj?.code === 'internal' && errMessage?.includes('No image data')) {
                toast.error('No image was generated. Try rephrasing your prompt.');
            } else {
                toast.error(`Generation failed: ${errMessage || 'Unknown error'}`);
            }
        } finally {
            setIsGenerating(false);
            generatingRef.current = false;
        }
    }, [localPrompt, mode, whiskState, toast, handleImageGenerate, handleVideoGenerate]);

    return {
        mode,
        localPrompt,
        setLocalPrompt,
        isGenerating,
        results,
        handleModeSwitch,
        handleGenerate,
        mappedIngredients,
        handleIngredientsChange,
        studioControls,
        setSelectedItem,
        setViewMode,
        sequence,
        setSequence,
        bpm,
        setBpm
    };
}
