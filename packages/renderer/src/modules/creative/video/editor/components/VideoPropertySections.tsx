import React, { memo, useCallback } from 'react';
import { VideoProject, VideoClip, useVideoEditorStore } from '../../store/videoEditorStore';
import { PanelSection, PropertyRow } from '@/components/studio/PropertiesPanel';
import { KeyframeButton, StyledInput, StyledRange, StyledSelect, StyledTextArea } from './VideoPropertyInputs';
import { Image as ImageIcon } from 'lucide-react';

// --- Project Settings Section ---

export const ASPECT_RATIO_PRESETS = [
    { id: '16:9', label: '16:9 · Landscape', width: 1920, height: 1080 },
    { id: '9:16', label: '9:16 · Vertical', width: 1080, height: 1920 },
    { id: '1:1', label: '1:1 · Square', width: 1080, height: 1080 },
    { id: '4:5', label: '4:5 · Portrait', width: 1080, height: 1350 },
] as const;

interface ProjectSettingsSectionProps {
    project: VideoProject;
    onApplyAspect?: (width: number, height: number) => void;
}

export const ProjectSettingsSection = memo(({ project, onApplyAspect }: ProjectSettingsSectionProps) => {
    const active = ASPECT_RATIO_PRESETS.find(preset => preset.width === project.width && preset.height === project.height);
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
            {onApplyAspect && (
                <PropertyRow label="Aspect" className="mt-1.5">
                    <StyledSelect
                        value={active?.id ?? ''}
                        onChange={(e) => {
                            const preset = ASPECT_RATIO_PRESETS.find(p => p.id === e.target.value);
                            if (preset) onApplyAspect(preset.width, preset.height);
                        }}
                        data-testid="project-aspect-preset"
                    >
                        {!active && <option value="">{project.width}x{project.height} (custom)</option>}
                        {ASPECT_RATIO_PRESETS.map(preset => (
                            <option key={preset.id} value={preset.id}>{preset.label}</option>
                        ))}
                    </StyledSelect>
                </PropertyRow>
            )}
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

    const handlePlaybackRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseFloat(e.target.value);
        updateClip(selectedClip.id, { playbackRate: Number.isFinite(parsed) ? Math.min(4, Math.max(0.25, parsed)) : undefined });
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
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
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
            {(selectedClip.type === 'video' || selectedClip.type === 'audio') && (
                <PropertyRow label="Speed (0.25–4×)" className="mt-1.5">
                    <StyledInput
                        type="number"
                        step="0.25"
                        min="0.25"
                        max="4"
                        value={selectedClip.playbackRate ?? 1}
                        onChange={handlePlaybackRateChange}
                        data-testid="clip-playback-rate"
                    />
                </PropertyRow>
            )}
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

    const handleAnchorXChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        updateClip(selectedClip.id, { anchorX: parseFloat(e.target.value) }), [selectedClip.id, updateClip]);

    const handleAnchorYChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        updateClip(selectedClip.id, { anchorY: parseFloat(e.target.value) }), [selectedClip.id, updateClip]);

    const handleBorderRadiusChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) =>
        updateClip(selectedClip.id, { borderRadius: parseFloat(e.target.value) }), [selectedClip.id, updateClip]);

    return (
        <PanelSection title="Transform">
            <div className="grid grid-cols-2 gap-1.5 mb-1.5">
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
                <div className="flex items-center gap-1.5">
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
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
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
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <PropertyRow label="Anchor X">
                    <div className="flex items-center gap-1">
                        <StyledInput
                            type="number"
                            step="0.1"
                            value={selectedClip.anchorX ?? 0.5}
                            onChange={handleAnchorXChange}
                        />
                        <KeyframeButton
                            onClick={() => handleAddKeyframe('anchorX', selectedClip.anchorX ?? 0.5)}
                            active={hasKeyframeAtCurrentTime("anchorX")}
                        />
                    </div>
                </PropertyRow>
                <PropertyRow label="Anchor Y">
                    <div className="flex items-center gap-1">
                        <StyledInput
                            type="number"
                            step="0.1"
                            value={selectedClip.anchorY ?? 0.5}
                            onChange={handleAnchorYChange}
                        />
                        <KeyframeButton
                            onClick={() => handleAddKeyframe('anchorY', selectedClip.anchorY ?? 0.5)}
                            active={hasKeyframeAtCurrentTime("anchorY")}
                        />
                    </div>
                </PropertyRow>
            </div>
            <PropertyRow label="Border Radius" className="mt-1.5">
                <div className="flex items-center gap-1">
                    <StyledInput
                        type="number"
                        min="0"
                        value={selectedClip.borderRadius ?? 0}
                        onChange={handleBorderRadiusChange}
                    />
                    <KeyframeButton
                        onClick={() => handleAddKeyframe('borderRadius', selectedClip.borderRadius ?? 0)}
                        active={hasKeyframeAtCurrentTime("borderRadius")}
                    />
                </div>
            </PropertyRow>
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

    const handleFontSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { fontSize: parseInt(e.target.value) });
    }, [selectedClip.id, updateClip]);

    const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { textColor: e.target.value });
    }, [selectedClip.id, updateClip]);

    const handleWeightChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        updateClip(selectedClip.id, { fontWeight: e.target.value });
    }, [selectedClip.id, updateClip]);

    const handleAlignChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        updateClip(selectedClip.id, { textAlign: e.target.value as 'left' | 'center' | 'right' });
    }, [selectedClip.id, updateClip]);

    const handleFontFamilyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        updateClip(selectedClip.id, { fontFamily: e.target.value });
    }, [selectedClip.id, updateClip]);

    const handleLetterSpacingChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseFloat(e.target.value);
        updateClip(selectedClip.id, { letterSpacing: Number.isFinite(parsed) ? parsed : undefined });
    }, [selectedClip.id, updateClip]);

    const handleTextCaseChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        updateClip(selectedClip.id, { textCase: e.target.value as 'none' | 'uppercase' | 'lowercase' });
    }, [selectedClip.id, updateClip]);

    const handleTextBackgroundToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, e.target.checked
            ? { textBackground: { color: '#000000', padding: 12, radius: 8 } }
            : { textBackground: undefined });
    }, [selectedClip.id, updateClip]);

    const handleTextBackgroundColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { textBackground: { ...(selectedClip.textBackground ?? { color: '#000000', padding: 12, radius: 8 }), color: e.target.value } });
    }, [selectedClip.id, selectedClip.textBackground, updateClip]);

    const handleTextShadowToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, e.target.checked
            ? { textShadow: { color: 'rgba(0,0,0,0.65)', blur: 8, offsetX: 0, offsetY: 3 } }
            : { textShadow: undefined });
    }, [selectedClip.id, updateClip]);

    const handleTextShadowBlurChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const blur = parseInt(e.target.value);
        updateClip(selectedClip.id, { textShadow: { ...(selectedClip.textShadow ?? { color: 'rgba(0,0,0,0.65)', blur: 8, offsetX: 0, offsetY: 3 }), blur: Number.isFinite(blur) ? blur : undefined } });
    }, [selectedClip.id, selectedClip.textShadow, updateClip]);

    return (
        <PanelSection title="Text Content">
            <PropertyRow label="Text">
                <StyledTextArea
                    className="w-full min-h-[60px]"
                    value={selectedClip.text || ''}
                    onChange={handleTextChange}
                />
            </PropertyRow>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <PropertyRow label="Font Size">
                    <StyledInput
                        type="number"
                        min="8"
                        max="800"
                        value={selectedClip.fontSize ?? 50}
                        onChange={handleFontSizeChange}
                    />
                </PropertyRow>
                <PropertyRow label="Color">
                    <StyledInput
                        type="color"
                        value={selectedClip.textColor ?? '#ffffff'}
                        onChange={handleColorChange}
                    />
                </PropertyRow>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <PropertyRow label="Weight">
                    <StyledSelect value={selectedClip.fontWeight ?? 'bold'} onChange={handleWeightChange}>
                        <option value="normal">Normal</option>
                        <option value="500">Medium</option>
                        <option value="bold">Bold</option>
                        <option value="900">Black</option>
                    </StyledSelect>
                </PropertyRow>
                <PropertyRow label="Align">
                    <StyledSelect value={selectedClip.textAlign ?? 'center'} onChange={handleAlignChange}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                    </StyledSelect>
                </PropertyRow>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
                <PropertyRow label="Font">
                    <StyledSelect
                        value={selectedClip.fontFamily ?? 'Archivo Black'}
                        onChange={handleFontFamilyChange}
                        data-testid="text-font-family"
                    >
                        <option value="Archivo Black">Archivo Black</option>
                        <option value="Space Mono">Space Mono</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Oswald">Oswald</option>
                        <option value="League Gothic">League Gothic</option>
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="IBM Plex Mono">IBM Plex Mono</option>
                        <option value="Source Code Pro">Source Code Pro</option>
                    </StyledSelect>
                </PropertyRow>
                <PropertyRow label="Case">
                    <StyledSelect value={selectedClip.textCase ?? 'none'} onChange={handleTextCaseChange} data-testid="text-case">
                        <option value="none">As typed</option>
                        <option value="uppercase">UPPERCASE</option>
                        <option value="lowercase">lowercase</option>
                    </StyledSelect>
                </PropertyRow>
            </div>
            <PropertyRow label="Letter spacing (em)" className="mt-2">
                <StyledInput
                    type="number"
                    step="0.01"
                    min="-0.1"
                    max="0.5"
                    value={selectedClip.letterSpacing ?? 0}
                    onChange={handleLetterSpacingChange}
                    data-testid="text-letter-spacing"
                />
            </PropertyRow>
            <div className="grid grid-cols-2 gap-2 mt-2 items-center">
                <PropertyRow label="Caption panel">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={Boolean(selectedClip.textBackground)}
                            onChange={handleTextBackgroundToggle}
                            data-testid="text-background-toggle"
                        />
                        {selectedClip.textBackground && (
                            <StyledInput
                                type="color"
                                value={selectedClip.textBackground.color}
                                onChange={handleTextBackgroundColorChange}
                                data-testid="text-background-color"
                            />
                        )}
                    </div>
                </PropertyRow>
                <PropertyRow label="Shadow">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={Boolean(selectedClip.textShadow)}
                            onChange={handleTextShadowToggle}
                            data-testid="text-shadow-toggle"
                        />
                        {selectedClip.textShadow && (
                            <StyledInput
                                type="number"
                                min="0"
                                max="40"
                                value={selectedClip.textShadow.blur ?? 8}
                                onChange={handleTextShadowBlurChange}
                                title="Blur (px)"
                                data-testid="text-shadow-blur"
                            />
                        )}
                    </div>
                </PropertyRow>
            </div>
        </PanelSection>
    );
});
ContentSection.displayName = 'ContentSection';

