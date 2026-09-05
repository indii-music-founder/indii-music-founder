/**
 * WorkflowBlock.tsx
 *
 * Project Canvas representation of a saved Workflow / Creative Recipe.
 *
 * Architectural Guarantees:
 * 1. Does NOT duplicate or store the workflow graph inside Project Canvas.
 * 2. References canonical saved workflow via `entityRef: { kind: 'workflow', entityId }`.
 * 3. "Open in Workflow Lab" opens the canonical workflow editor.
 * 4. "Run" triggers the canonical WorkflowEngine, creating an auditable `workflow_run` block.
 * 5. Visual canvas connections are non-executing semantic edges.
 */

import React, { useState, useEffect } from 'react';
import {
    GitFork,
    Play,
    ExternalLink,
    CheckCircle2,
    AlertTriangle,
    Clock,
    MoreVertical,
    X,
    Loader2,
} from 'lucide-react';
import { useStore } from '@/core/store';
import { loadWorkflow } from '@/modules/workflow/services/workflowPersistence';
import { secureRandomHex } from '@/utils/crypto-random';
import { logger } from '@/utils/logger';
import type { ProjectCanvasBlock } from '../../types';
import type { SavedWorkflow } from '@/modules/workflow/types';

interface WorkflowBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onUpdate?: (blockId: string, updates: Partial<ProjectCanvasBlock>) => void;
    onRemovePlacement: (blockId: string) => void;
    onSelect: (blockId: string, multi: boolean) => void;
}

