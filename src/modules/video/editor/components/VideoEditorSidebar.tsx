import React from 'react';
import { Settings, Layers, Image as ImageIcon, Trash2, Plus } from 'lucide-react';
import { EditorAssetLibrary } from './EditorAssetLibrary'; // Adjust import path as needed
import { VideoProject } from '../../store/videoEditorStore';
import { HistoryItem } from '@/core/store/slices/creativeSlice';

interface VideoEditorSidebarProps {
    activeTab: 'project' | 'tracks' | 'assets';
    setActiveTab: (tab: 'project' | 'tracks' | 'assets') => void;
    project: VideoProject;
    updateProject: (updates: Partial<VideoProject>) => void;
    removeTrack: (id: string) => void;
    addTrack: (type: 'video' | 'audio') => void;
    onLibraryDragStart: (e: React.DragEvent, item: HistoryItem) => void;
}

export const VideoEditorSidebar: React.FC<VideoEditorSidebarProps> = ({
    activeTab,
    setActiveTab,
    project,
    updateProject,
    removeTrack,
    addTrack,
    onLibraryDragStart
}) => {
    return (
        <div className="flex h-full border-r border-[--border]">
            {/* Sidebar Tabs */}
            <div className="w-16 bg-[--card] flex flex-col items-center py-4 border-r border-[--border] gap-4">
                <button
                    onClick={() => setActiveTab('project')}
                    className={`p-2 rounded-lg transition-colors ${activeTab === 'project' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    title="Project Settings"
                >
                    <Settings size={20} />
                </button>
                <button
                    onClick={() => setActiveTab('tracks')}
                    className={`p-2 rounded-lg transition-colors ${activeTab === 'tracks' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    title="Tracks"
                >
                    <Layers size={20} />
                </button>
                <button
                    onClick={() => setActiveTab('assets')}
                    className={`p-2 rounded-lg transition-colors ${activeTab === 'assets' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                    title="Assets Library"
                >
                    <ImageIcon size={20} />
                </button>
            </div>

            {/* Sidebar Content */}
            <div className="w-64 bg-[--card] overflow-y-auto custom-scrollbar">
                {activeTab === 'assets' && (
                    <EditorAssetLibrary onDragStart={onLibraryDragStart} />
                )}

                {activeTab === 'project' && (
                    <div className="p-4 space-y-4">
                        <h3 className="text-lg font-semibold">Project Settings</h3>

                        <div className="bg-purple-900/20 border border-purple-500/30 p-3 rounded-md">
                            <h4 className="text-xs font-bold text-purple-400 uppercase mb-2">Veo 3.1 Presets</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => updateProject({ width: 1920, height: 1080, fps: 24 })}
                                    className="text-xs bg-purple-600 hover:bg-purple-500 text-white py-1 px-2 rounded transition-colors"
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
                                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                value={project.name}
                                onChange={(e) => updateProject({ name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label htmlFor="projectWidth" className="block text-sm font-medium text-gray-400">Width</label>
                            <input
                                type="number"
                                id="projectWidth"
                                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                value={project.width}
                                onChange={(e) => updateProject({ width: parseInt(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label htmlFor="projectHeight" className="block text-sm font-medium text-gray-400">Height</label>
                            <input
                                type="number"
                                id="projectHeight"
                                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                value={project.height}
                                onChange={(e) => updateProject({ height: parseInt(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label htmlFor="projectFps" className="block text-sm font-medium text-gray-400">FPS</label>
                            <input
                                type="number"
                                id="projectFps"
                                className="mt-1 block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                value={project.fps}
                                onChange={(e) => updateProject({ fps: parseInt(e.target.value) })}
                            />
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
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Add Track
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
