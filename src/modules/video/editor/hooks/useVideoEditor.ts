import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { PlayerRef } from '@remotion/player';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import { useVideoEditorStore, VideoProject, VideoClip } from '../../store/videoEditorStore';
import { HistoryItem } from '@/core/store/slices/creativeSlice';
import { useToast } from '@/core/context/ToastContext';
import { PIXELS_PER_FRAME } from '../constants';

export function useVideoEditor(initialVideo?: HistoryItem) {
    const {
        project, setProject, updateClip, addClip, removeClip,
        addTrack, removeTrack, setIsPlaying, setCurrentTime,
        setSelectedClipId, isPlaying, currentTime
    } = useVideoEditorStore();

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
                    trackId: project.tracks[0].id,
                    name: initialVideo.prompt || 'Imported Video'
                });
            }
            initializedRef.current = true;
        }
    }, [initialVideo, addClip, project.clips, project.tracks]);

    // Sync player state with store
    useEffect(() => {
        if (playerRef.current) {
            isPlaying ? playerRef.current.play() : playerRef.current.pause();
        }
    }, [isPlaying]);

    const handlePlayPause = useCallback(() => setIsPlaying(!isPlaying), [isPlaying, setIsPlaying]);

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
        const clipData: any = {
            type, startFrame: 0, durationInFrames: 90, trackId: trackId, name: `New ${type} Clip`
        };
        if (type === 'text') clipData.text = 'New Text';
        else if (type === 'video') clipData.src = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        else if (type === 'image') clipData.src = 'https://picsum.photos/800/450';
        else if (type === 'audio') { clipData.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'; clipData.name = 'Audio Track'; }
        addClip(clipData);
    }, [addClip]);

    const handleExport = async () => {
        setIsExporting(true);
        toast.info('Starting cloud export... This may take a while.');
        try {
            const render = httpsCallable(functions, 'renderVideo');
            const result = await render({ compositionId: project.id, inputProps: { project } });
            const data = result.data as { renderId?: string; success?: boolean; url?: string; error?: string };
            if (data.renderId || data.success) toast.success('Cloud render started successfully!');
            else throw new Error(data.error || 'Export failed');
        } catch (error: any) {
            console.error('Export error:', error);
            toast.error(`Export failed: ${error.message}`);
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
                        type: item.type === 'video' ? 'video' : item.type === 'music' ? 'audio' : 'image',
                        src: item.url,
                        startFrame: dropFrame,
                        durationInFrames: item.type === 'image' ? 90 : 150,
                        trackId: trackId,
                        name: item.prompt || `Imported ${item.type}`
                    });
                    toast.success('Asset added to timeline');
                }
            } catch (err) {
                console.error('Failed to parse dropped item', err);
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
        isPlaying,
        currentTime,
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
        setProject
    };
}
