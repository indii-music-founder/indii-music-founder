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
    SourceSection
} from './VideoPropertySections';

interface VideoPropertiesPanelProps {
    project: VideoProject;
    selectedClip: VideoClip | undefined;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const VideoPropertiesPanel: React.FC<VideoPropertiesPanelProps> = ({ project, selectedClip, updateClip }) => {
    const [isFrameModalOpen, setIsFrameModalOpen] = useState(false);

    const handleSourceSelect = useCallback((item: HistoryItem) => {
        if (selectedClip) {
            updateClip(selectedClip.id, { src: item.url });
        }
    }, [selectedClip, updateClip]);

    const handleOpenFrameModal = useCallback(() => setIsFrameModalOpen(true), []);

    return (
        <PropertiesPanel title="Properties">
            <ProjectSettingsSection project={project} />

            {selectedClip ? (
                <>
                    <ClipBasicsSection selectedClip={selectedClip} updateClip={updateClip} />

                    <TransformSection
                        selectedClip={selectedClip}
                        updateClip={updateClip}
                    />

                    <FiltersSection selectedClip={selectedClip} updateClip={updateClip} />

                    <TransitionsSection selectedClip={selectedClip} updateClip={updateClip} />

                    {/* Content Specific */}
                    {selectedClip.type === 'text' && (
                        <ContentSection selectedClip={selectedClip} updateClip={updateClip} />
                    )}

                    {(selectedClip.type === 'video' || selectedClip.type === 'image' || selectedClip.type === 'audio') && (
                        <SourceSection
                            selectedClip={selectedClip}
                            updateClip={updateClip}
                            onOpenFrameModal={handleOpenFrameModal}
                        />
                    )}
                </>
            ) : (
                <div className="p-4 bg-gray-800/50 m-4 rounded border border-gray-800 text-center">
                    <p className="text-xs text-gray-500 italic">Select a clip to edit properties</p>
                </div>
            )}

            <FrameSelectionModal
                isOpen={isFrameModalOpen}
                onClose={() => setIsFrameModalOpen(false)}
                onSelect={handleSourceSelect}
                target="ingredient"
            />
        </PropertiesPanel>
    );
};
