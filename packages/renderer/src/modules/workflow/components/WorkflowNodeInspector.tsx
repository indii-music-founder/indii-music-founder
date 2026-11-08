import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { X, Sparkles, Save, Loader2, Layers, Maximize2, ChevronDown, ChevronUp } from 'lucide-react';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { logger } from '@/utils/logger';
import type { WorkflowAuditionVariant, SubgraphNodeData } from '../types';

export default function WorkflowNodeInspector() {
    const { nodes, edges, setNodes, setEdges, selectedNodeId, setSelectedNodeId } = useStore(useShallow(state => ({
        nodes: state.nodes,
        edges: state.edges,
        setNodes: state.setNodes,
        setEdges: state.setEdges,
        selectedNodeId: state.selectedNodeId,
        setSelectedNodeId: state.setSelectedNodeId
    })));

    const [prompt, setPrompt] = useState('');
    const [aiInstruction, setAiInstruction] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Audition Variants state
    const [songContext, setSongContext] = useState('');
    const [variants, setVariants] = useState<WorkflowAuditionVariant[]>([]);
    const [isAuditioning, setIsAuditioning] = useState(false);
    const [showAudition, setShowAudition] = useState(false);
    const [appliedVariantId, setAppliedVariantId] = useState<string | null>(null);

    // Expand subgraph state
    const [isExpanding, setIsExpanding] = useState(false);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    const isSubgraph = selectedNode?.type === 'subgraphNode';
    const subgraphData = isSubgraph ? (selectedNode?.data as SubgraphNodeData) : null;
    const subgraphStepCount = subgraphData?.subgraph?.nodes?.length ?? 0;

    useEffect(() => {
        if (selectedNode) {
            setPrompt(('prompt' in selectedNode.data ? selectedNode.data.prompt : '') || '');
        }
        // Reset audition state when node changes
        setVariants([]);
        setShowAudition(false);
        setAppliedVariantId(null);
        setSongContext('');
    }, [selectedNodeId, selectedNode]);

    if (!selectedNode) return null;

    const handleSave = () => {
        setNodes(nodes.map(n =>
            n.id === selectedNodeId
                ? { ...n, data: { ...n.data, prompt } }
                : n
        ));
    };

    const handleAiRefine = async () => {
        if (!aiInstruction.trim()) return;
        setIsGenerating(true);
        try {
            const response = await AI.generateContent(
                [{ role: 'user', parts: [{ text: `Refine this prompt based on the instruction: "${aiInstruction}". \n\nCurrent Prompt: "${prompt}"\n\nReturn ONLY the refined prompt text.` }] }],
                INTELLIGENCE_MODELS.TEXT.AGENT
            );
            const part = response.response.candidates?.[0]?.content?.parts?.[0];
            const newPrompt = (part && 'text' in part && typeof part.text === 'string') ? part.text : prompt;
            setPrompt(newPrompt);
            setAiInstruction('');
        } catch (e: unknown) {
            logger.error('[Inspector] AI refinement failed', e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAudition = async () => {
        if (!selectedNode) return;
        setIsAuditioning(true);
        setVariants([]);
        try {
            const { auditionWorkflowVariants } = await import('../services/workflowGenerator');
            const result = await auditionWorkflowVariants(selectedNode, songContext || prompt || 'independent music artist release');
            setVariants(result);
            setShowAudition(true);
        } catch (e: unknown) {
            logger.error('[Inspector] Audition failed', e);
        } finally {
            setIsAuditioning(false);
        }
    };

    const handleApplyVariant = (variant: WorkflowAuditionVariant) => {
        setPrompt(variant.prompt);
        setAppliedVariantId(variant.id);
        // Auto-save the applied variant prompt to the node
        setNodes(nodes.map(n =>
            n.id === selectedNodeId
                ? { ...n, data: { ...n.data, prompt: variant.prompt } }
                : n
        ));
    };

    const handleExpandSubgraph = async () => {
        if (!selectedNodeId) return;
        setIsExpanding(true);
        try {
            const { expandSubgraph } = await import('../services/workflowGenerator');
            const updated = expandSubgraph({ id: 'canvas', name: '', description: '', createdAt: '', updatedAt: '', viewport: { x: 0, y: 0, zoom: 1 }, nodes, edges }, selectedNodeId);
            setNodes(updated.nodes);
            setEdges(updated.edges);
            setSelectedNodeId(null);
        } catch (e: unknown) {
            logger.error('[Inspector] Expand subgraph failed', e);
        } finally {
            setIsExpanding(false);
        }
    };

    const nodeLabel = 'label' in selectedNode.data
        ? String(selectedNode.data.label)
        : 'departmentName' in selectedNode.data
            ? String((selectedNode.data as { departmentName: string }).departmentName)
            : selectedNode.type ?? 'Node';

    return (
        <div className="flex flex-col h-full rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/[0.02]">
                <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles size={10} /> Node Inspector
                    </h3>
                    <p className="text-xs text-gray-300 font-semibold mt-0.5 truncate max-w-[160px]">{nodeLabel}</p>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                {/* Node type badge */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Type</label>
                    <div className="px-3 py-2 bg-gray-800 rounded border border-gray-700 text-sm text-gray-300 capitalize flex items-center gap-2">
                        {isSubgraph && <Layers size={12} className="text-pink-400" />}
                        {selectedNode.data.nodeType} Node
                        {isSubgraph && subgraphStepCount > 0 && (
                            <span className="ml-auto text-[10px] text-pink-400 font-bold">{subgraphStepCount} steps</span>
                        )}
                    </div>
                </div>

                {/* Expand Subgraph — only for subgraphNode */}
                {isSubgraph && (
                    <div className="bg-pink-900/10 border border-pink-500/30 rounded-lg p-3">
                        <label className="text-xs font-bold text-pink-400 uppercase mb-2 block flex items-center gap-2">
                            <Maximize2 size={12} /> Micro-Workflow
                        </label>
                        <p className="text-[11px] text-gray-400 mb-3">
                            Expand this Micro-Workflow back to its {subgraphStepCount} individual nodes on the canvas for editing.
                        </p>
                        <button
                            onClick={handleExpandSubgraph}
                            disabled={isExpanding}
                            className="w-full py-1.5 px-3 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {isExpanding ? <Loader2 size={12} className="animate-spin" /> : <Maximize2 size={12} />}
                            {isExpanding ? 'Expanding...' : 'Expand to Canvas'}
                        </button>
                    </div>
                )}

                {/* Prompt / Configuration — skip for subgraphNode */}
                {!isSubgraph && (
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Prompt / Configuration</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-28 bg-black/30 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-green-500 outline-none resize-none"
                            placeholder="Enter node instructions..."
                        />
                    </div>
                )}

                {/* AI Prompt Refiner — skip for subgraphNode */}
                {!isSubgraph && (
                    <div className="bg-green-900/10 border border-green-500/30 rounded-lg p-3">
                        <label className="text-xs font-bold text-green-400 uppercase mb-2 block flex items-center gap-2">
                            <Sparkles size={12} /> Refine Prompt
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={aiInstruction}
                                onChange={(e) => setAiInstruction(e.target.value)}
                                placeholder="e.g. Make it more cinematic..."
                                className="flex-1 bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-green-500 outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAiRefine()}
                            />
                            <button
                                onClick={handleAiRefine}
                                disabled={isGenerating || !aiInstruction.trim()}
                                className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            </button>
                        </div>
                    </div>
                )}

                {/* Audition Variants — only for department nodes */}
                {selectedNode.type === 'departmentNode' && (
                    <div className="bg-purple-900/10 border border-purple-500/30 rounded-lg p-3">
                        <button
                            onClick={() => setShowAudition(v => !v)}
                            className="w-full flex items-center justify-between text-xs font-bold text-purple-400 uppercase mb-1"
                        >
                            <span className="flex items-center gap-2">
                                <Sparkles size={12} /> Audition 3 Creative Directions
                            </span>
                            {showAudition ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showAudition && (
                            <div className="mt-2 space-y-2">
                                <input
                                    type="text"
                                    value={songContext}
                                    onChange={(e) => setSongContext(e.target.value)}
                                    placeholder="Your song vibe, e.g. 'dark synth-pop breakup anthem'"
                                    className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                                />
                                <button
                                    onClick={handleAudition}
                                    disabled={isAuditioning}
                                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {isAuditioning ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    {isAuditioning ? 'Generating...' : 'Generate 3 Directions'}
                                </button>

                                {variants.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                        {variants.map((v) => (
                                            <div
                                                key={v.id}
                                                className={`p-2 rounded-lg border cursor-pointer transition-all ${appliedVariantId === v.id
                                                    ? 'border-purple-400 bg-purple-900/30'
                                                    : 'border-gray-700 bg-black/20 hover:border-purple-500/60'
                                                    }`}
                                                onClick={() => handleApplyVariant(v)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="text-xs font-bold text-white">{v.title}</span>
                                                    {appliedVariantId === v.id && (
                                                        <span className="text-[10px] text-purple-400 font-bold shrink-0">Applied ✓</span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-400 mt-0.5">{v.description}</p>
                                                <p className="text-[10px] text-purple-300 mt-1 italic">{v.styleRationale}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {!showAudition && (
                            <p className="text-[11px] text-gray-500">Get 3 suggested creative directions for this node. Click to expand.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer — save button (not shown for subgraphNode since no prompt) */}
            {!isSubgraph && (
                <div className="p-4 border-t border-gray-800 bg-gray-800/50 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                    >
                        <Save size={16} /> Save Changes
                    </button>
                </div>
            )}
        </div>
    );
}