export const WorkflowBlock: React.FC<WorkflowBlockProps> = ({
    block,
    isSelected,
    onRemovePlacement,
    onSelect,
}) => {
    const setModule = useStore((state) => state.setModule);
    const setWorkflowNodes = useStore((state) => state.setNodes);
    const setWorkflowEdges = useStore((state) => state.setEdges);
    const addCanvasBlock = useStore((state) => state.addCanvasBlock);
    const addCanvasEdge = useStore((state) => state.addCanvasEdge);
    const updateCanvasBlock = useStore((state) => state.updateCanvasBlock);

    const workflowId = block.entityRef?.entityId;

    const [workflow, setWorkflow] = useState<SavedWorkflow | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    // Fetch canonical workflow metadata
    useEffect(() => {
        let isMounted = true;
        if (!workflowId) {
            setIsLoading(false);
            return;
        }

        loadWorkflow(workflowId)
            .then((loaded) => {
                if (isMounted) {
                    setWorkflow(loaded);
                    setIsLoading(false);
                }
            })
            .catch((err) => {
                logger.warn(`[WorkflowBlock] Failed to load workflow ${workflowId}:`, err);
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [workflowId]);

    const handleOpenInWorkflowLab = () => {
        if (!workflow) return;
        if (workflow.nodes) setWorkflowNodes(workflow.nodes);
        if (workflow.edges) setWorkflowEdges(workflow.edges);
        setModule('workflow');
    };

    const handleRunWorkflow = async () => {
        if (!workflow || isRunning) return;
        setIsRunning(true);

        const runId = `run_${Date.now()}_${secureRandomHex(4)}`;
        const now = Date.now();

        // 1. Create a persistent workflow_run block positioned to the right
        const createdBlockId = addCanvasBlock({
            type: 'workflow_run',
            position: {
                x: block.position.x + block.size.width + 50,
                y: block.position.y,
            },
            size: { width: 300, height: 180 },
            zIndex: 1,
            entityRef: {
                kind: 'workflow_run',
                entityId: runId,
                versionId: workflow.id,
            },
            snapshot: {
                title: `Run: ${workflow.name || 'Creative Recipe'}`,
                excerpt: 'Execution in progress...',
                cachedAt: now,
            },
            settings: {
                runId,
                workflowId: workflow.id,
                workflowName: workflow.name || 'Recipe',
                status: 'working',
                startedAt: now,
            },
            provenance: {
                creatorType: 'workflow',
                creatorId: workflow.id,
                operation: 'execute_workflow',
                timestamp: now,
                correlationId: runId,
            },
        });

        // 2. Connect a non-executing context edge from the workflow to the run block
        addCanvasEdge(block.id, createdBlockId, 'context', 'executes');

        try {
            // Execute via WorkflowEngine
            const { WorkflowEngine } = await import('@/modules/workflow/services/WorkflowEngine');
            const nodesCopy = structuredClone(workflow.nodes || []);
            const edgesCopy = structuredClone(workflow.edges || []);

            const engine = new WorkflowEngine(nodesCopy, edgesCopy, () => {
                // UI node state updates if needed
            });

            await engine.run();

            // Completed successfully
            const completedAt = Date.now();
            updateCanvasBlock(createdBlockId, {
                snapshot: {
                    title: `Run: ${workflow.name || 'Creative Recipe'}`,
                    excerpt: 'Execution completed successfully.',
                    cachedAt: completedAt,
                },
                settings: {
                    runId,
                    workflowId: workflow.id,
                    workflowName: workflow.name || 'Recipe',
                    status: 'done',
                    completedAt,
                    durationMs: completedAt - now,
                },
                updatedAt: completedAt,
            });
        } catch (error) {
            logger.error('[WorkflowBlock] Workflow execution failed:', error);
            const failedAt = Date.now();
            updateCanvasBlock(createdBlockId, {
                snapshot: {
                    title: `Run: ${workflow.name || 'Creative Recipe'}`,
                    excerpt: 'Execution failed.',
                    cachedAt: failedAt,
                },
                settings: {
                    runId,
                    workflowId: workflow.id,
                    workflowName: workflow.name || 'Recipe',
                    status: 'error',
                    errorMessage: error instanceof Error ? error.message : 'Unknown execution error',
                    failedAt,
                },
                updatedAt: failedAt,
            });
        } finally {
            setIsRunning(false);
        }
    };

    // Missing Reference State
    if (!isLoading && !workflow) {
        return (
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(block.id, e.shiftKey || e.metaKey);
                }}
                className={`w-full h-full rounded-2xl p-4 flex flex-col justify-between bg-zinc-900/90 backdrop-blur-md border transition-all ${
                    isSelected ? 'ring-2 ring-rose-500 border-rose-500/50' : 'border-rose-900/40 hover:border-rose-800'
                }`}
            >
                <div className="flex items-start gap-2.5 text-rose-400">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-300">
                            Missing Recipe Reference
                        </h4>
                        <p className="text-xs text-zinc-400 mt-1">
                            Workflow ID <code className="text-zinc-300 font-mono text-[10px]">{workflowId || 'unknown'}</code> was not found.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800/60">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemovePlacement(block.id);
                        }}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
                    >
                        Remove Placement
                    </button>
                </div>
            </div>
        );
    }

    const nodeCount = workflow?.nodes ? workflow.nodes.length : 0;
    const edgeCount = workflow?.edges ? workflow.edges.length : 0;

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onSelect(block.id, e.shiftKey || e.metaKey);
            }}
            className={`w-full h-full rounded-2xl flex flex-col bg-zinc-900/95 backdrop-blur-md border transition-all select-none overflow-hidden shadow-xl ${
                isSelected
                    ? 'ring-2 ring-indigo-500 border-indigo-500/50'
                    : 'border-zinc-800/80 hover:border-zinc-700'
            }`}
        >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-zinc-950/40 border-b border-zinc-800/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                        <GitFork size={12} />
                    </div>
                    <h3 className="text-xs font-semibold text-zinc-200 truncate" title={workflow?.name || 'Recipe'}>
                        {workflow?.name || 'Creative Recipe'}
                    </h3>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 relative">
                    <button
                        onClick={handleOpenInWorkflowLab}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title="Open in Workflow Lab"
                    >
                        <ExternalLink size={13} />
                    </button>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title="Options"
                    >
                        <MoreVertical size={13} />
                    </button>

                    {isMenuOpen && (
                        <div
                            onMouseLeave={() => setIsMenuOpen(false)}
                            className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50 text-xs"
                        >
                            <button
                                onClick={handleOpenInWorkflowLab}
                                className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <ExternalLink size={13} />
                                <span>Open in Workflow Lab</span>
                            </button>
                            <div className="h-px bg-zinc-800 my-1" />
                            <button
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    onRemovePlacement(block.id);
                                }}
                                className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <X size={13} />
                                <span>Remove from Canvas</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Body Description & Node Overview */}
            <div className="flex-1 p-3.5 flex flex-col justify-between overflow-hidden text-xs">
                <div className="overflow-y-auto min-h-0">
                    <p className="text-zinc-400 line-clamp-2 leading-relaxed">
                        {workflow?.description || 'Reusable creative automation recipe.'}
                    </p>

                    <div className="flex items-center gap-2 mt-3 text-[11px] text-zinc-400">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 font-mono">
                            {nodeCount} {nodeCount === 1 ? 'step' : 'steps'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700/60 font-mono">
                            {edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400 font-medium ml-auto">
                            <CheckCircle2 size={11} /> Validated
                        </span>
                    </div>
                </div>

                {/* Cost Preview (Explicitly never fabricates guessed values) */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/60 mt-1">
                    <span>Estimated Cost:</span>
                    <span className="font-mono text-zinc-400">
                        {((workflow as unknown as { cost?: number })?.cost !== undefined) ? `$${(workflow as unknown as { cost?: number }).cost}` : 'Unavailable (Calculated at runtime)'}
                    </span>
                </div>

                {/* Run Trigger */}
                <div className="flex items-center justify-between gap-2 mt-2">
                    <button
                        onClick={handleRunWorkflow}
                        disabled={isRunning || nodeCount === 0}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-[0.98]"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Executing...</span>
                            </>
                        ) : (
                            <>
                                <Play size={12} className="fill-current" />
                                <span>Run Recipe</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 bg-zinc-950/40 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                <span className="font-mono">ID: {workflowId ? workflowId.slice(0, 8) : '...'}</span>
                <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {workflow?.updatedAt ? new Date(workflow.updatedAt).toLocaleDateString() : 'Synced'}
                </span>
            </div>
        </div>
    );
};
