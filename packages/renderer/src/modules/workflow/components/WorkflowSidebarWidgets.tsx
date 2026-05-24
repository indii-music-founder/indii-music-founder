import React from 'react';
import { Zap, GitBranch } from 'lucide-react';
import type { WorkflowDefinition } from '@/services/agent/WorkflowRegistry';
import type { SavedWorkflow } from '../types';

interface SystemProtocolsWidgetProps {
    protocols: WorkflowDefinition[];
    onLoad: (protocol: WorkflowDefinition) => void;
    currentWorkflowId?: string;
}

export function SystemProtocolsWidget({
    protocols,
    onLoad,
    currentWorkflowId,
}: SystemProtocolsWidgetProps) {
    if (protocols.length === 0) return null;

    return (
        <div className="rounded-xl bg-purple-500/5 border border-purple-500/10 p-3">
            <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-1.5">
                <Zap size={10} /> System Protocols
            </h3>
            <div className="space-y-1">
                {protocols.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => onLoad(p)}
                        className={`w-full text-left flex items-center gap-2 py-2 px-2 rounded-lg transition-colors text-xs ${
                            `protocol-${p.id}` === currentWorkflowId
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                        }`}
                    >
                        <GitBranch size={12} className="flex-shrink-0 text-purple-400" />
                        <span className="truncate">{p.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

interface SavedWorkflowsWidgetProps {
    savedWorkflows: SavedWorkflow[];
    onLoad: (workflow: SavedWorkflow) => void;
    currentWorkflowId?: string;
}

export function SavedWorkflowsWidget({
    savedWorkflows,
    onLoad,
    currentWorkflowId,
}: SavedWorkflowsWidgetProps) {
    if (savedWorkflows.length === 0) return null;

    return (
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">
                Recent Workflows
            </h3>
            <div className="space-y-1">
                {savedWorkflows.slice(0, 5).map((w) => (
                    <button
                        key={w.id}
                        onClick={() => onLoad(w)}
                        className={`w-full text-left flex items-center gap-2 py-2 px-2 rounded-lg transition-colors text-xs ${
                            w.id === currentWorkflowId
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
