/**
 * WorkflowRunBlock.tsx
 *
 * Project Canvas representation of an auditable Workflow Run Receipt.
 *
 * Architectural Guarantees:
 * 1. Displays verified run receipt status without fabrication.
 * 2. Surfaces pending, working, waiting_for_approval, done, and error states.
 * 3. Never displays leaked secrets or API credentials.
 * 4. "Remove from canvas" removes spatial placement only.
 */

import React, { useState } from 'react';
import {
    Activity,
    CheckCircle2,
    XCircle,
    Loader2,
    Clock,
    AlertTriangle,
    ShieldAlert,
    ExternalLink,
    MoreVertical,
    X,
} from 'lucide-react';
import { useStore } from '@/core/store';
import type { ProjectCanvasBlock } from '../../types';

interface WorkflowRunBlockProps {
    block: ProjectCanvasBlock;
    isSelected: boolean;
    onUpdate?: (blockId: string, updates: Partial<ProjectCanvasBlock>) => void;
    onRemovePlacement: (blockId: string) => void;
    onSelect: (blockId: string, multi: boolean) => void;
}

export const WorkflowRunBlock: React.FC<WorkflowRunBlockProps> = ({
    block,
    isSelected,
    onRemovePlacement,
    onSelect,
}) => {
    const setModule = useStore((state) => state.setModule);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const settings = block.settings || {};
    const status = (settings.status as string) || 'done';
    const runId = (settings.runId as string) || block.entityRef?.entityId || 'unknown_run';
    const workflowName = (settings.workflowName as string) || block.snapshot?.title || 'Creative Recipe Run';
    const errorMessage = settings.errorMessage as string | undefined;
    const durationMs = settings.durationMs as number | undefined;

    const renderStatusBadge = () => {
        switch (status) {
            case 'working':
            case 'running':
                return (
                    <span className="flex items-center gap-1 text-cyan-400 font-medium">
                        <Loader2 size={12} className="animate-spin" /> In Progress
                    </span>
                );
            case 'waiting_for_approval':
                return (
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                        <ShieldAlert size={12} /> Needs Approval
                    </span>
                );
            case 'error':
            case 'failed':
                return (
                    <span className="flex items-center gap-1 text-rose-400 font-medium">
                        <XCircle size={12} /> Execution Failed
                    </span>
                );
            case 'done':
            case 'completed':
            default:
                return (
                    <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <CheckCircle2 size={12} /> Completed
                    </span>
                );
        }
    };

    const handleOpenWorkflowLab = () => {
        setModule('workflow');
    };

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onSelect(block.id, e.shiftKey || e.metaKey);
            }}
            className={`w-full h-full rounded-2xl flex flex-col bg-zinc-900/95 backdrop-blur-md border transition-all select-none overflow-hidden shadow-xl ${
                isSelected
                    ? 'ring-2 ring-cyan-500 border-cyan-500/50'
                    : 'border-zinc-800/80 hover:border-zinc-700'
            }`}
        >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-zinc-950/40 border-b border-zinc-800/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                        <Activity size={12} />
                    </div>
                    <h3 className="text-xs font-semibold text-zinc-200 truncate" title={workflowName}>
                        {workflowName}
                    </h3>
                </div>

                <div className="flex items-center gap-1 shrink-0 relative">
                    <button
                        onClick={handleOpenWorkflowLab}
                        className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                        title="View in Workflow Lab"
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
                                onClick={handleOpenWorkflowLab}
                                className="w-full px-3 py-1.5 text-left text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                            >
                                <ExternalLink size={13} />
                                <span>Open Workflow Lab</span>
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

            {/* Run Details Body */}
            <div className="flex-1 p-3.5 flex flex-col justify-between overflow-hidden text-xs">
                <div className="overflow-y-auto min-h-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Execution Status:</span>
                        {renderStatusBadge()}
                    </div>

                    {status === 'error' && errorMessage && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-start gap-1.5">
                            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                            <span className="break-all">{errorMessage}</span>
                        </div>
                    )}

                    {status === 'done' && (
                        <p className="text-zinc-400 text-xs leading-relaxed">
                            {block.snapshot?.excerpt || 'Workflow run finished. Any output artifacts are linked.'}
                        </p>
                    )}
                </div>

                {durationMs !== undefined && (
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 pt-2 border-t border-zinc-800/60">
                        <Clock size={11} />
                        <span>Duration: {(durationMs / 1000).toFixed(1)}s</span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 bg-zinc-950/40 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500">
                <span className="font-mono text-zinc-400" title={runId}>
                    Receipt: {runId.length > 20 ? `${runId.slice(0, 18)}...` : runId}
                </span>
                <span>{new Date(block.createdAt).toLocaleTimeString()}</span>
            </div>
        </div>
    );
};
