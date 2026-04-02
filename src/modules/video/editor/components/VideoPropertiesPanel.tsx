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
        ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-2 items-start"
        : "";

    return (
        <PropertiesPanel title="Advanced Properties Hub" className={isPopoutActive ? "w-full flex-1 border-l-0 bg-[#0a0a0a]" : "w-64"}>
            <div className={contentWrapperClass}>
                <div className={isPopoutActive ? "bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] shadow-sm overflow-hidden" : ""}>
                    <ProjectSettingsSection project={project} />
                </div>

                {selectedClip ? (
                    <>
                        <div className={isPopoutActive ? "bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] shadow-sm overflow-hidden" : ""}>
                            <ClipBasicsSection selectedClip={selectedClip} updateClip={updateClip} />
                        </div>

                        <div className={isPopoutActive ? "bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] shadow-sm overflow-hidden" : ""}>
                            <TransformSection
                                selectedClip={selectedClip}
                                updateClip={updateClip}
                            />
                        </div>

                        <div className={isPopoutActive ? "bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] shadow-sm overflow-hidden" : ""}>
                            <FiltersSection selectedClip={selectedClip} updateClip={updateClip} />
                        </div>

                        <div className={isPopoutActive ? "bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] shadow-sm overflow-hidden" : ""}>
                            <TransitionsSection selectedClip={selectedClip} updateClip={updateClip} />
                        </div>

                        {/* Content Specific */}
                        {selectedClip.type === 'text' && (
                            <div className={isPopoutActive ? "bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] shadow-sm overflow-hidden" : ""}>
                                <ContentSection selectedClip={selectedClip} updateClip={updateClip} />
                            </div>
                        )}

                        {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                            <div className={isPopoutActive ? "bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] shadow-sm overflow-hidden" : ""}>
                                <AudioSection selectedClip={selectedClip} updateClip={updateClip} />
                            </div>
                        )}

                        {(selectedClip.type === 'video' || selectedClip.type === 'image' || selectedClip.type === 'audio') && (
                            <div className={isPopoutActive ? "bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] shadow-sm overflow-hidden" : ""}>
                                <SourceSection
                                    selectedClip={selectedClip}
                                    updateClip={updateClip}
                                    onOpenFrameModal={handleOpenFrameModal}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="p-4 bg-gradient-to-br from-gray-800/40 to-gray-900/40 m-2 rounded-lg border border-gray-800 shadow-xl space-y-4 md:col-span-2 xl:col-span-3">
                        <h3 className="text-sm font-semibold text-white tracking-tight">Studio Editor Workflow</h3>
                        <ul className="text-[11px] font-medium text-gray-400 text-left space-y-2">
                            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">&bull;</span> <span className="leading-snug"><strong>Add clips:</strong> Drag items from your Asset Library (left) onto the timeline below.</span></li>
                            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">&bull;</span> <span className="leading-snug"><strong>Add text overlays:</strong> Click the <span className="px-1.5 py-0.5 bg-gray-700/80 ring-1 ring-white/10 rounded text-[9px] text-white">Txt</span> button on any track header to spawn a text.</span></li>
                            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">&bull;</span> <span className="leading-snug"><strong>Edit properties:</strong> Click any clip in the timeline once to select it. Its text, filters, and scale will appear right here!</span></li>
                            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">&bull;</span> <span className="leading-snug"><strong>Transitions:</strong> Select a clip, then scroll down here to configure "Transition In" & "Transition Out".</span></li>
                            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">&bull;</span> <span className="leading-snug"><strong>Create a video:</strong> Click <span className="font-bold text-white bg-white/5 px-1.5 py-0.5 rounded ring-1 ring-white/10 text-[9px]">&larr; Back to Director</span> to use the AI generator.</span></li>
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
