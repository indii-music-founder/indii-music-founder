import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PlayerRef } from '@remotion/player';
import { useVideoEditorStore, VideoClip, syncChannel } from '@/modules/creative/video/store/videoEditorStore';
import { HistoryItem } from '@/core/store/slices/creative';
import { useToast } from '@/core/context/ToastContext';
import { PIXELS_PER_FRAME } from '../constants';
import { logger } from '@/utils/logger';
import { resolveMediaDurationSeconds, durationSecondsToFrames } from '../utils/mediaMetadata';
import { readCreativeAssetDrag, writeCreativeAssetDrag } from '@/services/creative/CreativeAssetDragService';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cloudRenderEligibilityError } from '../utils/renderEligibility';
import { RenderService } from '@/services/video/RenderService';

export function useVideoEditor(initialVideo?: HistoryItem) {
    const {
        project, setProject, updateClip, addClip, removeClip,
        addTrack, removeTrack, setIsPlaying, setCurrentTime,
        setSelectedClipId, selectedClipId
    } = useVideoEditorStore(useShallow(state => ({
        project: state.project,
        setProject: state.setProject,
        updateClip: state.updateClip,
        addClip: state.addClip,
        removeClip: state.removeClip,
        addTrack: state.addTrack,
        removeTrack: state.removeTrack,
        setIsPlaying: state.setIsPlaying,
        setCurrentTime: state.setCurrentTime,
        setSelectedClipId: state.setSelectedClipId,
        selectedClipId: state.selectedClipId
    })));

    const playerRef = useRef<PlayerRef>(null);
    const initializedRef = useRef(false);
    const toast = useToast();

    // Local State
    const [activeTab, setActiveTab] = useState<'project' | 'tracks' | 'assets'>('assets');
    const [isExporting, setIsExporting] = useState(false);

    // Memoize selected clip lookup
    const selectedClip = useMemo(() =>
        project.clips.find((c: VideoClip) => c.id === selectedClipId),
        [project.clips, selectedClipId]
    );

    useEffect(() => {
        if (!initialVideo || initializedRef.current) return;
        initializedRef.current = true;

        const existingClip = project.clips.find((c: VideoClip) => c.src === initialVideo.url);
        if (existingClip) return;

        const mediaType: 'video' | 'audio' | 'image' = initialVideo.type === 'video' ? 'video' : initialVideo.type === 'music' ? 'audio' : 'image';
        const trackId = project.tracks[0]?.id;
        if (!trackId) return;

        resolveMediaDurationSeconds(initialVideo.url, mediaType).then((durationSeconds) => {
            const fps = useVideoEditorStore.getState().project?.fps || 30;
            const durationInFrames = mediaType === 'image' ? 90 : durationSecondsToFrames(durationSeconds, fps);
            addClip({
                type: mediaType,
                src: initialVideo.url,
                startFrame: 0,
                durationInFrames,
                trackId,
                name: initialVideo.prompt || 'Imported Video'
            });
        });
    }, [initialVideo, addClip, project.clips, project.tracks]);

    // Sync player state with store
    useEffect(() => {
        // We handle playing state differently now, using a subscription 
        // to avoid re-rendering the whole editor
        const unsub = useVideoEditorStore.subscribe((state, prevState) => {
            if (state.isPlaying !== prevState.isPlaying) {
                if (playerRef.current) {
                    if (state.isPlaying) {
                        playerRef.current.play();
                    } else {
                        playerRef.current.pause();
                    }
                } else if (state.isPopoutActive) {
                    syncChannel?.postMessage({ type: 'SYNC_ACTION', action: state.isPlaying ? 'play' : 'pause' });
                }
            }
        });
        return unsub;
    }, []);

    /**
     * Deleting a track silently takes every clip on it with no undo — the editor
     * has no history stack, and the footage a session timeline references is often
     * irreplaceable. Confirm before the destructive cascade, and only when there is
     * actually something to lose, so removing an empty track stays a single click.
     *
     * The guard lives here rather than in the store so the store stays a pure,
     * synchronous state container. Uses the project's standard react-call dialog —
     * window.confirm is banned (CLAUDE.md).
     */
    const confirmRemoveTrack = useCallback(async (trackId: string) => {
        const { project: current } = useVideoEditorStore.getState();
        const clipCount = current.clips.filter(c => c.trackId === trackId).length;

        if (clipCount > 0) {
            const trackName = current.tracks.find(t => t.id === trackId)?.name ?? 'this track';
            const ok = await ConfirmDialog.call({
                title: 'Delete track?',
                message: `Deleting ${trackName} will also delete ${clipCount} clip${clipCount === 1 ? '' : 's'} on it. This can’t be undone.`,
                confirmText: `Delete track and ${clipCount} clip${clipCount === 1 ? '' : 's'}`,
                variant: 'destructive',
            });
            if (!ok) return;
        }

        removeTrack(trackId);
    }, [removeTrack]);

    const handlePlayPause = useCallback(() => setIsPlaying(!useVideoEditorStore.getState().isPlaying), [setIsPlaying]);

    const handleSeek = useCallback((frame: number) => {
        if (playerRef.current) {
            playerRef.current.seekTo(frame);
            setCurrentTime(frame);
        } else if (useVideoEditorStore.getState().isPopoutActive) {
            syncChannel?.postMessage({ type: 'SYNC_ACTION', action: 'seek', frame });
            setCurrentTime(frame);
        }
    }, [setCurrentTime]);

    const formatTime = useCallback((frame: number) => {
        const fps = project.fps || 30;
        const seconds = Math.floor(frame / fps);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const remainingFrames = frame % fps;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}:${remainingFrames.toString().padStart(2, '0')}`;
    }, [project.fps]);

    const handleAddSampleClip = useCallback((trackId: string, type: 'text' | 'video' | 'image' | 'audio' = 'text') => {
        const base: Omit<VideoClip, 'id'> = {
            type, startFrame: 0, durationInFrames: 90, trackId, name: `New ${type} Clip`,
        };
        const clipData: Omit<VideoClip, 'id'> = type === 'text'
            ? { ...base, text: 'New Text' }
            : type === 'video'
                ? { ...base, src: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }
                : type === 'image'
                    ? { ...base, src: 'https://picsum.photos/800/450' }
                    : { ...base, src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', name: 'Audio Track' };
        addClip(clipData);
    }, [addClip]);

    const handleExport = async () => {
        const eligibilityError = cloudRenderEligibilityError(project);
        if (eligibilityError) {
            toast.error(eligibilityError);
            return;
        }
        setIsExporting(true);
        toast.info('Starting cloud export... This may take a while.');
        try {
            const { useStore } = await import('@/core/store');
            const state = useStore.getState();
            const projectId = state.currentProjectId || project.id;
            const organizationId = state.currentOrganizationId;

            if (!organizationId) {
                throw new Error('Organization context required for cloud rendering');
            }

            const renderService = new RenderService();
            const receipt = await renderService.renderCompositionCloud(
                {
                    compositionId: project.id,
                    outputLocation: `gs://indii-cloud-renders/${projectId}/${Date.now()}.mp4`,
                    inputProps: { project },
                    projectId,
                    organizationId
                },
                (progress) => {
                    logger.info(`[VideoEditor] Cloud render progress: ${progress}%`);
                }
            );

            if (receipt.asset?.url) {
                toast.success('Cloud render complete!');
                // Auto-save to generatedHistory
                state.addToHistory({
                    id: `export_${receipt.renderId}`,
                    type: 'video',
                    url: receipt.asset.url,
                    origin: 'editor',
                    prompt: `Cloud export of ${project.name || 'Project'}`,
                    timestamp: Date.now(),
                    projectId,
                    orgId: organizationId
                });
            }
        } catch (error: unknown) {
            logger.error('Cloud export error:', error);
            toast.error(`Cloud export failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleDownloadMP4 = async () => {
        setIsExporting(true);
        toast.info('Starting local render... Please wait.');
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { electronAPI } = window as any;
            if (!electronAPI?.selectDirectory) {
                throw new Error("Directory selection is not available. Please use the desktop app.");
            }
            if (!electronAPI?.video?.render) {
                throw new Error("Local rendering is not supported in the browser environment. Please use the desktop app.");
            }

            const timestamp = Date.now();
            const filename = `video_${timestamp}.mp4`;

            // Prompt user to select export directory (handles access granting via AccessControlService)
            const selectedDirectory = await electronAPI.selectDirectory();
            if (!selectedDirectory) {
                // User cancelled selection
                setIsExporting(false);
                return;
            }

            // Construct full output path (forward slashes work on all platforms in Electron)
            const outputLocation = `${selectedDirectory}/${filename}`;

            const resultLocation = await electronAPI.video.render({
                compositionId: project.id,
                outputLocation,
                inputProps: { project }
            });

            toast.success(`Render complete: ${resultLocation}`);

            // Auto-save output to generatedHistory globally
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            import('@/core/store').then((module: any) => {
                const { useStore } = module;
                const state = useStore.getState();
                state.addToHistory({
                    id: `export_${timestamp}`,
                    type: 'video',
                    url: `file://${resultLocation}`,
                    localPath: resultLocation,
                    origin: 'editor',
                    prompt: `Export of ${project.name || 'Project'}`,
                    timestamp: timestamp,
                    projectId: project.id,
                    orgId: state.currentOrganizationId
                });
            });

        } catch (error: unknown) {
            logger.error('Local export error:', error);
            toast.error(`Local render failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleLibraryDragStart = (e: React.DragEvent, item: HistoryItem) => {
        writeCreativeAssetDrag(e.dataTransfer, item, 'editor-library');
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        try {
            const payload = readCreativeAssetDrag(e.dataTransfer);
            if (!payload) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const dropFrame = Math.max(0, Math.round(x / PIXELS_PER_FRAME));
            const trackId = project.tracks[0]?.id;
            if (!trackId) return;

            if (!['image', 'video', 'music'].includes(payload.asset.type)) {
                toast.info('This file type cannot be placed on the video timeline yet.');
                return;
            }
            const mediaType: 'image' | 'audio' | 'video' = payload.asset.type === 'image' ? 'image' : payload.asset.type === 'music' ? 'audio' : 'video';
            const durationSeconds = await resolveMediaDurationSeconds(payload.asset.url, mediaType);
            const fps = useVideoEditorStore.getState().project?.fps || 30;
            const durationInFrames = mediaType === 'image' ? 90 : durationSecondsToFrames(durationSeconds, fps);

            addClip({
                type: mediaType,
                src: payload.asset.url,
                ...(mediaType === 'video' && payload.asset.storageUri?.startsWith('gs://')
                    ? { canonicalSourceUri: payload.asset.storageUri }
                    : {}),
                startFrame: dropFrame,
                durationInFrames,
                trackId,
                name: payload.asset.name
            });
            toast.success('Asset added to timeline');
        } catch (err: unknown) {
            logger.error('Failed to parse dropped item', err);
        }
    };

    return {
        project,
        playerRef,
        activeTab,
        setActiveTab,
        selectedClipIdState: selectedClipId,
        setSelectedClipIdState: setSelectedClipId,
        selectedClip,
        isExporting,
        handlePlayPause,
        handleSeek,
        formatTime,
        handleAddSampleClip,
        handleExport,
        handleDownloadMP4,
        handleLibraryDragStart,
        handleDrop,
        updateClip,
        addTrack,
        removeTrack: confirmRemoveTrack,
        removeClip,
        setProject,
        setCurrentTime // Expose setCurrentTime for frame synchronization
    };
}
