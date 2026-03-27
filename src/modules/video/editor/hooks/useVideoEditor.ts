import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PlayerRef } from '@remotion/player';
import { httpsCallable } from 'firebase/functions';
import { functionsWest1 } from '@/services/firebase';
import { useVideoEditorStore, VideoProject, VideoClip } from '../../store/videoEditorStore';
import { HistoryItem } from '@/core/store/slices/creative';
import { useToast } from '@/core/context/ToastContext';
import { PIXELS_PER_FRAME } from '../constants';
import { logger } from '@/utils/logger';


export function useVideoEditor(initialVideo?: HistoryItem) {
    const {
        project, setProject, updateClip, addClip, removeClip,
        addTrack, removeTrack, setIsPlaying, setCurrentTime,
        setSelectedClipId
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
        setSelectedClipId: state.setSelectedClipId
    })));

    const playerRef = useRef<PlayerRef>(null);
    const initializedRef = useRef(false);
    const toast = useToast();

    // Local State
    const [activeTab, setActiveTab] = useState<'project' | 'tracks' | 'assets'>('project');
    const [selectedClipIdState, setSelectedClipIdState] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Sync local selection with store
    useEffect(() => {
        setSelectedClipId(selectedClipIdState);
    }, [selectedClipIdState, setSelectedClipId]);

    // Memoize selected clip lookup
    const selectedClip = useMemo(() =>
        project.clips.find((c: VideoClip) => c.id === selectedClipIdState),
        [project.clips, selectedClipIdState]
    );

    useEffect(() => {
        if (initialVideo && !initializedRef.current) {
            const existingClip = project.clips.find((c: VideoClip) => c.src === initialVideo.url);
            if (!existingClip) {
                addClip({
                    type: initialVideo.type === 'video' ? 'video' : 'image',
                    src: initialVideo.url,
                    startFrame: 0,
                    durationInFrames: 150,
                    trackId: project.tracks[0]!.id,
                    name: initialVideo.prompt || 'Imported Video'
                });
            }
            initializedRef.current = true;
        }
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
                }
            }
        });
        return unsub;
    }, []);

    const handlePlayPause = useCallback(() => setIsPlaying(!useVideoEditorStore.getState().isPlaying), [setIsPlaying]);

    const handleSeek = useCallback((frame: number) => {
        if (playerRef.current) {
            playerRef.current.seekTo(frame);
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
        setIsExporting(true);
        toast.info('Starting cloud export... This may take a while.');
        try {
            const render = httpsCallable(functionsWest1, 'renderVideo');
            const result = await render({ compositionId: project.id, inputProps: { project } });
            const data = result.data as { renderId?: string; success?: boolean; url?: string; error?: string };
            if (data.renderId || data.success) toast.success('Cloud render started successfully!');
            else throw new Error(data.error || 'Export failed');
        } catch (error: unknown) {
            logger.error('Export error:', error);
            toast.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleLibraryDragStart = (e: React.DragEvent, item: HistoryItem) => {
        e.dataTransfer.setData('application/json', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('application/json');
        if (data) {
            try {
                const item = JSON.parse(data) as HistoryItem;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const dropFrame = Math.max(0, Math.round(x / PIXELS_PER_FRAME));
                const trackId = project.tracks[0]?.id;

                if (trackId) {
                    addClip({
                        type: item.type === 'video' ? 'video' : 'image',
                        src: item.url,
                        startFrame: dropFrame,
                        durationInFrames: item.type === 'image' ? 90 : 150,
                        trackId: trackId,
                        name: item.prompt || `Imported ${item.type}`
                    });
                    toast.success('Asset added to timeline');
                }
            } catch (err) {
                logger.error('Failed to parse dropped item', err);
            }
        }
    };

    return {
        project,
        playerRef,
        activeTab,
        setActiveTab,
        selectedClipIdState,
        setSelectedClipIdState,
        selectedClip,
        isExporting,
        handlePlayPause,
        handleSeek,
        formatTime,
        handleAddSampleClip,
        handleExport,
        handleLibraryDragStart,
        handleDrop,
        updateClip,
        addTrack,
        removeTrack,
        removeClip,
        setProject,
        setCurrentTime // Expose setCurrentTime for frame synchronization
    };
}
