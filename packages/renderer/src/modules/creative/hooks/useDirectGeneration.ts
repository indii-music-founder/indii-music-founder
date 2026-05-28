import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { WhiskService } from '@/services/WhiskService';
import { logger } from '@/utils/logger';
import { Ingredient } from '../components/IngredientDropZone';
import { SequenceBlock } from '../components/SequenceTimeline';
import { VideoGenerationJob } from '../components/veo/VideoGenerationProgress';
import { functions, db, auth, storage } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';

type CallableGenerationError = {
    code?: unknown;
    message?: unknown;
    details?: unknown;
};

function normalizeCallableCode(code: unknown): string | undefined {
    if (typeof code !== 'string') return undefined;
    return code.replace(/^functions\//, '');
}

function detailsMessage(details: unknown): string | undefined {
    if (!details) return undefined;
    if (typeof details === 'string') return details;
    if (details instanceof Error) return details.message;
    if (typeof details === 'object') {
        const record = details as Record<string, unknown>;
        const detailMessage = record.message || record.cause || record.reason;
        if (typeof detailMessage === 'string') return detailMessage;
    }
    return undefined;
}

function generationErrorMessage(error: unknown): { code?: string; message: string } {
    const errObj = error as CallableGenerationError | null;
    const code = normalizeCallableCode(errObj?.code);
    const rawMessage = error instanceof Error ? error.message : typeof errObj?.message === 'string' ? errObj.message : String(error);
    const detailMessage = detailsMessage(errObj?.details);
    const usableRawMessage = rawMessage && rawMessage !== code && rawMessage !== '[object Object]' ? rawMessage : undefined;
    const message = usableRawMessage || detailMessage;

    if (message && message !== 'internal') {
        return { code, message };
    }
    if (detailMessage) {
        return { code, message: detailMessage };
    }

    if (code === 'permission-denied') return { code, message: 'Google generation credentials or permissions are not configured.' };
    if (code === 'not-found') return { code, message: 'The selected Google generation model is not available in this project or region.' };
    if (code === 'resource-exhausted') return { code, message: 'Google generation quota is exhausted. Try again later or switch model tier.' };
    if (code === 'deadline-exceeded') return { code, message: 'Generation timed out. The model may be busy - please try again.' };
    if (code === 'invalid-argument') return { code, message: 'The generation request was rejected. Check prompt, aspect ratio, and model settings.' };

    return { code, message: 'The Google generation service returned an internal error.' };
}

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

    const generatingRef = useRef(false);
    const unsubsRef = useRef<Record<string, () => void>>({});
    const currentProjectIdRef = useRef(currentProjectId);
    useEffect(() => { currentProjectIdRef.current = currentProjectId; }, [currentProjectId]);

    useEffect(() => {
        return () => {
            Object.values(unsubsRef.current).forEach(unsub => unsub());
            unsubsRef.current = {};
        };
    }, []);

    useEffect(() => {
        activeJobs.forEach(job => {
            if (unsubsRef.current[job.id]) return;
            if (job.status === 'completed' || job.status === 'failed') return;

            const jobRef = doc(db, 'creative_jobs', job.id);
            const unsub = onSnapshot(jobRef, async (snapshot) => {
                if (!snapshot.exists()) return;
                const data = snapshot.data();

                setActiveJobs(prev => {
                    const idx = prev.findIndex(j => j.id === job.id);
                    if (idx === -1) return prev;
                    const newJobs = [...prev];
                    newJobs[idx] = {
                        ...newJobs[idx],
                        status: data.status,
                        progress: data.progress || 0,
                        error: data.error
                    } as VideoGenerationJob;
                    return newJobs;
                });

                if (data.status === 'completed' && data.resultUri) {
                    try {
                        let finalUrl = data.resultUri;
                        if (finalUrl.startsWith('gs://')) {
                            // Convert gs:// URI to an HTTP download URL for UI rendering
                            const bucketPath = finalUrl.split('/').slice(3).join('/');
                            const storageRef = ref(storage, bucketPath);
                            finalUrl = await getDownloadURL(storageRef);
                        }

                        const finalItem: HistoryItem = {
                            id: job.id,
                            url: finalUrl,
                            type: data.type || mode,
                            prompt: data.prompt || job.prompt,
                            timestamp: Date.now(),
                            projectId: currentProjectIdRef.current,
                            origin: 'generated' as const
                        };

                        setResults(prev => {
                            if (prev.some(p => p.id === finalItem.id)) return prev;
                            return [finalItem, ...prev];
                        });
                        addToHistory({ ...finalItem });
                        
                        if (data.type === 'image') {
                           setSelectedItem(finalItem);
                           setViewMode('editor');
                        }

                        toast.success(`\${data.type} generation finished!`);

                        setTimeout(() => {
                            setActiveJobs(prev => prev.filter(j => j.id !== job.id));
                            if (unsubsRef.current[job.id]) {
                                unsubsRef.current[job.id]?.();
                                delete unsubsRef.current[job.id];
                            }
                        }, 3000);
                    } catch (err) {
                        logger.error('Failed to resolve Storage URL', err);
                    }
                } else if (data.status === 'failed') {
                    setTimeout(() => {
                        setActiveJobs(prev => prev.filter(j => j.id !== job.id));
                        if (unsubsRef.current[job.id]) {
                            unsubsRef.current[job.id]?.();
                            delete unsubsRef.current[job.id];
                        }
                    }, 5000);
                }
            });

            unsubsRef.current[job.id] = unsub;
        });
    }, [activeJobs, mode, addToHistory, setSelectedItem, setViewMode, toast]);

    const handleModeSwitch = useCallback((newMode: 'image' | 'video') => {
        if (newMode !== mode) {
            setGenerationMode(newMode);
        }
    }, [mode, setGenerationMode]);

    const mappedIngredients: Ingredient[] = videoInputs?.ingredients?.map(hi => ({
        id: hi.id,
        dataUrl: hi.url,
        type: hi.type as 'image' | 'video',
        file: new File([], 'placeholder')
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
            if (foundItem) return foundItem;
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
        const userId = auth.currentUser?.uid || 'founder-demo-uid';

        let referenceUri;
        const ingredientsList = videoInputs?.ingredients || [];
        const firstIngredient = ingredientsList[0];
        if (firstIngredient && firstIngredient.url) {
            referenceUri = await CreativeStorageService.uploadReferenceMedia(userId, firstIngredient.url, 'image');
        }

        const generateImageV3 = httpsCallable(functions, 'generateImageV3');
        const res = await generateImageV3({
            prompt: finalPrompt,
            aspectRatio: studioControls.aspectRatio,
            model: studioControls.model,
            imageSize: studioControls.imageSize,
            thinkingLevel: studioControls.thinkingLevel,
            useGoogleSearch: studioControls.useGrounding,
            referenceUri
        });
        
        const data = res.data as { jobId: string };
        setActiveJobs(prev => [
            ...prev,
            { id: data.jobId, prompt: localPrompt, status: 'queued' as const, progress: 0 }
        ]);
        toast.info('Image job queued. Check gallery for progress.');

    }, [studioControls.aspectRatio, studioControls.model, studioControls.imageSize, studioControls.thinkingLevel, studioControls.useGrounding, localPrompt, videoInputs?.ingredients, toast]);

    const handleVideoGenerate = useCallback(async (finalPrompt: string) => {
        const userId = auth.currentUser?.uid || 'founder-demo-uid';

        let effectiveResolution = studioControls.resolution;
        if (effectiveResolution === '4k') {
            effectiveResolution = '1080p';
            toast.info('4K is not yet supported for video. Generating at 1080p instead.');
        }

        const sequenceTotalBeats = sequence.length > 0 ? sequence.reduce((a, b) => a + b.beats, 0) : 0;
        const secondsPerBeat = 60 / bpm;
        const sequenceTotalSeconds = sequenceTotalBeats * secondsPerBeat;
        
        let sequencePrompt = finalPrompt;
        if (sequence.length > 0) {
            const sequenceDetails = sequence.map(block => `\${block.beats} beats (\${(block.beats * secondsPerBeat).toFixed(2)}s) [\${block.section || 'Uncategorized'}, \${block.energy || 'Medium'} Energy]`).join(', ');
            sequencePrompt = `[SEQUENCE: \${sequenceDetails} at \${bpm} BPM] \${finalPrompt}`;
        }

        let firstFrameUri;
        const ingredientsList = videoInputs?.ingredients || [];
        const firstIngredient = ingredientsList[0];
        const firstCharRef = characterReferences?.[0];
        if (firstIngredient && firstIngredient.url) {
            firstFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, firstIngredient.url, firstIngredient.type as 'image'|'video');
        } else if (videoInputs?.firstFrame?.url) {
            firstFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, videoInputs.firstFrame.url, 'image');
        } else if (firstCharRef && firstCharRef.image?.url) {
            firstFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, firstCharRef.image.url, 'image');
        }

        let lastFrameUri;
        if (videoInputs?.lastFrame?.url) {
            lastFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, videoInputs.lastFrame.url, 'image');
        }

        const referenceUris = characterReferences?.slice(0, 3).length
            ? await Promise.all(characterReferences.slice(0, 3).map(refItem =>
                CreativeStorageService.uploadReferenceMedia(userId, refItem.image.url, 'image')
            ))
            : undefined;
        const parsedSeed = studioControls.seed ? Number(studioControls.seed) : undefined;

        const generateVideoV3 = httpsCallable(functions, 'generateVideoV3');
        const res = await generateVideoV3({
            prompt: sequencePrompt,
            firstFrameUri,
            lastFrameUri,
            referenceUris,
            aspectRatio: studioControls.aspectRatio,
            model: studioControls.model,
            resolution: effectiveResolution,
            durationSeconds: Math.min(8, Math.max(4, studioControls.duration || Math.ceil(sequenceTotalSeconds) || 6)),
            personGeneration: studioControls.personGeneration,
            negativePrompt: studioControls.negativePrompt || undefined,
            seed: Number.isSafeInteger(parsedSeed) ? parsedSeed : undefined,
            enhancePrompt: true,
        });

        const data = res.data as { jobId: string };
        setActiveJobs(prev => [
            ...prev,
            { id: data.jobId, prompt: localPrompt, status: 'queued' as const, progress: 0 }
        ]);
        toast.info('Video job queued. Check gallery for progress.');
    }, [studioControls, localPrompt, sequence, bpm, videoInputs, characterReferences, toast]);

    const handleGenerate = useCallback(async () => {
        if (!localPrompt.trim()) {
            toast.error('Please enter a prompt before generating.');
            return;
        }
        if (generatingRef.current) return;

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

            const { code, message: errMessage } = generationErrorMessage(error);

            if (code === 'deadline-exceeded' || errMessage?.includes('timeout')) {
                toast.error('Generation timed out. The API may be busy - please try again.');
            } else if (code === 'resource-exhausted') {
                toast.error(errMessage || 'Quota exceeded. Please upgrade your plan.');
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
