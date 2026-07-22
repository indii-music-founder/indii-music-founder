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
import { useVideoProjectPersistence } from './hooks/useVideoProjectPersistence';
import AnnotationPalette from "../../components/AnnotationPalette";
import EditDefinitionsPanel from "../../components/EditDefinitionsPanel";
import { STUDIO_COLORS, CreativeColor } from '../../constants';

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
        handleDownloadMP4,
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

    useVideoProjectPersistence();

    const isPopoutActive = useVideoEditorStore(state => state.isPopoutActive);
    const isLoadingProject = useVideoEditorStore(state => state.isLoadingProject);
    const projectLoadError = useVideoEditorStore(state => state.projectLoadError);
    const projectSaveError = useVideoEditorStore(state => state.projectSaveError);

    const handleAddTrackVideo = React.useCallback(() => addTrack('video'), [addTrack]);
    const handleFrameUpdate = React.useCallback((frame: number) => setCurrentTime(frame), [setCurrentTime]);

    // Annotation Palette State
    const [activeColor, setActiveColor] = React.useState<CreativeColor>(STUDIO_COLORS[0]!);
    const [colorDefinitions, _setColorDefinitions] = React.useState<Record<string, string>>({});
    const [isDefinitionsOpen, setIsDefinitionsOpen] = React.useState(false);
    const [referenceImages, setReferenceImages] = React.useState<Record<string, { mimeType: string; data: string } | null>>({});

    const handleUpdateDefinition = React.useCallback((colorId: string, prompt: string) => {
        _setColorDefinitions(prev => ({ ...prev, [colorId]: prompt }));
    }, []);

    const handleUpdateReferenceImage = React.useCallback((colorId: string, image: { mimeType: string; data: string } | null) => {
        setReferenceImages(prev => ({ ...prev, [colorId]: image }));
    }, []);

    if (isLoadingProject) {
        return (
            <div className="flex items-center justify-center h-full bg-[--background] text-[--foreground] text-sm text-gray-400">
                Loading project timeline…
            </div>
        );
    }

    // ISSUE-1193/1195: a load failure must never fall through to an editable
    // blank timeline. We do not know what is stored, so the only safe posture is
    // to block editing and say so — the previous behaviour showed an empty
    // project and let the next autosave overwrite the real one.
    if (projectLoadError) {
        return (
            <div
                role="alert"
                className="flex flex-col items-center justify-center gap-4 h-full bg-[--background] text-[--foreground] px-6 text-center"
            >
                <h2 className="text-base font-bold text-red-400">Couldn’t load this timeline</h2>
                <p className="text-sm text-gray-400 max-w-md">{projectLoadError}</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-md text-xs font-bold uppercase transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[--background] text-[--foreground]">
            {/* ISSUE-1195: save failures were previously a logger.warn and nothing
                else. This banner persists until a save succeeds. */}
            {projectSaveError && (
                <div
                    role="alert"
                    className="shrink-0 bg-red-950/80 border-b border-red-800 text-red-200 text-xs px-4 py-2"
                >
                    <span className="font-bold">Not saved.</span> {projectSaveError}
                </div>
            )}
            <StudioToolbar
                className="bg-gray-900 border-gray-800"
                left={
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => useVideoEditorStore.getState().setViewMode('director')}
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-colors"
                        >
                            &larr; Back to Director
                        </button>
                        <h2 className="font-bold text-sm border-l border-gray-800 pl-4">Studio Editor</h2>
                        <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{project.width}x{project.height} @ {project.fps}fps</span>
                    </div>
                }
                right={
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownloadMP4}
                            disabled={isExporting}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isExporting ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                        >
                            {isExporting ? 'Working...' : 'Download MP4'}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            data-testid="video-export-btn"
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isExporting ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                        >
                            {isExporting ? 'Exporting...' : 'Cloud Render'}
                        </button>
                    </div>
                }
            />

            <div className="flex-1 min-h-0 flex overflow-hidden">
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
                    <div className="flex-1 flex bg-black relative transition-all duration-300 overflow-hidden">
                        {/* 8-Color Semantic Annotation Palette per Gemini 3 Architecture */}
                        <AnnotationPalette
                            activeColor={activeColor}
                            onColorSelect={setActiveColor}
                            colorDefinitions={colorDefinitions}
                            onOpenDefinitions={() => setIsDefinitionsOpen(true)}
                        />
                        <div className="flex-1 flex items-center justify-center relative">
                            <VideoPreview
                                playerRef={playerRef}
                                project={project}
                                onFrameUpdate={handleFrameUpdate}
                            />
                        </div>
                        <EditDefinitionsPanel
                            isOpen={isDefinitionsOpen}
                            onClose={() => setIsDefinitionsOpen(false)}
                            definitions={colorDefinitions}
                            onUpdateDefinition={handleUpdateDefinition}
                            referenceImages={referenceImages}
                            onUpdateReferenceImage={handleUpdateReferenceImage}
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
                className="h-[280px] flex-none shrink-0 overflow-y-auto custom-scrollbar relative border-t border-[#1a1a1a]"
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
