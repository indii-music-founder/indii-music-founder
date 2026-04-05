import React, { useState, useEffect, useRef } from 'react';
import WorkflowEditor from './components/WorkflowEditor';
import NodePanel from './components/NodePanel';
import WorkflowGeneratorModal from './components/WorkflowGeneratorModal';
import WorkflowTemplateModal from './components/WorkflowTemplateModal';
import WorkflowLoadModal from './components/WorkflowLoadModal';
import { useStore } from '../../core/store';
import { useShallow } from 'zustand/react/shallow';
import type { ModuleId } from '@/core/constants';
import {
    Play, Loader2, GitBranch, Sparkles, LayoutTemplate, Save, FolderOpen,
    Cpu, Zap, Clock, Music, Image, Mail, Filter, Webhook,
    HelpCircle, BookOpen, MessageSquare, Settings
} from 'lucide-react';
import { WorkflowEngine } from './services/WorkflowEngine';
import { WORKFLOW_TEMPLATES } from './services/workflowTemplates';
import { v4 as uuidv4 } from 'uuid';
import { Status, SavedWorkflow } from './types';
import { getUserWorkflows } from './services/workflowPersistence';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { MobileOnlyWarning } from '@/core/components/MobileOnlyWarning';
import { useMobile } from '@/hooks/useMobile';
import { logger } from '@/utils/logger';
import { useToast } from '@/core/context/ToastContext';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

/* ================================================================== */
/*  Workflow Lab — Three-Panel Layout                                   */
/*                                                                     */
/*  ┌──────────┬───────────────────────────┬──────────────┐            */
/*  │  LEFT    │    CENTER                 │   RIGHT      │            */
/*  │  Controls│    Node Editor            │   Node Lib   │            */
/*  │  Actions │    (React Flow)           │   Inspector  │            */
/*  │  Save    │                           │   Help       │            */
/*  └──────────┴───────────────────────────┴──────────────┘            */
/* ================================================================== */

