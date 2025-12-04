import React from 'react';
import { VideoProject, VideoClip } from '../../store/videoEditorStore';

interface VideoPropertiesPanelProps {
    project: VideoProject;
    selectedClip: VideoClip | undefined;
    updateClip: (id: string, updates: Partial<VideoClip>) => void;
}

export const VideoPropertiesPanel: React.FC<VideoPropertiesPanelProps> = ({ project, selectedClip, updateClip }) => {
    return (
        <div className="w-80 border-l border-gray-800 bg-gray-900 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-4">Properties</h3>
            <div className="space-y-4">
                <div className="bg-gray-800 p-3 rounded border border-gray-700">
                    <label className="text-xs text-gray-500 block mb-1">Project Name</label>
                    <input
                        type="text"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                        value={project.name}
                        readOnly
                    />
                </div>

                {selectedClip ? (
                    <div className="space-y-4 border-t border-gray-800 pt-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase">Selected Clip</h4>

                        <div className="bg-gray-800 p-3 rounded border border-gray-700 space-y-3">
                            {/* Basic Properties */}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                    value={selectedClip.name}
                                    onChange={(e) => updateClip(selectedClip.id, { name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Start Frame</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.startFrame}
                                        onChange={(e) => updateClip(selectedClip.id, { startFrame: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Duration</label>
                                    <input
                                        type="number"
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.durationInFrames}
                                        onChange={(e) => updateClip(selectedClip.id, { durationInFrames: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                            </div>

                            {/* Transform Properties */}
                            <div className="border-t border-gray-700 pt-3">
                                <label className="text-xs font-bold text-gray-400 block mb-2">Transform</label>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Scale</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                            value={selectedClip.scale ?? 1}
                                            onChange={(e) => updateClip(selectedClip.id, { scale: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Rotation</label>
                                        <input
                                            type="number"
                                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                            value={selectedClip.rotation ?? 0}
                                            onChange={(e) => updateClip(selectedClip.id, { rotation: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Opacity</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        className="w-full"
                                        value={selectedClip.opacity ?? 1}
                                        onChange={(e) => updateClip(selectedClip.id, { opacity: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="border-t border-gray-700 pt-3">
                                <label className="text-xs font-bold text-gray-400 block mb-2">Filter</label>
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
                                {selectedClip.filter && (
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Intensity</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            className="w-full"
                                            value={selectedClip.filter.intensity}
                                            onChange={(e) => updateClip(selectedClip.id, { filter: { ...selectedClip.filter!, intensity: parseInt(e.target.value) } })}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Transitions */}
                            <div className="border-t border-gray-700 pt-3">
                                <label className="text-xs font-bold text-gray-400 block mb-2">Transitions</label>
                                <div className="mb-2">
                                    <label className="text-xs text-gray-500 block mb-1">In</label>
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
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Out</label>
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
                                </div>
                            </div>

                            {/* Content Specific */}
                            {selectedClip.type === 'text' && (
                                <div className="border-t border-gray-700 pt-3">
                                    <label className="text-xs text-gray-500 block mb-1">Text Content</label>
                                    <textarea
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none min-h-[60px]"
                                        value={selectedClip.text || ''}
                                        onChange={(e) => updateClip(selectedClip.id, { text: e.target.value })}
                                    />
                                </div>
                            )}

                            {(selectedClip.type === 'video' || selectedClip.type === 'image' || selectedClip.type === 'audio') && (
                                <div className="border-t border-gray-700 pt-3">
                                    <label className="text-xs text-gray-500 block mb-1">Source URL</label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm focus:border-purple-500 outline-none"
                                        value={selectedClip.src || ''}
                                        onChange={(e) => updateClip(selectedClip.id, { src: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-gray-800 p-3 rounded border border-gray-700">
                        <p className="text-xs text-gray-400 italic">Select a clip to edit properties</p>
                    </div>
                )}
            </div>
        </div>
    );
};
