import React, { memo, useCallback } from 'react';
import { VideoProject, VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { PanelSection, PropertyRow } from '@/components/studio/PropertiesPanel';
import { KeyframeButton, StyledInput, StyledRange, StyledSelect, StyledTextArea } from './VideoPropertyInputs';
import { Image as ImageIcon } from 'lucide-react';

// --- Project Settings Section ---

interface ProjectSettingsSectionProps {
    project: VideoProject;
}

export const ProjectSettingsSection = memo(({ project }: ProjectSettingsSectionProps) => {
    return (
        <PanelSection title="Project Settings" defaultOpen={true}>
            <PropertyRow label="Project Name">
                <StyledInput
                    type="text"
                    value={project.name || 'Untitled Project'}
                    readOnly
                    onChange={() => { }}
                />
            </PropertyRow>
        </PanelSection>
    );
});
ProjectSettingsSection.displayName = 'ProjectSettingsSection';

// --- Clip Basics Section ---

interface ClipBasicsSectionProps {
    selectedClip: VideoClip;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const ClipBasicsSection = memo(({ selectedClip, updateClip }: ClipBasicsSectionProps) => {
    const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { name: e.target.value });
    }, [selectedClip.id, updateClip]);

    const handleStartFrameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { startFrame: parseInt(e.target.value) || 0 });
    }, [selectedClip.id, updateClip]);

    const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { durationInFrames: parseInt(e.target.value) || 1 });
    }, [selectedClip.id, updateClip]);

    return (
        <PanelSection title="Clip Basics">
            <PropertyRow label="Name">
                <StyledInput
                    type="text"
                    value={selectedClip.name}
                    onChange={handleNameChange}
                />
            </PropertyRow>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <PropertyRow label="Start Frame">
                    <StyledInput
                        type="number"
                        value={selectedClip.startFrame}
                        onChange={handleStartFrameChange}
                    />
                </PropertyRow>
                <PropertyRow label="Duration">
                    <StyledInput
                        type="number"
                        value={selectedClip.durationInFrames}
                        onChange={handleDurationChange}
                    />
                </PropertyRow>
            </div>
        </PanelSection>
    );
});
ClipBasicsSection.displayName = 'ClipBasicsSection';

// --- Transform Section ---

interface TransformSectionProps {
    selectedClip: VideoClip;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const TransformSection = memo(({ selectedClip, updateClip }: TransformSectionProps) => {
    const ObjectCurrentTime = useVideoEditorStore(state => state.currentTime);
    const currentTime = ObjectCurrentTime;

    // Keyframe Logic
    const handleAddKeyframe = useCallback((property: string, value: number) => {
        const relativeFrame = Math.max(0, currentTime - selectedClip.startFrame);
        if (relativeFrame > selectedClip.durationInFrames) return;

        const currentKeyframes = selectedClip.keyframes?.[property] || [];
        const filteredKeyframes = currentKeyframes.filter(k => k.frame !== relativeFrame);

        const newKeyframes = [
            ...filteredKeyframes,
            { frame: relativeFrame, value }
        ].sort((a, b) => a.frame - b.frame);

        updateClip(selectedClip.id, {
            keyframes: {
                ...selectedClip.keyframes,
                [property]: newKeyframes
            }
        });
    }, [selectedClip, currentTime, updateClip]);

    const hasKeyframeAtCurrentTime = (property: string) => {
        if (!selectedClip.keyframes?.[property]) return false;
        const relativeFrame = currentTime - selectedClip.startFrame;
        return selectedClip.keyframes[property].some(k => Math.abs(k.frame - relativeFrame) < 1);
    };

    // Property Updaters
    const handleScaleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        updateClip(selectedClip.id, { scale: parseFloat(e.target.value) }), [selectedClip.id, updateClip]);

    const handleRotationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        updateClip(selectedClip.id, { rotation: parseFloat(e.target.value) }), [selectedClip.id, updateClip]);

