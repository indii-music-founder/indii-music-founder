import React, { useState, useCallback } from 'react';
import { VideoProject, VideoClip } from '../../store/videoEditorStore';
import { PropertiesPanel } from '@/components/studio/PropertiesPanel';
import FrameSelectionModal from '../../components/FrameSelectionModal';
import { HistoryItem } from '@/core/store';
import {
    ProjectSettingsSection,
    ClipBasicsSection,
    TransformSection,
    FiltersSection,
    TransitionsSection,
    ContentSection,
    SourceSection,
    AudioSection
} from './VideoPropertySections';

interface VideoPropertiesPanelProps {
    project: VideoProject;
    selectedClip: VideoClip | undefined;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
    isPopoutActive?: boolean;
}

export const VideoPropertiesPanel: React.FC<VideoPropertiesPanelProps> = ({ project, selectedClip, updateClip, isPopoutActive = false }) => {
    const [isFrameModalOpen, setIsFrameModalOpen] = useState(false);

    const handleSourceSelect = useCallback((item: HistoryItem) => {
        if (selectedClip) {
            updateClip(selectedClip.id, { src: item.url });
        }
    }, [selectedClip, updateClip]);

    const handleOpenFrameModal = useCallback(() => setIsFrameModalOpen(true), []);

    const contentWrapperClass = isPopoutActive
        ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6 items-start"
        : "";

    return (
        <PropertiesPanel title="Advanced Properties Hub" className={isPopoutActive ? "w-full flex-1 border-l-0 bg-[#0a0a0a]" : "w-64"}>
            <div className={contentWrapperClass}>
                <div className={isPopoutActive ? "bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl" : ""}>
                    <ProjectSettingsSection project={project} />
                </div>

                {selectedClip ? (
                    <>
                        <div className={isPopoutActive ? "bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl" : ""}>
                            <ClipBasicsSection selectedClip={selectedClip} updateClip={updateClip} />
                        </div>

                        <div className={isPopoutActive ? "bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl" : ""}>
                            <TransformSection
                                selectedClip={selectedClip}
                                updateClip={updateClip}
                            />
                        </div>

                        <div className={isPopoutActive ? "bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl" : ""}>
                            <FiltersSection selectedClip={selectedClip} updateClip={updateClip} />
                        </div>

                        <div className={isPopoutActive ? "bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl" : ""}>
                            <TransitionsSection selectedClip={selectedClip} updateClip={updateClip} />
                        </div>

                        {/* Content Specific */}
                        {selectedClip.type === 'text' && (
                            <div className={isPopoutActive ? "bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl" : ""}>
                                <ContentSection selectedClip={selectedClip} updateClip={updateClip} />
                            </div>
                        )}

                        {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                            <div className={isPopoutActive ? "bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl" : ""}>
                                <AudioSection selectedClip={selectedClip} updateClip={updateClip} />
                            </div>
                        )}

                        {(selectedClip.type === 'video' || selectedClip.type === 'image' || selectedClip.type === 'audio') && (
                            <div className={isPopoutActive ? "bg-gray-900/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl" : ""}>
                                <SourceSection
                                    selectedClip={selectedClip}
                                    updateClip={updateClip}
                                    onOpenFrameModal={handleOpenFrameModal}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="p-8 bg-gradient-to-br from-gray-800/40 to-gray-900/40 m-4 rounded-xl border border-gray-800 shadow-2xl space-y-6 md:col-span-2 xl:col-span-3">
                        <h3 className="text-lg font-bold text-white tracking-tight">Studio Editor Workflow</h3>
                        <ul className="text-sm font-medium text-gray-400 text-left space-y-4">
                            <li className="flex items-start gap-3"><span className="text-blue-400">&bull;</span> <span><strong>Add clips:</strong> Drag items from your Asset Library (left) onto the timeline below.</span></li>
                            <li className="flex items-start gap-3"><span className="text-blue-400">&bull;</span> <span><strong>Add text overlays:</strong> Click the <span className="px-1.5 py-0.5 bg-gray-700/80 ring-1 ring-white/10 rounded text-[11px] text-white">Txt</span> button on any track header to spawn a text.</span></li>
                            <li className="flex items-start gap-3"><span className="text-blue-400">&bull;</span> <span><strong>Edit properties:</strong> Click any clip in the timeline once to select it. Its text, filters, and scale will appear right here!</span></li>
                            <li className="flex items-start gap-3"><span className="text-blue-400">&bull;</span> <span><strong>Transitions:</strong> Select a clip, then scroll down here to configure "Transition In" & "Transition Out".</span></li>
                            <li className="flex items-start gap-3"><span className="text-blue-400">&bull;</span> <span><strong>Create a new video:</strong> Click <span className="font-bold text-white bg-white/5 px-2 py-1 rounded ring-1 ring-white/10">&larr; Back to Director</span> in the top left to use the AI generator.</span></li>
                        </ul>
                    </div>
                )}
            </div>

            <FrameSelectionModal
                isOpen={isFrameModalOpen}
                onClose={() => setIsFrameModalOpen(false)}
                onSelect={handleSourceSelect}
                target="ingredient"
            />
        </PropertiesPanel>
    );
};
