import { ProxyManifestSchema } from '@indii/shared';
import { useStore } from '@/core/store';
import { downloadAsset } from '@/utils/download';
import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { previewPause, previewPlay, previewSeekToFrame } from '../previewTransport';
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore, VideoClip, syncChannel } from '@/modules/creative/video/store/videoEditorStore';
import { HistoryItem } from '@/core/store/slices/creative';
import { useToast } from '@/core/context/ToastContext';
import { PIXELS_PER_FRAME } from '../constants';
import { nearestTrackIdByY } from '../utils/timelineUtils';
import { logger } from '@/utils/logger';
import { resolveMediaDurationSeconds, durationSecondsToFrames } from '../utils/mediaMetadata';
import { readCreativeAssetDrag, writeCreativeAssetDrag } from '@/services/creative/CreativeAssetDragService';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { renderVideoProjectLocally } from '@/services/video/LocalVideoProjectRenderer';
import { platformBridge } from '@/services/platform/PlatformBridgeService';

export function useVideoEditor(initialVideo?: HistoryItem, beforeExport?: () => Promise<void>) {
    const {
        project, setProject, updateClip, addClip, removeClip,
        addTrack, removeTrack, setIsPlaying, setCurrentTime, currentTime,
        setSelectedClipId, selectedClipId,
    } = useVideoEditorStore(useShallow(state => ({
        project: state.project,
        currentTime: state.currentTime,
        setProject: state.setProject,
        updateClip: state.updateClip,
        addClip: state.addClip,
        removeClip: state.removeClip,
        addTrack: state.addTrack,
        removeTrack: state.removeTrack,
        setIsPlaying: state.setIsPlaying,
        setCurrentTime: state.setCurrentTime,
        setSelectedClipId: state.setSelectedClipId,
        selectedClipId: state.selectedClipId,
    })));

    const initializedRef = useRef<string | null>(null);
    const isLoadingProject = useVideoEditorStore(state => state.isLoadingProject);
    const importScope = useStore(state => JSON.stringify([state.user?.uid, state.currentProjectId, state.currentOrganizationId]));
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
        const state = useVideoEditorStore.getState();
        if (!initialVideo || isLoadingProject || state.isLoadingProject || state.projectLoadError || initialVideo.projectId !== project.id) return;
        const key = `${importScope}:${initialVideo.id}`;
        if (initializedRef.current === key || project.clips.some(c => c.src === initialVideo.url)) return;
        const trackId = project.tracks[0]?.id; if (!trackId) return;
        let cancelled = false;
        const mediaType = initialVideo.type === 'video' ? 'video' : initialVideo.type === 'music' ? 'audio' : 'image';
        void (async () => {
            let manifest;
            if (initialVideo.meta) {
                let metadata: unknown;
                try { metadata = JSON.parse(initialVideo.meta); } catch { /* Legacy plain-text notes have no inspection. */ }
                if (metadata && typeof metadata === 'object' && 'proxyManifest' in metadata) manifest = ProxyManifestSchema.parse(metadata.proxyManifest);
            }
            const duration = manifest ? manifest.inspection.proxyDurationUs / 1_000_000 : await resolveMediaDurationSeconds(initialVideo.url, mediaType);
            const active = useStore.getState(); const editor = useVideoEditorStore.getState();
            if (cancelled || JSON.stringify([active.user?.uid, active.currentProjectId, active.currentOrganizationId]) !== importScope
                || editor.project.id !== project.id || editor.isLoadingProject || editor.projectLoadError) return;
            if (manifest && (manifest.ownerUid !== active.user?.uid || manifest.projectId !== project.id)) throw new Error('This recording belongs to a different account or project.');
            if (mediaType !== 'image' && (!Number.isFinite(duration) || duration <= 0)) throw new Error('Could not read this recording’s duration. Retry the import; the original is unchanged.');
            if (editor.project.clips.some(c => c.src === initialVideo.url)) return;
            initializedRef.current = key;
            addClip({ type: mediaType, src: initialVideo.url, startFrame: 0,
                durationInFrames: mediaType === 'image' ? 90 : durationSecondsToFrames(duration, editor.project.fps), trackId, name: initialVideo.prompt || 'Imported recording',
                ...(mediaType !== 'image' ? { sourceInUs: 0, sourceOutUs: Math.round(duration * 1_000_000) } : {}),
                ...(mediaType === 'video' && manifest ? { hasAudio: Boolean(manifest.inspection.sourceAudioCodec) } : {}),
                ...(initialVideo.storageUri ? { canonicalSourceUri: initialVideo.storageUri } : {}),
                ...(manifest ? { proxyGeneration: manifest.proxy.generation, sourceGeneration: manifest.proxy.generation } : {}),
            });
        })().catch(error => {
            if (cancelled) return;
            logger.error('Failed to import media:', error); toast.error(error instanceof Error ? error.message : 'Could not import the recording.');
        });
        return () => { cancelled = true; };
    }, [initialVideo, addClip, project.id, project.clips, project.tracks, isLoadingProject, importScope, toast]);

    // Sync player state with store
    useEffect(() => {
        // We handle playing state differently now, using a subscription 
        // to avoid re-rendering the whole editor
        const unsub = useVideoEditorStore.subscribe((state, prevState) => {
            if (state.isPlaying !== prevState.isPlaying) {
                if (state.isPlaying) {
                    void previewPlay();
                } else {
                    previewPause();
                }
                if (state.isPopoutActive) {
                    syncChannel?.postMessage({ type: 'SYNC_ACTION', action: state.isPlaying ? 'play' : 'pause' });
                }
            }
            // Loop wrap check: if playing and currentTime was wrapped back to loop.a
            if (state.isPlaying && state.loopRegion && state.currentTime === state.loopRegion.a && prevState.currentTime >= state.loopRegion.b - 1) {
                previewSeekToFrame(state.loopRegion.a, state.project.fps);
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
        previewSeekToFrame(frame, project.fps);
        setCurrentTime(frame);
        if (useVideoEditorStore.getState().isPopoutActive) {
            syncChannel?.postMessage({ type: 'SYNC_ACTION', action: 'seek', frame });
            setCurrentTime(frame);
        }
    }, [project.fps, setCurrentTime]);

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
        if (window.electronAPI?.video?.render) {
            setIsExporting(true);
            toast.info('Rendering video locally…');
            try {
                const receipt = await renderVideoProjectLocally(project);
                toast.success(`Render complete: ${receipt.asset.url.replace(/^file:\/\//, '')}`);
            } catch (error: unknown) {
                logger.error('Desktop render error:', error);
                toast.error(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsExporting(false);
            }
            return;
        }

        setIsExporting(true);
        try {
            if (!beforeExport) throw new Error('Save this timeline before requesting a cloud render.');
            await beforeExport(); const active = useStore.getState();
            if (active.currentProjectId !== project.id || useVideoEditorStore.getState().project !== project) throw new Error('The timeline changed. Review it and export again.');
            toast.info('Rendering your saved timeline…');
            await renderVideoProjectLocally(project, { organizationId: active.currentOrganizationId });
            toast.success('Video rendered. Download MP4 is ready.');
        } catch (error: unknown) {
            logger.error('Cloud export error:', error); toast.error(error instanceof Error ? error.message : 'Cloud export failed.');
        } finally { setIsExporting(false); }
    };

    const handleDownloadMP4 = async () => {
        if (!platformBridge.canRenderVideoLocally()) {
            const url = useVideoEditorStore.getState().previewArtifactUrl;
            if (!url?.startsWith('https://')) { toast.error('Render this timeline first, then download the completed MP4.'); return; }
            try { if (!await downloadAsset(url, `${project.name || 'video'}.mp4`)) throw new Error('Download failed. Try again.'); }
            catch (error) { toast.error(error instanceof Error ? error.message : 'Download failed.'); }
            return;
        }
        setIsExporting(true);
        toast.info('Starting local render... Please wait.');
        try {
            if (!platformBridge.canRenderVideoLocally()) {
                throw new Error("Local rendering is not supported in the browser environment. Please use the desktop app.");
            }

            const filename = `video_${Date.now()}.mp4`;

            // Prompt user to select export directory via platform bridge
            const selectedDirectory = await platformBridge.selectDirectory();
            if (!selectedDirectory) {
                // User cancelled selection
                setIsExporting(false);
                return;
            }

            // Construct full output path (forward slashes work on all platforms in Electron)
            const outputLocation = `${selectedDirectory}/${filename}`;

            const receipt = await renderVideoProjectLocally(project, {
                outputLocation,
                outputName: filename,
            });
            toast.success(`Render complete: ${receipt.asset.url.replace(/^file:\/\//, '')}`);

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
            // Zoom-aware, matching the per-track drop zones in TimelineTrack.
            const zoom = useVideoEditorStore.getState().timelineZoom || 1;
            const dropFrame = Math.max(0, Math.round(x / (PIXELS_PER_FRAME * zoom)));
            // Container-level drops (track gaps, padding) land on the track
            // nearest the pointer's vertical position, not always the first.
            const trackId = nearestTrackIdByY(
                project.tracks,
                e.clientY,
                (id) => {
                    const el = typeof document !== 'undefined' && typeof document.querySelector === 'function'
                        ? document.querySelector(`[data-track-id="${id}"]`)
                        : null;
                    const rect = el?.getBoundingClientRect?.();
                    return rect ? { top: rect.top, bottom: rect.bottom } : null;
                },
            ) ?? project.tracks[0]?.id;
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

    const previewArtifactUrl = useVideoEditorStore(useShallow(state => state.previewArtifactUrl));

    return {
        project,
        currentTime,
        previewArtifactUrl,        activeTab,
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
