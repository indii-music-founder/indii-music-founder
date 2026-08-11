import { logger } from '@/utils/logger';
import { VideoAspectRatioSchema } from '@/modules/creative/video/schemas';

import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { projectBucketMatches } from '@/core/constants';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './store/videoEditorStore';
import { VideoGeneration } from "@/services/video/VideoGenerationService";
import { WhiskService } from "@/services/WhiskService";
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/services/firebase';
import { materializeVideoFrameForHandoff } from '@/services/creative/CreativeMediaHandoffService';
import { creativeAssetPayloadToHistoryItem, readCreativeAssetDrag, writeCreativeAssetDrag } from '@/services/creative/CreativeAssetDragService';
import { Layout, Settings, Shuffle, ChevronDown, ChevronUp, Hash, Music, Trash2, Layers, Film, Send } from 'lucide-react';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { StoryboardTimeline } from './components/StoryboardTimeline';
import { SessionIngestionPanel } from './components/SessionIngestionPanel';

import { IntelligencePromptInput } from '../components/veo/IntelligencePromptInput';
import { DailiesStrip } from './components/DailiesStrip';
import { VideoStage } from './components/VideoStage';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { resolveStorageUri } from '@/services/storage/storageUri';
// Lazy load SceneBuilder to prevent vendor-three → vendor-react circular dependency
const SceneBuilder = lazy(() => import('./visualizer/SceneBuilder').then(m => ({ default: m.SceneBuilder })));
import { useToast, ToastContextType } from '@/core/context/ToastContext';
import { useOptionalAdaptiveWorkspace } from '@/components/layout/AdaptiveWorkspaceContext';

/** Valid job status values for video generation */
export type JobStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'stitching' | 'cancelled';

/** Data shape from Firestore video job listener */
export interface VideoJobUpdateData {
    status?: string;
    progress?: number;
    videoUrl?: string;
    prompt?: string;
    stitchError?: string;
    metadata?: Record<string, unknown>;
    directorSettings?: Record<string, unknown>;
    inputUris?: string[];
    firstFrameUri?: string;
    lastFrameUri?: string;
    output?: {
        url?: string;
        metadata?: Record<string, unknown>;
    };
}

function extractVideoAnchorUris(source: {
    directorSettings?: unknown;
    inputUris?: unknown;
    firstFrameUri?: unknown;
    lastFrameUri?: unknown;
} | null | undefined): {
    directorSettings?: Record<string, unknown>;
    firstFrameUri?: string;
    lastFrameUri?: string;
} {
    const directorSettings = source?.directorSettings && typeof source.directorSettings === 'object' && !Array.isArray(source.directorSettings)
        ? source.directorSettings as Record<string, unknown>
        : undefined;
    const inputUris = Array.isArray(source?.inputUris) ? source.inputUris : [];

    const firstFrameUri = typeof directorSettings?.firstFrameUri === 'string'
        ? directorSettings.firstFrameUri
        : typeof source?.firstFrameUri === 'string'
            ? source.firstFrameUri
            : typeof inputUris[0] === 'string'
                ? inputUris[0]
                : undefined;

    const lastFrameUri = typeof directorSettings?.lastFrameUri === 'string'
        ? directorSettings.lastFrameUri
        : typeof source?.lastFrameUri === 'string'
            ? source.lastFrameUri
            : typeof inputUris[1] === 'string'
                ? inputUris[1]
                : undefined;

    return {
        directorSettings,
        firstFrameUri,
        lastFrameUri,
    };
}

// Lazy load the heavy Editor
const VideoEditor = React.lazy(() => import('./editor/VideoEditor').then(module => ({ default: module.VideoEditor })));

// eslint-disable-next-line react-refresh/only-export-components
export const processJobUpdate = async (
    data: VideoJobUpdateData | null,
    currentJobId: string,
    deps: {
        currentProjectId: string | null,
        currentOrganizationId: string | undefined,
        localPrompt: string,
        addToHistory: (item: HistoryItem) => void,
        updateHistoryItem: (id: string, updates: Partial<HistoryItem>) => void,
        setActiveVideo: (item: HistoryItem) => void,
        setJobId: (id: string | null) => void,
        setJobStatus: (status: JobStatus) => void,
        setJobProgress: (progress: number) => void,
        toast: ToastContextType,
        resetEditorProgress: () => void,
        getCurrentStatus: () => JobStatus
    }
) => {
    if (data) {
        const newStatus = data.status;

        // Check current status to avoid unnecessary updates
        const currentStatus = deps.getCurrentStatus();
        if (newStatus && newStatus !== currentStatus) {
            // Type guard for valid job statuses
            const validStatuses: JobStatus[] = ['idle', 'queued', 'processing', 'completed', 'failed', 'stitching', 'cancelled'];
            if (validStatuses.includes(newStatus as JobStatus)) {
                deps.setJobStatus(newStatus as JobStatus);
            }
        }

        if (data.progress !== undefined) {
            deps.setJobProgress(data.progress);
            useStore.getState().updateJobProgress(currentJobId, data.progress);
        }

        if (newStatus === 'completed' && (data.videoUrl || data.output?.url)) {
            useStore.getState().updateJobStatus(currentJobId, 'success');
            const rawVideoUrl = data.videoUrl || data.output?.url || '';
            const playableVideoUrl = await resolveStorageUrl(rawVideoUrl);
            const storageUri = resolveStorageUri(rawVideoUrl);
            // ⚡ Automatic Local Save (Veo 3.1 Requirement)
            // The Autonomous community/app needs access to this file locally first.
            const filename = `veo_${currentJobId}.mp4`;

            // Trigger background download via Electron
            // We don't await this to avoid blocking the UI update, but we log it
            if (window.electronAPI?.video?.saveAsset) {
                window.electronAPI.video.saveAsset(playableVideoUrl, filename)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .then((path: any) => {
                        logger.debug('Video saved locally to:', path);
                        deps.updateHistoryItem(currentJobId, { localPath: path });
                    })
                    .catch((err: unknown) => {
                        logger.error('Failed to save to local folder:', err);
                        deps.toast.error('Failed to save video to local disk.');
                    });
            }

            const metadata = data.output?.metadata || data.metadata;
            const anchorUris = extractVideoAnchorUris(data);
            const normalizedMetadata = metadata ? { ...metadata } : undefined;

            if (normalizedMetadata) {
                if (anchorUris.directorSettings) {
                    normalizedMetadata.directorSettings = anchorUris.directorSettings;
                }
                if (anchorUris.firstFrameUri) {
                    normalizedMetadata.firstFrameUri = anchorUris.firstFrameUri;
                }
                if (anchorUris.lastFrameUri) {
                    normalizedMetadata.lastFrameUri = anchorUris.lastFrameUri;
                }
                if (Array.isArray(data.inputUris) && data.inputUris.length > 0) {
                    normalizedMetadata.inputUris = data.inputUris;
                }
            }

            const newAsset = {
                id: currentJobId,
                url: playableVideoUrl,
                storageUri,
                localPath: '', // Will be updated async
                prompt: data.prompt || deps.localPrompt,
                type: 'video' as const,
                timestamp: Date.now(),
                projectId: deps.currentProjectId || 'default',
                orgId: deps.currentOrganizationId,
                meta: normalizedMetadata ? JSON.stringify(normalizedMetadata) : undefined
            };
            deps.addToHistory(newAsset);
            deps.setActiveVideo(newAsset);
            deps.toast.success('Scene generated!');
            deps.setJobId(null);
            deps.setJobStatus('idle');
            deps.resetEditorProgress();
        } else if (newStatus === 'failed') {
            useStore.getState().updateJobStatus(currentJobId, 'error', data.stitchError || 'Generation failed');
            deps.toast.error(data.stitchError ? `Stitching failed: ${data.stitchError}` : 'Generation failed');
            deps.setJobId(null);
            deps.setJobStatus('failed');
            deps.resetEditorProgress();
        } else if (newStatus === 'cancelled') {
            useStore.getState().updateJobStatus(currentJobId, 'cancelled', data.stitchError || 'Generation cancelled');
            deps.toast.info('Generation cancelled.');
            deps.setJobId(null);
            deps.setJobStatus('cancelled');
            deps.resetEditorProgress();
        }
    }
}

