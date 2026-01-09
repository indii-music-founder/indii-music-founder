import React from 'react';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { HistoryItem } from '@/core/store/slices/creativeSlice';
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
    } = useVideoEditor(initialVideo);

    const { handleDragStart } = useTimelineDrag();

    return (
        <div className="flex flex-col h-full bg-[--background] text-[--foreground]">
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

                <div className="flex-1 flex items-center justify-center bg-black relative">
                    <VideoPreview playerRef={playerRef} project={project} />
                </div>

                <VideoPropertiesPanel
                    project={project}
                    selectedClip={selectedClip}
                    updateClip={updateClip}
                    currentTime={currentTime}
                />
            </div>

            <div
                className="h-[400px] overflow-y-auto custom-scrollbar relative border-t border-[--border]"
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            >
                <VideoTimeline
                    project={project}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    selectedClipId={selectedClipIdState}
                    handlePlayPause={handlePlayPause}
                    handleSeek={handleSeek}
                    handleAddTrack={() => addTrack('video')}
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