// --- Treatment Section (cinematic entrance / count-up / audio fades) ---

interface TreatmentSectionProps {
    selectedClip: VideoClip;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const TreatmentSection = memo(({ selectedClip, updateClip }: TreatmentSectionProps) => {
    const isText = selectedClip.type === 'text';
    const isVisual = selectedClip.type !== 'audio';
    const supportsFades = selectedClip.type === 'audio' || selectedClip.hasAudio === true;

    const handleEntranceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value as 'none' | 'waterfall' | 'inverse-zoom';
        if (value === 'none') {
            updateClip(selectedClip.id, { entrance: undefined });
        } else {
            updateClip(selectedClip.id, { entrance: { type: value } });
        }
    }, [selectedClip.id, updateClip]);

    const handleCountUpToggle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            updateClip(selectedClip.id, {
                countUp: { to: 10, suffix: '' },
                entrance: undefined, // counter and waterfall cannot coexist (compiler contract)
            });
        } else {
            updateClip(selectedClip.id, { countUp: undefined });
        }
    }, [selectedClip.id, updateClip]);

    const handleCountUpTarget = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const to = parseInt(e.target.value);
        if (!Number.isFinite(to) || to < 0) return;
        updateClip(selectedClip.id, { countUp: { ...(selectedClip.countUp ?? { to: 10, suffix: '' }), to } });
    }, [selectedClip.id, selectedClip.countUp, updateClip]);

    const handleCountUpSuffix = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { countUp: { ...(selectedClip.countUp ?? { to: 10, suffix: '' }), suffix: e.target.value } });
    }, [selectedClip.id, selectedClip.countUp, updateClip]);

    const handleCountUpPrefix = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { countUp: { ...(selectedClip.countUp ?? { to: 10, suffix: '' }), prefix: e.target.value } });
    }, [selectedClip.id, selectedClip.countUp, updateClip]);

    const parseFadeSeconds = (value: string): number | undefined => {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    };

    const handleFadeInChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, {
            audioFade: { ...(selectedClip.audioFade ?? {}), inSeconds: parseFadeSeconds(e.target.value) },
        });
    }, [selectedClip.id, selectedClip.audioFade, updateClip]);

    const handleFadeOutChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, {
            audioFade: { ...(selectedClip.audioFade ?? {}), outSeconds: parseFadeSeconds(e.target.value) },
        });
    }, [selectedClip.id, selectedClip.audioFade, updateClip]);

    return (
        <PanelSection title="Treatment" defaultOpen={false}>
            {isVisual && (
                <PropertyRow label="Entrance">
                    <StyledSelect
                        value={selectedClip.entrance?.type ?? 'none'}
                        onChange={handleEntranceChange}
                        data-testid="treatment-entrance"
                    >
                        <option value="none">None</option>
                        {isText && <option value="waterfall">Waterfall words</option>}
                        <option value="inverse-zoom">Inverse zoom</option>
                    </StyledSelect>
                </PropertyRow>
            )}

            {isText && (
                <>
                    <PropertyRow label="Count-up">
                        <input
                            type="checkbox"
                            checked={Boolean(selectedClip.countUp)}
                            onChange={handleCountUpToggle}
                            data-testid="treatment-countup-toggle"
                        />
                    </PropertyRow>
                    {selectedClip.countUp && (
                        <>
                            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                <PropertyRow label="To">
                                    <StyledInput
                                        type="number"
                                        min="0"
                                        value={selectedClip.countUp.to}
                                        onChange={handleCountUpTarget}
                                        data-testid="treatment-countup-to"
                                    />
                                </PropertyRow>
                                <PropertyRow label="Suffix">
                                    <StyledInput
                                        type="text"
                                        value={selectedClip.countUp.suffix ?? ''}
                                        onChange={handleCountUpSuffix}
                                        placeholder="AGENTS"
                                        data-testid="treatment-countup-suffix"
                                    />
                                </PropertyRow>
                            </div>
                            <PropertyRow label="Prefix" className="mt-1.5">
                                <StyledInput
                                    type="text"
                                    value={selectedClip.countUp.prefix ?? ''}
                                    onChange={handleCountUpPrefix}
                                    placeholder="$"
                                    data-testid="treatment-countup-prefix"
                                />
                            </PropertyRow>
                        </>
                    )}
                </>
            )}

            {supportsFades && (
                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    <PropertyRow label="Fade in (s)">
                        <StyledInput
                            type="number"
                            min="0"
                            step="0.5"
                            value={selectedClip.audioFade?.inSeconds ?? ''}
                            onChange={handleFadeInChange}
                            placeholder="0"
                            data-testid="treatment-fade-in"
                        />
                    </PropertyRow>
                    <PropertyRow label="Fade out (s)">
                        <StyledInput
                            type="number"
                            min="0"
                            step="0.5"
                            value={selectedClip.audioFade?.outSeconds ?? ''}
                            onChange={handleFadeOutChange}
                            placeholder="0"
                            data-testid="treatment-fade-out"
                        />
                    </PropertyRow>
                </div>
            )}

            {!isVisual && !supportsFades && (
                <p className="text-[10px] text-gray-500">No treatment options for this clip type.</p>
            )}
        </PanelSection>
    );
});
TreatmentSection.displayName = 'TreatmentSection';

