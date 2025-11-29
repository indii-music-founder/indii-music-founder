import React, { useState } from 'react';
import WorkflowEditor from './components/WorkflowEditor';
import NodePanel from './components/NodePanel';
import WorkflowNodeInspector from './components/WorkflowNodeInspector';
import { useStore } from '../../core/store';
import { Play, Loader2, GitBranch, Sparkles } from 'lucide-react';
import { WorkflowEngine } from './services/WorkflowEngine';

export default function WorkflowLab() {
    const { nodes, edges, setNodes, setEdges } = useStore();
    const [isRunning, setIsRunning] = useState(false);

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
    const [generatorPrompt, setGeneratorPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

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

                    <button
                        onClick={() => setShowGenerator(true)}
                        className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                    >
                        <Sparkles size={16} />
                        Generate with AI
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
        </div>
    );
}
