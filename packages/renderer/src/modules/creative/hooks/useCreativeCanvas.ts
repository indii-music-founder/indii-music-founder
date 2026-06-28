/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { STUDIO_COLORS, CreativeColor } from '../constants';
import { canvasOps } from '../services/CanvasOperationsService';
import { VideoDirector } from '../services/VideoDirector';
import { Editing } from '@/services/image/EditingService';
import { saveAssetToStorage, saveCanvasStateToStorage, getCanvasStateFromStorage } from '@/services/storage/repository';
import { Candidate } from '../components/CandidatesCarousel';
import { imageAnalysisService } from '@/services/image/ImageAnalysisService';
import { logger } from '@/utils/logger';
import { compileCreativeEditManifest, getCreativeSessionId, normalizeCreativeImageSize, summarizeCreativeEditManifest, type CreativeVaultScope } from '../services/creativeManifest';
import { creativeSessionService } from '@/services/creative/CreativeSessionService';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { auth } from '@/services/firebase';
import { CostControlService } from '@/services/billing/CostControlService';
import { estimateCostUsd } from '@/services/intelligence/billing/ModelPricing';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

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

async function resolveEditableImageUrl(item: HistoryItem): Promise<string> {
    const candidates = [item.url, item.thumbnailUrl].filter((url): url is string => Boolean(url?.trim()));
    let unresolvedStorageUri: string | null = null;

    for (const candidate of candidates) {
        const resolved = await resolveStorageUrl(candidate);
        if (resolved.startsWith('gs://')) {
            unresolvedStorageUri = resolved;
            continue;
        }
        return resolved;
    }

    if (unresolvedStorageUri) {
        throw new Error('Selected asset is still a gs:// Storage URI and could not be resolved for display.');
    }

    throw new Error('Selected asset does not include a displayable image URL.');
}

interface UseCreativeCanvasProps {
    item: HistoryItem | null;
    onClose: () => void;
    onRefine?: () => void;
}