    const handleOpacityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        updateClip(selectedClip.id, { opacity: parseFloat(e.target.value) }), [selectedClip.id, updateClip]);

    const handleXChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        updateClip(selectedClip.id, { x: parseFloat(e.target.value) }), [selectedClip.id, updateClip]);

    const handleYChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        updateClip(selectedClip.id, { y: parseFloat(e.target.value) }), [selectedClip.id, updateClip]);

    return (
        <PanelSection title="Transform">
            <div className="grid grid-cols-2 gap-2 mb-2">
                <PropertyRow label="Scale">
                    <div className="flex items-center gap-1">
                        <StyledInput
                            type="number"
                            step="0.1"
                            value={selectedClip.scale ?? 1}
                            onChange={handleScaleChange}
                        />
                        <KeyframeButton
                            onClick={() => handleAddKeyframe('scale', selectedClip.scale ?? 1)}
                            active={hasKeyframeAtCurrentTime("scale")}
                        />
                    </div>
                </PropertyRow>
                <PropertyRow label="Rotation">
                    <div className="flex items-center gap-1">
                        <StyledInput
                            type="number"
                            value={selectedClip.rotation ?? 0}
                            onChange={handleRotationChange}
                        />
                        <KeyframeButton
                            onClick={() => handleAddKeyframe('rotation', selectedClip.rotation ?? 0)}
                            active={hasKeyframeAtCurrentTime("rotation")}
                        />
                    </div>
                </PropertyRow>
            </div>
            <PropertyRow label="Opacity">
                <div className="flex items-center gap-2">
                    <StyledRange
                        min="0"
                        max="1"
                        step="0.1"
                        value={selectedClip.opacity ?? 1}
                        onChange={handleOpacityChange}
                    />
                    <KeyframeButton
                        onClick={() => handleAddKeyframe('opacity', selectedClip.opacity ?? 1)}
                        active={hasKeyframeAtCurrentTime("opacity")}
                    />
                </div>
            </PropertyRow>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <PropertyRow label="X Position">
                    <div className="flex items-center gap-1">
                        <StyledInput
                            type="number"
                            value={selectedClip.x ?? 0}
                            onChange={handleXChange}
                        />
                        <KeyframeButton
                            onClick={() => handleAddKeyframe('x', selectedClip.x ?? 0)}
                            active={hasKeyframeAtCurrentTime("x")}
                        />
                    </div>
                </PropertyRow>
                <PropertyRow label="Y Position">
                    <div className="flex items-center gap-1">
                        <StyledInput
                            type="number"
                            value={selectedClip.y ?? 0}
                            onChange={handleYChange}
                        />
                        <KeyframeButton
                            onClick={() => handleAddKeyframe('y', selectedClip.y ?? 0)}
                            active={hasKeyframeAtCurrentTime("y")}
                        />
                    </div>
                </PropertyRow>
            </div>
        </PanelSection>
    );
});
TransformSection.displayName = 'TransformSection';

// --- Filters Section ---

interface FiltersSectionProps {
    selectedClip: VideoClip;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const FiltersSection = memo(({ selectedClip, updateClip }: FiltersSectionProps) => {
    const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const type = e.target.value as 'none' | 'blur' | 'grayscale' | 'sepia' | 'contrast' | 'brightness';
        if (type === 'none') {
            updateClip(selectedClip.id, { filter: undefined });
        } else {
            updateClip(selectedClip.id, { filter: { type, intensity: 50 } });
        }
    }, [selectedClip.id, updateClip]);

    const handleIntensityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedClip.filter) return;
        updateClip(selectedClip.id, { filter: { ...selectedClip.filter, intensity: parseInt(e.target.value) } });
    }, [selectedClip.id, selectedClip.filter, updateClip]);

    return (
        <PanelSection title="Filters">
            <PropertyRow label="Type">
                <StyledSelect
                    className="w-full mb-2"
                    value={selectedClip.filter?.type || 'none'}
                    onChange={handleTypeChange}
                >
                    <option value="none">None</option>
                    <option value="blur">Blur</option>
                    <option value="grayscale">Grayscale</option>
                    <option value="sepia">Sepia</option>
                    <option value="contrast">Contrast</option>
                    <option value="brightness">Brightness</option>
                </StyledSelect>
            </PropertyRow>
            {selectedClip.filter && (
                <PropertyRow label="Intensity">
                    <StyledRange
                        min="0"
                        max="100"
                        value={selectedClip.filter.intensity}
                        onChange={handleIntensityChange}
                    />
                </PropertyRow>
            )}
        </PanelSection>
    );
});
FiltersSection.displayName = 'FiltersSection';

// --- Transitions Section ---

