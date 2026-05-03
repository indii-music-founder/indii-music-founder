import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useToast } from '@/core/context/ToastContext';
import { WhiskService } from '@/services/WhiskService';
import { logger } from '@/utils/logger';
import { Ingredient } from '../components/IngredientDropZone';
import { SequenceBlock } from '../components/SequenceTimeline';
import { VideoGenerationJob } from '../components/veo/VideoGenerationProgress';
import { VideoJob } from '@/types/video';
import { VideoAspectRatioSchema } from '@/modules/video/schemas';

export function useDirectGeneration() {
    const {
        studioControls,
        creativePrompt,
        setCreativePrompt,
        addToHistory,
        currentProjectId,
        whiskState,
        setSelectedItem,
        setViewMode,
        videoInputs,
        setVideoInputs,
        characterReferences,
        generationMode,
        setGenerationMode
    } = useStore(useShallow(state => ({
        studioControls: state.studioControls,
        creativePrompt: state.creativePrompt,
        setCreativePrompt: state.setCreativePrompt,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId,
        whiskState: state.whiskState,
        setSelectedItem: state.setSelectedItem,
        setViewMode: state.setViewMode,
        videoInputs: state.videoInputs,
        setVideoInputs: state.setVideoInputs,
        characterReferences: state.characterReferences,
        generationMode: state.generationMode,
        setGenerationMode: state.setGenerationMode
    })));
    const toast = useToast();

    const localPrompt = creativePrompt ?? '';
    const mode = generationMode;

    const setLocalPrompt = useCallback((value: string) => {
        setCreativePrompt(value);
    }, [setCreativePrompt]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<HistoryItem[]>([]);
    const [activeJobs, setActiveJobs] = useState<VideoGenerationJob[]>([]);
    const [sequence, setSequence] = useState<SequenceBlock[]>([]);
    const [bpm, setBpm] = useState<number>(120);

    // Guard against double-submit while a generation is in-flight
    const generatingRef = useRef(false);
    const unsubsRef = useRef<Record<string, () => void>>({});
    // Ref to capture the latest projectId for use inside async subscription callbacks,
    // preventing stale closures when the user switches projects mid-generation.
    const currentProjectIdRef = useRef(currentProjectId);
    useEffect(() => { currentProjectIdRef.current = currentProjectId; }, [currentProjectId]);

    // Cleanup subscriptions on unmount
    useEffect(() => {
        return () => {
            Object.values(unsubsRef.current).forEach(unsub => unsub());
            unsubsRef.current = {};
        };
    }, []);

    // Job polling/subscription loop
    useEffect(() => {
        activeJobs.forEach(job => {
            if (unsubsRef.current[job.id]) return; // already subscribed
            if (job.status === 'completed' || job.status === 'failed') return;

            const unsub = VideoGeneration.subscribeToJob(job.id, (updatedJob: VideoJob | null) => {
                if (!updatedJob) return;

                setActiveJobs(prev => {
                    const idx = prev.findIndex(j => j.id === updatedJob.id);
                    if (idx === -1) return prev;

                    const newJobs = [...prev];
                    newJobs[idx] = {
                        ...newJobs[idx],
                        status: updatedJob.status as any,
                        progress: updatedJob.progress,
                        error: updatedJob.error
                    } as VideoGenerationJob;
                    return newJobs;
                });

                if (updatedJob.status === 'completed' && (updatedJob.output?.url || updatedJob.videoUrl || updatedJob.url)) {
                    const finalUrl = updatedJob.output?.url || updatedJob.videoUrl || updatedJob.url || '';
                    const finalItem: HistoryItem = {
                        id: updatedJob.id,
                        url: finalUrl,
                        type: 'video' as const,
                        prompt: updatedJob.prompt || job.prompt,
                        timestamp: Date.now(),
                        projectId: currentProjectIdRef.current,
                        origin: 'generated' as const
                    };

                    setResults(prev => {
                        if (prev.some(p => p.id === finalItem.id)) return prev;
                        return [finalItem, ...prev];
                    });
                    addToHistory({ ...finalItem });
                    toast.success('Video generation finished!');
                    
                    setTimeout(() => {
                        setActiveJobs(prev => prev.filter(j => j.id !== updatedJob.id));
                        if (unsubsRef.current[updatedJob.id]) {
                            unsubsRef.current[updatedJob.id]?.();
                            delete unsubsRef.current[updatedJob.id];
                        }
                    }, 3000);
                } else if (updatedJob.status === 'failed') {
                    setTimeout(() => {
                        setActiveJobs(prev => prev.filter(j => j.id !== updatedJob.id));
                        if (unsubsRef.current[updatedJob.id]) {
                            unsubsRef.current[updatedJob.id]?.();
                            delete unsubsRef.current[updatedJob.id];
                        }
                    }, 5000);
                }
            });

            unsubsRef.current[job.id] = unsub;
        });
    }, [activeJobs, currentProjectId, addToHistory, toast]);

    const handleModeSwitch = useCallback((newMode: 'image' | 'video') => {
        if (newMode !== mode) {
            setGenerationMode(newMode);
        }
    }, [mode, setGenerationMode]);

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
                projectId: currentProjectIdRef.current,
                origin: 'uploaded'
            };
        });
        setVideoInputs({ ingredients: newHistoryItems });
    }, [setVideoInputs]);

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
                projectId: currentProjectIdRef.current,
                origin: 'generated' as const
            }));
            
            setResults(prev => [...newItems, ...prev]);
            newItems.forEach(item => addToHistory({ ...item }));

            setSelectedItem(newItems[0] || null);
            setViewMode('editor');

            setTimeout(() => {
                toast.success('Image generated directly successfully');
            }, 500);
        }
    }, [studioControls.model, studioControls.aspectRatio, localPrompt, addToHistory, setSelectedItem, setViewMode, toast]);

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

        // Validate aspect ratio against the schema; fall back to '16:9' only for truly unsupported values.
        const validatedAspectRatio = VideoAspectRatioSchema.safeParse(studioControls.aspectRatio);
        const effectiveAspectRatio = validatedAspectRatio.success ? validatedAspectRatio.data : '16:9';

        const generated = await VideoGeneration.generateVideo({
            prompt: sequencePrompt,
            resolution: effectiveResolution,
            aspectRatio: effectiveAspectRatio,
            duration: finalDuration,
            durationSeconds: finalDuration,
            model: studioControls.model, // Will be resolved by FirebaseAIService
            fps: 24,
            orgId: 'personal', // Force personal for direct test
            referenceImages: [
                ...(characterReferences || []).map(ref => {
                    let bytes = ref.image.url;
                    const commaIndex = bytes.indexOf(',');
                    if (bytes.startsWith('data:') && commaIndex !== -1) {
                        bytes = bytes.substring(commaIndex + 1);
                    }
                    return {
                        image: { imageBytes: bytes, mimeType: 'image/jpeg' },
                        referenceType: 'asset' as const
                    };
                }),
                ...ingredientsList.map(ing => {
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
            ]
        });

        if (generated && generated.length > 0) {
            const newItems: HistoryItem[] = generated.map(g => ({
                id: g.id || crypto.randomUUID(),
                url: g.url || '', // Might be empty if queued
                type: 'video' as const,
                prompt: localPrompt,
                timestamp: Date.now(),
                projectId: currentProjectIdRef.current,
                origin: 'generated' as const
            }));

            const immediatelyReady = newItems.filter(i => i.url);
            const queuedJobs = newItems.filter(i => !i.url);

            if (immediatelyReady.length > 0) {
                setResults(prev => [...immediatelyReady, ...prev]);
                immediatelyReady.forEach(item => addToHistory({ ...item }));
                toast.success('Video generated successfully');
            }

            if (queuedJobs.length > 0) {
                setActiveJobs(prev => [
                    ...prev,
                    ...queuedJobs.map(job => ({
                        id: job.id,
                        prompt: job.prompt || localPrompt,
                        status: 'queued' as const,
                        progress: 0
                    }))
                ]);
                toast.info('Video job queued. Check gallery for results.');
            }
        }
    }, [studioControls, localPrompt, addToHistory, toast, sequence, bpm, videoInputs?.ingredients]);

    const handleGenerate = useCallback(async () => {
        if (!localPrompt.trim()) {
            toast.error('Please enter a prompt before generating.');
            return;
        }
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

    const cancelJob = useCallback((jobId: string) => {
        setActiveJobs(prev => prev.filter(j => j.id !== jobId));
        if (unsubsRef.current[jobId]) {
            unsubsRef.current[jobId]?.();
            delete unsubsRef.current[jobId];
        }
    }, []);

    return {
        mode,
        localPrompt,
        setLocalPrompt,
        isGenerating,
        results,
        activeJobs,
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
        setBpm,
        cancelJob
    };
}
