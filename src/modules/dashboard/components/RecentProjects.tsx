import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { DashboardService, ProjectMetadata } from '@/services/dashboard/DashboardService';
import {
    FolderOpen, Clock, Image, Plus, ArrowUpRight, Sparkles,
} from 'lucide-react';
import NewProjectModal from './NewProjectModal';

export default function RecentProjects() {
    const { setModule, setProject } = useStore(
        useShallow((s) => ({ setModule: s.setModule, setProject: s.setProject }))
    );

    const [projects, setProjects] = useState<ProjectMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        DashboardService.getProjects()
            .then((p) => setProjects(p.slice(0, 4))) // Show top 4
            .catch((err) => { console.error('[RecentProjects] failed to load projects:', err); })
            .finally(() => setLoading(false));
    }, []);

    const handleOpen = (id: string) => {
        setProject(id);
        setModule('creative');
    };

    const handleCreate = async (name: string, type: 'creative' | 'music' | 'marketing' | 'legal') => {
        try {
            const p = await DashboardService.createProject(name);
            setProjects((prev) => [p, ...prev].slice(0, 4));
            setIsModalOpen(false);
            handleOpen(p.id);
        } catch (_e) {
            // swallow
        }
    };

    if (loading) {
        return (
            <div className="bg-[#161b22]/50 border border-white/5 rounded-xl p-5 h-full animate-pulse">
                <div className="h-4 w-32 bg-gray-800 rounded mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-gray-800/50 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#161b22]/50 border border-white/5 rounded-xl p-5 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <FolderOpen size={16} className="text-blue-400" />
                    <h3 className="text-sm font-bold text-white">Recent Projects</h3>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                    title="New Project"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Project list */}
            {projects.length > 0 ? (
                <div className="flex-1 space-y-2">
                    {projects.map((project, i) => (
                        <motion.button
                            key={project.id}
                            className="w-full flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/5 hover:border-white/10 hover:bg-white/5 transition-all group text-left"
                            onClick={() => handleOpen(project.id)}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                        >
                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded-lg bg-gray-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {project.thumbnail ? (
                                    <img
                                        src={project.thumbnail}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Image size={16} className="text-gray-600" />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                                    {project.name}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                    <Clock size={10} />
                                    <span>{formatRelativeDate(project.lastModified)}</span>
                                    <span className="text-gray-700">·</span>
                                    <span>{project.assetCount ?? 0} assets</span>
                                </div>
                            </div>

                            {/* Arrow */}
                            <ArrowUpRight
                                size={14}
                                className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            />
                        </motion.button>
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                    <div className="w-12 h-12 rounded-xl bg-gray-800/50 flex items-center justify-center mb-3">
                        <Sparkles size={20} className="text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-400 mb-1">No projects yet</p>
                    <p className="text-[10px] text-gray-600 mb-4">Create your first to get started</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        Create Project
                    </button>
                </div>
            )}

            {/* View All link */}
            {projects.length > 0 && (
                <button
                    onClick={() => setModule('files')}
                    className="mt-3 text-[10px] text-gray-500 hover:text-gray-300 transition-colors text-center font-medium uppercase tracking-wider"
                >
                    View All Projects
                </button>
            )}

            <NewProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleCreate}
                error={null}
            />
        </div>
    );
}

function formatRelativeDate(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
