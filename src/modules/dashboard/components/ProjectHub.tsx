import React, { useState, useEffect, useRef } from 'react';
import { DashboardService, ProjectMetadata } from '../../../services/dashboard/DashboardService';
import { FolderPlus, Clock, Image, MoreVertical, Copy, Trash2 } from 'lucide-react';
import { useStore } from '@/core/store';
import NewProjectModal from './NewProjectModal';
import { useToast } from '@/core/context/ToastContext';

export default function ProjectHub() {
    const [projects, setProjects] = useState<ProjectMetadata[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const { setModule } = useStore();
    const toast = useToast();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        DashboardService.getProjects().then(setProjects);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        if (openMenuId) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuId]);

    const handleOpenProject = (id: string) => {
        console.log("Opening project:", id);
        // In a real app, we'd set the active project ID in the store
        setModule('creative'); // Default to creative for now
    };

    const handleDuplicateProject = async (projectId: string) => {
        try {
            setOpenMenuId(null);
            const duplicated = await DashboardService.duplicateProject(projectId);
            setProjects(prev => [duplicated, ...prev]);
            toast.success(`Project duplicated: ${duplicated.name}`);
        } catch (error) {
            console.error('Failed to duplicate project:', error);
            toast.error('Failed to duplicate project');
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        try {
            setOpenMenuId(null);
            await DashboardService.deleteProject(projectId);
            setProjects(prev => prev.filter(p => p.id !== projectId));
            toast.success('Project deleted');
        } catch (error) {
            console.error('Failed to delete project:', error);
            toast.error('Failed to delete project');
        }
    };

    const handleCreateProject = async (name: string, type: 'creative' | 'music' | 'marketing' | 'legal') => {
        try {
            const newProject = await DashboardService.createProject(name);
            setProjects(prev => [newProject, ...prev]);
            setIsModalOpen(false);
            // Optionally open immediately:
            handleOpenProject(newProject.id);
        } catch (error) {
            console.error("Failed to create project:", error);
            // In a real app, we'd set an error state to show in the modal
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Recent Projects</h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
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
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" ref={openMenuId === project.id ? menuRef : null}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(openMenuId === project.id ? null : project.id);
                                    }}
                                    className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white min-w-11 min-h-11 flex items-center justify-center"
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {openMenuId === project.id && (
                                    <div className="absolute top-full right-0 mt-1 bg-[#1c2128] border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 min-w-[140px]">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDuplicateProject(project.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                        >
                                            <Copy size={14} />
                                            <span>Duplicate</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProject(project.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                )}
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

            <NewProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreateProject}
                error={null}
            />
        </div>
    );
}
