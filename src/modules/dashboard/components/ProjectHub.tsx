import { useState, useEffect, useRef } from 'react';
import { DashboardService, ProjectMetadata } from '../../../services/dashboard/DashboardService';
import { FolderPlus, Clock, Image, MoreVertical, Copy, Trash2, Wand2, ArrowUpRight, Plus } from 'lucide-react';
import { useStore } from '@/core/store';
import NewProjectModal from './NewProjectModal';
import { useToast } from '@/core/context/ToastContext';

interface Template {
    id: string;
    name: string;
    description: string;
    type: 'creative' | 'music' | 'marketing' | 'legal';
    image: string;
}

const TEMPLATES: Template[] = [
    {
        id: 'promo-run',
        name: 'Promo Run',
        description: 'Multi-platform social campaign with synced visuals.',
        type: 'marketing',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80'
    },
    {
        id: 'single-release',
        name: 'Single Release',
        description: 'Complete release cycle: music, art, and metadata.',
        type: 'music',
        image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80'
    },
    {
        id: 'brand-identity',
        name: 'Brand Identity',
        description: 'Generate high-fidelity logotypes and color suites.',
        type: 'creative',
        image: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400&q=80'
    }
];

export default function ProjectHub() {
    const [projects, setProjects] = useState<ProjectMetadata[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const { setModule, setProject } = useStore();
    const toast = useToast();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        DashboardService.getProjects().then(setProjects);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        if (openMenuId) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuId]);

    const handleOpenProject = (id: string) => {
        setProject(id);
        setModule('creative');
    };

    const handleDuplicateProject = async (projectId: string) => {
        try {
            setOpenMenuId(null);
            const duplicated = await DashboardService.duplicateProject(projectId);
            setProjects(prev => [duplicated, ...prev]);
            toast.success(`Project duplicated: ${duplicated.name}`);
        } catch (error) {
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
            toast.error('Failed to delete project');
        }
    };

    const handleCreateProject = async (name: string, type: 'creative' | 'music' | 'marketing' | 'legal') => {
        try {
            const newProject = await DashboardService.createProject(name);
            setProjects(prev => [newProject, ...prev]);
            setIsModalOpen(false);
            handleOpenProject(newProject.id);
        } catch (error) {
            console.error("Failed to create project:", error);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-8 pb-12">
            {/* Header Area */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Active Projects</h2>
                    <p className="text-gray-500 text-sm mt-1">Manage and evolve your current studio sessions.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
                >
                    <FolderPlus size={18} />
                    <span className="font-semibold text-sm">Create New</span>
                </button>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => (
                    <div
                        key={project.id}
                        onClick={() => handleOpenProject(project.id)}
                        className="bg-[#161b22]/50 backdrop-blur-md border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-500 hover:bg-[#1c2128]/70 transition-all cursor-pointer group relative"
                    >
                        <div className="h-44 bg-gray-900/50 relative overflow-hidden">
                            {project.thumbnail ? (
                                <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-800 bg-gradient-to-br from-gray-900 to-black">
                                    <Image size={40} className="group-hover:scale-110 transition-transform duration-500 opacity-20" />
                                </div>
                            )}

                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity" ref={openMenuId === project.id ? menuRef : null}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(openMenuId === project.id ? null : project.id);
                                    }}
                                    className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white/80 hover:text-white border border-white/10 hover:border-white/20 transition-all"
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {openMenuId === project.id && (
                                    <div className="absolute top-full right-0 mt-2 bg-[#1c2128]/95 backdrop-blur-xl border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDuplicateProject(project.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 transition-colors"
                                        >
                                            <Copy size={15} />
                                            <span>Duplicate Project</span>
                                        </button>
                                        <div className="h-px bg-gray-800 mx-2" />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProject(project.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 size={15} />
                                            <span>Delete Permanently</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-5">
                            <h3 className="text-white font-bold text-lg mb-1.5 flex items-center justify-between">
                                {project.name}
                                <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                            </h3>
                            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-tighter">
                                <span className="flex items-center gap-1.5 text-gray-400">
                                    <Clock size={12} className="text-blue-500" />
                                    {new Date(project.lastModified).toLocaleDateString()}
                                </span>
                                <span className="text-gray-500">{project.assetCount} Assets</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Templates Area */}
            <div className="pt-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Wand2 className="text-purple-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Starter Templates</h2>
                        <p className="text-gray-500 text-sm">Jumpstart your release with pre-configured workflows.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {TEMPLATES.map(template => (
                        <div
                            key={template.id}
                            className="group relative bg-[#161b22]/30 border border-gray-800/50 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all cursor-pointer"
                        >
                            <div className="h-32 relative">
                                <img src={template.image} alt={template.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-60" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] to-transparent opacity-80" />
                                <div className="absolute inset-0 flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-500">
                                    <div className="w-12 h-12 bg-purple-600/90 rounded-full flex items-center justify-center text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus size={20} />
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 relative -mt-4">
                                <span className="inline-block px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded uppercase mb-2">
                                    {template.type}
                                </span>
                                <h3 className="text-white font-bold text-base mb-1">{template.name}</h3>
                                <p className="text-gray-400 text-xs leading-relaxed">{template.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
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

