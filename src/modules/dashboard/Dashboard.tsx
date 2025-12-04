import React from 'react';
import { useStore, AppSlice } from '@/core/store';
import { Folder, Plus, Clock, Layout, Music, Scale, MessageSquare, Sparkles, Camera, ArrowUpRight, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { OrganizationSelector } from './components/OrganizationSelector';
import NewProjectModal from './components/NewProjectModal';
import { auth } from '@/services/firebase';


export default function Dashboard() {
    const { setModule, setProject, currentOrganizationId, projects, addProject } = useStore();
    console.log("Dashboard Render. Current User:", auth.currentUser?.uid, "Is Anonymous:", auth.currentUser?.isAnonymous);

    const filteredProjects = projects.filter(p => p.orgId === currentOrganizationId);

    const handleOpenProject = (id: string, type: AppSlice['currentModule']) => {
        setProject(id);
        setModule(type);
    };

    const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);
    const [showBrandKit, setShowBrandKit] = React.useState(false);
    const [newProjectName, setNewProjectName] = React.useState('');
    const [newProjectType, setNewProjectType] = React.useState<'creative' | 'music' | 'marketing' | 'legal'>('creative');
    const [error, setError] = React.useState<string | null>(null);

    const handleCreateProject = async (name: string, type: 'creative' | 'music' | 'marketing' | 'legal') => {
        if (!name.trim()) return;
        setError(null);

        try {
            const { createNewProject } = useStore.getState();
            await createNewProject(name, type, currentOrganizationId);
            setShowNewProjectModal(false);
            setNewProjectName(''); // Reset name on success
        } catch (e: any) {
            console.error("Project creation failed:", e);
            setError(e.message || "Failed to create project");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // For images, we might want to OCR them or just store them. 
            // For now, we'll treat everything as text/blob for the RAG service to handle (it might need updating for images)
            // Or we just read text for now as before.

            try {
                let textContent = '';

                if (file.type.startsWith('image/')) {
                    // Placeholder for OCR or Image Description
                    // Future implementation: Use AI service to describe image content
                    textContent = `[Image Upload: ${file.name}]`;
                    alert("Image upload detected. OCR would run here.");
                } else {
                    textContent = await file.text();
                }

                const { processForKnowledgeBase } = await import('../../services/rag/ragService');
                const { useStore } = await import('@/core/store');

                const processed = await processForKnowledgeBase(textContent, file.name);
                console.log("Processed Doc:", processed);

                // Add to store
                const newDoc = {
                    id: crypto.randomUUID(),
                    name: processed.title,
                    content: processed.content,
                    type: 'document' as const,
                    tags: processed.tags,
                    entities: processed.entities,
                    embeddingId: processed.embeddingId,
                    indexingStatus: 'ready' as const,
                    createdAt: Date.now()
                };

                useStore.getState().addKnowledgeDocument(newDoc);
                alert(`Added ${processed.title} to Knowledge Base!`);
            } catch (err) {
                console.error(err);
                alert("Failed to process document.");
            }
        }
    };

    return (
        <div className="flex-1 bg-surface p-4 md:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar relative w-full">
            <div className="max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-12 gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">Welcome back to <span className="neon-text-blue">indiiOS</span>.</h1>
                        <div className="flex items-center gap-4">
                            <OrganizationSelector />
                            <p className="text-white/50 hidden md:block">Manage your creative projects and workflows.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto justify-end md:justify-start">
                        <button
                            onClick={() => auth.signOut()}
                            className="p-3 md:px-4 md:py-3 bg-red-500/10 text-red-500 border border-red-500/50 rounded-full font-bold hover:bg-red-500/20 transition-all flex items-center justify-center"
                            title="Sign Out"
                        >
                            <LogOut size={20} />
                            <span className="hidden md:inline ml-2">Sign Out</span>
                        </button>
                        <button
                            onClick={() => setShowBrandKit(true)}
                            className="p-3 md:px-6 md:py-3 bg-neon-purple/10 text-neon-purple border border-neon-purple/50 rounded-full font-bold hover:bg-neon-purple/20 hover:shadow-[0_0_15px_rgba(176,38,255,0.3)] transition-all flex items-center justify-center gap-2"
                            title="Brand Kit"
                        >
                            <Sparkles size={20} />
                            <span className="hidden md:inline">Brand Kit</span>
                        </button>
                        <button
                            onClick={() => setShowNewProjectModal(true)}
                            className="p-3 md:px-6 md:py-3 bg-white text-black rounded-full font-bold hover:bg-neon-blue hover:text-black hover:shadow-[0_0_15px_rgba(0,243,255,0.5)] transition-all flex items-center justify-center gap-2"
                            title="New Project"
                        >
                            <Plus size={20} />
                            <span className="hidden md:inline">New Project</span>
                        </button>
                    </div>
                </div>

                {/* Recent Projects */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Clock size={20} className="text-neon-purple" /> Recent Projects
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map((project, index) => (
                            <motion.div
                                key={project.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => handleOpenProject(project.id, project.type)}
                                className="group glass-panel p-6 rounded-2xl hover:border-neon-blue/50 hover:bg-white/5 transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-8 h-8 rounded-full bg-neon-blue text-black flex items-center justify-center shadow-[0_0_10px_rgba(0,243,255,0.5)]">
                                        <ArrowUpRight size={16} />
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-white/10">
                                    {project.type === 'creative' && <Layout className="text-neon-blue" />}
                                    {project.type === 'music' && <Music className="text-neon-purple" />}
                                    {project.type === 'marketing' && <MessageSquare className="text-signal-green" />}
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">{project.name}</h3>
                                <p className="text-xs text-white/40">Last edited {new Date(project.date).toLocaleDateString()}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Knowledge Base Upload */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Folder size={20} className="text-signal-green" /> Knowledge Base
                    </h2>
                    <div className="glass-panel p-4 md:p-8 rounded-3xl shadow-2xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                            {/* Drop Zone */}
                            <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-signal-green hover:bg-signal-green/5 transition-all cursor-pointer relative group min-h-[250px]">
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={handleFileUpload}
                                />
                                <div className="w-16 h-16 bg-signal-green/10 text-signal-green rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(0,255,157,0.2)]">
                                    <Plus size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Upload Knowledge Assets</h3>
                                <p className="text-sm text-white/40 max-w-xs mx-auto">Drag & drop Brand Kits, Bios, or Strategy Docs (TXT, JSON, MD)</p>
                            </div>

                            {/* Mobile Camera Option */}
                            <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-neon-blue hover:bg-neon-blue/5 transition-all cursor-pointer relative group min-h-[250px]">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={handleFileUpload}
                                />
                                <div className="w-16 h-16 bg-neon-blue/10 text-neon-blue rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                                    <Camera size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Scan Document</h3>
                                <p className="text-sm text-white/40 max-w-xs mx-auto">Use your camera to capture and upload physical documents instantly.</p>
                            </div>
                        </div>
                    </div>
                </section>


            </div>

            {/* Brand Kit Modal */}
            <OnboardingModal isOpen={showBrandKit} onClose={() => setShowBrandKit(false)} />

            {/* New Project Modal */}
            <NewProjectModal
                isOpen={showNewProjectModal}
                onClose={() => setShowNewProjectModal(false)}
                onCreate={async (name, type) => {
                    setNewProjectName(name);
                    setNewProjectType(type);
                    await handleCreateProject(name, type);
                }}
                error={error}
            />
        </div>
    );
}


