import React, { useState, useEffect } from 'react';
import WorkflowEditor from './components/WorkflowEditor';
import NodePanel from './components/NodePanel';
import WorkflowGeneratorModal from './components/WorkflowGeneratorModal';
import WorkflowTemplateModal from './components/WorkflowTemplateModal';
import WorkflowLoadModal from './components/WorkflowLoadModal';
import { useStore } from '../../core/store';
import { Play, Loader2, GitBranch, Sparkles, LayoutTemplate, Save, FolderOpen } from 'lucide-react';
import { WorkflowEngine } from './services/WorkflowEngine';
import { WORKFLOW_TEMPLATES } from './services/workflowTemplates';
import { v4 as uuidv4 } from 'uuid';
import { Status, SavedWorkflow } from './types';
import { getUserWorkflows } from './services/workflowPersistence';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { MobileOnlyWarning } from '@/core/components/MobileOnlyWarning';

export default function WorkflowLab() {
    // Hooks must be called unconditionally before early returns
    const { nodes, edges, setNodes, setEdges, user } = useStore();
    const [isRunning, setIsRunning] = useState(false);
    const [workflowName, setWorkflowName] = useState('My Workflow');
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string | undefined>(undefined);

    // Alias user for compatibility
    const currentUser = user;

    const [showGenerator, setShowGenerator] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [generatorPrompt, setGeneratorPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

    // Auto-save logic (must be called before early return)
    useEffect(() => {
        if (!currentWorkflowId || !currentUser || nodes.length === 0) return;

        setSaveStatus('unsaved');

        const saveTimer = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                const engine = new WorkflowEngine(nodes, edges, setNodes);
                // Mock viewport for now, ideally get from ReactFlow instance
                const viewport = { x: 0, y: 0, zoom: 1 };
                await engine.saveWorkflow(currentWorkflowId, workflowName, 'Auto-saved workflow', viewport);
                
                setSaveStatus('saved');
            } catch (error) {
                console.error("Auto-save failed:", error);
                setSaveStatus('unsaved'); // Revert to unsaved on error
            }
        }, 2000); // Debounce 2s

        return () => clearTimeout(saveTimer);
    }, [nodes, edges, workflowName, currentWorkflowId, currentUser, setNodes]);

    // Check if device is mobile AFTER hooks are called
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (isMobile) {
        return (
            <ModuleErrorBoundary moduleName="Workflow Lab">
                <MobileOnlyWarning
                    featureName="Workflow Lab"
                    reason="The node-based workflow editor requires a larger screen with mouse controls. Try our simplified Creative Studio or Marketing features on mobile."
                    suggestedModule="creative"
                />
            </ModuleErrorBoundary>
        );
    }

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
            const engine = new WorkflowEngine(nodes, edges, setNodes);
            const id = currentWorkflowId || uuidv4();
            // Mock viewport for now
            const viewport = { x: 0, y: 0, zoom: 1 };

            await engine.saveWorkflow(
                id,
                workflowName,
                'Saved workflow',
                viewport
            );
            setCurrentWorkflowId(id);
            // alert("Workflow saved successfully!"); // Removed alert for smoother experience
        } catch (error) {
            console.error("Failed to save workflow:", error);
            alert(`Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSaving(false);
            setSaveStatus('saved');
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
        <ModuleErrorBoundary moduleName="Workflow Lab">
            <div className="flex h-full bg-[#0f0f0f]">
                {/* Sidebar */}
                <div className="w-64 border-r border-gray-800 bg-[#1a1a1a] flex flex-col">
                    <div className="p-4 border-b border-gray-800">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <GitBranch className="text-purple-500" /> Workflow Lab
                        </h2>
                    </div>

                    <div className="p-4 space-y-2">
                        <div className="mb-2">
                            <input
                                type="text"
                                value={workflowName}
                                onChange={(e) => setWorkflowName(e.target.value)}
                                className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-700 focus:border-purple-500 outline-none text-sm"
                                placeholder="Workflow Name"
                            />
                            <div className="flex justify-end mt-1">
                                <span className={`text-xs font-medium flex items-center gap-1 ${saveStatus === 'saved' ? 'text-green-500' :
                                    saveStatus === 'saving' ? 'text-yellow-500' :
                                        'text-gray-500'
                                    }`}>
                                    {saveStatus === 'saving' && <Loader2 size={10} className="animate-spin" />}
                                    {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved changes'}
                                </span>
                            </div>
                        </div>

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
                    <WorkflowGeneratorModal
                        onClose={() => setShowGenerator(false)}
                        onGenerate={(prompt) => {
                            setGeneratorPrompt(prompt);
                            return handleGenerateWorkflow();
                        }}
                    />
                )}

                {/* Templates Modal */}
                {showTemplates && (
                    <WorkflowTemplateModal
                        onClose={() => setShowTemplates(false)}
                        onLoadTemplate={handleLoadTemplate}
                    />
                )}

                {/* Load Saved Workflows Modal */}
                {showLoadModal && (
                    <WorkflowLoadModal
                        onClose={() => setShowLoadModal(false)}
                        onLoadWorkflow={handleLoadSavedWorkflow}
                        savedWorkflows={savedWorkflows}
                    />
                )}
            </div>
        </ModuleErrorBoundary>
    );
}
