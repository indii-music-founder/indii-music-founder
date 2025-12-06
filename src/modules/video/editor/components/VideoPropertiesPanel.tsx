import React from 'react';
import { VideoProject, VideoClip } from '../../store/videoEditorStore';
import { PropertiesPanel, PanelSection, PropertyRow } from '@/components/studio/PropertiesPanel';

interface VideoPropertiesPanelProps {
    project: VideoProject;
    selectedClip: VideoClip | undefined;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
    currentTime: number;
}

export const VideoPropertiesPanel: React.FC<VideoPropertiesPanelProps> = ({ project, selectedClip, updateClip, currentTime }) => {

    const handleAddKeyframe = (property: string, value: number) => {
        if (!selectedClip) return;

        const relativeFrame = Math.max(0, currentTime - selectedClip.startFrame);
        if (relativeFrame > selectedClip.durationInFrames) return; // Can't add keyframe outside clip

        const currentKeyframes = selectedClip.keyframes?.[property] || [];
        // Remove existing keyframe at this frame if any
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
    };

    const hasKeyframeAtCurrentTime = (property: string) => {
        if (!selectedClip || !selectedClip.keyframes?.[property]) return false;
        const relativeFrame = currentTime - selectedClip.startFrame;
        return selectedClip.keyframes[property].some(k => Math.abs(k.frame - relativeFrame) < 1); // Allow 1 frame tolerance
    };

    const KeyframeButton = ({ property, value }: { property: string, value: number }) => (
        <button
            onClick={() => handleAddKeyframe(property, value)}
            className={`p-1 rounded hover:bg-gray-700 ${hasKeyframeAtCurrentTime(property) ? 'text-purple-400' : 'text-gray-500'}`}
            title="Add/Update Keyframe"
        >
            <div className="w-2 h-2 transform rotate-45 border border-current bg-current" />
        </button>
    );

    return (
        <PropertiesPanel title="Properties">
            <PanelSection title="Project Settings" defaultOpen={true}>
                <PropertyRow label="Project Name">
                    <input
                        type="text"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                        value={project.name}
                        readOnly
                    />
                </PropertyRow>
            </PanelSection>

            {selectedClip ? (
                <>
                    <PanelSection title="Clip Basics">
                        <PropertyRow label="Name">
                            <input
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                value={selectedClip.name}
                                onChange={(e) => updateClip(selectedClip.id, { name: e.target.value })}
                            />
                        </PropertyRow>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <PropertyRow label="Start Frame">
                                <input
                                    type="number"
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    value={selectedClip.startFrame}
                                    onChange={(e) => updateClip(selectedClip.id, { startFrame: parseInt(e.target.value) || 0 })}
                                />
                            </PropertyRow>
                            <PropertyRow label="Duration">
                                <input
                                    type="number"
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    value={selectedClip.durationInFrames}
                                    onChange={(e) => updateClip(selectedClip.id, { durationInFrames: parseInt(e.target.value) || 1 })}
                                />
                            </PropertyRow>
                        </div>
                    </PanelSection>

                    <PanelSection title="Transform">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <PropertyRow label="Scale">
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.scale ?? 1}
                                        onChange={(e) => updateClip(selectedClip.id, { scale: parseFloat(e.target.value) })}
                                    />
                                    <KeyframeButton property="scale" value={selectedClip.scale ?? 1} />
                                </div>
                            </PropertyRow>
                            <PropertyRow label="Rotation">
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.rotation ?? 0}
                                        onChange={(e) => updateClip(selectedClip.id, { rotation: parseFloat(e.target.value) })}
                                    />
                                    <KeyframeButton property="rotation" value={selectedClip.rotation ?? 0} />
                                </div>
                            </PropertyRow>
                        </div>
                        <PropertyRow label="Opacity">
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    className="w-full"
                                    value={selectedClip.opacity ?? 1}
                                    onChange={(e) => updateClip(selectedClip.id, { opacity: parseFloat(e.target.value) })}
                                />
                                <KeyframeButton property="opacity" value={selectedClip.opacity ?? 1} />
                            </div>
                        </PropertyRow>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <PropertyRow label="X Position">
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.x ?? 0}
                                        onChange={(e) => updateClip(selectedClip.id, { x: parseFloat(e.target.value) })}
                                    />
                                    <KeyframeButton property="x" value={selectedClip.x ?? 0} />
                                </div>
                            </PropertyRow>
                            <PropertyRow label="Y Position">
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.y ?? 0}
                                        onChange={(e) => updateClip(selectedClip.id, { y: parseFloat(e.target.value) })}
                                    />
                                    <KeyframeButton property="y" value={selectedClip.y ?? 0} />
                                </div>
                            </PropertyRow>
                        </div>
                    </PanelSection>

                    <PanelSection title="Filters">
                        <PropertyRow label="Type">
                            <select
                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none mb-2"
                                value={selectedClip.filter?.type || 'none'}
                                onChange={(e) => {
                                    const type = e.target.value as any;
                                    if (type === 'none') {
                                        updateClip(selectedClip.id, { filter: undefined });
                                    } else {
                                        updateClip(selectedClip.id, { filter: { type, intensity: 50 } });
                                    }
                                }}
                            >
                                <option value="none">None</option>
                                <option value="blur">Blur</option>
                                <option value="grayscale">Grayscale</option>
                                <option value="sepia">Sepia</option>
                                <option value="contrast">Contrast</option>
                                <option value="brightness">Brightness</option>
                            </select>
                        </PropertyRow>
                        {selectedClip.filter && (
                            <PropertyRow label="Intensity">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    className="w-full"
                                    value={selectedClip.filter.intensity}
                                    onChange={(e) => updateClip(selectedClip.id, { filter: { ...selectedClip.filter!, intensity: parseInt(e.target.value) } })}
                                />
                            </PropertyRow>
                        )}
                    </PanelSection>

                    <PanelSection title="Transitions">
                        <PropertyRow label="In">
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    value={selectedClip.transitionIn?.type || 'none'}
                                    onChange={(e) => {
                                        const type = e.target.value as any;
                                        if (type === 'none') {
                                            updateClip(selectedClip.id, { transitionIn: undefined });
                                        } else {
                                            updateClip(selectedClip.id, { transitionIn: { type, duration: 15 } });
                                        }
                                    }}
                                >
                                    <option value="none">None</option>
                                    <option value="fade">Fade</option>
                                    <option value="slide">Slide</option>
                                    <option value="wipe">Wipe</option>
                                    <option value="zoom">Zoom</option>
                                </select>
                                {selectedClip.transitionIn && (
                                    <input
                                        type="number"
                                        className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.transitionIn.duration}
                                        onChange={(e) => updateClip(selectedClip.id, { transitionIn: { ...selectedClip.transitionIn!, duration: parseInt(e.target.value) } })}
                                        title="Duration (frames)"
                                    />
                                )}
                            </div>
                        </PropertyRow>
                        <PropertyRow label="Out">
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    value={selectedClip.transitionOut?.type || 'none'}
                                    onChange={(e) => {
                                        const type = e.target.value as any;
                                        if (type === 'none') {
                                            updateClip(selectedClip.id, { transitionOut: undefined });
                                        } else {
                                            updateClip(selectedClip.id, { transitionOut: { type, duration: 15 } });
                                        }
                                    }}
                                >
                                    <option value="none">None</option>
                                    <option value="fade">Fade</option>
                                    <option value="slide">Slide</option>
                                    <option value="wipe">Wipe</option>
                                    <option value="zoom">Zoom</option>
                                </select>
                                {selectedClip.transitionOut && (
                                    <input
                                        type="number"
                                        className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.transitionOut.duration}
                                        onChange={(e) => updateClip(selectedClip.id, { transitionOut: { ...selectedClip.transitionOut!, duration: parseInt(e.target.value) } })}
                                        title="Duration (frames)"
                                    />
                                )}
                            </div>
                        </PropertyRow>
                    </PanelSection>

                    {/* Content Specific */}
                    {selectedClip.type === 'text' && (
                        <PanelSection title="Content">
                            <PropertyRow label="Text Content">
                                <textarea
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none min-h-[60px]"
                                    value={selectedClip.text || ''}
                                    onChange={(e) => updateClip(selectedClip.id, { text: e.target.value })}
                                />
                            </PropertyRow>
                        </PanelSection>
                    )}

                    {(selectedClip.type === 'video' || selectedClip.type === 'image' || selectedClip.type === 'audio') && (
                        <PanelSection title="Source">
                            <PropertyRow label="Source URL">
                                <input
                                    type="text"
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    value={selectedClip.src || ''}
                                    onChange={(e) => updateClip(selectedClip.id, { src: e.target.value })}
                                />
                            </PropertyRow>
                        </PanelSection>
                    )}
                </>
            ) : (
                <div className="p-4 bg-gray-800/50 m-4 rounded border border-gray-800 text-center">
                    <p className="text-xs text-gray-500 italic">Select a clip to edit properties</p>
                </div>
            )}
        </PropertiesPanel>
    );
};
