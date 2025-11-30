import React from 'react';
import { useStore } from '@/core/store';
import { Folder, Plus, Clock, Layout, Music, Scale, MessageSquare, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { OrganizationSelector } from './components/OrganizationSelector';

export default function Dashboard() {
    const { setModule, setProject, currentProjectId, currentOrganizationId } = useStore();

    const projects = [
        { id: 'default', name: 'Default Project', date: Date.now(), type: 'creative', orgId: 'org-default' },
        { id: 'proj-2', name: 'Neon City Campaign', date: Date.now() - 86400000, type: 'marketing', orgId: 'org-default' },
        { id: 'proj-3', name: 'Audio Experience', date: Date.now() - 172800000, type: 'music', orgId: 'org-default' },
    ].filter(p => p.orgId === currentOrganizationId);

    const handleOpenProject = (id: string, type: any) => {
        setProject(id);
        setModule(type);
    };

    const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);
    const [showBrandKit, setShowBrandKit] = React.useState(false);
    const [newProjectName, setNewProjectName] = React.useState('');
    const [newProjectType, setNewProjectType] = React.useState<'creative' | 'music' | 'marketing' | 'legal'>('creative');

    const handleCreateProject = () => {
        if (!newProjectName.trim()) return;
        const newId = `proj-${Date.now()}`;
        // In a real app, we would save this to a backend or store
        setProject(newId);
        setModule(newProjectType);
        setShowNewProjectModal(false);
    };

    return (
        <div className="flex-1 bg-[#0f0f0f] p-8 overflow-y-auto custom-scrollbar relative">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">Welcome back to indiiOS.</h1>
                        <div className="flex items-center gap-4">
                            <OrganizationSelector />
                            <p className="text-gray-400">Manage your creative projects and workflows.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowBrandKit(true)}
                            className="px-6 py-3 bg-purple-600/20 text-purple-400 border border-purple-600/50 rounded-full font-bold hover:bg-purple-600/30 transition-colors flex items-center gap-2"
                        >
                            <Sparkles size={20} /> Brand Kit
                        </button>
                        <button
                            onClick={() => setShowNewProjectModal(true)}
                            className="px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors flex items-center gap-2"
                        >
                            <Plus size={20} /> New Project
                        </button>
                    </div>
                </div>

                {/* Recent Projects */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Clock size={20} className="text-purple-500" /> Recent Projects
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project, index) => (
                            <motion.div
                                key={project.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => handleOpenProject(project.id, project.type)}
                                className="group bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800 hover:border-purple-500/50 hover:bg-[#222] transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center">
                                        <ArrowUpRight size={16} />
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    {project.type === 'creative' && <Layout className="text-blue-400" />}
                                    {project.type === 'music' && <Music className="text-pink-400" />}
                                    {project.type === 'marketing' && <MessageSquare className="text-green-400" />}
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">{project.name}</h3>
                                <p className="text-xs text-gray-500">Last edited {new Date(project.date).toLocaleDateString()}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Knowledge Base Upload */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Folder size={20} className="text-yellow-500" /> Knowledge Base
                    </h2>
                    <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800">
                        <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-yellow-500/50 hover:bg-[#222] transition-all cursor-pointer relative">
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const text = await file.text();
                                        // Import dynamically to avoid circular deps if any, or just use direct import
                                        const { processForKnowledgeBase } = await import('../../services/rag/ragService');
                                        const { useStore } = await import('@/core/store');

                                        try {
                                            const processed = await processForKnowledgeBase(text, file.name);
                                            console.log("Processed Doc:", processed);

                                            // Add to store
                                            const newDoc = {
                                                id: crypto.randomUUID(),
                                                name: processed.title,
                                                content: processed.content,
                                                type: 'document',
                                                tags: processed.tags,
                                                entities: processed.entities,
                                                embeddingId: processed.embeddingId,
                                                indexingStatus: 'ready',
                                                createdAt: Date.now()
                                            };

                                            useStore.getState().addKnowledgeDocument(newDoc as any);
                                            alert(`Added ${processed.title} to Knowledge Base!`);
                                        } catch (err) {
                                            console.error(err);
                                            alert("Failed to process document.");
                                        }
                                    }
                                }}
                            />
                            <div className="w-12 h-12 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mb-4">
                                <Plus size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">Upload Knowledge Assets</h3>
                            <p className="text-sm text-gray-500">Drag & drop Brand Kits, Bios, or Strategy Docs (TXT, JSON, MD)</p>
                        </div>
                    </div>
                </section>

                {/* Modules Grid */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Layout size={20} className="text-blue-500" /> Quick Access
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button onClick={() => setModule('creative')} className="p-6 bg-[#1a1a1a] rounded-xl border border-gray-800 hover:border-blue-500/50 hover:bg-[#222] transition-all text-left group">
                            <Layout size={24} className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-white">Creative Studio</h3>
                            <p className="text-xs text-gray-500 mt-1">Image & Video Generation</p>
                        </button>
                        <button onClick={() => setModule('music')} className="p-6 bg-[#1a1a1a] rounded-xl border border-gray-800 hover:border-pink-500/50 hover:bg-[#222] transition-all text-left group">
                            <Music size={24} className="text-pink-500 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-white">Music Studio</h3>
                            <p className="text-xs text-gray-500 mt-1">Audio Synthesis</p>
                        </button>
                        <button onClick={() => setModule('marketing')} className="p-6 bg-[#1a1a1a] rounded-xl border border-gray-800 hover:border-green-500/50 hover:bg-[#222] transition-all text-left group">
                            <MessageSquare size={24} className="text-green-500 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-white">Marketing</h3>
                            <p className="text-xs text-gray-500 mt-1">Campaign Management</p>
                        </button>
                        <button onClick={() => setModule('legal')} className="p-6 bg-[#1a1a1a] rounded-xl border border-gray-800 hover:border-yellow-500/50 hover:bg-[#222] transition-all text-left group">
                            <Scale size={24} className="text-yellow-500 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold text-white">Legal</h3>
                            <p className="text-xs text-gray-500 mt-1">Contracts & Rights</p>
                        </button>
                    </div>
                </section>
            </div>

            {/* Brand Kit Modal */}
            <OnboardingModal isOpen={showBrandKit} onClose={() => setShowBrandKit(false)} />

            {/* New Project Modal */}
            {showNewProjectModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
                    >
                        <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project Name</label>
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="Enter project name..."
                                    className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Project Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['creative', 'music', 'marketing', 'legal'].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => setNewProjectType(type as any)}
                                            className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${newProjectType === type
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                                : 'bg-[#0f0f0f] border-gray-700 text-gray-400 hover:border-gray-500'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowNewProjectModal(false)}
                                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateProject}
                                    disabled={!newProjectName.trim()}
                                    className="flex-1 py-3 bg-white hover:bg-gray-200 text-black rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create Project
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

function ArrowUpRight({ size }: { size: number }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
        </svg>
    );
}
