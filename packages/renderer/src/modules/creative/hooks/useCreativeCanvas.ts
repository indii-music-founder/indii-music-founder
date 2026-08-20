/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { STUDIO_COLORS, CreativeColor } from '../constants';
import { canvasOps } from '../services/CanvasOperationsService';
import { VideoDirector } from '../services/VideoDirector';
import { Editing } from '@/services/image/EditingService';
import { saveAssetToStorage, saveCanvasStateToStorage, getCanvasStateFromStorage } from '@/services/storage/repository';
import { imageAnalysisService } from '@/services/image/ImageAnalysisService';
import { logger } from '@/utils/logger';
import { buildReferenceRolePrompt, compileCreativeEditManifest, getCreativeSessionId, normalizeCreativeImageSize, summarizeCreativeEditManifest, type CreativeVaultScope } from '../services/creativeManifest';
import { INTELLIGENCE_CONFIG } from '@/core/config/intelligence-models';
import { creativeSessionService } from '@/services/creative/CreativeSessionService';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { auth } from '@/services/firebase';
import { CostControlService } from '@/services/billing/CostControlService';
import { estimateCostUsd } from '@/services/intelligence/billing/ModelPricing';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { buildAssetStorageUri, resolveStorageUri } from '@/services/storage/storageUri';
import { CloudStorageService } from '@/services/CloudStorageService';
import { normalizeVideoAspectRatio } from '@/services/video/videoAspectRatio';
import type { Candidate } from '../components/CandidateReview';

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
        try {
            const resolved = await resolveStorageUrl(candidate);
            if (resolved.startsWith('gs://')) {
                unresolvedStorageUri = resolved;
                continue;
            }
            return resolved;
        } catch (err: unknown) {
            logger.warn('Failed to resolve asset URL:', err);
            continue;
        }
    }

    if (unresolvedStorageUri) {
        throw new Error('Selected asset is still a gs:// Storage URI and could not be resolved for display.');
    }

    throw new Error('Selected asset does not include a displayable image URL.');
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    if (dataUrl.startsWith('data:')) {
        return CloudStorageService.dataURItoBlob(dataUrl);
    }

    const response = await fetch(dataUrl);
    return response.blob();
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
    const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(false);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [hasDetections, setHasDetections] = useState(false);
    const [activeTool, setActiveTool] = useState<'select' | 'line' | 'polygon' | 'text' | 'brush'>('brush');
     
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
    // ISSUE-1395: tracks whether the user actually modified the fabric canvas
    // this session (change events only fire on real mutations — object
    // add/modify/remove/path — never on selection). The "Canvas" send flow
    // must not export/duplicate an untouched asset into the gallery; it only
    // persists (and stages) the edited output when this flag is set.
    const dirtyRef = useRef(false);
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
    const currentUserStorageUri = (assetId: string) => {
        const userId = auth.currentUser?.uid;
        return userId ? buildAssetStorageUri(assetId, userId) : undefined;
    };
    const candidatePersistenceUri = (candidate?: Candidate | null) => candidate?.storageUri || candidate?.url || null;
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
    // ISSUE-1391: this must be useLayoutEffect, not useEffect. Fabric.js
    // re-parents the React-owned <canvas> into its own wrapper container
    // (wrapElement: parentNode.replaceChild(container, canvas)). On editor
    // close React unmounts the subtree — passive (useEffect) cleanups run
    // AFTER the DOM nodes are removed, so canvasOps.dispose() fired too late
    // and fabric's cleanupDOM removeChild() threw "The node to be removed is
    // not a child of this node". A layout-effect cleanup runs synchronously
    // BEFORE React removes the node, letting dispose() unwrap the fabric
    // container first (fabric's cleanupDOM restores the original parent).
    useLayoutEffect(() => {
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
                dirtyRef.current = true;
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
                        // Load-time object:added events are not user edits — the
                        // restored canvas is the baseline, not a change.
                        dirtyRef.current = false;
                    }, handleCanvasChange);
                } else if (isMounted) {
                    // Initialize WITH base image URL
                    canvasOps.initialize(canvasEl.current, editableImageUrl, () => {
                        // The base image placement fires object:added before
                        // onReady — that is the baseline, not a user edit.
                        dirtyRef.current = false;
                    }, handleCanvasChange);
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
                            const restoredCandidates = await Promise.all(
                                (savedSession.generatedCandidates || []).map(async (candidateUri) => ({
                                    id: crypto.randomUUID(),
                                    url: await resolveStorageUrl(candidateUri),
                                    storageUri: candidateUri.startsWith('data:') ? undefined : candidateUri,
                                    prompt: savedSession.prompt
                                }))
                            );
                            setGeneratedCandidates(restoredCandidates);
                        }
                    }
                } catch (sessionErr) {
                    logger.warn('[CreativeStudio] Creative session restore skipped', sessionErr);
                }
            } catch (err: unknown) {
                logger.warn('[CreativeStudio] Failed to restore canvas state', err);
                if (isMounted) {
                    // Fallback to fresh canvas with resolved URL
                    canvasOps.initialize(canvasEl.current, await resolveEditableImageUrl(item), () => {
                        dirtyRef.current = false;
                    }, handleCanvasChange);
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

    const handleAddRectangle = () => {
        canvasOps.addRectangle(activeColor.hex);
        setHistoryTrigger(prev => prev + 1);
    };
    const handleAddCircle = () => {
        canvasOps.addCircle(activeColor.hex);
        setHistoryTrigger(prev => prev + 1);
    };
    const handleAddText = () => {
        canvasOps.addText('New Text', activeColor.hex);
        setHistoryTrigger(prev => prev + 1);
    };
    const handleAddSketchLayer = () => {
        const layerId = canvasOps.addBlankSketchLayer(activeColor.name || 'Sketch Layer');
        if (layerId) {
            handleSelectLayer(layerId);
        }
        handleSetTool('brush');
        setIsLayersPanelOpen(true);
        toast.info(`Blank sketch layer added. Draw on the canvas to create a sketch.`);
    };

    const handleUndo = async () => {
        await canvasOps.undo();
        setHistoryTrigger(prev => prev + 1);
    };

    const handleRedo = async () => {
        await canvasOps.redo();
        setHistoryTrigger(prev => prev + 1);
    };

    // Layers panel: derived from historyTrigger so the list stays in sync with
    // every canvas mutation (add/remove/reorder/undo/redo) without a separate
    // subscription.
    const layers = useMemo(() => canvasOps.getLayers(), [historyTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleLayersPanel = () => setIsLayersPanelOpen(prev => !prev);

    const handleSelectLayer = (id: string) => {
        setSelectedLayerId(id);
        canvasOps.selectLayer(id);
    };

    const handleToggleLayerVisibility = (id: string) => {
        canvasOps.toggleLayerVisibility(id);
        setHistoryTrigger(prev => prev + 1);
    };

    const handleToggleLayerLock = (id: string) => {
        canvasOps.toggleLayerLock(id);
        setHistoryTrigger(prev => prev + 1);
    };

    const handleDeleteLayer = (id: string) => {
        canvasOps.deleteLayer(id);
        if (selectedLayerId === id) setSelectedLayerId(null);
        setHistoryTrigger(prev => prev + 1);
    };

    const handleReorderLayer = (id: string, direction: 'up' | 'down') => {
        canvasOps.reorderLayer(id, direction);
        setHistoryTrigger(prev => prev + 1);
    };

    const persistDraftCandidates = async (candidates: Candidate[], sourcePrompt: string): Promise<Candidate[]> => {
        if (!item || candidates.length === 0) return candidates;
        const { addToHistory } = useStore.getState();
        const persistedCandidates: Candidate[] = [];

        await Promise.all(candidates.map(async (candidate, index) => {
            try {
                const blob = await dataUrlToBlob(candidate.url);
                const assetId = await saveAssetToStorage(blob);
                const storageUri = currentUserStorageUri(assetId);
                const persistedCandidate = {
                    ...candidate,
                    storageUri,
                };
                persistedCandidates[index] = persistedCandidate;
                addToHistory({
                    id: assetId,
                    url: candidate.url,
                    storageUri,
                    prompt: candidate.prompt || sourcePrompt || `Magic Edit option ${index + 1}`,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId || item.projectId || 'default',
                    origin: 'editor',
                    parentId: item.id,
                    tags: ['magic-edit', 'draft-candidate'],
                });
            } catch (error: unknown) {
                logger.warn('[CreativeStudio] Draft candidate persistence skipped', {
                    candidateId: candidate.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }));

        return candidates.map((candidate, index) => persistedCandidates[index] ?? candidate);
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
                setHasDetections(true);
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
        setHasDetections(false);
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
        const activeKeys = Object.keys(finalDefinitions);
        const roleInstructions = buildReferenceRolePrompt(finalDefinitions, referenceRoles, activeKeys);
        const activeReferenceEntries = activeKeys
            .map(colorId => {
                const reference = referenceImages[colorId];
                if (!reference) return null;
                const colorName = STUDIO_COLORS.find(c => c.id === colorId)?.name.toUpperCase() ?? colorId.toUpperCase();
                return { colorId, colorName, reference };
            })
            .filter((entry): entry is { colorId: string; colorName: string; reference: { mimeType: string; data: string } } => !!entry);

        setIsProcessing(true);
        setProcessingStatus(isHighFidelity ? "Capturing Visual Context..." : "Architecting Masks...");
        toast.info(isHighFidelity ? 'Starting High-Fidelity Pro Edit...' : 'Starting High-Speed Flash Edit...');

        try {
            setProcessingStatus(isHighFidelity ? "Reasoning (Pro)..." : "Inpainting (Flash)...");
            const prepared = canvasOps.prepareMasksForEdit(finalDefinitions, referenceImages);

            if (prepared && prepared.masks.length > 0) {
                const combinedPrompt = Object.values(finalDefinitions).join(". ") || magicFillPrompt;
                const roleAwarePrompt = [
                    combinedPrompt,
                    roleInstructions.length > 0 ? `Reference role guidance:\n${roleInstructions.join('\n')}` : '',
                ].filter(Boolean).join('\n\n');
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
                    const isMultiMask = activeKeys.length > 1;

                    let maskData: string | null = null;
                    let promptPayload = roleAwarePrompt;
                    let useSemanticMap = false;
                    let referenceImagesForEdit: { mimeType: string; data: string }[] = [];

                    if (isMultiMask) {
                        await reserveImageBudget('gemini-3-pro-image');
                        maskData = canvasOps.extractSemanticMask();
                        useSemanticMap = true;
                        const maxReferenceImages = INTELLIGENCE_CONFIG.IMAGE.DEFAULT.maxReferenceImages;
                        const visibleReferences = activeReferenceEntries.slice(0, maxReferenceImages);
                        const droppedReferences = activeReferenceEntries.slice(maxReferenceImages);

                        if (droppedReferences.length > 0) {
                            toast.warning(`Dropped ${droppedReferences.map(ref => ref.colorName).join(', ')} because Nano Banana Pro only accepts up to ${maxReferenceImages} reference images.`);
                        }

                        const referenceIndexByColor = new Map(visibleReferences.map((entry, index) => [entry.colorId, index + 1] as const));
                        const legend = activeKeys.map(colorId => {
                            const colorDef = STUDIO_COLORS.find(c => c.id === colorId);
                            const label = colorDef ? colorDef.name.toUpperCase() : 'MARKED';
                            const referenceIndex = referenceIndexByColor.get(colorId);
                            const referenceText = referenceIndex
                                ? `uses reference image ${referenceIndex}`
                                : 'has no reference image';
                            return `- ${label} REGION ${referenceText}: ${finalDefinitions[colorId]}`;
                        }).join('\n');
                        promptPayload = `Applying multiple edits defined by color mask:\n${legend}\n\n${roleInstructions.length > 0 ? `Reference role guidance:\n${roleInstructions.join('\n')}` : ''}`.trim();

                        referenceImagesForEdit = visibleReferences.map(entry => entry.reference);
                    } else {
                        maskData = canvasOps.extractGeminiMask();
                    }

                    if (maskData) {
                        const result = await Editing.editImage({
                            image: prepared.baseImage,
                            mask: { mimeType: 'image/png', data: maskData },
                            referenceImages: referenceImagesForEdit,
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
                            const candidates = [{
                                id: crypto.randomUUID(),
                                url: result.url,
                                prompt: promptPayload,
                                thoughtSignature: result.thoughtSignature
                            }];
                            const persistedCandidates = await persistDraftCandidates(candidates, promptPayload);
                            setGeneratedCandidates(persistedCandidates);
                            await updateSession({
                                lastAction: 'high_fidelity_edit',
                                generatedCandidates: persistedCandidates.map(candidate => candidate.storageUri || candidate.url),
                                selectedCandidateUri: persistedCandidates[0]?.storageUri || result.url,
                                outputUri: persistedCandidates[0]?.storageUri || result.url,
                            });
                            toast.success(`High-Fidelity Edit Complete!`);
                        }
                    }
                } else if (prepared.masks.length === 1) {
                    await reserveImageBudget('gemini-3.1-flash-image');
                        const result = await Editing.editImage({
                            image: prepared.baseImage,
                            mask: prepared.masks[0],
                            referenceImage: prepared.masks[0]?.referenceImage,
                            prompt: roleAwarePrompt,
                            forceHighFidelity: false,
                            model: 'flash',
                            sessionId,
                        routeId: editManifest.route.id,
                        routeLabel: editManifest.route.label,
                        routeReason: editManifest.route.reason,
                    });

                    if (result) {
                        const candidates = [{
                            id: crypto.randomUUID(),
                            url: result.url,
                            prompt: combinedPrompt
                        }];
                        const persistedCandidates = await persistDraftCandidates(candidates, combinedPrompt);
                        setGeneratedCandidates(persistedCandidates);
                        await updateSession({
                            lastAction: 'speed_edit',
                            generatedCandidates: persistedCandidates.map(candidate => candidate.storageUri || candidate.url),
                            selectedCandidateUri: persistedCandidates[0]?.storageUri || result.url,
                            outputUri: persistedCandidates[0]?.storageUri || result.url,
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
                        const candidates = results.map(r => ({
                            id: r.id,
                            url: r.url,
                            prompt: r.prompt
                        }));
                        const persistedCandidates = await persistDraftCandidates(candidates, combinedPrompt);
                        setGeneratedCandidates(persistedCandidates);
                        const firstCandidateUri = candidatePersistenceUri(persistedCandidates[0]) ?? candidatePersistenceUri(candidates[0]);
                        await updateSession({
                            lastAction: 'multi_region_edit',
                            generatedCandidates: persistedCandidates.map(candidate => candidate.storageUri || candidate.url),
                            selectedCandidateUri: firstCandidateUri,
                            outputUri: firstCandidateUri,
                        });
                        toast.success("Multi-Region Chain Complete!");
                    }
                }
                } else {
                    setProcessingStatus("Remixing Visuals...");
                    const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
                    const blob = item.url.startsWith('data:')
                        ? await CloudStorageService.dataURItoBlob(item.url)
                        : await (await fetch(item.url)).blob();
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
                    const candidates = [{
                        id: crypto.randomUUID(),
                        url: result.url,
                        prompt: magicFillPrompt
                    }];
                    const persistedCandidates = await persistDraftCandidates(candidates, magicFillPrompt);
                    setGeneratedCandidates(persistedCandidates);
                    await updateSession({
                        lastAction: 'remix_edit',
                        generatedCandidates: persistedCandidates.map(candidate => candidate.storageUri || candidate.url),
                        selectedCandidateUri: persistedCandidates[0]?.storageUri || result.url,
                        outputUri: persistedCandidates[0]?.storageUri || result.url,
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
        const { aspectRatio, coercedFrom } = normalizeVideoAspectRatio(studioControls.aspectRatio);
        if (coercedFrom && coercedFrom !== aspectRatio) {
            toast.info(`Animating ${coercedFrom} art as ${aspectRatio} video.`);
        }
        toast.info('Starting video generation...');
        try {
            const result = await VideoDirector.triggerAnimation(item, {
                aspectRatio,
            });
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
        setHistoryTrigger(prev => prev + 1);
        await updateSession({
            lastAction: 'candidate_selected',
            selectedCandidateUri: candidate.storageUri || candidate.url,
            outputUri: candidate.storageUri || candidate.url,
        });
        toast.success(`Applied Option ${index + 1}`);
    };

    const handleCandidateApply = async (selected: Candidate[]) => {
        const first = selected[0];
        if (!first) return;
        const index = generatedCandidates.findIndex(candidate => candidate.id === first.id);
        await handleCandidateSelect(first, index >= 0 ? index : 0);
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

    /**
     * Persist the current canvas state: export the flattened artwork to
     * storage, add it to the gallery as a canvas-export asset, and save the
     * layer state for reload. Returns the persisted export ({url, storageUri})
     * so callers can hand the EDITED output onward (e.g. the canvas send
     * flow) — or null when nothing could be persisted.
     */
    const saveCanvas = async (): Promise<{ url: string; storageUri?: string } | null> => {
        if (!item) return null;

        // Guard: prevent saving an empty canvas (e.g. image failed to load due to CORS)
        if (!canvasOps.hasContent()) {
            toast.error('Cannot save: canvas is empty. The image may have failed to load.');
            return null;
        }

        try {
            // 1. Get the data URL (inside try: throws/returns '' if canvas is tainted — ISSUE-482)
            const dataUrl = canvasOps.saveCanvas();
            if (!dataUrl) {
                toast.error('Could not export the canvas. Reopen the image and try again.');
                return null;
            }

            // 2. Upload blob to Firebase Storage as a persistent asset
            const blob = await canvasOps.getBlob();
            let storageUri: string | undefined;
            if (blob) {
                const assetId = await saveAssetToStorage(blob);
                storageUri = currentUserStorageUri(assetId);

                // 3. Create or update HistoryItem so the export appears in the gallery
                const { addToHistory, updateHistoryItem } = useStore.getState();
                
                if (item.origin === 'canvas-export') {
                    updateHistoryItem(item.id, {
                        url: dataUrl || item.url,
                        storageUri,
                        timestamp: Date.now()
                    });
                } else {
                    const canvasAsset: HistoryItem = {
                        id: assetId,
                        url: dataUrl || item.url,
                        storageUri,
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
                selectedCandidateUri: candidatePersistenceUri(generatedCandidates[0]),
                outputUri: storageUri ?? item.url,
            });
            // ISSUE-917: Only show success if storage actually succeeded
            if (storageUri) {
                toast.success('Saved to gallery & cloud!');
            } else {
                toast.warning('Canvas state saved, but export to gallery failed.');
            }
            return { url: dataUrl || item.url, storageUri };
        } catch {
            // ISSUE-917: No disk save actually happened in catch path
            toast.error('Canvas save failed. Changes are not persistent.');
            return null;
        }
    };

    /**
     * ISSUE-1391 (founder-requested flow): one-click handoff of the asset
     * being edited straight onto the canvas — the "more direct way of getting
     * assets between locations and pages". Stages it onto the InfiniteCanvas
     * with its natural dimensions and switches view. Mirrors
     * openImageInStudio's cascade positioning so repeated sends land visibly.
     *
     * ISSUE-1395 follow-up: an untouched canvas must NOT spawn a duplicate
     * gallery export ("Canvas edit of…") — persistence happens only when the
     * user actually changed something, and in that case the EDITED output
     * (not the original asset) is what lands on the board.
     */
    const handleSendToCanvas = async () => {
        if (!item) return;
        const { addCanvasImage, setViewMode, currentProjectId, canvasImages } = useStore.getState();
        const { readNaturalDimensions } = await import('@/core/store/slices/creative/creativeHistorySlice');

        let sourceUrl = item.storageUri || item.url;
        if (dirtyRef.current) {
            const saved = await saveCanvas();
            if (saved) {
                sourceUrl = saved.storageUri || saved.url;
            }
        }

        // gs:// URIs cannot be decoded by Image() — resolve to a download URL
        // so the staged asset keeps its true dimensions instead of collapsing
        // to the legacy 512×512 box.
        const dimensionUrl = await resolveStorageUrl(sourceUrl);
        const { width, height } = await readNaturalDimensions(dimensionUrl);
        const naturalWidth = width > 0 ? width : 512;
        const naturalHeight = height > 0 ? height : 512;
        const aspect = naturalWidth / naturalHeight;

        const existing = canvasImages || [];
        const CASCADE_STEP = 32;
        const last = existing[existing.length - 1];
        const baseX = 100;
        const baseY = 100;
        let x = baseX;
        let y = baseY;
        if (last && typeof last.x === 'number' && typeof last.y === 'number') {
            x = last.x + CASCADE_STEP;
            y = last.y + CASCADE_STEP;
        }
        if (x > 1400 || y > 1400) {
            x = baseX + CASCADE_STEP;
            y = baseY + CASCADE_STEP;
        }

        addCanvasImage({
            id: `editor_${item.id}_${Date.now()}`,
            base64: sourceUrl,
            x,
            y,
            width: naturalWidth,
            height: naturalHeight,
            aspect,
            projectId: currentProjectId || 'default',
            prompt: `Canvas edit of: ${item.prompt || 'untitled'}`,
            parentId: item.id,
        });
        onClose();
        setViewMode('canvas');
        toast.success('Sent to canvas!');
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
                const storageUri = resolveStorageUri(synthResults.url);
                const targetAsset: HistoryItem = {
                    id: crypto.randomUUID(),
                    url: synthResults.url,
                    storageUri,
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
                    // `url` is a canvas.toDataURL() result (a data: URI), not a network
                    // URL — fetch() on a data: URI is blocked by this app's CSP
                    // connect-src directive, which made every batch export fail.
                    const blob = await CloudStorageService.dataURItoBlob(url);
                    const assetId = await saveAssetToStorage(blob);
                    const storageUri = currentUserStorageUri(assetId);
                    
                    const formatAsset: HistoryItem = {
                        id: assetId,
                        url: url, // Assuming URL is a blob URL or base64. Ideally we'd use the uploaded URL if saveAssetToStorage returned it, but we can stick to the local URL for instant display
                        storageUri,
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
        isLayersPanelOpen,
        layers,
        selectedLayerId,
        hasDetections,
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
        toggleLayersPanel,
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
        handleSelectLayer,
        handleToggleLayerVisibility,
        handleToggleLayerLock,
        handleDeleteLayer,
        handleReorderLayer,
        handleAnimate,
        handleCandidateSelect,
        handleCandidateApply,
        saveCanvas,
        handleFlattenCanvas,
        handleRefine: onRefine || handleRefineInternal,
        handleCreateLastFrame,
        batchExportDimensions,
        handleSendToCanvas,
        handleUndo,
        handleRedo,
        canUndo: canvasOps.canUndo(),
        canRedo: canvasOps.canRedo(),
        activeTool,
        handleSetTool,
        handleAddRectangle,
        handleAddCircle,
        handleAddText,
        handleAddSketchLayer,
        sessionId,
        editManifest,
        editSummary,
    };
}