export default function VideoWorkflow() {
    const workspaceMode = useOptionalAdaptiveWorkspace()?.mode ?? 'wide';
    // Global State
    // ⚡ Bolt Optimization: Use useShallow to prevent re-renders on unrelated store updates (like prompt keystrokes)
    const {
        generatedHistory,
        addToHistory,
        updateHistoryItem,
        creativePrompt,
        setCreativePrompt,
        studioControls,
        currentProjectId,
        videoInputs,
        currentOrganizationId,
        pendingPrompt,
        setPendingPrompt,
        selectedItem,
        setVideoInputs,
        whiskState,
        characterReferences,
        setStudioControls,
        isRightPanelOpen,
        toggleRightPanel,
        isPromptBuilderOpen,
        togglePromptBuilder,
        pendingStageHandoff,
        consumeStageHandoff,
        addCharacterReference,
        sendToStage
    } = useStore(useShallow((state: import('@/core/store').StoreState) => ({
        generatedHistory: state.generatedHistory,
        addToHistory: state.addToHistory,
        updateHistoryItem: state.updateHistoryItem,
        creativePrompt: state.creativePrompt,
        setCreativePrompt: state.setCreativePrompt,
        studioControls: state.studioControls,
        currentProjectId: state.currentProjectId,
        videoInputs: state.videoInputs,
        currentOrganizationId: state.currentOrganizationId,
        pendingPrompt: state.pendingPrompt,
        setPendingPrompt: state.setPendingPrompt,
        selectedItem: state.selectedItem,
        setVideoInputs: state.setVideoInputs,
        whiskState: state.whiskState,
        characterReferences: state.characterReferences,
        setStudioControls: state.setStudioControls,
        isRightPanelOpen: state.isRightPanelOpen,
        toggleRightPanel: state.toggleRightPanel,
        isPromptBuilderOpen: state.isPromptBuilderOpen,
        togglePromptBuilder: state.togglePromptBuilder,
        pendingStageHandoff: state.pendingStageHandoff,
        consumeStageHandoff: state.consumeStageHandoff,
        addCharacterReference: state.addCharacterReference,
        sendToStage: state.sendToStage
    })));

    // Editor Store
    const {
        viewMode,
        setViewMode,
        jobId,
        setJobId,
        status: jobStatus,
        setStatus: setJobStatus,
        progress: jobProgress,
        setProgress: setJobProgress
    } = useVideoEditorStore(useShallow(state => ({
        viewMode: state.viewMode,
        setViewMode: state.setViewMode,
        jobId: state.jobId,
        setJobId: state.setJobId,
        status: state.status,
        setStatus: state.setStatus,
        progress: state.progress,
        setProgress: state.setProgress
    })));

    const toast = useToast();

    // View State: 'director' (Generation) or 'editor' (Timeline)
    const [localPrompt, setLocalPrompt] = useState(creativePrompt ?? '');
    const localPromptRef = useRef(localPrompt);

    // Keep ref in sync
    useEffect(() => { localPromptRef.current = localPrompt; }, [localPrompt]);

    // Director State
    const [activeVideo, setActiveVideo] = useState<HistoryItem | null>(null);
    const [sourceJobId, setSourceJobId] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const randomizeSeed = useCallback(() => {
        const rand = () => {
            const randValues = new Uint32Array(1);
            crypto.getRandomValues(randValues);
            return (randValues[0] ?? 0) / 4294967295;
        };
        const newSeed = Math.floor(rand() * 2147483647).toString();
        setStudioControls({ seed: newSeed });
    }, [setStudioControls]);

    // Stable handler for drag start
    const handleDragStart = React.useCallback((e: React.DragEvent, item: HistoryItem) => {
        writeCreativeAssetDrag(e.dataTransfer, item, 'veo-dailies');
    }, []);

    const handleCreativeAssetDrop = React.useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const payload = readCreativeAssetDrag(event.dataTransfer);
        if (!payload) return;
        const item = creativeAssetPayloadToHistoryItem(payload);

        try {
            if (item?.type === 'image') {
                if (!videoInputs.firstFrame) {
                    setVideoInputs({ firstFrame: item });
                    toast.success('Dropped image set as Veo’s first frame.');
                } else if (!videoInputs.lastFrame) {
                    setVideoInputs({ lastFrame: item });
                    toast.success('Dropped image set as Veo’s last frame.');
                } else {
                    addCharacterReference({
                        image: item,
                        referenceType: 'reference',
                        name: item.prompt || payload.asset.name,
                    });
                    toast.success('Dropped image added as a Veo visual reference.');
                }
                return;
            }

            if (item?.type === 'video') {
                const userId = auth.currentUser?.uid;
                if (!userId) throw new Error('Sign in before creating a Veo continuity frame.');
                setActiveVideo(item);
                setSourceJobId(item.id);
                const continuityFrame = await materializeVideoFrameForHandoff(item, 'last', {
                    userId,
                    projectId: currentProjectId || item.projectId || undefined,
                });
                setVideoInputs({ firstFrame: continuityFrame, lastFrame: null });
                toast.success('Dropped video loaded; its last frame starts the next Veo shot.');
                return;
            }

            if (item?.type === 'music') {
                useVideoEditorStore.getState().setInputAudio(item.url);
                toast.success('Dropped audio attached to the Veo shot.');
                return;
            }

            toast.info(`${payload.asset.name} cannot be used by Veo yet.`);
        } catch (error) {
            logger.error('[veo-drop] Failed to prepare dropped asset', error);
            toast.error(error instanceof Error ? error.message : 'Failed to prepare the dropped asset for Veo.');
        }
    }, [addCharacterReference, currentProjectId, setVideoInputs, toast, videoInputs.firstFrame, videoInputs.lastFrame]);

    // ⚡ Bolt Optimization: Memoize filtered video list to prevent DailiesStrip re-renders
    const videoHistory = useMemo(() => {
        return generatedHistory.filter(h => h.type === 'video' && (!currentProjectId || projectBucketMatches(h.projectId, currentProjectId)));
    }, [generatedHistory, currentProjectId]);

    // Sync pending prompt
    useEffect(() => {
        if (pendingPrompt) {
            setLocalPrompt(pendingPrompt);
            setCreativePrompt(pendingPrompt);

            setPendingPrompt(null);
        }
    }, [pendingPrompt, setCreativePrompt, setPendingPrompt]);

    // Consume cross-stage handoff for Veo. A video sent from Omni (or the
    // gallery) is loaded as the active source and its last frame is persisted
    // as Veo's first frame. Veo only extends Veo-generated provider outputs,
    // so frame continuity is the supported bridge for arbitrary/Omni videos.
    useEffect(() => {
        const handoff = pendingStageHandoff?.veo;
        if (!handoff) return;

        consumeStageHandoff('veo');
        let cancelled = false;

        const receiveAsset = async () => {
            const { item, role } = handoff;

            try {
                if (role === 'reference-image' && item.type === 'image') {
                    addCharacterReference({
                        image: item,
                        referenceType: 'reference',
                        name: item.prompt || 'Reference Image'
                    });
                    toast.success('Reference image received in Veo');
                    return;
                }

                if (role === 'source-video' && item.type === 'video') {
                    setActiveVideo(item);
                    setSourceJobId(item.id);
                    const userId = auth.currentUser?.uid;
                    if (!userId) throw new Error('Sign in before creating a Veo continuity frame.');
                    const firstFrame = await materializeVideoFrameForHandoff(item, 'last', {
                        userId,
                        projectId: currentProjectId || item.projectId || undefined,
                    });
                    if (cancelled) return;
                    setVideoInputs({ firstFrame, lastFrame: null });
                    toast.success('Video loaded in Veo with its last frame ready for continuation');
                    return;
                }

                if ((role === 'first-frame' || role === 'last-frame') && (item.type === 'image' || item.type === 'video')) {
                    const slot = role === 'first-frame' ? 'firstFrame' : 'lastFrame';
                    let frame = item;
                    if (item.type === 'video') {
                        const userId = auth.currentUser?.uid;
                        if (!userId) throw new Error('Sign in before extracting a video frame.');
                        frame = await materializeVideoFrameForHandoff(
                            item,
                            role === 'first-frame' ? 'first' : 'last',
                            {
                                userId,
                                projectId: currentProjectId || item.projectId || undefined,
                            },
                        );
                    }
                    if (cancelled) return;
                    setVideoInputs({ [slot]: frame });
                    setSourceJobId(item.id);
                    toast.success(`${role === 'first-frame' ? 'First' : 'Last'} frame received in Veo`);
                    return;
                }

                logger.warn('[veo-handoff] Unsupported asset/role combination', { role, type: item.type });
                toast.error('That asset cannot be used by Veo in the selected role.');
            } catch (error) {
                if (cancelled) return;
                logger.error('[veo-handoff] Failed to prepare handoff', error);
                toast.error(error instanceof Error ? error.message : 'Failed to prepare the asset for Veo.');
            }
        };

        void receiveAsset();
        return () => { cancelled = true; };
    }, [pendingStageHandoff?.veo, setVideoInputs, consumeStageHandoff, addCharacterReference, toast, currentProjectId]);

    // The editor is a first-class destination. Route the original durable
    // video into the timeline instead of regenerating or re-uploading it.
    useEffect(() => {
        const handoff = pendingStageHandoff?.editor;
        if (!handoff) return;

        consumeStageHandoff('editor');
        if (handoff.item.type !== 'video' && handoff.item.type !== 'image') {
            toast.error('Only video or image assets can be opened in the timeline editor.');
            return;
        }

        setActiveVideo(handoff.item);
        setSourceJobId(handoff.item.id);
        setViewMode('editor');
        toast.success(`Opened ${handoff.originStage} asset in the timeline editor`);
    }, [pendingStageHandoff?.editor, consumeStageHandoff, setViewMode, toast]);

    // Keyboard Shortcut for Mode Toggle
    useGlobalShortcut({
        id: 'video-mode-toggle',
        key: 'e',
        meta: true,
        ignoreInput: true,
        priority: 'normal',
        handler: (e) => {
            e.preventDefault();
            setViewMode(viewMode === 'director' ? 'editor' : 'director');
            toast.info(`Switched to ${viewMode === 'director' ? 'Editor' : 'Director'} Mode`);
        }
    }, [viewMode, setViewMode, toast]);

    useGlobalShortcut({
        id: 'video-mode-toggle-ctrl',
        key: 'e',
        ctrl: true,
        ignoreInput: true,
        priority: 'normal',
        handler: (e) => {
            e.preventDefault();
            setViewMode(viewMode === 'director' ? 'editor' : 'director');
            toast.info(`Switched to ${viewMode === 'director' ? 'Editor' : 'Director'} Mode`);
        }
    }, [viewMode, setViewMode, toast]);

    // Optimize screen real-estate based on mode
    useEffect(() => {
        if (viewMode === 'editor' && isRightPanelOpen) {
            toggleRightPanel(); // Close right panel in editor mode to prevent squishing
        } else if (viewMode === 'director' && !isRightPanelOpen) {
            toggleRightPanel(); // Re-open in director mode for VEO controls
        }
    }, [viewMode, isRightPanelOpen, toggleRightPanel]);

    // Set initial active video
    useEffect(() => {
        if (selectedItem?.type === 'video') {
            setActiveVideo(selectedItem);
        } else if (generatedHistory.length > 0 && !activeVideo) {
            // Find most recent video, strictly prioritizing durable https URLs over ephemeral blobs
            // to prevent console transport errors when initializing with dead blobs from past sessions.
            const validRecent = generatedHistory.find(
                h => h.type === 'video' &&
                    (!currentProjectId || projectBucketMatches(h.projectId, currentProjectId)) &&
                    !h.url.startsWith('blob:')
            );

            if (validRecent) setActiveVideo(validRecent);
        }
    }, [selectedItem, generatedHistory, activeVideo, currentProjectId]);

    useEffect(() => {
        if (!activeVideo || activeVideo.type !== 'video') return;

        if (!activeVideo.meta) {
            setVideoInputs({ firstFrame: null, lastFrame: null });
            return;
        }

        let cancelled = false;

        const restoreAnchors = async () => {
            try {
                const parsedMeta = JSON.parse(activeVideo.meta) as Record<string, unknown>;
                const anchorUris = extractVideoAnchorUris(parsedMeta);

                if (!anchorUris.firstFrameUri && !anchorUris.lastFrameUri) {
                    setVideoInputs({ firstFrame: null, lastFrame: null });
                    return;
                }

                const buildFrameItem = async (uri: string, slot: 'firstFrame' | 'lastFrame'): Promise<HistoryItem> => {
                    const resolvedUrl = await resolveStorageUrl(uri);

                    return {
                        id: `${activeVideo.id}-${slot}-frame`,
                        type: 'image',
                        url: resolvedUrl,
                        storageUri: uri,
                        prompt: `${slot === 'firstFrame' ? 'Start' : 'End'} frame from: ${activeVideo.prompt || 'video'}`,
                        timestamp: activeVideo.timestamp,
                        projectId: activeVideo.projectId,
                        orgId: activeVideo.orgId,
                        origin: activeVideo.origin || 'generated',
                        parentId: activeVideo.id,
                    };
                };

                const [firstFrame, lastFrame] = await Promise.all([
                    anchorUris.firstFrameUri ? buildFrameItem(anchorUris.firstFrameUri, 'firstFrame') : Promise.resolve(null),
                    anchorUris.lastFrameUri ? buildFrameItem(anchorUris.lastFrameUri, 'lastFrame') : Promise.resolve(null),
                ]);

                if (!cancelled) {
                    setVideoInputs({
                        firstFrame,
                        lastFrame,
                    });
                }
            } catch (error) {
                logger.debug('[VideoWorkflow] No stored keyframe anchors to restore', error);
            }
        };

        void restoreAnchors();

        return () => {
            cancelled = true;
        };
    }, [activeVideo, setVideoInputs]);

    // Job Listener
    useEffect(() => {
        if (!jobId) return;

        const unsubscribe = VideoGeneration.subscribeToJob(jobId, (data) => {
            void processJobUpdate(data, jobId, {
                currentProjectId,
                currentOrganizationId,
                localPrompt: localPromptRef.current,
                addToHistory,
                updateHistoryItem,
                setActiveVideo,
                setJobId,
                setJobStatus,
                setJobProgress: (p) => {
                    setTimeout(() => {
                        useVideoEditorStore.getState().setProgress(p);
                        setJobProgress(p);
                    }, 0); // H10 Fix: Avoid state cascade
                },
                toast,
                resetEditorProgress: () => {
                    setTimeout(() => useVideoEditorStore.getState().setProgress(0), 100); // H9 Fix: Delay reset
                },
                getCurrentStatus: () => useVideoEditorStore.getState().status
            });
        });

        return () => { if (unsubscribe) unsubscribe(); };
    }, [jobId, addToHistory, updateHistoryItem, toast, setJobId, setJobStatus, currentOrganizationId, currentProjectId, setActiveVideo, setJobProgress]);

    const handleGenerate = async (promptOverride?: string) => {
        setJobStatus('queued');
        const isTemporalInpaint = !!(videoInputs.isTemporalInpaint && videoInputs.maskFrame && activeVideo?.type === 'video');
        const isInterpolation = !isTemporalInpaint && !!(videoInputs.firstFrame && videoInputs.lastFrame);
        toast.info(
            isTemporalInpaint
                ? 'Queuing temporal inpaint...'
                : isInterpolation
                    ? 'Queuing interpolation...'
                    : 'Queuing scene generation...'
        );

        // ⚡ Bolt Optimization: Use prompt passed from child component (which has local state)
        // to avoid using stale state due to debounce, falling back to localPrompt.
        const promptToUse = promptOverride || localPrompt;

        // 🔍 Prompt Diagnostics — trace exactly which prompt is being sent
        logger.info('[VideoGeneration] Prompt selection:', {
            promptOverride: promptOverride ? `"${promptOverride.substring(0, 80)}..."` : '(none)',
            localPrompt: localPrompt ? `"${localPrompt.substring(0, 80)}..."` : '(empty)',
            globalPrompt: useStore.getState().prompt ? `"${useStore.getState().prompt.substring(0, 80)}..."` : '(empty)',
            selected: `"${promptToUse.substring(0, 80)}..."`,
        });

        try {
            // Update global prompt before generating
            setLocalPrompt(promptToUse);
            setCreativePrompt(promptToUse);
            if (promptOverride) setLocalPrompt(promptToUse); // Ensure local state matches

            // Synthesize prompt with Whisk references (SUBJECT, SCENE, STYLE, MOTION)
            let finalPrompt = WhiskService.synthesizeVideoPrompt(promptToUse, whiskState);

            if (isTemporalInpaint) {
                finalPrompt = `[TEMPORAL INPAINT MODE]: ${finalPrompt}. Preserve the video structure and replace the masked region only.`;
            }

            // 🧠 Thinking Mode: Incorporate advanced reasoning into the prompt for now
            // until a native 'thinking' parameter is supported for Veo models.
            if (studioControls.thinkingLevel !== 'none') {
                finalPrompt = `[Think CINEMATIC PHYSICS & CONTINUITY]: ${finalPrompt}`;
            }

            // 🔇 Audio Suppression: When generateAudio is disabled, append audio-muting
            // instructions. Veo 3.1 has no API-level audio toggle — this is a prompt-level
            // workaround recommended by the Google Autonomous community.
            let audioNegativePrompt = studioControls.negativePrompt;
            if (!studioControls.generateAudio) {
                const audioSuppression = '(no background music), (no dialogue), (no sound effects), (no audio), (silent video), (muted)';
                audioNegativePrompt = audioNegativePrompt
                    ? `${audioNegativePrompt}, ${audioSuppression}`
                    : audioSuppression;
                // Also add a soft directive to the main prompt
                finalPrompt = `${finalPrompt}. Generate this as a completely silent video with no audio track.`;
                logger.info('[VideoGeneration] 🔇 Audio suppression enabled — negative prompt augmented');
            }

            let results: { id: string; url: string; prompt: string; }[] = [];

            // Validate aspect ratio against the schema; fall back to '16:9' only for truly unsupported values.
            const validatedAR = VideoAspectRatioSchema.safeParse(studioControls.aspectRatio);
            const effectiveAspectRatio = validatedAR.success ? validatedAR.data : '16:9';

            // Combine character references and active Whisk references (max 3 items)
            // Upload Whisk source media to storage and convert to gs:// URIs
            const { auth } = await import('@/services/firebase');
            const { CreativeStorageService } = await import('@/services/creative/CreativeStorageService');
            const userId = auth.currentUser?.uid;

            const whiskMediaUris = userId
                ? (await Promise.all(
                      (await WhiskService.getSourceMedia(whiskState) || []).map(async w => {
                          try {
                              const dataUrl = `data:${w.mimeType};base64,${w.data}`;
                              return await CreativeStorageService.uploadReferenceMedia(userId, dataUrl, 'image', { scope: 'objects' });
                          } catch {
                              return undefined;
                          }
                      })
                  )).filter((uri): uri is string => !!uri)
                : [];

            const combinedReferenceImages = [
                ...(characterReferences || []).map(ref => ({
                    image: { uri: ref.image.url },
                    referenceType: 'asset' as const
                })),
                ...whiskMediaUris.map(uri => ({
                    image: { uri },
                    referenceType: 'asset' as const
                }))
            ].slice(0, 3);

            const sourceVideoUri = isTemporalInpaint ? (activeVideo?.storageUri || activeVideo?.url) : undefined;
            const maskFrameUri = isTemporalInpaint ? (videoInputs.maskFrame?.storageUri || videoInputs.maskFrame?.url) : undefined;
            const frameRange = isTemporalInpaint && videoInputs.maskRange
                ? videoInputs.maskRange
                : undefined;

            if (isTemporalInpaint && (!sourceVideoUri || !maskFrameUri)) {
                throw new Error('Temporal inpaint requires a selected video source and a captured mask frame.');
            }

            // Validate frame range for temporal inpaint: endFrame must be > startFrame (non-zero duration)
            if (isTemporalInpaint && frameRange && frameRange.endFrame <= frameRange.startFrame) {
                throw new Error(`Invalid temporal inpaint frame range: endFrame (${frameRange.endFrame}) must be > startFrame (${frameRange.startFrame}). Set Anchor and End frames at different times.`);
            }

            // Check for long-form Video (Daisy Chain or duration > 8s)
            if (!isTemporalInpaint && (studioControls.duration > 8 || videoInputs.isDaisyChain)) {
                results = await VideoGeneration.generateLongFormVideo({
                    prompt: finalPrompt,
                    totalDuration: Math.max(studioControls.duration, 8), // Ensure at least 1 block
                    aspectRatio: effectiveAspectRatio,
                    resolution: studioControls.resolution,
                    negativePrompt: audioNegativePrompt,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    firstFrame: videoInputs.firstFrame?.url,
                    // Audio suppression handled via prompt augmentation above
                    inputAudio: useVideoEditorStore.getState().inputAudio || undefined,
                    thinkingLevel: studioControls.thinkingLevel,
                    model: studioControls.model,
                    personGeneration: studioControls.personGeneration,
                    referenceImages: combinedReferenceImages,
                    onProgress: (current: number, total: number) => {
                        // Optional: Could wire this up to a local progress update if store supports it
                        logger.info(`Segment ${current}/${total}`);
                    }
                });
            } else {
                const directorFps = studioControls.fps || 24;
                const directorDuration = studioControls.duration || 6;
                const directorSettings = {
                    fps: directorFps,
                    durationSeconds: directorDuration,
                    totalFrames: Math.round(directorFps * directorDuration),
                    aspectRatio: effectiveAspectRatio,
                    resolution: studioControls.resolution,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    firstFrameUri: videoInputs.firstFrame?.url,
                    lastFrameUri: videoInputs.lastFrame?.url,
                    cameraMovement: studioControls.cameraMovement,
                    motionStrength: studioControls.motionStrength,
                };

                results = await VideoGeneration.generateVideo({
                    mode: isTemporalInpaint ? 'temporal_inpaint' : undefined,
                    prompt: finalPrompt,
                    resolution: studioControls.resolution,
                    aspectRatio: effectiveAspectRatio,
                    negativePrompt: audioNegativePrompt,
                    seed: studioControls.seed ? parseInt(studioControls.seed) : undefined,
                    fps: studioControls.fps,
                    cameraMovement: studioControls.cameraMovement,
                    motionStrength: studioControls.motionStrength,
                    shotList: studioControls.shotList,
                    firstFrame: videoInputs.firstFrame?.url,
                    lastFrame: videoInputs.lastFrame?.url,
                    sourceVideoUri,
                    maskFrameUri,
                    maskTrackUri: maskFrameUri,
                    frameRange,
                    timeOffset: videoInputs.timeOffset,
                    referenceImages: combinedReferenceImages,
                    personGeneration: studioControls.personGeneration,
                    orgId: currentOrganizationId,
                    duration: studioControls.duration,
                    durationSeconds: studioControls.duration,
                    directorSettings,
                    // Audio suppression handled via prompt augmentation above
                    inputAudio: useVideoEditorStore.getState().inputAudio || undefined,
                    thinkingLevel: studioControls.thinkingLevel,
                    model: studioControls.model,
                    useGrounding: studioControls.useGrounding,
                    parentId: sourceJobId || undefined
                });
            }

            if (results && results.length > 0) {
                const firstResult = results[0]!;

                // If the URL is provided immediately, complete it. Otherwise, set jobId to listen for updates.
                if (firstResult.url) {
                    for (const res of results) {
                        const filename = `veo_${res.id}.mp4`;
                        const storageUri = resolveStorageUri(res.url);
                        const playableUrl = await resolveStorageUrl(res.url);

                        if (window.electronAPI?.video?.saveAsset) {
                            (window.electronAPI.video.saveAsset(playableUrl, filename) as Promise<string>)
                                .then((path: string) => {
                                    logger.debug('Video saved locally to:', path);
                                    updateHistoryItem(res.id, { localPath: path });
                                })
                                .catch((err: unknown) => logger.error('Failed to save to local folder:', err));
                        }

                        const newAsset = {
                            id: res.id,
                            url: playableUrl,
                            storageUri: storageUri || undefined,
                            localPath: '', // Will be updated async
                            prompt: res.prompt,
                            type: 'video' as const,
                            timestamp: Date.now(),
                            projectId: currentProjectId
                        };
                        addToHistory(newAsset);
                        setActiveVideo(newAsset);
                    }
                    setJobStatus('completed');
                    toast.success('Scene generated!');
                } else {
                    // Start listening for the background job
                    setJobId(firstResult!.id);
                    setJobStatus('processing');
                    useStore.getState().addJob({
                        id: firstResult!.id,
                        title: `Generative Video: Rendering scene...`,
                        progress: 0,
                        status: 'running',
                        type: 'video_render'
                    });
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error("[VideoGeneration] handleGenerate() failed:", {
                errorMessage: message,
                errorType: error?.constructor?.name || 'unknown',
                errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
            });

            // Classify error for user-friendly messaging
            let userMessage = message;
            if (message.includes('safety filter') || message.includes('content policy') || message.includes('CONTENT_FILTERED')) {
                userMessage = `Safety filter: ${message}`;
            } else if (message.includes('timed out') || message.includes('TIMEOUT')) {
                userMessage = 'Video generation timed out. The API may be under heavy load — please try again.';
            } else if (message.includes('quota') || message.includes('Quota exceeded')) {
                userMessage = message; // Already user-friendly
            } else if (message.includes('circuit breaker') || message.includes('OPEN')) {
                userMessage = 'Service temporarily unavailable due to repeated errors. Please wait a moment and try again.';
            } else if (message.includes('400') || message.includes('INVALID_ARGUMENT')) {
                userMessage = `Invalid request: ${message}. Please check your settings and try again.`;
            } else if (message.includes('does not support temporal inpaint')) {
                // ISSUE-869: temporal inpaint is gated by a server feature flag with no
                // client-side mirror, so the UI can't know in advance it's disabled.
                userMessage = 'Temporal inpaint is not enabled on this server yet. Try Interpolation (first/last frame) or standard scene generation instead.';
            } else {
                userMessage = `Generation failed: ${message}`;
            }

            toast.error(userMessage);
            setJobStatus('failed');
        }
    };

    const handleCancelJob = useCallback(async () => {
        if (!jobId) return;
        try {
            const cancelVideoJob = httpsCallable(functions, 'cancelVideoJob');
            await cancelVideoJob({ jobId });
            setJobStatus('cancelled');
            setJobProgress(0);
            setJobId(null);
            toast.info('Video generation cancelled.');
        } catch (error: unknown) {
            logger.warn('[VideoWorkflow] Failed to cancel video job', error);
            toast.error(error instanceof Error ? error.message : 'Failed to cancel video generation.');
        }
    }, [jobId, setJobId, setJobProgress, setJobStatus, toast]);

    const estimatedCost = VideoGeneration.estimateVideoCost(studioControls.duration || 6, studioControls.model);

    const openSessionProxy = useCallback(async (session: import('@indii/shared').VideoSession) => {
        const proxy = session.proxyManifest?.proxy;
        if (!proxy) {
            toast.error('This session does not have a completed proxy manifest.');
            return;
        }
        const storageUri = `gs://${proxy.bucket}/${proxy.path}`;
        const url = await resolveStorageUrl(storageUri);
        const item: HistoryItem = {
            id: session.sessionId,
            url,
            storageUri,
            localPath: '',
            prompt: 'Long recording edit proxy',
            type: 'video',
            timestamp: Date.now(),
            projectId: session.projectId,
            orgId: session.organizationId,
        };
        addToHistory(item);
        setActiveVideo(item);
        setViewMode('editor');
    }, [addToHistory, setActiveVideo, setViewMode, toast]);

    return (
        <div
            className="flex-1 flex min-h-0 min-w-0 overflow-hidden h-full bg-background relative"
            data-testid="video-workflow-workspace"
            data-workspace-mode={workspaceMode}
        >
            {/* Main Stage (Director View) */}
            <div
                id="director-panel"
                role="tabpanel"
                aria-label="Director Mode"
                className={`flex-1 flex flex-col relative transition-all duration-500 ${viewMode === 'director' ? 'opacity-100 z-10' : 'opacity-0 z-0 hidden'}`}
                onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(event) => { void handleCreativeAssetDrop(event); }}
                data-testid="veo-asset-drop-zone"
            >



                {/* Central Preview Stage (Memoized) */}
                <div
                    className={`flex-1 min-h-0 overflow-hidden relative ${
                        workspaceMode === 'wide'
                            ? 'px-8 pb-56'
                            : workspaceMode === 'standard'
                                ? 'px-5 pb-52'
                                : 'px-3 pb-44'
                    }`}
                    data-testid="video-primary-stage"
                >
                            <VideoStage
                                jobStatus={jobStatus}
                                jobProgress={jobProgress}
                                activeVideo={activeVideo}
                                firstFrame={videoInputs.firstFrame}
                                lastFrame={videoInputs.lastFrame}
                                maskRange={videoInputs.maskRange}
                                setVideoInputs={setVideoInputs}
                                onCancelJob={jobStatus === 'queued' || jobStatus === 'processing' || jobStatus === 'stitching' ? handleCancelJob : undefined}
                            />
                            {/* Send Output Actions */}
                            {activeVideo && activeVideo.type === 'video' && (
                                <div className={`absolute flex gap-2 z-20 ${
                                    workspaceMode === 'focused' ? 'bottom-48 right-3' : 'bottom-60 right-6'
                                }`}>
                                    <button
                                        onClick={() => {
                                            sendToStage('omni', {
                                                item: activeVideo,
                                                role: 'source-video',
                                                originStage: 'veo',
                                                timestamp: Date.now()
                                            });
                                            toast.info('Sent to Omni for remixing!');
                                        }}
                                        className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-purple-400/30"
                                        title="Send to Omni for remixing"
                                    >
                                        <Send size={16} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            sendToStage('editor', {
                                                item: activeVideo,
                                                role: 'source-video',
                                                originStage: 'veo',
                                                timestamp: Date.now()
                                            });
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-full shadow-2xl hover:scale-105 transition-all flex items-center justify-center border border-emerald-400/30"
                                        title="Open this video in the timeline editor"
                                        aria-label="Open Veo video in timeline editor"
                                    >
                                        <Film size={16} />
                                    </button>
                                </div>
                            )}
                </div>

                {/* Mode Switcher Shortcut buttons (Overlay) */}
                <div
                    className={`absolute z-40 flex gap-2 ${
                        workspaceMode === 'focused'
                            ? 'left-3 top-3 flex-row'
                            : 'left-4 top-24 flex-col'
                    }`}
                    data-testid="video-mode-actions"
                >
                    <SessionIngestionPanel
                        organizationId={currentOrganizationId}
                        projectId={currentProjectId}
                        onOpenProxy={openSessionProxy}
                    />
                    <button
                        onClick={() => setViewMode('visualizer')}
                        className="w-10 h-10 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all shadow-xl backdrop-blur-md"
                        title="Open 3D Stage Builder"
                    >
                        <Layout size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('editor')}
                        className="w-10 h-10 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all shadow-xl backdrop-blur-md"
                        title="Open Timeline Editor"
                    >
                        <Settings size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('storyboard')}
                        className="w-10 h-10 bg-black/40 border border-white/10 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all shadow-xl backdrop-blur-md"
                        title="Open Storyboard Sync"
                    >
                        <Layers size={18} />
                    </button>
                </div>

                {/* Technical Settings Panel (Collapsible, Bottom-Right) */}
                <div
                    className={`absolute right-3 top-3 z-30 ${
                        workspaceMode === 'focused'
                            ? 'w-[min(18rem,calc(100%-4.5rem))]'
                            : 'w-72'
                    }`}
                    data-testid="video-technical-settings"
                >
                    <button
                        onClick={() => setShowSettings(s => !s)}
                        data-testid="toggle-settings-btn"
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-wider mb-1 ml-auto"
                        aria-label="Toggle Technical Settings"
                        aria-expanded={showSettings}
                    >
                        <Settings size={12} />
                        Settings
                        {showSettings ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>

                    {showSettings && (
                        <div className="glass max-h-[min(30rem,calc(100vh-8rem))] overflow-y-auto rounded-xl p-4 space-y-3 border border-white/10 shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Seed Control */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Hash size={10} className="text-blue-400" />
                                    Seed (Reproducibility)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={studioControls.seed || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setStudioControls({ seed: val });
                                        }}
                                        placeholder="Random"
                                        data-testid="seed-input"
                                        aria-label="Seed value for reproducible generation"
                                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/30 outline-none font-mono transition-all"
                                    />
                                    <button
                                        onClick={randomizeSeed}
                                        data-testid="randomize-seed-btn"
                                        title="Generate random seed"
                                        aria-label="Generate random seed"
                                        className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-all"
                                    >
                                        <Shuffle size={14} />
                                    </button>
                                    {studioControls.seed && (
                                        <button
                                            onClick={() => setStudioControls({ seed: '' })}
                                            data-testid="clear-seed-btn"
                                            title="Clear seed (use random)"
                                            aria-label="Clear seed"
                                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                <p className="text-[9px] text-gray-600 leading-snug">
                                    {studioControls.seed
                                        ? `Seed: ${studioControls.seed} — Same prompt + seed = same output`
                                        : 'Empty = random seed each generation'
                                    }
                                </p>
                            </div>

                            {/* Last used seed from active video */}
                            {activeVideo?.meta && (() => {
                                try {
                                    const meta = JSON.parse(activeVideo.meta);
                                    const usedSeed = meta?.seed;
                                    if (usedSeed) {
                                        return (
                                            <button
                                                onClick={() => setStudioControls({ seed: String(usedSeed) })}
                                                data-testid="reuse-seed-btn"
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/20 text-green-400 hover:bg-green-500/10 transition-all text-[10px] font-bold"
                                            >
                                                <Hash size={10} />
                                                Reuse seed from selected: {usedSeed}
                                            </button>
                                        );
                                    }
                                } catch { /* ignore */ }
                                return null;
                            })()}
                        </div>
                    )}
                </div>

                {/* Dailies Strip (Bottom Overlay) */}
                <DailiesStrip
                    items={videoHistory}
                    selectedId={activeVideo?.id || null}
                    onSelect={setActiveVideo}
                    onDragStart={handleDragStart}
                />

                {/* Bottom Prompt Input Bar */}
                <div className={`flex-none border-t border-white/10 bg-background/80 backdrop-blur-xl shrink-0 z-30 ${
                    workspaceMode === 'focused' ? 'p-2' : 'p-4'
                }`}>
                    <div className={`flex items-center justify-center max-w-4xl mx-auto w-full ${
                        workspaceMode === 'focused' ? 'gap-2' : 'gap-4'
                    }`}>
                        <div className="flex-1 flex flex-col gap-2 relative">
                            {useVideoEditorStore.getState().inputAudio && (
                                <div className="self-center flex items-center gap-2 px-3 py-1 bg-green-500/20 backdrop-blur-md rounded-full border border-green-400/40 text-green-300 shadow-md animate-in fade-in zoom-in duration-200">
                                    <Music className="w-3 h-3 text-green-400 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Custom Audio Attached</span>
                                    <button
                                        onClick={() => useVideoEditorStore.getState().setInputAudio(null)}
                                        className="ml-1 text-gray-400 hover:text-red-400 transition-colors"
                                        title="Remove Custom Audio"
                                        aria-label="Remove Custom Audio"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                            <IntelligencePromptInput
                                mode="video"
                                prompt={localPrompt}
                                onChange={(val) => {
                                    setLocalPrompt(val);
                                    setCreativePrompt(val);
                                }}
                                onGenerate={() => handleGenerate()}
                                disabled={jobStatus === 'queued' || jobStatus === 'processing'}
                                showBuilder={isPromptBuilderOpen}
                            >
                                <button
                                    onClick={togglePromptBuilder}
                                    data-testid="toggle-prompt-builder"
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    title={isPromptBuilderOpen ? 'Hide Prompt Builder' : 'Show Prompt Builder'}
                                    aria-expanded={isPromptBuilderOpen}
                                >
                                    {isPromptBuilderOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <span className="text-[10px] text-muted-foreground uppercase font-mono px-2 border-r border-white/5">
                                    {studioControls?.model?.toUpperCase() || 'PRO'} (${estimatedCost.toFixed(2)})
                                </span>
                                <button
                                    onClick={() => handleGenerate()}
                                    data-testid="video-generate-btn"
                                    disabled={jobStatus === 'queued' || jobStatus === 'processing' || !localPrompt.trim()}
                                    className="bg-foreground text-background p-1.5 rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {(jobStatus === 'queued' || jobStatus === 'processing') ? (
                                        <>
                                            <div className="w-4 h-4 animate-spin border-2 border-background border-t-transparent rounded-full" />
                                            <span className="sr-only">Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <div data-testid="icon-Send" className="w-4 h-4" />
                                            <span className="sr-only">Generate</span>
                                        </>
                                    )}
                                </button>
                            </IntelligencePromptInput>
                        </div>
                    </div>
                </div>
            </div>

            {/* Editor Container (Full Screen Overlay) */}
            {viewMode === 'editor' && (
                <div
                    id="editor-panel"
                    role="tabpanel"
                    aria-label="Editor Mode"
                    className="absolute inset-0 z-50 bg-background"
                >
                    <ErrorBoundary fallback={<div className="p-10 text-red-500">Editor Error</div>}>
                        <React.Suspense fallback={<div className="flex items-center justify-center h-full text-yellow-500">Loading Cutting Room...</div>}>
                            <div className="h-full flex flex-col">
                                {/* Editor Header Removed - using Global Navbar */}
                                <div className="flex-1 relative overflow-hidden">
                                    <VideoEditor initialVideo={activeVideo || undefined} />
                                </div>
                            </div>
                        </React.Suspense>
                    </ErrorBoundary>
                </div>
            )}
            {/* 3D Visualizer Container */}
            {viewMode === 'visualizer' && (
                <div className="absolute inset-0 z-50 bg-background flex flex-col p-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode('director')}
                                className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <ChevronDown size={20} className="rotate-90" />
                            </button>
                            <h2 className="text-white font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                                <Layout size={16} className="text-blue-400" />
                                Interactive 3D Stage
                            </h2>
                        </div>
                        <button
                            onClick={() => setViewMode('director')}
                            className="p-2 hover:bg-red-900/40 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                    <div className="flex-1 min-h-0">
                        <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading 3D Stage...</div>}>
                            <SceneBuilder />
                        </Suspense>
                    </div>
                </div>
            )}

            {/* Storyboard Sync Container */}
            {viewMode === 'storyboard' && (
                <div className="absolute inset-0 z-50 bg-background flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b border-white/5 bg-[#0e1117]/40 shrink-0">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode('director')}
                                className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                                title="Back to Director View"
                            >
                                <ChevronDown size={20} className="rotate-90" />
                            </button>
                            <h2 className="text-white font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                                <Layers size={14} className="text-green-400 animate-pulse" />
                                Audio-Storyboard Sync Workspace
                            </h2>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ErrorBoundary fallback={<div className="p-10 text-red-500">Storyboard Sync Error</div>}>
                            <StoryboardTimeline />
                        </ErrorBoundary>
                    </div>
                </div>
            )}
        </div>
    );
}
