import React, { useEffect, lazy, Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CampaignConfigDialog } from '@/components/ui/CampaignConfigDialog';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import CreativeNavbar from './components/CreativeNavbar';
import InfiniteCanvas from './components/InfiniteCanvas';
import AutonomousLab from './components/AutonomousLab';
import VideoWorkflow from './video/VideoWorkflow';
import CreativeCanvas from './components/CreativeCanvas';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { WhiskService } from '@/services/WhiskService';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import DirectGenerationTab from './components/DirectGenerationTab';
import ShowroomUI from './components/ShowroomUI';
import { logger } from '@/utils/logger';
import { useRef } from 'react';
import { awaitCompletedPlpVideoVariant } from './plpVideoVariant';
import {
    completePlpSlot,
    createPlpBatch,
    failPlpSlot,
    getEligiblePlpSlots,
    retryPlpSlot,
    setPlpLaunchStatus,
    queuePlpSlot,
    type PlpBatch,
    type PlpVariantResult,
} from './plpBatch';
import { buildDistributorContext, validateImageForDistributor } from '@/services/onboarding/DistributorContext';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';

import CreativeClipboard from './components/CreativeClipboard';
import OmniWorkflow from './video/OmniWorkflow';
import CanvasModePicker from './components/CanvasModePicker';
import PlpBatchStatus from './components/PlpBatchStatus';
import { AdaptiveWorkspace } from '@/components/layout/AdaptiveWorkspace';

/**
 * ISSUE-1007: decodes the actual persisted image's pixel dimensions instead
 * of trusting the requested aspectRatio/resolution — cover-art compliance
 * must be checked against what was really generated.
 */
function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('Failed to decode image dimensions'));
        img.src = url;
    });
}

function normalizeImageFormat(mimeType: string): string | null {
    if (mimeType === 'image/jpeg') return 'JPG';
    if (mimeType === 'image/png') return 'PNG';
    if (mimeType === 'image/webp') return 'WEBP';
    return null;
}

async function sha256(blob: Blob): Promise<string> {
    const blobWithArrayBuffer = blob as Blob & { arrayBuffer?: () => Promise<ArrayBuffer> };
    const bytes = blobWithArrayBuffer.arrayBuffer
        ? await blobWithArrayBuffer.arrayBuffer()
        : await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error ?? new Error('Could not read cover-art bytes'));
            reader.readAsArrayBuffer(blob);
        });
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function parseMegabytes(value?: string): number | undefined {
    const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*MB$/i);
    return match ? Math.round(Number(match[1]) * 1024 * 1024) : undefined;
}

/**
 * Measures the concrete file delivered by the provider/storage path. Requested
 * resolution is not evidence of a distributor-safe output.
 */