// --- Audio Section ---

interface AudioSectionProps {
    selectedClip: VideoClip;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const AudioSection = memo(({ selectedClip, updateClip }: AudioSectionProps) => {
    const ObjectCurrentTime = useVideoEditorStore(state => state.currentTime);
    const currentTime = ObjectCurrentTime;

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateClip(selectedClip.id, { volume: parseFloat(e.target.value) });
    }, [selectedClip.id, updateClip]);

    const handleAddKeyframe = useCallback((property: string, value: number) => {
        const relativeFrame = Math.max(0, currentTime - selectedClip.startFrame);
        if (relativeFrame > selectedClip.durationInFrames) return;
        const currentKeyframes = selectedClip.keyframes?.[property] || [];
        const filteredKeyframes = currentKeyframes.filter(k => k.frame !== relativeFrame);
        const newKeyframes = [...filteredKeyframes, { frame: relativeFrame, value }].sort((a, b) => a.frame - b.frame);
        updateClip(selectedClip.id, { keyframes: { ...selectedClip.keyframes, [property]: newKeyframes } });
    }, [selectedClip, currentTime, updateClip]);

    const hasKeyframeAtCurrentTime = (property: string) => {
        if (!selectedClip.keyframes?.[property]) return false;
        const relativeFrame = currentTime - selectedClip.startFrame;
        return selectedClip.keyframes[property].some(k => Math.abs(k.frame - relativeFrame) < 1);
    };

    return (
        <PanelSection title="Audio Configuration">
            <PropertyRow label="Volume">
                <div className="flex items-center gap-2">
                    <StyledRange
                        min="0"
                        max="1"
                        step="0.05"
                        value={selectedClip.volume ?? 1}
                        onChange={handleVolumeChange}
                    />
                    <KeyframeButton
                        onClick={() => handleAddKeyframe('volume', selectedClip.volume ?? 1)}
                        active={hasKeyframeAtCurrentTime("volume")}
                    />
                </div>
            </PropertyRow>
        </PanelSection>
    );
});
AudioSection.displayName = 'AudioSection';

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
