/**
 * PromoteToWorkflowModal.tsx
 *
 * Promotes a selection of Project Canvas blocks into a reusable Workflow Lab Recipe.
 *
 * Architectural Guarantees:
 * 1. Explicit preview and confirmation — no automatic conversion of ordinary canvas lines.
 * 2. Maps supported blocks to valid Workflow Lab nodes and edges.
 * 3. Persists through canonical `saveWorkflow` from `workflowPersistence.ts`.
 * 4. Places a `workflow` reference block on the canvas without altering original blocks.
 */

import React, { useState } from 'react';
import {
    GitFork,
    X,
    Check,
    ArrowRight,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import { saveWorkflow } from '@/modules/workflow/services/workflowPersistence';
import { auth } from '@/services/firebase';
import { Status } from '@/modules/workflow/types';
import type { CustomNode, CustomEdge } from '@/modules/workflow/types';
import type { ProjectCanvasBlock } from '../../types';

interface PromoteToWorkflowModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedBlocks: ProjectCanvasBlock[];
    onWorkflowCreated: (savedWorkflowId: string, workflowName: string) => void;
}

export const PromoteToWorkflowModal: React.FC<PromoteToWorkflowModalProps> = ({
    isOpen,
    onClose,
    selectedBlocks,
    onWorkflowCreated,
}) => {
    const [recipeName, setRecipeName] = useState('New Creative Recipe');
    const [recipeDescription, setRecipeDescription] = useState('Automated pipeline created from canvas selection.');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    // Construct Workflow Lab graph from selection
    const generatedNodes: CustomNode[] = [];
    const generatedEdges: CustomEdge[] = [];

    // 1. Initial Input Node from Text or Note blocks
    const promptSource = selectedBlocks.find((b) => b.type === 'note' || b.type === 'text');
    const initialPrompt = promptSource?.snapshot?.excerpt || promptSource?.snapshot?.title || 'Generate campaign creative';

    const inputNodeId = 'node_input_1';
    generatedNodes.push({
        id: inputNodeId,
        type: 'inputNode',
        position: { x: 100, y: 150 },
        data: {
            nodeType: 'input',
            prompt: initialPrompt,
            status: Status.PENDING,
        },
    });

    // 2. Department processing nodes from Asset or Output blocks
    let lastNodeId = inputNodeId;
    let stepIndex = 1;

    selectedBlocks.forEach((b) => {
        if (b.type === 'asset') {
            const mediaType = b.snapshot?.mediaType || 'image';
            const deptNodeId = `node_dept_${stepIndex}`;
            stepIndex++;

            generatedNodes.push({
                id: deptNodeId,
                type: 'departmentNode',
                position: { x: 100 + stepIndex * 240, y: 150 },
                data: {
                    nodeType: 'department',
                    departmentName: mediaType === 'video' ? 'Video' : 'Creative',
                    selectedJobId: mediaType === 'video' ? 'video-generation' : 'image-generation',
                    prompt: b.snapshot?.title || 'Transform asset',
                    status: Status.PENDING,
                },
            });

            generatedEdges.push({
                id: `edge_${lastNodeId}_${deptNodeId}`,
                source: lastNodeId,
                target: deptNodeId,
            });

            lastNodeId = deptNodeId;
        }
    });

    // 3. Terminal Output Node
    const outputNodeId = `node_output_${stepIndex}`;
    generatedNodes.push({
        id: outputNodeId,
        type: 'outputNode',
        position: { x: 100 + (stepIndex + 1) * 240, y: 150 },
        data: {
            nodeType: 'output',
            status: Status.PENDING,
        },
    });

    generatedEdges.push({
        id: `edge_${lastNodeId}_${outputNodeId}`,
        source: lastNodeId,
        target: outputNodeId,
    });

    const handleConfirm = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            setError('You must be signed in to save workflows.');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const now = new Date().toISOString();
            const savedId = await saveWorkflow(
                {
                    name: recipeName.trim() || 'Untitled Recipe',
                    description: recipeDescription.trim(),
                    nodes: generatedNodes,
                    edges: generatedEdges,
                    viewport: { x: 0, y: 0, zoom: 1 },
                    createdAt: now,
                    updatedAt: now,
                },
                userId
            );

            onWorkflowCreated(savedId, recipeName.trim() || 'Untitled Recipe');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save workflow.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-400">
                        <GitFork size={18} />
                        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                            Promote Selection to Creative Recipe
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body Form */}
                <div className="p-5 space-y-4 text-xs">
                    <div>
                        <label className="block font-semibold text-zinc-300 mb-1">
                            Recipe Name
                        </label>
                        <input
                            type="text"
                            value={recipeName}
                            onChange={(e) => setRecipeName(e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 outline-none focus:border-indigo-500/60"
                        />
                    </div>

                    <div>
                        <label className="block font-semibold text-zinc-300 mb-1">
                            Description
                        </label>
                        <textarea
                            value={recipeDescription}
                            onChange={(e) => setRecipeDescription(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 outline-none focus:border-indigo-500/60 resize-none"
                        />
                    </div>

                    {/* Preview Graph Steps */}
                    <div>
                        <span className="block font-semibold text-zinc-400 mb-2">
                            Proposed Pipeline Steps ({generatedNodes.length} nodes):
                        </span>
                        <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-2 max-h-40 overflow-y-auto">
                            {generatedNodes.map((node, i) => (
                                <div key={node.id} className="flex items-center gap-2 text-zinc-300">
                                    <span className="w-5 h-5 rounded-md bg-zinc-800 text-indigo-400 font-mono text-[10px] flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <span className="font-semibold text-zinc-200 capitalize">
                                        {node.data.nodeType}
                                    </span>
                                    <span className="text-zinc-500 truncate">
                                        {node.data.nodeType === 'department'
                                            ? `${node.data.departmentName} (${node.data.selectedJobId})`
                                            : node.data.nodeType === 'input'
                                            ? `Prompt: "${node.data.prompt?.slice(0, 30)}..."`
                                            : 'Save Output'}
                                    </span>
                                    {i < generatedNodes.length - 1 && (
                                        <ArrowRight size={12} className="text-zinc-600 ml-auto shrink-0" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-semibold transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/20"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={14} className="animate-spin" /> Saving...
                            </>
                        ) : (
                            <>
                                <Check size={14} /> Promote to Recipe
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
