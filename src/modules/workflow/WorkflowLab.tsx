import React, { useState, useEffect } from 'react';
import WorkflowEditor from './components/WorkflowEditor';
import NodePanel from './components/NodePanel';
import WorkflowNodeInspector from './components/WorkflowNodeInspector';
import { useStore } from '../../core/store';
import { Play, Loader2, GitBranch, Sparkles, LayoutTemplate, X, ArrowRight, Save, FolderOpen } from 'lucide-react';
import { WorkflowEngine } from './services/WorkflowEngine';
import { WORKFLOW_TEMPLATES } from './services/workflowTemplates';
import { v4 as uuidv4 } from 'uuid';
import { Status, SavedWorkflow } from './types';
import { saveWorkflow, getUserWorkflows, loadWorkflow } from './services/workflowPersistence';
import { auth } from '../../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function WorkflowLab() {
    const { nodes, edges, setNodes, setEdges } = useStore();
    const [isRunning, setIsRunning] = useState(false);
    const [workflowName, setWorkflowName] = useState('My Workflow');
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | undefined>(undefined);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setAuthLoading(false);
            if (user) {
                console.log("WorkflowLab: User authenticated:", user.uid);
            } else {
                console.log("WorkflowLab: User not authenticated");
            }
        });
        return () => unsubscribe();
    }, []);

    const handleRunWorkflow = async () => {
        if (nodes.length === 0) return;
        setIsRunning(true);
        try {
            const engine = new WorkflowEngine(nodes, edges, setNodes);
            await engine.run();
        } catch (e) {
            console.error("Workflow failed", e);
        } finally {
            setIsRunning(false);
        }
    };

    const [showGenerator, setShowGenerator] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [generatorPrompt, setGeneratorPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const handleGenerateWorkflow = async () => {
        if (!generatorPrompt.trim()) return;
        setIsGenerating(true);
        try {
            // Dynamic import to avoid circular deps
            const { generateWorkflowFromPrompt } = await import('./services/workflowGenerator');
            const workflow = await generateWorkflowFromPrompt(generatorPrompt);

            setNodes(workflow.nodes);
            setEdges(workflow.edges);
            setShowGenerator(false);
            setGeneratorPrompt('');
        } catch (error) {
            console.error("Failed to generate workflow:", error);
            alert("Failed to generate workflow. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLoadTemplate = (templateId: string) => {
        const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            const newNodes = template.nodes.map(n => ({ ...n, id: n.id === 'start' || n.id === 'end' ? n.id : uuidv4() }));
            setNodes(template.nodes.map(n => ({ ...n, data: { ...n.data, status: Status.PENDING } })));
            setEdges(template.edges);
            setWorkflowName(template.name);
            setCurrentWorkflowId(undefined); // Reset ID as this is a new instance from template
            setShowTemplates(false);
        }
    };

    const handleSaveWorkflow = async () => {
        if (!currentUser) {
            alert("Please wait for login...");
            return;
        }
        setIsSaving(true);
        try {
            const id = await saveWorkflow({
                id: currentWorkflowId,
                name: workflowName,
                description: 'Saved workflow',
                nodes,
                edges,
                createdAt: new Date().toISOString()
            }, currentUser.uid);
            setCurrentWorkflowId(id);
            alert("Workflow saved successfully!");
        } catch (error) {
            console.error("Failed to save workflow:", error);
            alert(`Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenLoadModal = async () => {
        if (!currentUser) {
            alert("Please wait for login...");
            return;
        }
        setShowLoadModal(true);
        try {
            const workflows = await getUserWorkflows(currentUser.uid);
            setSavedWorkflows(workflows);
        } catch (error) {
            console.error("Failed to load workflows:", error);
        }
    };

    const handleLoadSavedWorkflow = (workflow: SavedWorkflow) => {
        setNodes(workflow.nodes);
        setEdges(workflow.edges);
        setWorkflowName(workflow.name);
        setCurrentWorkflowId(workflow.id);
        setShowLoadModal(false);
    };

    return (
        <div className="flex h-full bg-[#0f0f0f]">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-800 bg-[#1a1a1a] flex flex-col">
                <div className="p-4 border-b border-gray-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <GitBranch className="text-purple-500" /> Workflow Lab
                    </h2>
                </div>

                <div className="p-4 space-y-2">
                    <input
                        type="text"
                        value={workflowName}
                        onChange={(e) => setWorkflowName(e.target.value)}
                        className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg mb-2 border border-gray-700 focus:border-purple-500 outline-none text-sm"
                        placeholder="Workflow Name"
                    />

                    <button
                        onClick={handleRunWorkflow}
                        disabled={isRunning}
                        className={`w-full py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${isRunning
                            ? 'bg-yellow-500/20 text-yellow-500 cursor-wait'
                            : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'
                            }`}
                    >
                        {isRunning ? <Loader2 className="animate-spin" /> : <Play size={16} />}
                        {isRunning ? 'Running...' : 'Run Workflow'}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleSaveWorkflow}
                            disabled={isSaving}
                            className="py-2 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save
                        </button>
                        <button
                            onClick={handleOpenLoadModal}
                            className="py-2 px-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs"
                        >
                            <FolderOpen size={14} />
                            Load
                        </button>
                    </div>

                    <button
                        onClick={() => setShowGenerator(true)}
                        className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                    >
                        <Sparkles size={16} />
                        Generate with AI
                    </button>

                    <button
                        onClick={() => setShowTemplates(true)}
                        className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all border border-gray-700"
                    >
                        <LayoutTemplate size={16} />
                        Templates
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <NodePanel />
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 relative">
                <WorkflowEditor />
            </div>

            {/* Generator Modal */}
            {showGenerator && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                            <Sparkles className="text-purple-500" /> AI Workflow Architect
                        </h2>
                        <p className="text-gray-400 mb-4 text-sm">
                            Describe what you want to build (e.g., "Take a song, analyze it, generate a music video, and create a marketing campaign").
                        </p>
                        <textarea
                            value={generatorPrompt}
                            onChange={(e) => setGeneratorPrompt(e.target.value)}
                            placeholder="Describe your workflow..."
                            className="w-full h-32 bg-[#0f0f0f] border border-gray-700 rounded-lg p-4 text-white focus:border-purple-500 outline-none resize-none mb-4"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowGenerator(false)}
                                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateWorkflow}
                                disabled={isGenerating || !generatorPrompt.trim()}
                                className="flex-1 py-3 bg-white hover:bg-gray-200 text-black rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}
                                {isGenerating ? 'Designing...' : 'Generate Workflow'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Templates Modal */}
            {showTemplates && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 w-full max-w-4xl shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <LayoutTemplate className="text-blue-500" /> Workflow Templates
                            </h2>
                            <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto p-1">
                            {WORKFLOW_TEMPLATES.map((template) => (
                                <button
                                    key={template.id}
                                    onClick={() => handleLoadTemplate(template.id)}
                                    className="flex flex-col text-left p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all group"
                                >
                                    <h3 className="font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                                        {template.name}
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                                        {template.description}
                                    </p>
                                    <div className="mt-auto flex items-center text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                        Load Template <ArrowRight size={12} className="ml-1" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Load Saved Workflows Modal */}
            {showLoadModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <FolderOpen className="text-blue-500" /> Saved Workflows
                            </h2>
                            <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-2 overflow-y-auto p-1">
                            {savedWorkflows.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No saved workflows found.</p>
                            ) : (
                                savedWorkflows.map((workflow) => (
                                    <button
                                        key={workflow.id}
                                        onClick={() => handleLoadSavedWorkflow(workflow)}
                                        className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all group"
                                    >
                                        <div className="text-left">
                                            <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                                {workflow.name}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                Last updated: {new Date(workflow.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <ArrowRight size={16} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