async function measureCoverArt(url: string, profile: Parameters<typeof buildDistributorContext>[0]) {
    const [dimensions, response] = await Promise.all([loadImageDimensions(url), fetch(url)]);
    if (!response.ok) throw new Error(`Could not read generated cover-art bytes (${response.status})`);
    const blob = await response.blob();
    const mimeType = blob.type.toLowerCase();
    const context = buildDistributorContext(profile);
    const validation = validateImageForDistributor(profile, dimensions.width, dimensions.height);
    const errors = [...validation.errors];
    const format = normalizeImageFormat(mimeType);
    if (!format || !context.image.format.includes(format)) {
        errors.push(`Unsupported cover-art format: ${mimeType || 'unknown'}. Allowed: ${context.image.format.join(', ')}.`);
    }
    const maxSize = parseMegabytes(context.distributor?.coverArt.maxFileSize);
    if (maxSize && blob.size > maxSize) {
        errors.push(`Cover art exceeds the ${context.distributor?.coverArt.maxFileSize} file-size limit.`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings: validation.warnings,
        measuredWidth: dimensions.width,
        measuredHeight: dimensions.height,
        mimeType,
        sizeBytes: blob.size,
        sha256: await sha256(blob),
    };
}

/** Map UI-friendly person generation values to Intelligence API uppercase constants. */
const PERSON_GEN_API_MAP: Record<string, string> = {
    'allow_adult': 'ALLOW_ADULT',
    'dont_allow': 'ALLOW_NONE',
    'allow_all': 'ALLOW_ALL',
};

// Lazy load StudioControlsPanel for mobile controls tab
const StudioControlsPanel = lazy(() => import('@/core/components/right-panel/StudioControlsPanel'));

export default function CreativeStudio({ initialMode }: { initialMode?: 'image' | 'video' }) {
    const {
        viewMode, setViewMode,
        selectedItem, setSelectedItem,
        generationMode, setGenerationMode,
        pendingPrompt, setPendingPrompt,
        prompt, setPrompt,
        isGenerating,
        studioControls,
        addToHistory, currentProjectId,
        userProfile, whiskState,
        characterReferences,
        chatImportContext,
        clearChatImportContext,
        initializeDesignHistory,
        pendingStageHandoff,
        consumeStageHandoff,
        addCharacterReference,
        canvasImages
    } = useStore(useShallow(state => ({
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        selectedItem: state.selectedItem,
        setSelectedItem: state.setSelectedItem,
        canvasImages: state.canvasImages,
        generationMode: state.generationMode,
        setGenerationMode: state.setGenerationMode,
        pendingPrompt: state.pendingPrompt,
        setPendingPrompt: state.setPendingPrompt,
        prompt: state.creativePrompt,
        setPrompt: state.setCreativePrompt,
        isGenerating: state.isGenerating,
        studioControls: state.studioControls,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId,
        userProfile: state.userProfile,
        whiskState: state.whiskState,
        characterReferences: state.characterReferences,
        chatImportContext: state.chatImportContext,
        clearChatImportContext: state.clearChatImportContext,
        initializeDesignHistory: state.initializeDesignHistory,
        pendingStageHandoff: state.pendingStageHandoff,
        consumeStageHandoff: state.consumeStageHandoff,
        addCharacterReference: state.addCharacterReference
    })));
    const toast = useToast();
    const [activeMobileTab, setActiveMobileTab] = React.useState<'controls' | 'studio'>('studio');
    const [plpBatch, setPlpBatch] = React.useState<PlpBatch | null>(null);
    const plpBatchRef = React.useRef<PlpBatch | null>(null);
    const plpRetryHandlersRef = React.useRef(new Map<number, () => Promise<void>>());
    const plpRetryInFlightRef = React.useRef(new Set<number>());
    const acceptedPlpSlotsRef = React.useRef(new Set<string>());
    const plpLaunchInFlightRef = React.useRef(false);
    const hasModeOverlay = viewMode === 'direct'
        || viewMode === 'video_production'
        || viewMode === 'omni'
        || viewMode === 'showroom'
        || viewMode === 'lab';

    const mutatePlpBatch = React.useCallback((mutate: (batch: PlpBatch) => PlpBatch) => {
        const current = plpBatchRef.current;
        if (!current) return;
        const next = mutate(current);
        plpBatchRef.current = next;
        setPlpBatch(next);
    }, []);

    const handleRetryPlpSlot = React.useCallback(async (slotIndex: number) => {
        const batch = plpBatchRef.current;
        if (!batch) return;
        if (useStore.getState().currentProjectId !== batch.projectId) {
            toast.warning('Switch back to the project that started this PLP batch before retrying.');
            return;
        }
        const retry = plpRetryHandlersRef.current.get(slotIndex);
        if (!retry) {
            toast.error('This variant no longer has retry context. Start a new PLP batch.');
            return;
        }
        if (plpRetryInFlightRef.current.has(slotIndex)) return;
        plpRetryInFlightRef.current.add(slotIndex);
        try {
            await retry();
        } finally {
            plpRetryInFlightRef.current.delete(slotIndex);
        }
    }, [toast]);

    const handleLaunchPlpBatch = React.useCallback(async () => {
        const batch = plpBatchRef.current;
        if (!batch || plpLaunchInFlightRef.current || batch.launchStatus === 'launched') return;
        if (useStore.getState().currentProjectId !== batch.projectId) {
            toast.warning('Switch back to the project that started this PLP batch before launch.');
            return;
        }

        const eligibleSlots = getEligiblePlpSlots(batch);
        if (batch.slots.some(slot => slot.status === 'queued')) {
            toast.info('Wait for queued PLP variants to finish before launch review.');
            return;
        }
        if (eligibleSlots.length !== batch.slots.length) {
            toast.error('Retry every failed PLP variant before launch. All 15 assets must be completed and playable.');
            return;
        }

        plpLaunchInFlightRef.current = true;
        let launch: Awaited<ReturnType<typeof CampaignConfigDialog.call>>;
        try {
            launch = await CampaignConfigDialog.call({
                variantCount: eligibleSlots.length,
                defaultBody: batch.prompt.slice(0, 120),
            });
        } catch (error: unknown) {
            plpLaunchInFlightRef.current = false;
            logger.error('[PLP] Campaign review dialog failed', error);
            toast.error('Campaign review could not be opened. Your variants are still saved.');
            return;
        }
        if (!launch) {
            plpLaunchInFlightRef.current = false;
            toast.info('Variants saved. No ad campaign was launched.');
            return;
        }

        mutatePlpBatch(current => setPlpLaunchStatus(current, 'launching'));
        try {
            const { adAutomationService } = await import('@/services/marketing/AdAutomationService');
            const adBudget = {
                platform: 'meta' as const,
                dailyBudget: launch.dailyBudget,
                totalDays: launch.totalDays,
                targetAgeRange: [launch.targetAgeMin, launch.targetAgeMax] as [number, number],
                targetInterests: launch.targetInterests,
            };
            const adCreatives = eligibleSlots.map(slot => ({
                creativeId: slot.result!.id,
                postId: `plp_${batch.id}_${slot.index}`,
                headline: launch.headline,
                body: launch.body,
                callToAction: (slot.kind === 'video' ? 'LEARN_MORE' : 'SHOP_NOW') as 'LEARN_MORE' | 'SHOP_NOW',
            }));
            await adAutomationService.deployPLPPipeline(adCreatives, adBudget);
            mutatePlpBatch(current => setPlpLaunchStatus(current, 'launched'));
            toast.success('Campaign deployed to Marketing Protocol.');
        } catch (error: unknown) {
            logger.error('[PLP] Failed to deploy marketing pipeline', error);
            // A sequential provider deployment can fail after creating a campaign,
            // ad set, or some ads. Fail closed instead of offering a blind retry
            // that could create a second paid campaign.
            mutatePlpBatch(current => setPlpLaunchStatus(current, 'attention_required'));
            toast.error('Campaign launch could not be confirmed. Variants are saved; verify Marketing status before trying again.');
        } finally {
            plpLaunchInFlightRef.current = false;
        }
    }, [mutatePlpBatch, toast]);

    useEffect(() => {
        initializeDesignHistory();
    }, [initializeDesignHistory]);

    // Consume cross-stage handoff for Image
    useEffect(() => {
        const handoff = pendingStageHandoff?.image;
        if (handoff) {
            const { item, role } = handoff;

            switch (role) {
                case 'reference-image':
                case 'image-input':
                    // Add as character reference for styling/composition guidance
                    addCharacterReference({
                        image: item,
                        referenceType: 'reference',
                        name: item.prompt || 'Reference Image'
                    });
                    break;
                default:
                    logger.warn('[image-handoff] Unexpected role for image stage', { role });
            }

            consumeStageHandoff('image');
            toast.success('Asset received in Image Studio');
        }
    }, [pendingStageHandoff?.image, consumeStageHandoff, addCharacterReference, toast]);

    const isDirty = React.useMemo(() => (prompt && prompt.length > 0) || isGenerating, [prompt, isGenerating]);
    useUnsavedChanges(isDirty);

    useEffect(() => {
        if (initialMode) {
            setGenerationMode(initialMode);
        }
    }, [initialMode, setGenerationMode]);

    // P0 FIX: Restore canvas editor when returning to Studio
    // If the store still has a selectedItem from before navigation, re-open the editor.
    // This prevents the "state lost" feeling when users navigate away and come back.
    useEffect(() => {
        if (selectedItem && viewMode !== 'editor') {
            setViewMode('editor');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally only on mount
    }, []);

    const prevGenerationMode = useRef(generationMode);

    useEffect(() => {
        useStore.setState({ isAgentOpen: false });
        
        if (generationMode !== prevGenerationMode.current) {
            if (generationMode === 'video') {
                // Allow navigating to editor to pick assets even while in video mode
                if (viewMode !== 'editor' && viewMode !== 'video_production' && viewMode !== 'direct' && viewMode !== 'omni') {
                    setViewMode('video_production');
                }
            } else if (viewMode === 'video_production') {
                // If we switched OUT of video mode, go back to direct generation
                setViewMode('direct');
            }
            prevGenerationMode.current = generationMode;
        }
    }, [generationMode, viewMode, setViewMode]);

    // Handle Pending Prompt for Image Mode
    useEffect(() => {
        if (pendingPrompt && generationMode === 'image') {
            const { setIsGenerating } = useStore.getState();
            setPrompt(pendingPrompt);
            setPendingPrompt(null);

            // Trigger Image Generation
            const generateImage = async () => {
                const isCoverArt = studioControls.isCoverArtMode;
                const isPLP = studioControls.isPLPMode;

                setIsGenerating(true);
                toast.info(isPLP ? "Deploying PLP 15-Variant Pipeline..." : isCoverArt ? "Generating cover art..." : "Generating image...");

                try {
                    const { ImageGeneration } = await import('@/services/image/ImageGenerationService');

                    // Synthesize prompt and get source images for Whisk
                    const finalPrompt = WhiskService.synthesizeWhiskPrompt(pendingPrompt, whiskState);
                    const sourceImages = await WhiskService.getSourceMedia(whiskState);

                    if (isPLP) {
                        const { VideoGeneration } = await import('@/services/video/VideoGenerationService');
                        // Hold every result to the project that explicitly started this batch.
                        // A view/project switch while video jobs are pending must not refile
                        // their output into the newly active project.
                        const plpProjectId = currentProjectId;
                        const batchId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                            ? crypto.randomUUID()
                            : `plp_${Date.now()}_${secureRandomAlphanumeric(16)}`;
                        const initialBatch = createPlpBatch(batchId, plpProjectId, pendingPrompt);
                        plpBatchRef.current = initialBatch;
                        setPlpBatch(initialBatch);
                        plpRetryHandlersRef.current.clear();
                        plpRetryInFlightRef.current.clear();
                        acceptedPlpSlotsRef.current.clear();
                        plpLaunchInFlightRef.current = false;

                        const runSlot = async (index: number, isRetry: boolean): Promise<boolean> => {
                            if (isRetry) {
                                mutatePlpBatch(batch => batch.id === batchId ? retryPlpSlot(batch, index) : batch);
                            }

                            try {
                                let item: PlpVariantResult | undefined;
                                if (index < 10) {
                                    item = (await ImageGeneration.generateImages({
                                        prompt: `${finalPrompt}, variant iteration ${index + 1}, varied composition`,
                                        count: 1,
                                        resolution: studioControls.resolution,
                                        aspectRatio: studioControls.aspectRatio,
                                        negativePrompt: studioControls.negativePrompt,
                                        personGeneration: PERSON_GEN_API_MAP[studioControls.personGeneration] ?? 'ALLOW_ADULT',
                                        sourceImages,
                                        model: studioControls.model,
                                        thinkingLevel: studioControls.thinkingLevel === 'none' ? undefined : studioControls.thinkingLevel,
                                        useGrounding: studioControls.useGrounding,
                                        sessionId: plpProjectId ? `creative_${plpProjectId}` : undefined,
                                    }))[0];
                                } else {
                                    const videoIndex = index - 10;
                                    item = (await awaitCompletedPlpVideoVariant(() => VideoGeneration.generateVideo({
                                        prompt: `${finalPrompt}, cinematic motion variant ${videoIndex + 1}`,
                                        resolution: studioControls.resolution,
                                        aspectRatio: ['9:16', '10:16', '9:21', '3:4'].includes(studioControls.aspectRatio) ? '9:16' : '16:9',
                                        duration: 4,
                                        cameraMovement: 'Dynamic',
                                        motionStrength: 0.8,
                                        model: studioControls.model,
                                        referenceImages: (characterReferences || []).map(ref => {
                                            let bytes = ref.image.url;
                                            const commaIndex = bytes.indexOf(',');
                                            if (bytes.startsWith('data:') && commaIndex !== -1) {
                                                bytes = bytes.substring(commaIndex + 1);
                                            }
                                            return {
                                                image: { imageBytes: bytes, mimeType: 'image/jpeg' },
                                                referenceType: 'asset' as const
                                            };
                                        })
                                    }), (jobId) => VideoGeneration.waitForJob(jobId), token => {
                                        mutatePlpBatch(batch => batch.id === batchId ? queuePlpSlot(batch, index, token.id) : batch);
                                    }))[0];
                                }

                                if (!item?.id || !item.url) {
                                    throw new Error(`${index < 10 ? 'Image' : 'Video'} variant completed without a playable asset.`);
                                }

                                const slotKey = `${batchId}:${index}`;
                                if (acceptedPlpSlotsRef.current.has(slotKey)) return true;
                                acceptedPlpSlotsRef.current.add(slotKey);
                                mutatePlpBatch(batch => batch.id === batchId ? completePlpSlot(batch, index, item!) : batch);
                                addToHistory({
                                    id: item.id,
                                    url: item.url,
                                    prompt: pendingPrompt,
                                    type: index < 10 ? 'image' : 'video',
                                    timestamp: Date.now(),
                                    projectId: plpProjectId,
                                    origin: 'generated'
                                });
                                return true;
                            } catch (error: unknown) {
                                const message = error instanceof Error ? error.message : 'Variant generation failed.';
                                logger.warn(`[PLP] Variant ${index + 1} failed:`, error);
                                mutatePlpBatch(batch => batch.id === batchId ? failPlpSlot(batch, index, message) : batch);
                                return false;
                            }
                        };

                        const initialRuns = Array.from({ length: 15 }, (_, index) => {
                            plpRetryHandlersRef.current.set(index, () => runSlot(index, true).then(() => undefined));
                            return runSlot(index, false);
                        });
                        const outcomes = await Promise.all(initialRuns);
                        const successCount = outcomes.filter(Boolean).length;
                        const failedCount = outcomes.length - successCount;

                        if (successCount > 0) {
                            toast.success(`PLP: ${successCount} completed, ${failedCount} failed. Review the batch before launch.`);
                            if (useStore.getState().currentProjectId !== plpProjectId) {
                                toast.warning('PLP variants were saved to the project that started this batch. Switch back to review them before launch.');
                            }
                        } else {
                            toast.error('PLP pipeline failed: 0 variants generated. Retry failed slots from the batch panel.');
                        }

                    } else {
                        // Original Single Generation
                        const results = await ImageGeneration.generateImages({
                            prompt: finalPrompt,
                            count: 1,
                            resolution: studioControls.resolution,
                            aspectRatio: isCoverArt ? '1:1' : studioControls.aspectRatio,
                            negativePrompt: studioControls.negativePrompt,
                            personGeneration: PERSON_GEN_API_MAP[studioControls.personGeneration] ?? 'ALLOW_ADULT',
                            sourceImages: sourceImages,
                            // Pass distributor context for cover art mode
                            userProfile: isCoverArt ? userProfile : undefined,
                            isCoverArt,
                            // Gemini 3 Params
                            model: studioControls.model,
                            thinkingLevel: studioControls.thinkingLevel === 'none' ? undefined : studioControls.thinkingLevel,
                            useGrounding: studioControls.useGrounding,
                            sessionId: currentProjectId ? `creative_${currentProjectId}` : undefined,
                        });

                        if (results.length > 0) {
                            // ISSUE-1007: measure and validate the actual
                            // output against distributor requirements
                            // instead of trusting the requested aspect
                            // ratio/resolution and declaring success blind.
                            const measured = await Promise.all(results.map(async res => {
                                if (!isCoverArt || !userProfile) return { res, compliance: undefined };
                                try {
                                    return { res, compliance: await measureCoverArt(res.url, userProfile) };
                                } catch (dimErr: unknown) {
                                    logger.warn('[CreativeStudio] Could not measure cover art dimensions for compliance check', dimErr);
                                    // Release artwork is only compliant after the delivered file has
                                    // been measured. Treating an unreadable URL as "no result" let
                                    // the success branch call it distributor-ready without evidence.
                                    return {
                                        res,
                                        compliance: {
                                            valid: false,
                                            errors: ['Could not verify the generated file dimensions. Download or re-export the artwork before attaching it to a release.'],
                                            warnings: [],
                                            measuredWidth: 0,
                                            measuredHeight: 0,
                                        },
                                    };
                                }
                            }));

                            measured.forEach(({ res, compliance }) => {
                                addToHistory({
                                    id: res.id,
                                    url: res.url,
                                    prompt: pendingPrompt, // Store user's original prompt in history for clarity
                                    type: 'image',
                                    timestamp: Date.now(),
                                    projectId: currentProjectId,
                                    origin: 'generated',
                                    ...(isCoverArt ? {
                                        generationProvenance: {
                                            provider: 'google',
                                            model: studioControls.model,
                                        },
                                    } : {}),
                                    ...(compliance && { distributorCompliance: compliance })
                                });
                            });

                            if (isCoverArt) {
                                const nonCompliant = measured.find(m => m.compliance && !m.compliance.valid);
                                if (nonCompliant?.compliance) {
                                    toast.error(`Cover art does not meet distributor requirements: ${nonCompliant.compliance.errors.join('; ')}`);
                                } else {
                                    toast.success("Cover art generated and meets distributor size requirements.");
                                }
                            } else {
                                toast.success("Image generated!");
                            }
                        } else {
                            toast.error("Generation returned no images. Please try again.");
                        }
                    }
                } catch (e: unknown) {
                    logger.error("[CreativeStudio] Image generation error:", e);
                    const isQuota = e instanceof Error && (e.name === 'QuotaExceededError' || ('code' in e && (e as { code?: string }).code === 'QUOTA_EXCEEDED'));
                    if (isQuota) {
                        toast.error(e instanceof Error ? e.message : 'Quota exceeded. Please upgrade.');
                    } else {
                        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
                        toast.error(`Image generation failed: ${errorMsg}`);
                    }
                } finally {
                    setIsGenerating(false);
                }
            };
            generateImage();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingPrompt, generationMode, whiskState, setPrompt, setPendingPrompt, studioControls, addToHistory, currentProjectId, userProfile, toast]);

    return (
        <ModuleErrorBoundary moduleName="Studio">
            <div data-testid="creative-studio-container" className="flex flex-col h-full w-full bg-background selection:bg-dept-creative/30">
                <CreativeNavbar data-testid="creative-navbar" />

                {/* Mobile Tab Switcher */}
                <div className="md:hidden flex border-b border-white/10 bg-background shrink-0">
                    <button
                        onClick={() => setActiveMobileTab('controls')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileTab === 'controls' ? 'text-dept-creative border-b-2 border-dept-creative bg-white/5' : 'text-muted-foreground'}`}
                        data-testid="mobile-tab-controls"
                    >
                        Controls
                    </button>
                    <button
                        onClick={() => setActiveMobileTab('studio')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeMobileTab === 'studio' ? 'text-dept-creative border-b-2 border-dept-creative bg-white/5' : 'text-muted-foreground'}`}
                        data-testid="mobile-tab-studio"
                    >
                        Studio
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden relative">
                    <AdaptiveWorkspace contentClassName="relative">
                    {/* Mobile Controls Tab Content */}
                    <div className={`${activeMobileTab === 'controls' ? 'flex' : 'hidden'} md:hidden flex-1 flex-col overflow-y-auto bg-[#0f0f0f]`}>
                        <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading controls...</div>}>
                            <StudioControlsPanel toggleRightPanel={() => setActiveMobileTab('studio')} />
                        </Suspense>
                    </div>

                    {/* Main Workspace - Studio Tab on Mobile, always visible on desktop */}
                    <div className={`${activeMobileTab === 'studio' ? 'flex' : 'hidden'} md:flex flex-1 flex-col relative min-w-0 bg-[#0f0f0f]`}>
                        {chatImportContext && (
                            <div className="bg-dept-creative/20 text-white text-sm px-4 py-2 flex items-center justify-between border-b border-dept-creative/30 z-[110] relative">
                                <span>Imported from chat — {chatImportContext.agentId}'s response to: "{chatImportContext.prompt.substring(0, 50)}{chatImportContext.prompt.length > 50 ? '...' : ''}"</span>
                                <button onClick={clearChatImportContext} className="text-gray-400 hover:text-white">&times;</button>
                            </div>
                        )}

                        {plpBatch && (
                            <PlpBatchStatus
                                batch={plpBatch}
                                isProjectActive={currentProjectId === plpBatch.projectId}
                                onRetry={handleRetryPlpSlot}
                                onLaunch={handleLaunchPlpBatch}
                            />
                        )}
                        
                        {/* Always mount InfiniteCanvas as the unified base layer */}
                        <div className="absolute inset-0 z-0">
                            <InfiniteCanvas />
                            {(canvasImages?.length || 0) === 0 && viewMode === 'canvas' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center bg-black/40 backdrop-blur-sm rounded-lg p-8 max-w-md">
                                        <Sparkles className="w-12 h-12 mx-auto mb-4 text-blue-400 opacity-80" />
                                        <h2 className="text-white text-lg font-semibold mb-2">Create Your First Image</h2>
                                        <p className="text-gray-300 text-sm mb-4">
                                            Start by generating an image with a prompt, or upload your own photo to edit.
                                        </p>
                                        <p className="text-gray-400 text-xs">
                                            Use the toolbar at the bottom to generate, upload, or browse your project's assets.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Floating Mode Picker */}
                        <CanvasModePicker />

                        {/* Mode overlays only exist while a visible overlay mode is active.
                            Leaving an empty pointer-enabled layer mounted here blocks the
                            canvas and every control inside its z-0 stacking context. */}
                        {hasModeOverlay && (
                            <div
                                className="absolute inset-0 z-10 pointer-events-none"
                                data-testid="creative-mode-overlay"
                            >
                                <div className="w-full h-full pointer-events-auto">
                                    {viewMode === 'direct' && <DirectGenerationTab />}
                                    {viewMode === 'video_production' && <VideoWorkflow />}
                                    {viewMode === 'omni' && <OmniWorkflow />}
                                    {viewMode === 'showroom' && <ShowroomUI />}
                                    {viewMode === "lab" && <AutonomousLab />}
                                </div>
                            </div>
                        )}

                        {/* Legacy Editor Modal Overlay */}
                            <CreativeCanvas
                                item={selectedItem}
                                onClose={() => {
                                    setSelectedItem(null);
                                    setViewMode(generationMode === 'video' ? 'video_production' : 'direct');
                                }}
                                onSendToWorkflow={async (type, item) => {
                                    const { setVideoInput, setGenerationMode, setViewMode, setSelectedItem } = useStore.getState();

                                    const confirmed = await ConfirmDialog.call({
                                        title: 'Send to Video Editor?',
                                        message: `You are about to hand off this image to the Video Editor as the ${type === 'firstFrame' ? 'Start' : 'End'} Frame. This will switch your workspace to Video Production mode.`,
                                        confirmText: 'Yes, Send to Video',
                                        cancelText: 'Cancel'
                                    });

                                    if (confirmed) {
                                        setVideoInput(type, item);
                                        setGenerationMode('video');
                                        setViewMode('video_production');
                                        setSelectedItem(null);
                                        toast.success(`Set as ${type === 'firstFrame' ? 'Start' : 'End'} Frame`);
                                    }
                                }}
                            />
                    </div>
                    </AdaptiveWorkspace>
                </div>

                {/* Main Prompt Bar Removed - Using Global CommandBar */}

                {/* Visual Clipboard Dock */}
                <CreativeClipboard />

                {/* Transitions handled via viewMode === 'editor' above */}
            </div>
        </ModuleErrorBoundary>
    );
}
