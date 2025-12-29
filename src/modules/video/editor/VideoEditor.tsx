import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { PlayerRef } from '@remotion/player';
import { Plus, Trash2, Settings, Layers, Image as ImageIcon } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../services/firebase';
import { useVideoEditorStore, VideoClip } from '../store/videoEditorStore';
import { HistoryItem } from '../../../core/store/slices/creativeSlice';
import { useToast } from '../../../core/context/ToastContext';
import { EditorAssetLibrary } from './components/EditorAssetLibrary';
import { VideoPreview } from './components/VideoPreview';
import { VideoPropertiesPanel } from './components/VideoPropertiesPanel';
import { VideoTimeline } from './components/VideoTimeline';
import { StudioToolbar } from '@/components/studio/StudioToolbar';
import { throttle } from '../../../lib/throttle';

const PIXELS_PER_FRAME = 2;

interface VideoEditorProps {
    initialVideo?: HistoryItem;
}

export const VideoEditor: React.FC<VideoEditorProps> = ({ initialVideo }) => {
    const project = useVideoEditorStore(state => state.project);
    const setProject = useVideoEditorStore(state => state.setProject);
    const updateClip = useVideoEditorStore(state => state.updateClip);
    const addClip = useVideoEditorStore(state => state.addClip);
    const removeClip = useVideoEditorStore(state => state.removeClip);
    const addTrack = useVideoEditorStore(state => state.addTrack);
    const removeTrack = useVideoEditorStore(state => state.removeTrack);
    const setIsPlaying = useVideoEditorStore(state => state.setIsPlaying);
    const setCurrentTime = useVideoEditorStore(state => state.setCurrentTime);
    const setSelectedClipId = useVideoEditorStore(state => state.setSelectedClipId);
    const isPlaying = useVideoEditorStore(state => state.isPlaying);
    const currentTime = useVideoEditorStore(state => state.currentTime);
    const playerRef = useRef<PlayerRef>(null);
    const initializedRef = useRef(false);
    const toast = useToast();

    const [activeTab, setActiveTab] = useState<'project' | 'tracks' | 'assets'>('project');
    const [selectedClipIdState, setSelectedClipIdState] = useState<string | null>(null); // Local state for UI selection if needed, or sync with store
    const [isExporting, setIsExporting] = useState(false);

    // Sync local selection with store
    useEffect(() => {
        setSelectedClipId(selectedClipIdState);
    }, [selectedClipIdState, setSelectedClipId]);

    // Drag & Drop / Resize State
    const [dragState, setDragState] = useState<{
        type: 'move' | 'resize';
        clipId: string;
        startX: number;
        originalStartFrame: number;
        originalDuration: number;
    } | null>(null);

    // 1. Use useRef for drag state to avoid effect recreation
    const dragStateRef = useRef(dragState);
    useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

    const updateClipRef = useRef(updateClip);
    useEffect(() => { updateClipRef.current = updateClip; }, [updateClip]);

    // 5. Memoize selected clip lookup
    const selectedClip = useMemo(() =>
        project.clips.find(c => c.id === selectedClipIdState),
        [project.clips, selectedClipIdState]
    );

    // Initialize with passed video if available
    useEffect(() => {
        if (initialVideo && !initializedRef.current) {
            // Check if we already have this video to avoid duplicates on re-mounts
            const existingClip = project.clips.find(c => c.src === initialVideo.url);
            if (!existingClip) {
                addClip({
                    type: initialVideo.type === 'video' ? 'video' : 'image',
                    src: initialVideo.url,
                    startFrame: 0,
                    durationInFrames: 150, // 5 seconds default
                    trackId: project.tracks[0].id, // Add to first track
                    name: initialVideo.prompt || 'Imported Video'
                });
            }
            initializedRef.current = true;
        }
    }, [initialVideo, addClip, project.clips, project.tracks]);

    // Sync player state with store
    useEffect(() => {
        if (playerRef.current) {
            if (isPlaying) {
                playerRef.current.play();
            } else {
                playerRef.current.pause();
            }
        }
    }, [isPlaying]);

    const handlePlayPause = useCallback(() => {
        setIsPlaying(!isPlaying);
    }, [isPlaying, setIsPlaying]);

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

    // Drag & Drop Handlers
    const handleDragStart = useCallback((e: React.MouseEvent, clip: VideoClip, type: 'move' | 'resize') => {
        e.stopPropagation();
        setDragState({
            type,
            clipId: clip.id,
            startX: e.clientX,
            originalStartFrame: clip.startFrame,
            originalDuration: clip.durationInFrames
        });
        setSelectedClipId(clip.id);
    }, [setSelectedClipId]);

    useEffect(() => {
        const handleMouseMove = throttle((e: MouseEvent) => {
            if (!dragStateRef.current) return;

            const currentDragState = dragStateRef.current;
            const deltaPixels = e.clientX - currentDragState.startX;
            const deltaFrames = Math.round(deltaPixels / PIXELS_PER_FRAME);

            if (currentDragState.type === 'move') {
                const newStartFrame = Math.max(0, currentDragState.originalStartFrame + deltaFrames);
                updateClipRef.current(currentDragState.clipId, { startFrame: newStartFrame });
            } else if (currentDragState.type === 'resize') {
                const newDuration = Math.max(1, currentDragState.originalDuration + deltaFrames);
                updateClipRef.current(currentDragState.clipId, { durationInFrames: newDuration });
            }
        }, 16);

        const handleMouseUp = () => {
            setDragState(null);
        };

        // Add event listeners once with cleanup (using Refs for state access)
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []); // Empty deps - handlers use refs

    const handleAddTrack = useCallback(() => {
        addTrack('video');
    }, [addTrack]);

    const handleAddSampleClip = useCallback((trackId: string, type: 'text' | 'video' | 'image' | 'audio' = 'text') => {
        const clipData: any = {
            type,
            startFrame: 0,
            durationInFrames: 90,
            trackId: trackId,
            name: `New ${type} Clip`
        };

        if (type === 'text') {
            clipData.text = 'New Text';
        } else if (type === 'video') {
            clipData.src = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        } else if (type === 'image') {
            clipData.src = 'https://picsum.photos/800/450';
        } else if (type === 'audio') {
            clipData.src = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
            clipData.name = 'Audio Track';
        }

        addClip(clipData);
    }, [addClip]);

    const handleExport = async () => {
        setIsExporting(true);
        toast.info('Starting cloud export... This may take a while.');

        try {
            const render = httpsCallable(functions, 'renderVideo');
            const result = await render({
                compositionId: project.id, // Dynamic Composition ID
                inputProps: { project }
            });
            const data = result.data as { renderId?: string; success?: boolean; url?: string; error?: string };

            if (data.renderId || data.success) {
                toast.success('Cloud render started! (Check console for ID)');
                if (data.renderId) {
                    console.log('Render ID:', data.renderId);
                }
            } else {
                throw new Error(data.error || 'Export failed');
            }
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
                let item: HistoryItem;
                try {
                    item = JSON.parse(data) as HistoryItem;
                } catch (e) {
                    console.error("Failed to parse dropped item", e);
                    return;
                }

                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                // Calculate frame based on drop position (rough approximation)
                const dropFrame = Math.max(0, Math.round(x / PIXELS_PER_FRAME));

                // Find track based on Y position (simplified for now, defaults to first track or new track)
                // Ideally we'd calculate which track row the drop occurred in.
                const trackId = project.tracks[0]?.id;

                if (trackId) {
                    addClip({
                        type: item.type === 'video' ? 'video' : item.type === 'music' ? 'audio' : 'image',
                        src: item.url,
                        startFrame: dropFrame,
                        durationInFrames: item.type === 'image' ? 90 : 150, // Default durations
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

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const updateProject = (updates: Partial<typeof project>) => {
        setProject({ ...project, ...updates });
    };

    return (
        <div className="flex flex-col h-full bg-gray-950 text-white">
            {/* Header / Toolbar */}
            <StudioToolbar
                className="bg-gray-900 border-gray-800"
                left={
                    <div className="flex items-center gap-4">
                        <h2 className="font-bold text-lg">Studio Editor</h2>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{project.width}x{project.height} @ {project.fps}fps</span>
                    </div>
                }
                right={
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isExporting
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-500 text-white'
                            }`}
                    >
                        {isExporting ? 'Exporting...' : 'Export Video'}
                    </button>
                }
            >
                {/* Center Content Empty */}
            </StudioToolbar>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-16 bg-gray-900 flex flex-col items-center py-4 border-r border-gray-800 gap-4">
                    <button
                        onClick={() => setActiveTab('project')}
                        className={`p-2 rounded-lg transition-colors ${activeTab === 'project' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                        title="Project Settings"
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('tracks')}
                        className={`p-2 rounded-lg transition-colors ${activeTab === 'tracks' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                        title="Tracks"
                    >
                        <Layers size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('assets')}
                        className={`p-2 rounded-lg transition-colors ${activeTab === 'assets' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                        title="Assets Library"
                    >
                        <ImageIcon size={20} />
                    </button>
                </div>

                {/* Sidebar Content */}
                <div className="w-64 bg-gray-900 border-r border-gray-800 overflow-y-auto custom-scrollbar">
                    {activeTab === 'assets' && (
                        <EditorAssetLibrary onDragStart={handleLibraryDragStart} />
                    )}

                    {activeTab === 'project' && (
                        <div className="p-4 space-y-4">
                            <h3 className="text-lg font-semibold">Project Settings</h3>

                            <div className="bg-purple-900/20 border border-purple-500/30 p-3 rounded-md">
                                <h4 className="text-xs font-bold text-purple-400 uppercase mb-2">Veo 3.1 Presets</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => updateProject({ width: 1920, height: 1080, fps: 24 })}
                                        className="text-xs bg-purple-600 hover:bg-purple-500 text-white py-1 px-2 rounded transition-colors"
                                    >
                                        1080p Landscape (24fps)
                                    </button>
                                    <button
                                        onClick={() => updateProject({ width: 1080, height: 1920, fps: 24 })}
                                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded transition-colors"
                                    >
                                        1080p Portrait (24fps)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="projectName" className="block text-sm font-medium text-gray-400">Project Name</label>
                                <input
                                    type="text"
                                    id="projectName"
                                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                    value={project.name}
                                    onChange={(e) => updateProject({ name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label htmlFor="projectWidth" className="block text-sm font-medium text-gray-400">Width</label>
                                <input
                                    type="number"
                                    id="projectWidth"
                                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                    value={project.width}
                                    onChange={(e) => updateProject({ width: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label htmlFor="projectHeight" className="block text-sm font-medium text-gray-400">Height</label>
                                <input
                                    type="number"
                                    id="projectHeight"
                                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                    value={project.height}
                                    onChange={(e) => updateProject({ height: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label htmlFor="projectFps" className="block text-sm font-medium text-gray-400">FPS</label>
                                <input
                                    type="number"
                                    id="projectFps"
                                    className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                    value={project.fps}
                                    onChange={(e) => updateProject({ fps: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'tracks' && (
                        <div className="p-4 space-y-4">
                            <h3 className="text-lg font-semibold">Tracks</h3>
                            {project.tracks.map(track => (
                                <div key={track.id} className="flex items-center justify-between bg-gray-800 p-2 rounded-md">
                                    <span className="text-sm">{track.name || `Track ${track.id.substring(0, 4)}`}</span>
                                    <button
                                        onClick={() => removeTrack(track.id)}
                                        className="text-red-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-700"
                                        title="Remove Track"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={handleAddTrack}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={16} /> Add Track
                            </button>
                        </div>
                    )}
                </div>

                {/* Video Player */}
                <div className="flex-1 flex items-center justify-center bg-black relative">
                    <VideoPreview playerRef={playerRef} project={project} />
                </div>

                {/* Right Sidebar (Properties) */}
                <VideoPropertiesPanel
                    project={project}
                    selectedClip={selectedClip}
                    updateClip={updateClip}
                    currentTime={currentTime} // Pass current time for keyframing
                />
            </div>

            {/* Bottom Timeline Area */}
            <div
                className="flex-1 overflow-y-auto custom-scrollbar relative min-h-[200px]"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <VideoTimeline
                    project={project}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    selectedClipId={selectedClipIdState}
                    handlePlayPause={handlePlayPause}
                    handleSeek={handleSeek}
                    handleAddTrack={handleAddTrack}
                    handleAddSampleClip={handleAddSampleClip}
                    removeTrack={removeTrack}
                    removeClip={removeClip}
                    handleDragStart={handleDragStart}
                    formatTime={formatTime}
                />
            </div>
        </div>
    );
};
