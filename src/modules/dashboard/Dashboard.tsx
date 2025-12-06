import React from 'react';
import { useStore, AppSlice } from '@/core/store';
import { Folder, Plus, Clock, Layout, Music, MessageSquare, Sparkles, Camera, ArrowUpRight, LogOut, Download, Trash2 } from 'lucide-react';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { OrganizationSelector } from './components/OrganizationSelector';
import NewProjectModal from './components/NewProjectModal';
import { auth } from '@/services/firebase';
import { ThreeDCardContainer, ThreeDCardBody, ThreeDCardItem } from '@/components/ui/ThreeDCard';
import { ThreeDButton } from '@/components/ui/ThreeDButton';
import { ExportService } from '@/services/ExportService';
import { CleanupService } from '@/services/CleanupService';
import { useToast } from '@/core/context/ToastContext';


export default function Dashboard() {
    const { setModule, setProject, currentOrganizationId, projects, addProject } = useStore();
    const toast = useToast();
    console.log("Dashboard Render. Current User:", auth.currentUser?.uid, "Is Anonymous:", auth.currentUser?.isAnonymous);

    const filteredProjects = projects.filter(p => p.orgId === currentOrganizationId);

    const handleOpenProject = (id: string, type: AppSlice['currentModule']) => {
        setProject(id);
        setModule(type);
    };

    const handleExportProject = async (e: React.MouseEvent, projectId: string, projectName: string) => {
        e.stopPropagation(); // Prevent card click
        const toastId = toast.loading(`Exporting ${projectName}...`);

        try {
            await ExportService.exportAndDownloadProject(projectId, projectName, {
                onProgress: (progress) => {
                    const percent = Math.round((progress.current / progress.total) * 100);
                    toast.updateProgress(toastId, percent, progress.message);
                }
            });
            toast.dismiss(toastId);
            toast.success(`Exported ${projectName} successfully!`);
        } catch (error) {
            console.error('Export failed:', error);
            toast.dismiss(toastId);
            toast.error(`Failed to export ${projectName}`);
        }
    };

    const handleDatabaseCleanup = async () => {
        const toastId = toast.loading('Scanning for orphaned records...');

        try {
            // First, do a dry run scan
            const { report } = await CleanupService.vacuum({
                dryRun: true,
                onProgress: (message, current, total) => {
                    const percent = Math.round((current / total) * 100);
                    toast.updateProgress(toastId, percent, message);
                }
            });

            toast.dismiss(toastId);

            if (report.summary.totalOrphaned === 0) {
                toast.success('Database is clean! No orphaned records found.');
                return;
            }

            // Show what was found and confirm deletion
            const confirmed = window.confirm(
                `Found ${report.summary.totalOrphaned} orphaned records:\n\n` +
                `• ${report.summary.historyItemsFound} history items\n` +
                `• ${report.summary.projectsFound} projects\n\n` +
                `Do you want to delete these orphaned records?`
            );

            if (confirmed) {
                const cleanupToastId = toast.loading('Cleaning up orphaned records...');

                const result = await CleanupService.execute(report, {
                    onProgress: (message, current, total) => {
                        const percent = Math.round((current / total) * 100);
                        toast.updateProgress(cleanupToastId, percent, message);
                    }
                });

                toast.dismiss(cleanupToastId);

                if (result.errors.length > 0) {
                    toast.warning(`Cleanup completed with ${result.errors.length} errors`);
                } else {
                    toast.success(
                        `Cleaned up ${result.deletedHistory + result.deletedProjects} orphaned records!`
                    );
                }
            } else {
                toast.info('Cleanup cancelled');
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
            toast.dismiss(toastId);
            toast.error('Database cleanup failed');
        }
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
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">Welcome back to <span className="text-white">indiiOS</span>.</h1>
                        <div className="flex items-center gap-4">
                            <OrganizationSelector />
                            <p className="text-white/50 hidden md:block">Manage your creative projects and workflows.</p>
                        </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto justify-end md:justify-start">
                        <ThreeDButton
                            onClick={() => auth.signOut()}
                            variant="danger"
                            className="rounded-full flex items-center justify-center"
                            title="Sign Out"
                        >
                            <LogOut size={20} />
                            <span className="hidden md:inline ml-2">Sign Out</span>
                        </ThreeDButton>
                        <ThreeDButton
                            onClick={handleDatabaseCleanup}
                            variant="secondary"
                            className="rounded-full flex items-center justify-center gap-2 border-white/20 text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                            title="Clean Up Database"
                        >
                            <Trash2 size={20} />
                            <span className="hidden lg:inline">Cleanup</span>
                        </ThreeDButton>
                        <ThreeDButton
                            onClick={() => setShowBrandKit(true)}
                            variant="secondary"
                            className="rounded-full flex items-center justify-center gap-2 border-white/20 text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                            title="Brand Kit"
                        >
                            <Sparkles size={20} />
                            <span className="hidden md:inline">Brand Kit</span>
                        </ThreeDButton>
                        <ThreeDButton
                            onClick={() => setShowNewProjectModal(true)}
                            variant="primary"
                            className="rounded-full flex items-center justify-center gap-2 hover:bg-white hover:text-black hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                            title="New Project"
                        >
                            <Plus size={20} />
                            <span className="hidden md:inline">New Project</span>
                        </ThreeDButton>
                    </div>
                </div>

                {/* Recent Projects */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Clock size={20} className="text-white" /> Recent Projects
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map((project, index) => (
                            <ThreeDCardContainer key={project.id} className="inter-var w-full" onClick={() => handleOpenProject(project.id, project.type)}>
                                <ThreeDCardBody className="bg-white/5 relative group/card border-white/10 w-full h-auto rounded-xl p-6 border hover:border-white/50 hover:bg-white/10 transition-all cursor-pointer">
                                    <ThreeDCardItem
                                        translateZ="50"
                                        className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 border border-white/10"
                                    >
                                        {project.type === 'creative' && <Layout className="text-white" />}
                                        {project.type === 'music' && <Music className="text-gray-400" />}
                                        {project.type === 'marketing' && <MessageSquare className="text-gray-400" />}
                                    </ThreeDCardItem>

                                    <ThreeDCardItem
                                        translateZ="60"
                                        className="text-lg font-bold text-white mb-1"
                                    >
                                        {project.name}
                                    </ThreeDCardItem>

                                    <ThreeDCardItem
                                        translateZ="40"
                                        className="text-xs text-white/40"
                                    >
                                        Last edited {new Date(project.date).toLocaleDateString()}
                                    </ThreeDCardItem>

                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center gap-2">
                                        <ThreeDCardItem translateZ="80">
                                            <button
                                                onClick={(e) => handleExportProject(e, project.id, project.name)}
                                                className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center justify-center transition-all shadow-[0_0_10px_rgba(255,255,255,0.2)] hover:shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                                title="Export Project"
                                            >
                                                <Download size={14} />
                                            </button>
                                        </ThreeDCardItem>
                                        <ThreeDCardItem translateZ="80">
                                            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                                                <ArrowUpRight size={16} />
                                            </div>
                                        </ThreeDCardItem>
                                    </div>
                                </ThreeDCardBody>
                            </ThreeDCardContainer>
                        ))}
                    </div>
                </section>

                {/* Knowledge Base Upload */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Folder size={20} className="text-white" /> Knowledge Base
                    </h2>
                    <div className="glass-panel p-4 md:p-8 rounded-3xl shadow-2xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                            {/* Drop Zone */}
                            <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-white/50 hover:bg-white/5 transition-all cursor-pointer relative group min-h-[250px]">
                                <input
                                    type="file"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={handleFileUpload}
                                />
                                <div className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                    <Plus size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Upload Knowledge Assets</h3>
                                <p className="text-sm text-white/40 max-w-xs mx-auto">Drag & drop Brand Kits, Bios, or Strategy Docs (TXT, JSON, MD)</p>
                            </div>

                            {/* Mobile Camera Option */}
                            <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-white/50 hover:bg-white/5 transition-all cursor-pointer relative group min-h-[250px]">
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={handleFileUpload}
                                />
                                <div className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
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


