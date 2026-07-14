import React, { useState } from 'react';
import { Settings, Layers, Image as ImageIcon, Trash2, Plus } from 'lucide-react';
import { EditorAssetLibrary } from './EditorAssetLibrary'; // Adjust import path as needed
import { VideoProject } from '../../store/videoEditorStore';
import { HistoryItem } from '@/core/store/slices/creative';

interface VideoEditorSidebarProps {
    activeTab: 'project' | 'tracks' | 'assets';
    setActiveTab: (tab: 'project' | 'tracks' | 'assets') => void;
    project: VideoProject;
    updateProject: (updates: Partial<VideoProject>) => void;
    removeTrack: (id: string) => void;
    addTrack: (type: 'video' | 'audio') => void;
    onLibraryDragStart: (e: React.DragEvent, item: HistoryItem) => void;
}

const BOUNDS = { width: { min: 64, max: 8192 }, height: { min: 64, max: 8192 }, fps: { min: 1, max: 120 } };

const validateProjectSetting = (key: 'width' | 'height' | 'fps', value: string): number | null => {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num <= 0) return null;
    const bound = BOUNDS[key];
    return num >= bound.min && num <= bound.max ? num : null;
};

export const VideoEditorSidebar: React.FC<VideoEditorSidebarProps> = ({
    activeTab,
    setActiveTab,
    project,
    updateProject,
    removeTrack,
    addTrack,
    onLibraryDragStart
}) => {
    const [errors, setErrors] = useState<{ width?: string; height?: string; fps?: string }>({});

    const handleSettingChange = (key: 'width' | 'height' | 'fps', value: string) => {
        const validated = validateProjectSetting(key, value);
        if (validated !== null) {
            updateProject({ [key]: validated });
            setErrors(prev => ({ ...prev, [key]: undefined }));
        } else if (value === '') {
            setErrors(prev => ({ ...prev, [key]: 'Required' }));
        } else {
            const bound = BOUNDS[key];
            setErrors(prev => ({ ...prev, [key]: `Must be ${bound.min}–${bound.max}` }));
        }
    };

    return (
        <div className="flex h-full border-r border-[--border]">
            {/* Sidebar Tabs */}
            <div className="w-12 bg-gray-950 flex flex-col items-center py-4 border-r border-[#1a1a1a] gap-3">
                <button
                    onClick={() => setActiveTab('project')}
                    className={`p-1 rounded-lg transition-colors ${activeTab === 'project' ? 'bg-green-600/20 text-green-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
                    title="Project Settings"
                >
                    <Settings size={16} />
                </button>
                <button
                    onClick={() => setActiveTab('tracks')}
                    className={`p-1 rounded-lg transition-colors ${activeTab === 'tracks' ? 'bg-green-600/20 text-green-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
                    title="Tracks"
                >
                    <Layers size={16} />
                </button>
                <button
                    onClick={() => setActiveTab('assets')}
                    className={`p-1 rounded-lg transition-colors ${activeTab === 'assets' ? 'bg-green-600/20 text-green-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
                    title="Assets Library"
                >
                    <ImageIcon size={16} />
                </button>
            </div>

            {/* Sidebar Content */}
            <div className="w-56 shrink-0 bg-[--card] overflow-y-auto custom-scrollbar">
                {activeTab === 'assets' && (
                    <EditorAssetLibrary onDragStart={onLibraryDragStart} />
                )}

                {activeTab === 'project' && (
                    <div className="p-4 space-y-4">
                        <h3 className="text-lg font-semibold">Project Settings</h3>

                        <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-md">
                            <h4 className="text-xs font-bold text-green-400 uppercase mb-2">Video Presets</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => updateProject({ width: 1920, height: 1080, fps: 24 })}
                                    className="text-xs bg-green-600 hover:bg-green-500 text-white py-1 px-2 rounded transition-colors"
                                >
                                    1080p Landscape (24fps)
                                </button>
                                <button
                                    onClick={() => updateProject({ width: 1080, height: 1920, fps: 24 })}
                                    className="text-xs bg-gray-700 hover:bg-gray-600 text-white py-1 px-2 rounded transition-colors"
                                >
                                    1080p Portrait (24fps)
                                </button>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="projectName" className="block text-sm font-medium text-gray-400">Project Name</label>
                            <input
                                type="text"
                                id="projectName"
                                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                value={project.name}
                                onChange={(e) => updateProject({ name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label htmlFor="projectWidth" className="block text-sm font-medium text-gray-400">Width (64–8192)</label>
                            <input
                                type="number"
                                id="projectWidth"
                                className={`mt-1 block w-full rounded-md bg-gray-800 text-white shadow-sm focus:ring-green-500 sm:text-sm transition-colors ${errors.width ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-green-500'}`}
                                value={project.width}
                                onChange={(e) => handleSettingChange('width', e.target.value)}
                            />
                            {errors.width && <p className="text-xs text-red-400 mt-1">{errors.width}</p>}
                        </div>
                        <div>
                            <label htmlFor="projectHeight" className="block text-sm font-medium text-gray-400">Height (64–8192)</label>
                            <input
                                type="number"
                                id="projectHeight"
                                className={`mt-1 block w-full rounded-md bg-gray-800 text-white shadow-sm focus:ring-green-500 sm:text-sm transition-colors ${errors.height ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-green-500'}`}
                                value={project.height}
                                onChange={(e) => handleSettingChange('height', e.target.value)}
                            />
                            {errors.height && <p className="text-xs text-red-400 mt-1">{errors.height}</p>}
                        </div>
                        <div>
                            <label htmlFor="projectFps" className="block text-sm font-medium text-gray-400">FPS (1–120)</label>
                            <input
                                type="number"
                                id="projectFps"
                                className={`mt-1 block w-full rounded-md bg-gray-800 text-white shadow-sm focus:ring-green-500 sm:text-sm transition-colors ${errors.fps ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-green-500'}`}
                                value={project.fps}
                                onChange={(e) => handleSettingChange('fps', e.target.value)}
                            />
                            {errors.fps && <p className="text-xs text-red-400 mt-1">{errors.fps}</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'tracks' && (
                    <div className="p-4 space-y-4">
                        <h3 className="text-lg font-semibold">Tracks</h3>
                        {project.tracks.map(track => (
                            <div key={track.id} className="flex items-center justify-between bg-gray-800 p-2 rounded-md">
                                <span className="text-sm">{track.name || `Track ${track.id.substring(0, 4)}`}</span>
                                <button
                                    onClick={() => removeTrack(track.id)}
                                    className="text-red-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-700"
                                    title="Remove Track"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={() => addTrack('video')}
                            className="w-full bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Add Track
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
