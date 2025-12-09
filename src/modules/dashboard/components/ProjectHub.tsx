import React, { useState, useEffect } from 'react';
import { DashboardService, ProjectMetadata } from '../../../services/dashboard/DashboardService';
import { FolderPlus, Clock, Image, MoreVertical } from 'lucide-react';
import { useStore } from '@/core/store';

export default function ProjectHub() {
    const [projects, setProjects] = useState<ProjectMetadata[]>([]);
    const { setModule } = useStore();

    useEffect(() => {
        DashboardService.getProjects().then(setProjects);
    }, []);

    const handleOpenProject = (id: string) => {
        console.log("Opening project:", id);
        // In a real app, we'd set the active project ID in the store
        setModule('creative'); // Default to creative for now
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Recent Projects</h2>
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                    <FolderPlus size={18} />
                    <span>New Project</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-8 custom-scrollbar">
                {projects.map(project => (
                    <div
                        key={project.id}
                        onClick={() => handleOpenProject(project.id)}
                        className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden hover:border-gray-600 transition-all cursor-pointer group"
                    >
                        {/* Thumbnail */}
                        <div className="h-40 bg-gray-900 relative">
                            {project.thumbnail ? (
                                <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-700">
                                    <Image size={48} />
                                </div>
                            )}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white">
                                    <MoreVertical size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="p-4">
                            <h3 className="text-white font-medium text-lg mb-1 group-hover:text-blue-400 transition-colors">{project.name}</h3>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <Clock size={12} />
                                    <span>{new Date(project.lastModified).toLocaleDateString()}</span>
                                </div>
                                <span>{project.assetCount} Assets</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