export function useCreativeCanvas({ item, onClose, onRefine }: UseCreativeCanvasProps) {
    const { generatedHistory, currentProjectId, studioControls } = useStore(useShallow(state => ({
        generatedHistory: state.generatedHistory,
        currentProjectId: state.currentProjectId,
        studioControls: state.studioControls
    })));
    const toast = useToast();

    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState<string>('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isMagicFillMode, setIsMagicFillMode] = useState(false);
    const [isSelectingEndFrame, setIsSelectingEndFrame] = useState(false);
    const [isDefinitionsOpen, setIsDefinitionsOpen] = useState(false);
    const [activeTool, setActiveTool] = useState<'select' | 'line' | 'polygon' | 'text' | 'brush'>('brush');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [historyTrigger, setHistoryTrigger] = useState(0); // Used to force UI update for canUndo/canRedo

    // Data State
    const [prompt, setPrompt] = useState('');
    const [activeColor, setActiveColor] = useState<CreativeColor>(STUDIO_COLORS[0]!);
    const [definitions, setDefinitions] = useState<Record<string, string>>({});
    const [referenceImages, setReferenceImages] = useState<Record<string, { mimeType: string, data: string } | null>>({});
    const [referenceRoles, setReferenceRoles] = useState<Record<string, CreativeVaultScope>>({});
    const [generatedCandidates, setGeneratedCandidates] = useState<Candidate[]>([]);
    const [endFrameItem, setEndFrameItem] = useState<{ id: string; url: string; prompt: string; type: 'image' | 'video' } | null>(null);
    const [magicFillPrompt, setMagicFillPrompt] = useState('');
    const [isHighFidelity, setIsHighFidelity] = useState(false);

    // Canvas ref
    const canvasEl = useRef<HTMLCanvasElement>(null);
    const sessionId = useMemo(() => getCreativeSessionId(item?.id ?? null, currentProjectId), [currentProjectId, item?.id]);
    const editManifest = useMemo(() => compileCreativeEditManifest({
        sessionId,
        projectId: currentProjectId,
        item,
        prompt: magicFillPrompt || prompt || item?.prompt || '',
        definitions,
        referenceImages,
        referenceRoles,
        generatedCandidates,
        settings: {
            modelTier: isHighFidelity || studioControls.model === 'pro' ? 'pro' : 'fast',
            resolution: studioControls.resolution,
            imageSize: normalizeCreativeImageSize(studioControls.imageSize),
            grounding: studioControls.useGrounding,
            aspectRatio: studioControls.aspectRatio,
            highFidelity: isHighFidelity,
        }
    }), [
        currentProjectId,
        definitions,
        generatedCandidates,
        isHighFidelity,
        item,
        magicFillPrompt,
        prompt,
        referenceImages,
        referenceRoles,
        sessionId,
        studioControls.aspectRatio,
        studioControls.imageSize,
        studioControls.model,
        studioControls.resolution,
        studioControls.useGrounding
    ]);
    const editSummary = useMemo(() => summarizeCreativeEditManifest(editManifest), [editManifest]);
    const uploadSessionMedia = async (
        mediaByColor: Record<string, { mimeType: string; data: string } | null>,
        rolesByColor: Record<string, CreativeVaultScope>,
        scopeFallback: CreativeVaultScope
    ): Promise<Record<string, string | null>> => {
        const userId = auth.currentUser?.uid;
        if (!userId) return {};

        const entries = await Promise.all(Object.entries(mediaByColor).map(async ([colorId, media]) => {
            if (!media) return [colorId, null] as const;
            const scope = rolesByColor[colorId] || scopeFallback;
            const uri = await CreativeStorageService.uploadReferenceMedia(
                userId,
                `data:${media.mimeType};base64,${media.data}`,
                'image',
                { scope, sessionId, projectId: currentProjectId ?? undefined }
            );
            return [colorId, uri] as const;
        }));

        return Object.fromEntries(entries);
    };
    const reserveImageBudget = async (modelId: 'gemini-3-pro-image' | 'gemini-3.1-flash-image') => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            throw new Error('Auth required for creative image generation.');
        }

        const estimatedCost = estimateCostUsd(modelId, { images: 1 });
        const result = await CostControlService.checkAndReserve({
            operationType: 'image',
            estimatedCost,
            userId,
            metadata: {
                sessionId,
                routeId: editManifest.route.id,
                routeLabel: editManifest.route.label,
                modelId,
                resolution: editManifest.settings.imageSize || editManifest.settings.resolution,
            },
        });

        if (!result.allowed) {
            throw new Error(result.reason || 'Creative edit blocked by cost controls.');
        }
    };
    const persistSession = async (manifest = editManifest, extras: Record<string, unknown> = {}) => {
        try {
            await creativeSessionService.upsertFromManifest(manifest, extras as Parameters<typeof creativeSessionService.upsertFromManifest>[1]);
        } catch (error) {
            logger.warn('[CreativeStudio] Creative session persistence skipped', error);
        }
    };
    const updateSession = async (updates: Record<string, unknown>) => {
        try {
            await creativeSessionService.updateSession(sessionId, updates as Parameters<typeof creativeSessionService.updateSession>[1]);
        } catch (error) {
            logger.warn('[CreativeStudio] Creative session update skipped', error);
        }
    };

    // Sync prompt from item
    useEffect(() => {
        if (item) setPrompt(item.prompt);
    }, [item]);

    // Initialization
    useEffect(() => {
        let isMounted = true;

        async function setupCanvas() {
            if (!canvasEl.current || !item || item.type !== 'image') return;
            let editableImageUrl: string;
            try {
                editableImageUrl = await resolveEditableImageUrl(item);
            } catch (err: unknown) {
                logger.warn('[CreativeStudio] Selected image asset could not be resolved for editing', err);
                if (isMounted) {
                    toast.error('This asset cannot be opened in the editor because its image URL is unavailable.');
                }
                return;
            }

            const debouncedSave = debounce(async () => {
                if (!canvasOps.isInitialized()) return;
                try {
                    const json = await canvasOps.toJSON();
                    if (json) {
                        await saveCanvasStateToStorage(item.id, JSON.stringify(json));
                    }
                } catch (err: unknown) {
                    logger.warn('[CreativeStudio] Auto-save failed', err);
                }
            }, 1000);

            // Fire on every canvas mutation. Bump historyTrigger IMMEDIATELY so the
            // Undo/Redo buttons re-evaluate canUndo()/canRedo() right after a draw
            // (ISSUE-480 — they were stuck disabled until an unrelated re-render),
            // then debounce the heavier state persistence.
            const handleCanvasChange = () => {
                setHistoryTrigger(prev => prev + 1);
                debouncedSave();
            };

            // Try to load any previous edits/annotations FIRST
            try {
                const savedState = await getCanvasStateFromStorage(item.id);
                if (savedState && isMounted) {
                    // Initialize from saved layers, then repair stale/blank states
                    // that do not contain the selected asset as a base image.
                    canvasOps.initialize(canvasEl.current, undefined, async () => {
                        if (!isMounted) return;

                        await canvasOps.loadFromJSON(savedState);
                        const recoveredBase = await canvasOps.ensureBaseImage(editableImageUrl);
                        if (recoveredBase) {
                            logger.warn('[CreativeStudio] Restored missing base image from selected asset URL', {
                                itemId: item.id,
                            });
                        }
                    }, handleCanvasChange);
                } else if (isMounted) {
                    // Initialize WITH base image URL
                    canvasOps.initialize(canvasEl.current, editableImageUrl, undefined, handleCanvasChange);
                }

                try {
                    const savedSession = await creativeSessionService.loadSession(sessionId);
                    if (savedSession && isMounted) {
                        setIsHighFidelity(savedSession.settings?.modelTier === 'pro');
                        setMagicFillPrompt(savedSession.prompt || '');
                        const restoredDefinitions = Object.fromEntries(
                            (savedSession.references || [])
                                .filter((ref) => ref.prompt.trim().length > 0)
                                .map((ref) => [ref.colorId, ref.prompt])
                        );
                        setDefinitions(restoredDefinitions);
                        setReferenceRoles(Object.fromEntries(
                            (savedSession.references || []).map(ref => [ref.colorId, ref.role || 'objects'])
                        ));

                        if ((savedSession.generatedCandidates || []).length > 0) {
                            setGeneratedCandidates(savedSession.generatedCandidates.map((url) => ({
                                id: crypto.randomUUID(),
                                url,
                                prompt: savedSession.prompt
                            })));
                        }
                    }
                } catch (sessionErr) {
                    logger.warn('[CreativeStudio] Creative session restore skipped', sessionErr);
                }
            } catch (err: unknown) {
                logger.warn('[CreativeStudio] Failed to restore canvas state', err);
                if (isMounted) {
                    // Fallback to fresh canvas with resolved URL
                    canvasOps.initialize(canvasEl.current, await resolveEditableImageUrl(item), undefined, handleCanvasChange);
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
        const newTool = activeTool === 'brush' ? 'select' : 'brush';
        setActiveTool(newTool);
        
        if (activeTool === 'brush') {
            setGeneratedCandidates([]);
        }

        canvasOps.setTool(newTool, activeColor);

        if (newTool === 'brush') {
            toast.info(`Annotating with ${activeColor.name}. Describe your edit.`);
            setMagicFillPrompt(definitions[activeColor.id] || '');
        }
    };

    const handleSetTool = (tool: 'select' | 'line' | 'polygon' | 'text' | 'brush') => {
        setActiveTool(tool);
        canvasOps.setTool(tool, activeColor);
        if (tool === 'brush') {
            setMagicFillPrompt(definitions[activeColor.id] || '');
        }
    };

    const handleAddRectangle = () => canvasOps.addRectangle(activeColor.hex);
    const handleAddCircle = () => canvasOps.addCircle(activeColor.hex);
    const handleAddText = () => canvasOps.addText('New Text', activeColor.hex);

    const handleUndo = () => {
        canvasOps.undo();
        setHistoryTrigger(prev => prev + 1);
    };

    const handleRedo = () => {
        canvasOps.redo();
        setHistoryTrigger(prev => prev + 1);
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

    const handleUpdateReferenceRole = (colorId: string, role: CreativeVaultScope) => {
        setReferenceRoles(prev => ({ ...prev, [colorId]: role }));
    };

    const handleDetectObjects = async () => {
        if (!item || !canvasOps.isInitialized()) return;
        
        try {
            setIsProcessing(true);
            setProcessingStatus('Analyzing Image...');
            toast.info('Detecting objects...');

            const base64 = canvasOps.getBaseImageBase64();
            if (!base64) throw new Error('Could not extract base image.');

            const objects = await imageAnalysisService.detectObjects(base64);
            if (objects && objects.length > 0) {
                canvasOps.addBoundingBoxes(objects, async (label: string) => {
                    try {
                        setIsProcessing(true);
                        setProcessingStatus(`Extracting mask for: ${label}...`);
                        toast.info(`Smart selecting ${label}...`);
                        
                        const currentBase64 = canvasOps.getBaseImageBase64();
                        if (!currentBase64) return;
                        
                        const maskBase64 = await imageAnalysisService.extractSegmentationMask(currentBase64, label);
                        await canvasOps.addSegmentationMask(maskBase64, activeColor);
                        toast.success(`Successfully selected ${label}.`);
                    } catch (err: any) {
                        logger.error('[CreativeStudio] Segmentation failed', err);
                        toast.error(err.message || 'Segmentation failed.');
                    } finally {
                        setIsProcessing(false);
                        setProcessingStatus('');
                    }
                });
                toast.success(`Detected ${objects.length} objects.`);
            } else {
                toast.info('No prominent objects detected.');
            }
        } catch (error: any) {
            logger.error('[CreativeStudio] Object detection failed', error);
            toast.error(error.message || 'Object detection failed.');
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const handleClearDetections = () => {
        if (!canvasOps.isInitialized()) return;
        canvasOps.clearDetections();
        toast.info('Cleared detections from canvas.');
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
                const referenceAssetUris = await uploadSessionMedia(referenceImages, referenceRoles, 'objects');
                const maskAssetUris = await Promise.all(prepared.masks.map(async (mask) => {
                    const userId = auth.currentUser?.uid;
                    if (!userId) return null;
                    return CreativeStorageService.uploadReferenceMedia(
                        userId,
                        `data:${mask.mimeType};base64,${mask.data}`,
                        'image',
                        { scope: 'masks', sessionId }
                    );
                })).then((uris) => uris.filter((uri): uri is string => !!uri));
                const sessionSnapshot = compileCreativeEditManifest({
                    sessionId,
                    projectId: currentProjectId,
                    item,
                    prompt: combinedPrompt,
                    definitions: finalDefinitions,
                    referenceImages,
                    referenceRoles,
                    referenceAssetUris,
                    maskUris: maskAssetUris,
                    generatedCandidates,
                    settings: {
                        modelTier: isHighFidelity || studioControls.model === 'pro' ? 'pro' : 'fast',
                        resolution: studioControls.resolution,
                        imageSize: normalizeCreativeImageSize(studioControls.imageSize),
                        grounding: studioControls.useGrounding,
                        aspectRatio: studioControls.aspectRatio,
                        highFidelity: isHighFidelity,
                    }
                });

                await persistSession(sessionSnapshot, {
                    lastAction: 'magic_fill',
                    status: 'active',
                });

                if (isHighFidelity) {
                    const activeKeys = Object.keys(finalDefinitions);
                    const isMultiMask = activeKeys.length > 1;

                    let maskData: string | null = null;
                    let promptPayload = combinedPrompt;
                    let useSemanticMap = false;

                    if (isMultiMask) {
                        await reserveImageBudget('gemini-3-pro-image');
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
                            useSemanticMap,
                            sessionId,
                            routeId: editManifest.route.id,
                            routeLabel: editManifest.route.label,
                            routeReason: editManifest.route.reason,
                        });

                        if (result) {
                            setGeneratedCandidates([{
                                id: crypto.randomUUID(),
                                url: result.url,
                                prompt: promptPayload,
                                thoughtSignature: result.thoughtSignature
                            }]);
                            await updateSession({
                                lastAction: 'high_fidelity_edit',
                                selectedCandidateUri: result.url,
                                outputUri: result.url,
                            });
                            toast.success(`High-Fidelity Edit Complete!`);
                        }
                    }
                } else if (prepared.masks.length === 1) {
                    await reserveImageBudget('gemini-3.1-flash-image');
                    const result = await Editing.editImage({
                        image: prepared.baseImage,
                        mask: prepared.masks[0],
                        prompt: combinedPrompt,
                        forceHighFidelity: false,
                        model: 'flash',
                        sessionId,
                        routeId: editManifest.route.id,
                        routeLabel: editManifest.route.label,
                        routeReason: editManifest.route.reason,
                    });

                    if (result) {
                        setGeneratedCandidates([{
                            id: crypto.randomUUID(),
                            url: result.url,
                            prompt: combinedPrompt
                        }]);
                        await updateSession({
                            lastAction: 'speed_edit',
                            selectedCandidateUri: result.url,
                            outputUri: result.url,
                        });
                        toast.success(`Speedy Edit Complete!`);
                    }
                } else {
                    setProcessingStatus(isHighFidelity ? "Chaining Edits (Pro)..." : "Chaining Edits (Flash)...");
                    await reserveImageBudget(isHighFidelity ? 'gemini-3-pro-image' : 'gemini-3.1-flash-image');
                    const results = await Editing.multiMaskEdit({
                        image: prepared.baseImage,
                        masks: prepared.masks,
                        variationCount: 1,
                        model: isHighFidelity ? 'pro' : 'flash',
                        sessionId,
                        routeId: editManifest.route.id,
                        routeLabel: editManifest.route.label,
                        routeReason: editManifest.route.reason,
                    });

                    if (results.length > 0) {
                        setGeneratedCandidates(results.map(r => ({
                            id: r.id,
                            url: r.url,
                            prompt: r.prompt
                        })));
                        await updateSession({
                            lastAction: 'multi_region_edit',
                            selectedCandidateUri: results[0]?.url ?? null,
                            outputUri: results[0]?.url ?? null,
                        });
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
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
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
                    await updateSession({
                        lastAction: 'remix_edit',
                        selectedCandidateUri: result.url,
                        outputUri: result.url,
                    });
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
        await updateSession({
            lastAction: 'candidate_selected',
            selectedCandidateUri: candidate.url,
            outputUri: candidate.url,
        });
        toast.success(`Applied Option ${index + 1}`);
    };

    const handleFlattenCanvas = async () => {
        if (!canvasOps.isInitialized()) return;
        
        setIsProcessing(true);
        setProcessingStatus('Flattening Layers...');
        
        try {
            const success = await canvasOps.flattenCanvas();
            if (success) {
                toast.success('Canvas flattened! Edits are now permanent.');
                // Auto-save the new state
                await saveCanvas();
                await updateSession({
                    lastAction: 'flatten_canvas',
                });
            } else {
                toast.error('Failed to flatten canvas.');
            }
        } catch (error: any) {
            logger.error('[CreativeStudio] Flatten failed', error);
            toast.error('An error occurred while flattening.');
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    const saveCanvas = async () => {
        if (!item) return;

        // Guard: prevent saving an empty canvas (e.g. image failed to load due to CORS)
        if (!canvasOps.hasContent()) {
            toast.error('Cannot save: canvas is empty. The image may have failed to load.');
            return;
        }

        try {
            // 1. Get the data URL (inside try: throws/returns '' if canvas is tainted — ISSUE-482)
            const dataUrl = canvasOps.saveCanvas();
            if (!dataUrl) {
                toast.error('Could not export the canvas. Reopen the image and try again.');
                return;
            }

            // 2. Upload blob to Firebase Storage as a persistent asset
            const blob = await canvasOps.getBlob();
            if (blob) {
                const assetId = await saveAssetToStorage(blob);

                // 3. Create or update HistoryItem so the export appears in the gallery
                const { addToHistory, updateHistoryItem } = useStore.getState();
                
                if (item.origin === 'canvas-export') {
                    updateHistoryItem(item.id, {
                        url: dataUrl || item.url,
                        timestamp: Date.now()
                    });
                } else {
                    const canvasAsset: HistoryItem = {
                        id: assetId,
                        url: dataUrl || item.url,
                        prompt: `Canvas edit of: ${item.prompt || 'untitled'}`,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId,
                        origin: 'canvas-export',
                        parentId: item.id,
                    };
                    addToHistory(canvasAsset);
                }
            }

            // 4. Persist canvas state (annotations / layers) for reload
            const json = await canvasOps.toJSON();
            if (json) await saveCanvasStateToStorage(item.id, JSON.stringify(json));
            await persistSession(editManifest, {
                lastAction: 'save_canvas',
                status: 'completed',
                selectedCandidateUri: generatedCandidates[0]?.url ?? null,
                outputUri: item.url,
            });
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
            useStore.getState().updateWhiskItem('subject', whiskId, { intelligenceCaption: caption });
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
                setEndFrameItem(targetAsset as { id: string; url: string; prompt: string; type: 'image' | 'video' });
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
                const { addToHistory } = useStore.getState();
                
                const saveToCloud = async (url: string, suffix: string) => {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const assetId = await saveAssetToStorage(blob);
                    
                    const formatAsset: HistoryItem = {
                        id: assetId,
                        url: url, // Assuming URL is a blob URL or base64. Ideally we'd use the uploaded URL if saveAssetToStorage returned it, but we can stick to the local URL for instant display
                        prompt: `${item.prompt || 'untitled'} (${suffix})`,
                        type: 'image',
                        timestamp: Date.now(),
                        projectId: currentProjectId,
                        origin: 'canvas-export',
                        parentId: item.id,
                    };
                    addToHistory(formatAsset);
                };

                await Promise.all([
                    saveToCloud(results.tiktok, '9-16-tiktok'),
                    saveToCloud(results.instagram, '1-1-ig'),
                    saveToCloud(results.youtube, '16-9-yt')
                ]);

                toast.success("Batch formats saved to gallery! (TikTok, IG, YT)");
            }
        } catch (_error: unknown) {
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
        isMagicFillMode: activeTool === 'brush',
        isSelectingEndFrame,
        isDefinitionsOpen,
        prompt,
        activeColor,
        definitions,
        referenceImages,
        referenceRoles,
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
        handleUpdateReferenceRole,
        handleMagicFill,
        handleDetectObjects,
        handleClearDetections,
        handleAnimate,
        handleCandidateSelect,
        saveCanvas,
        handleFlattenCanvas,
        handleRefine: onRefine || handleRefineInternal,
        handleCreateLastFrame,
        batchExportDimensions,
        handleUndo,
        handleRedo,
        canUndo: canvasOps.canUndo(),
        canRedo: canvasOps.canRedo(),
        activeTool,
        handleSetTool,
        handleAddRectangle,
        handleAddCircle,
        handleAddText,
        sessionId,
        editManifest,
        editSummary,
    };
}
