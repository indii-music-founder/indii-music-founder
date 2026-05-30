const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../packages/renderer/src/modules/creative/hooks/useDirectGeneration.ts');

const content = `import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { WhiskService } from '@/services/WhiskService';
import { logger } from '@/utils/logger';
import { Ingredient } from '../components/IngredientDropZone';
import { SequenceBlock } from '../components/SequenceTimeline';
import { VideoGenerationJob } from '../components/veo/VideoGenerationProgress';
import { VideoAspectRatioSchema } from '@/modules/creative/video/schemas';
import { functions, db, auth, storage } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';

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
                    };
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

                        toast.success(\`\${data.type} generation finished!\`);

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
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error("Must be logged in to generate.");

        let referenceUri;
        const ingredientsList = videoInputs?.ingredients || [];
        if (ingredientsList.length > 0) {
            referenceUri = await CreativeStorageService.uploadReferenceMedia(userId, ingredientsList[0].url, 'image');
        }

        const generateImageV3 = httpsCallable(functions, 'generateImageV3');
        const res = await generateImageV3({
            prompt: finalPrompt,
            aspectRatio: studioControls.aspectRatio,
            referenceUri
        });
        
        const data = res.data as { jobId: string };
        setActiveJobs(prev => [
            ...prev,
            { id: data.jobId, prompt: localPrompt, status: 'queued' as const, progress: 0 }
        ]);
        toast.info('Image job queued. Check gallery for progress.');

    }, [studioControls.aspectRatio, localPrompt, videoInputs?.ingredients, toast]);

    const handleVideoGenerate = useCallback(async (finalPrompt: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error("Must be logged in to generate.");

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
            const sequenceDetails = sequence.map(block => \`\${block.beats} beats (\${(block.beats * secondsPerBeat).toFixed(2)}s) [\${block.section || 'Uncategorized'}, \${block.energy || 'Medium'} Energy]\`).join(', ');
            sequencePrompt = \`[SEQUENCE: \${sequenceDetails} at \${bpm} BPM] \${finalPrompt}\`;
        }

        let firstFrameUri;
        const ingredientsList = videoInputs?.ingredients || [];
        if (ingredientsList.length > 0) {
            firstFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, ingredientsList[0].url, ingredientsList[0].type as 'image'|'video');
        } else if (characterReferences && characterReferences.length > 0) {
            firstFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, characterReferences[0].image.url, 'image');
        }

        const generateVideoV3 = httpsCallable(functions, 'generateVideoV3');
        const res = await generateVideoV3({
            prompt: sequencePrompt,
            firstFrameUri
        });

        const data = res.data as { jobId: string };
        setActiveJobs(prev => [
            ...prev,
            { id: data.jobId, prompt: localPrompt, status: 'queued' as const, progress: 0 }
        ]);
        toast.info('Video job queued. Check gallery for progress.');
    }, [studioControls, localPrompt, sequence, bpm, videoInputs?.ingredients, characterReferences, toast]);

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

            const errObj = error as Record<string, unknown> | null;
            const errMessage = error instanceof Error ? error.message : String(error);

            if (errObj?.code === 'deadline-exceeded' || errMessage?.includes('timeout')) {
                toast.error('Generation timed out. The API may be busy - please try again.');
            } else if (errObj?.code === 'resource-exhausted') {
                toast.error(errMessage || 'Quota exceeded. Please upgrade your plan.');
            } else {
                toast.error(\`Generation failed: \${errMessage || 'Unknown error'}\`);
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
`

fs.writeFileSync(filePath, content);
