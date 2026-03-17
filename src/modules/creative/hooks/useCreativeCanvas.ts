import { useState, useRef, useEffect } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { STUDIO_COLORS, CreativeColor } from '../constants';
import { canvasOps } from '../services/CanvasOperationsService';
import { VideoDirector } from '../services/VideoDirector';
import { Editing } from '@/services/image/EditingService';
import { saveAssetToStorage, saveCanvasStateToStorage, getCanvasStateFromStorage } from '@/services/storage/repository';
import { Candidate } from '../components/CandidatesCarousel';

// Basic debounce helper
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function (...args: Parameters<T>) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

interface UseCreativeCanvasProps {
    item: HistoryItem | null;
    onClose: () => void;
    onRefine?: () => void;
}

export function useCreativeCanvas({ item, onClose, onRefine }: UseCreativeCanvasProps) {
    const { generatedHistory, currentProjectId } = useStore();
    const toast = useToast();

    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    const [isMagicFillMode, setIsMagicFillMode] = useState(false);
    const [isSelectingEndFrame, setIsSelectingEndFrame] = useState(false);
    const [isDefinitionsOpen, setIsDefinitionsOpen] = useState(false);

    // Data State
    const [prompt, setPrompt] = useState('');
    const [activeColor, setActiveColor] = useState<CreativeColor>(STUDIO_COLORS[0]);
    const [definitions, setDefinitions] = useState<Record<string, string>>({});
    const [referenceImages, setReferenceImages] = useState<Record<string, { mimeType: string, data: string } | null>>({});
    const [generatedCandidates, setGeneratedCandidates] = useState<Candidate[]>([]);
    const [endFrameItem, setEndFrameItem] = useState<{ id: string; url: string; prompt: string; type: 'image' | 'video' } | null>(null);
    const [magicFillPrompt, setMagicFillPrompt] = useState('');
    const [isHighFidelity, setIsHighFidelity] = useState(false);

    // Canvas ref
    const canvasEl = useRef<HTMLCanvasElement>(null);

    // Sync prompt from item
    useEffect(() => {
        if (item) setPrompt(item.prompt);
    }, [item]);

    // Initialization
    useEffect(() => {
        let isMounted = true;

        async function setupCanvas() {
            if (!canvasEl.current || !item || item.type !== 'image') return;

            const handleCanvasChange = debounce(async () => {
                if (!canvasOps.isInitialized()) return;
                try {
                    const json = await canvasOps.toJSON();
                    if (json) {
                        await saveCanvasStateToStorage(item.id, json);
                    }
                } catch (err) {
                    console.warn('[CreativeStudio] Auto-save failed', err);
                }
            }, 1000);

            // Try to load any previous edits/annotations FIRST
            try {
                const savedState = await getCanvasStateFromStorage(item.id);
                if (savedState && isMounted) {
                    // Initialize WITHOUT image URL (loadFromJSON brings its own objects)
                    canvasOps.initialize(canvasEl.current, undefined, async () => {
                        if (isMounted) await canvasOps.loadFromJSON(savedState);
                    }, handleCanvasChange);
                } else if (isMounted) {
                    // Initialize WITH base image URL
                    canvasOps.initialize(canvasEl.current, item.url, undefined, handleCanvasChange);
                }
            } catch (err) {
                console.warn('[CreativeStudio] Failed to restore canvas state', err);
                if (isMounted) {
                    // Fallback to fresh canvas
                    canvasOps.initialize(canvasEl.current, item.url, undefined, handleCanvasChange);
                }
            }
        }

        setupCanvas();

        return () => {
            isMounted = false;
            canvasOps.dispose();
        };
    }, [item]);

    // Sync brush color
    useEffect(() => {
        if (isMagicFillMode) {
            canvasOps.updateBrushColor(activeColor);
            setMagicFillPrompt(definitions[activeColor.id] || '');
        }
    }, [activeColor, isMagicFillMode, definitions]);

    const handlePromptChange = (val: string) => {
        setMagicFillPrompt(val);
        setDefinitions(prev => ({
            ...prev,
            [activeColor.id]: val
        }));
    };

    const toggleMagicFill = () => {
        const newMode = !isMagicFillMode;
        setIsMagicFillMode(newMode);

        if (isMagicFillMode) {
            setGeneratedCandidates([]);
        }

        canvasOps.setMagicFillMode(newMode, activeColor);

        if (newMode) {
            toast.info(`Annotating with ${activeColor.name}. Describe your edit.`);
            setMagicFillPrompt(definitions[activeColor.id] || '');
        }
    };

    const handleUpdateDefinition = (colorId: string, prompt: string) => {
        setDefinitions(prev => ({ ...prev, [colorId]: prompt }));
        if (colorId === activeColor.id) {
            setMagicFillPrompt(prompt);
        }
    };

    const handleUpdateReferenceImage = (colorId: string, image: { mimeType: string, data: string } | null) => {
        setReferenceImages(prev => ({ ...prev, [colorId]: image }));
    };

    const handleMagicFill = async () => {
        if (!item) return;

        const activeDefinitions = Object.fromEntries(
            Object.entries(definitions).filter(([, val]) => val.trim().length > 0)
        );

        if (Object.keys(activeDefinitions).length === 0 && !magicFillPrompt) {
            toast.error("Please describe the edit you want to make.");
            return;
        }

        const finalDefinitions = { ...activeDefinitions };
        if (magicFillPrompt && !finalDefinitions[activeColor.id]) {
            finalDefinitions[activeColor.id] = magicFillPrompt;
        }

        setIsProcessing(true);
        setProcessingStatus(isHighFidelity ? "Capturing Visual Context..." : "Architecting Masks...");
        toast.info(isHighFidelity ? 'Starting High-Fidelity Pro Edit...' : 'Starting High-Speed Flash Edit...');

        try {
            setProcessingStatus(isHighFidelity ? "Reasoning (Pro)..." : "Inpainting (Flash)...");
            const prepared = canvasOps.prepareMasksForEdit(finalDefinitions, referenceImages);

            if (prepared && prepared.masks.length > 0) {
                const combinedPrompt = Object.values(finalDefinitions).join(". ") || magicFillPrompt;

                if (isHighFidelity) {
                    const activeKeys = Object.keys(finalDefinitions);
                    const isMultiMask = activeKeys.length > 1;

                    let maskData: string | null = null;
                    let promptPayload = combinedPrompt;
                    let useSemanticMap = false;

                    if (isMultiMask) {
                        maskData = canvasOps.extractSemanticMask();
                        useSemanticMap = true;
                        const legend = activeKeys.map(colorId => {
                            const colorDef = STUDIO_COLORS.find(c => c.id === colorId);
                            const label = colorDef ? colorDef.name.toUpperCase() : 'MARKED';
                            return `- ${label} REGION: ${finalDefinitions[colorId]}`;
                        }).join('\n');
                        promptPayload = `Applying multiple edits defined by color mask:\n${legend}`;
                    } else {
                        maskData = canvasOps.extractGeminiMask();
                    }

                    if (maskData) {
                        const result = await Editing.editImage({
                            image: prepared.baseImage,
                            mask: { mimeType: 'image/png', data: maskData },
                            prompt: promptPayload,
                            forceHighFidelity: true,
                            model: 'pro',
                            useSemanticMap
                        });

                        if (result) {
                            setGeneratedCandidates([{
                                id: crypto.randomUUID(),
                                url: result.url,
                                prompt: promptPayload,
                                thoughtSignature: result.thoughtSignature
                            }]);
                            toast.success(`High-Fidelity Edit Complete!`);
                        }
                    }
                } else if (prepared.masks.length === 1) {
                    const result = await Editing.editImage({
                        image: prepared.baseImage,
                        mask: prepared.masks[0],
                        prompt: combinedPrompt,
                        forceHighFidelity: false,
                        model: 'flash'
                    });

                    if (result) {
                        setGeneratedCandidates([{
                            id: crypto.randomUUID(),
                            url: result.url,
                            prompt: combinedPrompt
                        }]);
                        toast.success(`Speedy Edit Complete!`);
                    }
                } else {
                    setProcessingStatus(isHighFidelity ? "Chaining Edits (Pro)..." : "Chaining Edits (Flash)...");
                    const results = await Editing.multiMaskEdit({
                        image: prepared.baseImage,
                        masks: prepared.masks,
                        variationCount: 1,
                        model: isHighFidelity ? 'pro' : 'flash'
                    });

                    if (results.length > 0) {
                        setGeneratedCandidates(results.map(r => ({
                            id: r.id,
                            url: r.url,
                            prompt: r.prompt
                        })));
                        toast.success("Multi-Region Chain Complete!");
                    }
                }
            } else {
                setProcessingStatus("Remixing Visuals...");
                const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
                const res = await fetch(item.url);
                const blob = await res.blob();
                const mimeType = blob.type || 'image/png';
                const base64data = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.readAsDataURL(blob);
                });

                const result = await ImageGeneration.remixImage({
                    contentImage: { mimeType, data: base64data },
                    styleImage: { mimeType, data: base64data },
                    prompt: magicFillPrompt
                });

                if (result) {
                    setGeneratedCandidates([{
                        id: crypto.randomUUID(),
                        url: result.url,
                        prompt: magicFillPrompt
                    }]);
                    toast.success("Remix Generated! Hint: Draw on the image for targeted edits.");
                }
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Failed to process edit');
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const handleAnimate = async () => {
        if (!item) return;
        toast.info('Starting video generation...');
        try {
            const result = await VideoDirector.triggerAnimation(item);
            if (result.success) {
                toast.success('Video generation started in background!');
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'Animation failed');
        }
    };

    const handleCandidateSelect = async (candidate: Candidate, index: number) => {
        await canvasOps.applyCandidateImage(candidate.url, isMagicFillMode, activeColor);
        setGeneratedCandidates([]);
        toast.success(`Applied Option ${index + 1}`);
    };

    const saveCanvas = async () => {
        if (!item) return;
        // 1. Trigger browser download (preserve existing UX)
        const dataUrl = canvasOps.saveCanvas(`edited-${item.id}.png`);

        try {
            // 2. Upload blob to Firebase Storage as a persistent asset
            const blob = await canvasOps.getBlob();
            if (blob) {
                const assetId = await saveAssetToStorage(blob);

                // 3. Create a HistoryItem so the export appears in the gallery
                const { addToHistory } = useStore.getState();
                const canvasAsset: HistoryItem = {
                    id: assetId,
                    url: dataUrl || item.url,
                    prompt: `Canvas edit of: ${item.prompt || 'untitled'}`,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    origin: 'canvas-export',
                };
                addToHistory(canvasAsset);
            }

            // 4. Persist canvas state (annotations / layers) for reload
            const json = await canvasOps.toJSON();
            if (json) await saveCanvasStateToStorage(item.id, json);
            toast.success('Saved to gallery & cloud!');
        } catch {
            toast.warning('Stored to disk only.');
        }
    };

    const handleRefineInternal = async () => {
        if (!item) return;
        onClose();
        const { addWhiskItem, setPendingPrompt, setViewMode, setGenerationMode } = useStore.getState();
        setGenerationMode('image');
        setViewMode('gallery');
        const whiskId = crypto.randomUUID();
        addWhiskItem('subject', 'image', item.url, item.prompt || "Reference", whiskId);
        setPendingPrompt(item.prompt);
        try {
            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
            const { fetchAsBase64 } = await import('@/services/storage/safeStorageFetch');
            const { mimeType, base64 } = await fetchAsBase64(item.url);
            const caption = await ImageGeneration.captionImage({ mimeType, data: base64 }, 'subject');
            useStore.getState().updateWhiskItem('subject', whiskId, { aiCaption: caption });
            toast.success("Essence locked!");
        } catch {
            toast.warning("Manual check required.");
        }
    };

    const handleCreateLastFrame = async () => {
        if (!item || item.type !== 'image') return;
        setIsProcessing(true);
        setProcessingStatus("Analyzing Scene...");
        try {
            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
            const { fetchAsBase64 } = await import('@/services/storage/safeStorageFetch');
            const { mimeType, base64 } = await fetchAsBase64(item.url);
            const climaxDescription = await ImageGeneration.captionImage({ mimeType, data: base64 }, 'subject');

            setProcessingStatus("Synthesizing...");
            const refinedPrompt = `${climaxDescription}, cinematic climax, dramatic lighting.`;
            const synthResults = await ImageGeneration.remixImage({
                contentImage: { mimeType, data: base64 },
                styleImage: { mimeType, data: base64 },
                prompt: refinedPrompt
            });

            if (synthResults) {
                const targetAsset: HistoryItem = {
                    id: crypto.randomUUID(),
                    url: synthResults.url,
                    prompt: `End Frame: ${refinedPrompt}`,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                };
                useStore.getState().addToHistory(targetAsset);
                setEndFrameItem(targetAsset as any);
                toast.success("Climax frame created!");
            }
        } catch (error: unknown) {
            toast.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const batchExportDimensions = async () => {
        if (!item) return;
        setIsProcessing(true);
        setProcessingStatus("Generating Batch Formats...");
        try {
            const results = await canvasOps.exportBatchDimensions();
            if (results) {
                toast.success("Batch formats generated! (TikTok, IG, YT)");

                // Helper to trigger download
                const download = (url: string, suffix: string) => {
                    const link = document.createElement('a');
                    link.download = `format-${suffix}-${item.id}.png`;
                    link.href = url;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                };

                // Trigger downloads
                download(results.tiktok, '9-16-tiktok');
                download(results.instagram, '1-1-ig');
                download(results.youtube, '16-9-yt');
            }
        } catch (error: unknown) {
            toast.error("Batch export failed.");
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    return {
        // State
        isProcessing,
        processingStatus,
        isMagicFillMode,
        isSelectingEndFrame,
        isDefinitionsOpen,
        prompt,
        activeColor,
        definitions,
        referenceImages,
        generatedCandidates,
        endFrameItem,
        magicFillPrompt,
        isHighFidelity,
        canvasEl,
        generatedHistory,

        // Setters
        setIsSelectingEndFrame,
        setEndFrameItem,
        setIsDefinitionsOpen,
        setActiveColor,
        setMagicFillPrompt: handlePromptChange,
        setIsHighFidelity,
        setGeneratedCandidates,

        // Handlers
        toggleMagicFill,
        handleUpdateDefinition,
        handleUpdateReferenceImage,
        handleMagicFill,
        handleAnimate,
        handleCandidateSelect,
        saveCanvas,
        handleRefine: onRefine || handleRefineInternal,
        handleCreateLastFrame,
        batchExportDimensions,
    };
}
