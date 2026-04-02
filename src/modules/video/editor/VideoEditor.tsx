import React from 'react';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { HistoryItem } from '@/core/store/slices/creative';
import { VideoPreview } from './components/VideoPreview';
import { VideoPropertiesPanel } from './components/VideoPropertiesPanel';
import { VideoTimeline } from './components/VideoTimeline';
import { StudioToolbar } from '@/components/studio/StudioToolbar';
import { useTimelineDrag } from './hooks/useTimelineDrag';
import { VideoEditorSidebar } from './components/VideoEditorSidebar';
import { useVideoEditor } from './hooks/useVideoEditor';

interface VideoEditorProps {
    initialVideo?: HistoryItem;
}

export const VideoEditor: React.FC<VideoEditorProps> = ({ initialVideo }) => {
    const {
        project,
        playerRef,
        activeTab,
        setActiveTab,
        selectedClipIdState,
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
        setCurrentTime
    } = useVideoEditor(initialVideo);

    const { handleDragStart } = useTimelineDrag();

    const isPopoutActive = useVideoEditorStore(state => state.isPopoutActive);

    const handleAddTrackVideo = React.useCallback(() => addTrack('video'), [addTrack]);

    return (
        <div className="flex flex-col h-full bg-[--background] text-[--foreground]">
            <StudioToolbar
                className="bg-gray-900 border-gray-800"
                left={
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => useVideoEditorStore.getState().setViewMode('director')}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-colors"
                        >
                            &larr; Back to Director
                        </button>
                        <h2 className="font-bold text-lg border-l border-gray-800 pl-4">Studio Editor</h2>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{project.width}x{project.height} @ {project.fps}fps</span>
                    </div>
                }
                right={
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        data-testid="video-export-btn"
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isExporting ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}
                    >
                        {isExporting ? 'Exporting...' : 'Export Video'}
                    </button>
                }
            />

            <div className="flex-1 flex overflow-hidden">
                <VideoEditorSidebar
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    project={project}
                    updateProject={(updates) => setProject({ ...project, ...updates })}
                    removeTrack={removeTrack}
                    addTrack={addTrack}
                    onLibraryDragStart={handleLibraryDragStart}
                />

                {!isPopoutActive && (
                    <div className="flex-1 flex items-center justify-center bg-black relative transition-all duration-300">
                        <VideoPreview
                            playerRef={playerRef}
                            project={project}
                            onFrameUpdate={(frame) => setCurrentTime(frame)}
                        />
                    </div>
                )}

                <VideoPropertiesPanel
                    project={project}
                    selectedClip={selectedClip}
                    updateClip={updateClip}
                    isPopoutActive={isPopoutActive}
                />
            </div>

            <div
                className="h-1/3 min-h-[220px] max-h-[350px] shrink-0 overflow-y-auto custom-scrollbar relative border-t border-[--border]"
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            >
                <VideoTimeline
                    project={project}
                    selectedClipId={selectedClipIdState}
                    handlePlayPause={handlePlayPause}
                    handleSeek={handleSeek}
                    handleAddTrack={handleAddTrackVideo}
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