export default function WorkflowLab() {
    // Hooks must be called unconditionally before early returns
    const { nodes, edges, setNodes, setEdges, user } = useStore(useShallow(state => ({
        nodes: state.nodes,
        edges: state.edges,
        setNodes: state.setNodes,
        setEdges: state.setEdges,
        user: state.user
    })));
    const { success: toastSuccess, error: toastError } = useToast();
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

    // Stable reference to ReactFlowInstance — populated via WorkflowEditor's onInit callback.
    // Used to capture real viewport (pan/zoom) at save time instead of a hardcoded {0,0,1}.
    const rfInstanceRef = useRef<import('reactflow').ReactFlowInstance | null>(null);

    // Auto-save logic (must be called before early return)
    useEffect(() => {
        if (!currentWorkflowId || !currentUser || nodes.length === 0) return;

        setSaveStatus('unsaved');

        const saveTimer = setTimeout(async () => {
            setSaveStatus('saving');
            try {
                const engine = new WorkflowEngine(nodes, edges, setNodes);
                // Capture real viewport so save/restore preserves the user's canvas position.
                const viewport = rfInstanceRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
                await engine.saveWorkflow(currentWorkflowId, workflowName, 'Auto-saved workflow', viewport);

                setSaveStatus('saved');
            } catch (error: unknown) {
                logger.error("Auto-save failed:", error);
                setSaveStatus('unsaved'); // Revert to unsaved on error
            }
        }, 2000); // Debounce 2s

        return () => clearTimeout(saveTimer);
    }, [nodes, edges, workflowName, currentWorkflowId, currentUser, setNodes]);

    // Reactive mobile detection via centralized hook
    const { isAnyPhone: isMobile } = useMobile();

    // Local Draft Auto-Save
    useEffect(() => {
        // Load draft on mount if no current workflow
        if (!currentWorkflowId && nodes.length === 0) {
            const draft = localStorage.getItem('workflow_draft');
            if (draft) {
                try {
                    const { nodes: savedNodes, edges: savedEdges, name } = JSON.parse(draft);
                    setNodes(savedNodes);
                    setEdges(savedEdges);
                    setWorkflowName(name);
                    setSaveStatus('unsaved'); // It's a draft, so it's unsaved in cloud
                } catch (e: unknown) {
                    logger.error("Failed to load draft", e);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs only on mount to load drafts
    }, []);

    // Save draft on change
    useEffect(() => {
        if (!currentWorkflowId && nodes.length > 0) {
            const draft = JSON.stringify({ nodes, edges, name: workflowName });
            localStorage.setItem('workflow_draft', draft);
        } else if (currentWorkflowId) {
            // If we have a real ID, clear the draft to avoid confusion
            localStorage.removeItem('workflow_draft');
        }
    }, [nodes, edges, workflowName, currentWorkflowId]);

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

    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            steps: [
                { element: '#tour-workflow-controls', popover: { title: 'Controls Panel', description: 'Manage your workflow files, run executions, and save changes here.' } },
                { element: '#tour-workflow-generator', popover: { title: 'AI Generator', description: 'Describe what you want to achieve, and let AI build the initial node structure for you.' } },
                { element: '#tour-workflow-canvas', popover: { title: 'Node Editor', description: 'Drag and drop nodes here. Connect them to build automation logic.' } },
                { element: '#tour-workflow-library', popover: { title: 'Node Library', description: 'A collection of available triggers, actions, and logic gates.' } },
                { element: '#tour-workflow-inspector', popover: { title: 'Inspector', description: 'Select a node to view and edit its detailed configuration.' } },
            ]
        });
        driverObj.drive();
    };

    const handleRunWorkflow = async () => {
        if (nodes.length === 0) return;
        setIsRunning(true);
        try {
            const engine = new WorkflowEngine(nodes, edges, setNodes);
            await engine.run();
        } catch (e: unknown) {
            logger.error("Workflow failed", e);
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
        } catch (error: unknown) {
            logger.error("Failed to generate workflow:", error);
            toastError('Failed to generate workflow. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLoadTemplate = (templateId: string) => {
        const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            // Remap IDs to fresh UUIDs so multiple template loads don't collide
            const idMap = new Map<string, string>();
            const newNodes = template.nodes.map(n => {
                const newId = n.id === 'start' || n.id === 'end' ? n.id : uuidv4();
                idMap.set(n.id, newId);
                return { ...n, id: newId, data: { ...n.data, status: Status.PENDING } };
            });
            const newEdges = template.edges.map(e => ({
                ...e,
                id: uuidv4(),
                source: idMap.get(e.source) ?? e.source,
                target: idMap.get(e.target) ?? e.target,
            }));
            setNodes(newNodes);
            setEdges(newEdges);
            setWorkflowName(template.name);
            setCurrentWorkflowId(undefined); // Fresh instance from template
            setShowTemplates(false);
        }
    };

    const handleSaveWorkflow = async () => {
        if (!currentUser) {
            toastError('Please wait for sign-in to complete before saving.');
            return;
        }
        setIsSaving(true);
        try {
            const engine = new WorkflowEngine(nodes, edges, setNodes);
            const id = currentWorkflowId || uuidv4();
            // Capture real viewport (pan + zoom) from the live ReactFlow instance.
            const viewport = rfInstanceRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };

            await engine.saveWorkflow(
                id,
                workflowName,
                'Saved workflow',
                viewport
            );
            setCurrentWorkflowId(id);
            toastSuccess('Workflow saved.');
        } catch (error: unknown) {
            logger.error("Failed to save workflow:", error);
            toastError(`Failed to save workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSaving(false);
            setSaveStatus('saved');
        }
    };

    const handleOpenLoadModal = async () => {
        if (!currentUser) {
            toastError('Please wait for sign-in to complete before loading.');
            return;
        }
        setShowLoadModal(true);
        try {
            const workflows = await getUserWorkflows(currentUser.uid);
            setSavedWorkflows(workflows);
        } catch (error: unknown) {
            logger.error("Failed to load workflows:", error);
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
            <div className="absolute inset-0 flex bg-[#0f0f0f]">
                {/* ── LEFT PANEL — Controls & Actions ────── */}
                <div id="tour-workflow-controls" className="w-64 border-r border-gray-800 bg-[#1a1a1a] flex flex-col flex-shrink-0">
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <GitBranch className="text-purple-500" /> Workflow Lab
                        </h2>
                        <button onClick={startTour} className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:text-white transition-colors" title="Take a Tour">
                            <HelpCircle size={16} />
                        </button>
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
                            id="tour-workflow-generator"
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

                    {/* Saved Workflows Quick List */}
                    <div className="flex-1 overflow-y-auto px-4 py-3">
                        <SavedWorkflowsWidget
                            savedWorkflows={savedWorkflows}
                            onLoad={handleLoadSavedWorkflow}
                            currentWorkflowId={currentWorkflowId}
                        />
                    </div>
                </div>

                {/* ── CENTER — Node Editor Canvas ────────────────────── */}
                <div id="tour-workflow-canvas" className="flex-1 relative min-w-0">
                    <WorkflowEditor onInit={(instance) => { rfInstanceRef.current = instance; }} />
                    <NodePanel />
                </div>

                {/* ── RIGHT PANEL — Node Library & Inspector ─────────── */}
                <aside className="hidden lg:flex w-72 2xl:w-80 flex-col border-l border-white/5 overflow-y-auto p-3 gap-3 flex-shrink-0 bg-[#0f0f0f]">
                    <NodeLibraryPanel />
                    <NodeInspectorPanel nodes={nodes} />
                    <HelpDocsPanel />
                </aside>

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

/* ================================================================== */
/*  Left Panel Widgets                                                  */
/* ================================================================== */

function SavedWorkflowsWidget({
    savedWorkflows,
    onLoad,
    currentWorkflowId,
}: {
    savedWorkflows: SavedWorkflow[];
    onLoad: (workflow: SavedWorkflow) => void;
    currentWorkflowId?: string;
}) {
    if (savedWorkflows.length === 0) return null;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Recent Workflows</h3>
            <div className="space-y-1">
                {savedWorkflows.slice(0, 5).map((w) => (
                    <button
                        key={w.id}
                        onClick={() => onLoad(w)}
                        className={`w-full text-left flex items-center gap-2 py-2 px-2 rounded-lg transition-colors text-xs ${w.id === currentWorkflowId
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                            }`}
                    >
                        <GitBranch size={12} className="flex-shrink-0" />
                        <span className="truncate">{w.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ================================================================== */
/*  Right Panel Widgets                                                 */
/* ================================================================== */

function NodeLibraryPanel() {
    const nodeDefs = [
        { name: 'AI Generate', nodeType: 'departmentNode', data: { departmentName: 'AI Department' }, icon: Sparkles, category: 'AI', color: 'text-purple-400' },
        { name: 'Process Audio', nodeType: 'audioSegmentNode', data: {}, icon: Music, category: 'Audio', color: 'text-blue-400' },
        { name: 'Generate Image', nodeType: 'departmentNode', data: { departmentName: 'Art Department' }, icon: Image, category: 'AI', color: 'text-pink-400' },
        { name: 'Send Email', nodeType: 'outputNode', data: {}, icon: Mail, category: 'Action', color: 'text-green-400' },
        { name: 'Filter', nodeType: 'logicNode', data: { departmentName: 'Logic', jobId: 'gatekeeper' }, icon: Filter, category: 'Logic', color: 'text-yellow-400' },
        { name: 'Webhook', nodeType: 'inputNode', data: {}, icon: Webhook, category: 'Integration', color: 'text-orange-400' },
        { name: 'Delay', nodeType: 'logicNode', data: { departmentName: 'Logic', jobId: 'router' }, icon: Clock, category: 'Flow', color: 'text-cyan-400' },
        { name: 'Transform', nodeType: 'departmentNode', data: { departmentName: 'Music Department' }, icon: Cpu, category: 'Data', color: 'text-emerald-400' },
    ];

    const onDragStart = (event: React.DragEvent, nodeType: string, data: Record<string, string>) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
        Object.entries(data).forEach(([key, value]) => {
            event.dataTransfer.setData(`application/${key}`, value);
        });
    };

    return (
        <div id="tour-workflow-library" className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <Zap size={10} /> Node Library
            </h3>
            <p className="text-[10px] text-gray-700 px-1 mb-2">Drag onto the canvas ↙</p>
            <div className="space-y-1">
                {nodeDefs.map((n) => (
                    <div
                        key={n.name}
                        className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => onDragStart(e, n.nodeType, n.data as Record<string, string>)}
                    >
                        <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                            <n.icon size={12} className={n.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-300 truncate">{n.name}</p>
                            <p className="text-[10px] text-gray-600">{n.category}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function NodeInspectorPanel({ nodes }: { nodes: Array<{ id: string; selected?: boolean; data?: { label?: string; status?: string; departmentName?: string }; type?: string }> }) {
    const selectedNodes = nodes.filter((n) => n.selected);
    const totalCount = nodes.length;
    const selectedCount = selectedNodes.length;

    return (
        <div id="tour-workflow-inspector" className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <Settings size={10} /> Inspector
            </h3>
            <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-[11px] text-gray-400">Total Nodes</span>
                    <span className="text-xs font-bold text-purple-400">{totalCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                    <span className="text-[11px] text-gray-400">Selected</span>
                    <span className="text-xs font-bold text-green-400">
                        {selectedCount > 0 ? `${selectedCount} node${selectedCount > 1 ? 's' : ''}` : 'None'}
                    </span>
                </div>
                {selectedCount > 0 ? (
                    selectedNodes.slice(0, 4).map((n) => (
                        <div key={n.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                            <Cpu size={10} className="text-purple-400 flex-shrink-0" />
                            <span className="text-[11px] text-gray-300 truncate">
                                {n.data?.departmentName || n.data?.label || n.type || n.id}
                            </span>
                        </div>
                    ))
                ) : (
                    <p className="text-[10px] text-gray-700 px-2 py-1">Click a node to inspect it</p>
                )}
                {selectedCount > 4 && (
                    <p className="text-[10px] text-gray-600 px-2">+{selectedCount - 4} more selected</p>
                )}
            </div>
        </div>
    );
}

function HelpDocsPanel() {
    const { setModule } = useStore(useShallow(state => ({
        setModule: state.setModule
    })));
    const goToKnowledge = () => setModule('knowledge' as ModuleId);
    const links = [
        { label: 'Getting Started', icon: BookOpen, desc: 'Learn the basics', onClick: goToKnowledge },
        { label: 'Node Reference', icon: HelpCircle, desc: 'All node types', onClick: goToKnowledge },
        { label: 'Community', icon: MessageSquare, desc: 'Ask questions', onClick: goToKnowledge },
    ];

    return (
        <div className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-3">
            <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <HelpCircle size={10} /> Help & Docs
            </h3>
            <div className="space-y-1">
                {links.map((l) => (
                    <button
                        key={l.label}
                        onClick={l.onClick}
                        className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                    >
                        <l.icon size={12} className="text-purple-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-300">{l.label}</p>
                            <p className="text-[10px] text-gray-600">{l.desc}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
