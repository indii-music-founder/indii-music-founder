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
import { TreatmentPicker } from './components/TreatmentPicker';
import { useDesktopRenderRelay } from '@/services/video/DesktopRenderRelayService';
import AnnotationPalette from "../../components/AnnotationPalette";
import EditDefinitionsPanel from "../../components/EditDefinitionsPanel";
import { STUDIO_COLORS, CreativeColor } from '../../constants';

interface VideoEditorProps {
    initialVideo?: HistoryItem;
}

export const VideoEditor: React.FC<VideoEditorProps> = ({ initialVideo }) => {
    const {
        project,
        previewArtifactUrl,
        currentTime,
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
    // Desktop only: execute queued cloud render jobs while the studio runs.
    useDesktopRenderRelay();

    const isPopoutActive = useVideoEditorStore(state => state.isPopoutActive);
    const isLoadingProject = useVideoEditorStore(state => state.isLoadingProject);
    const projectLoadError = useVideoEditorStore(state => state.projectLoadError);
    const projectSaveError = useVideoEditorStore(state => state.projectSaveError);
    const isEphemeralSession = useVideoEditorStore(state => state.isEphemeralSession);
    const canUndo = useVideoEditorStore(state => state.past.length > 0);
    const canRedo = useVideoEditorStore(state => state.future.length > 0);
    const timelineZoom = useVideoEditorStore(state => state.timelineZoom);
    const loopRegion = useVideoEditorStore(state => state.loopRegion);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey)) return;
            if (event.key.toLowerCase() === 'z' && event.shiftKey) {
                event.preventDefault();
                useVideoEditorStore.getState().redo();
            } else if (event.key.toLowerCase() === 'z') {
                event.preventDefault();
                useVideoEditorStore.getState().undo();
            } else if (event.key === 'Backspace') {
                const selected = useVideoEditorStore.getState().selectedClipId;
                if (selected) {
                    event.preventDefault();
                    useVideoEditorStore.getState().rippleDeleteClip(selected);
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

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
            {/* ISSUE-1194: a guest can reach this editor, but Firestore denies every
                write for anonymous sessions. Say so up front — the previous behaviour
                accepted the work and discarded it without a word. Amber, not red:
                this is a limitation of not having an account, not a malfunction. */}
            {isEphemeralSession && (
                <div
                    role="status"
                    className="shrink-0 bg-amber-950/80 border-b border-amber-800 text-amber-200 text-xs px-4 py-2"
                >
                    <span className="font-bold">Not saved.</span>{' '}
                    You’re signed in as a guest, so this timeline won’t be kept. Create an account to save your work.
                </div>
            )}

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
                        <div className="flex items-center gap-1 bg-gray-800 rounded-md px-1">
                            <button
                                onClick={() => useVideoEditorStore.getState().setTimelineZoom(timelineZoom / 1.5)}
                                data-testid="video-zoom-out-btn"
                                title="Zoom out"
                                className="px-2 py-1.5 text-gray-300 hover:text-white text-sm font-bold"
                            >
                                −
                            </button>
                            <span className="text-[10px] text-gray-400 w-10 text-center" data-testid="video-zoom-label">
                                {Math.round(timelineZoom * 100)}%
                            </span>
                            <button
                                onClick={() => useVideoEditorStore.getState().setTimelineZoom(timelineZoom * 1.5)}
                                data-testid="video-zoom-in-btn"
                                title="Zoom in"
                                className="px-2 py-1.5 text-gray-300 hover:text-white text-sm font-bold"
                            >
                                +
                            </button>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-800 rounded-md px-1" title="Loop region">
                            <button
                                onClick={() => useVideoEditorStore.getState().setLoopIn()}
                                data-testid="video-loop-in-btn"
                                title="Set loop in-point at the playhead"
                                className="px-2 py-1.5 text-gray-300 hover:text-white text-[10px] font-bold"
                            >
                                ⟦
                            </button>
                            <span className="text-[10px] text-gray-400" data-testid="video-loop-label">
                                {loopRegion ? `${loopRegion.a}–${loopRegion.b}f` : 'loop'}
                            </span>
                            <button
                                onClick={() => useVideoEditorStore.getState().setLoopOut()}
                                data-testid="video-loop-out-btn"
                                title="Set loop out-point at the playhead"
                                className="px-2 py-1.5 text-gray-300 hover:text-white text-[10px] font-bold"
                            >
                                ⟧
                            </button>
                            {loopRegion && (
                                <button
                                    onClick={() => useVideoEditorStore.getState().clearLoop()}
                                    data-testid="video-loop-clear-btn"
                                    title="Clear the loop region"
                                    className="px-1.5 py-1.5 text-gray-400 hover:text-red-300 text-[10px] font-bold"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => useVideoEditorStore.getState().undo()}
                            disabled={!canUndo}
                            data-testid="video-undo-btn"
                            title="Undo (⌘Z)"
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${canUndo ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-900 text-gray-600 cursor-not-allowed'}`}
                        >
                            ↩
                        </button>
                        <button
                            onClick={() => useVideoEditorStore.getState().redo()}
                            disabled={!canRedo}
                            data-testid="video-redo-btn"
                            title="Redo (⌘⇧Z)"
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${canRedo ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-900 text-gray-600 cursor-not-allowed'}`}
                        >
                            ↪
                        </button>
                        <TreatmentPicker />
                        {selectedClipIdState && (
                            <>
                                <button
                                    onClick={() => useVideoEditorStore.getState().splitClip(selectedClipIdState, currentTime)}
                                    data-testid="video-split-btn"
                                    title="Split the selected clip at the playhead"
                                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
                                >
                                    ✂
                                </button>
                                <button
                                    onClick={() => useVideoEditorStore.getState().duplicateClip(selectedClipIdState)}
                                    data-testid="video-duplicate-btn"
                                    title="Duplicate the selected clip"
                                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
                                >
                                    ⧉
                                </button>
                                <button
                                    onClick={() => useVideoEditorStore.getState().removeClip(selectedClipIdState)}
                                    data-testid="video-delete-btn"
                                    title="Delete the selected clip"
                                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-800 hover:bg-red-900 text-red-300 transition-colors"
                                >
                                    🗑
                                </button>
                                <button
                                    onClick={() => useVideoEditorStore.getState().rippleDeleteClip(selectedClipIdState)}
                                    data-testid="video-ripple-delete-btn"
                                    title="Ripple delete — remove and close the gap (⌘⌫)"
                                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-800 hover:bg-red-900 text-red-200 transition-colors"
                                >
                                    Ripple ⌫
                                </button>
                            </>
                        )}
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
                            {isExporting ? 'Rendering…' : 'Render Video'}
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
                                artifactUrl={previewArtifactUrl}
                                seekRequest={{ frame: currentTime, nonce: currentTime }}
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