interface TransitionsSectionProps {
    selectedClip: VideoClip;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const TransitionsSection = memo(({ selectedClip, updateClip }: TransitionsSectionProps) => {

    const handleInTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const type = e.target.value as 'none' | 'fade' | 'slide' | 'wipe' | 'zoom';
        if (type === 'none') {
            updateClip(selectedClip.id, { transitionIn: undefined });
        } else {
            updateClip(selectedClip.id, { transitionIn: { type, duration: 15 } });
        }
    }, [selectedClip.id, updateClip]);

    const handleInDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedClip.transitionIn) return;
        updateClip(selectedClip.id, { transitionIn: { ...selectedClip.transitionIn, duration: parseInt(e.target.value) } });
    }, [selectedClip.id, selectedClip.transitionIn, updateClip]);

    const handleOutTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const type = e.target.value as 'none' | 'fade' | 'slide' | 'wipe' | 'zoom';
        if (type === 'none') {
            updateClip(selectedClip.id, { transitionOut: undefined });
        } else {
            updateClip(selectedClip.id, { transitionOut: { type, duration: 15 } });
        }
    }, [selectedClip.id, updateClip]);

    const handleOutDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedClip.transitionOut) return;
        updateClip(selectedClip.id, { transitionOut: { ...selectedClip.transitionOut, duration: parseInt(e.target.value) } });
    }, [selectedClip.id, selectedClip.transitionOut, updateClip]);

    return (
        <PanelSection title="Transitions">
            <PropertyRow label="In">
                <div className="flex gap-2">
                    <StyledSelect
                        className="flex-1"
                        value={selectedClip.transitionIn?.type || 'none'}
                        onChange={handleInTypeChange}
                    >
                        <option value="none">None</option>
                        <option value="fade">Fade</option>
                        <option value="slide">Slide</option>
                        <option value="wipe">Wipe</option>
                        <option value="zoom">Zoom</option>
                    </StyledSelect>
                    {selectedClip.transitionIn && (
                        <StyledInput
                            type="number"
                            className="w-16"
                            value={selectedClip.transitionIn.duration}
                            onChange={handleInDurationChange}
                            title="Duration (frames)"
                        />
                    )}
                </div>
            </PropertyRow>
            <PropertyRow label="Out">
                <div className="flex gap-2">
                    <StyledSelect
                        className="flex-1"
                        value={selectedClip.transitionOut?.type || 'none'}
                        onChange={handleOutTypeChange}
                    >
                        <option value="none">None</option>
                        <option value="fade">Fade</option>
                        <option value="slide">Slide</option>
                        <option value="wipe">Wipe</option>
                        <option value="zoom">Zoom</option>
                    </StyledSelect>
                    {selectedClip.transitionOut && (
                        <StyledInput
                            type="number"
                            className="w-16"
                            value={selectedClip.transitionOut.duration}
                            onChange={handleOutDurationChange}
                            title="Duration (frames)"
                        />
                    )}
                </div>
            </PropertyRow>
        </PanelSection>
    );
});
TransitionsSection.displayName = 'TransitionsSection';

// --- Content Section (Text) ---

interface ContentSectionProps {
    selectedClip: VideoClip;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const ContentSection = memo(({ selectedClip, updateClip }: ContentSectionProps) => {
    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateClip(selectedClip.id, { text: e.target.value });
    }, [selectedClip.id, updateClip]);

    return (
        <PanelSection title="Content">
            <PropertyRow label="Text Content">
                <StyledTextArea
                    className="w-full min-h-[60px]"
                    value={selectedClip.text || ''}
                    onChange={handleTextChange}
                />
            </PropertyRow>
        </PanelSection>
    );
});
ContentSection.displayName = 'ContentSection';

// --- Source Section ---

interface SourceSectionProps {
    selectedClip: VideoClip;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
    onOpenFrameModal: () => void;
}

export const SourceSection = memo(({ selectedClip, updateClip, onOpenFrameModal }: SourceSectionProps) => {
    const handleSrcChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { src: e.target.value });
    }, [selectedClip.id, updateClip]);

    return (
        <PanelSection title="Source">
            <PropertyRow label="Source URL">
                <div className="flex gap-2">
                    <StyledInput
                        type="text"
                        value={selectedClip.src || ''}
                        onChange={handleSrcChange}
                    />
                    <button
                        onClick={onOpenFrameModal}
                        className="px-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors border border-gray-700"
                        title="Browse or Generate..."
                    >
                        <ImageIcon size={14} />
                    </button>
                </div>
            </PropertyRow>
        </PanelSection>
    );
});
SourceSection.displayName = 'SourceSection';
