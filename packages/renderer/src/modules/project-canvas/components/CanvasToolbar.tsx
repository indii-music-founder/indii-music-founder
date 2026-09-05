/**
 * CanvasToolbar.tsx
 *
 * Floating tool selector for Project Canvas.
 * Supports tool picking with keyboard shortcuts.
 */

import React from 'react';
import {
    MousePointer,
    Hand,
    Type,
    Layout,
    StickyNote,
    GitFork,
    ImagePlus,
    Sparkles,
    LayoutTemplate,
    History,
    Split,
} from 'lucide-react';
import type { CanvasToolType } from '../store/projectCanvasSlice';
import type { CanvasPresenceState } from '../types';
import { CollaboratorPills } from './presence/CanvasPresenceLayer';

interface CanvasToolbarProps {
    activeTool: CanvasToolType;
    onSelectTool: (tool: CanvasToolType) => void;
    onQuickAddText: () => void;
    onQuickAddFrame: () => void;
    onOpenAddEntity: (defaultTab?: 'notes' | 'workflows' | 'assets' | 'create_note') => void;
    onPromoteSelection?: () => void;
    selectedCount?: number;
    onOpenTemplates?: () => void;
    onOpenSnapshots?: () => void;
    onOpenCompare?: () => void;
    canCompare?: boolean;
    collaborators?: CanvasPresenceState[];
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
    activeTool,
    onSelectTool,
    onQuickAddText,
    onQuickAddFrame,
    onOpenAddEntity,
    onPromoteSelection,
    selectedCount = 0,
    onOpenTemplates,
    onOpenSnapshots,
    onOpenCompare,
    canCompare = false,
    collaborators = [],
}) => {
    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-zinc-800 shadow-2xl z-30 select-none">
            {/* Pointer / Select */}
            <button
                onClick={() => onSelectTool('select')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    activeTool === 'select'
                        ? 'bg-zinc-100 text-zinc-900 shadow-md font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
                title="Select Tool (V)"
                aria-label="Select tool"
            >
                <MousePointer size={14} />
                <span>Select</span>
            </button>

            {/* Pan Hand */}
            <button
                onClick={() => onSelectTool('pan')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    activeTool === 'pan'
                        ? 'bg-zinc-100 text-zinc-900 shadow-md font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
                title="Pan Canvas (H or Space+Drag)"
                aria-label="Pan tool"
            >
                <Hand size={14} />
                <span>Pan</span>
            </button>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            {/* Quick Add Text */}
            <button
                onClick={onQuickAddText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                title="Add Text Card (T)"
                aria-label="Add text card"
            >
                <Type size={14} className="text-zinc-400" />
                <span>Text</span>
            </button>

            {/* Quick Add Frame */}
            <button
                onClick={onQuickAddFrame}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                title="Add Frame Section (F)"
                aria-label="Add frame section"
            >
                <Layout size={14} className="text-cyan-400" />
                <span>Frame</span>
            </button>

            {/* Note Picker */}
            <button
                onClick={() => onOpenAddEntity('notes')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                title="Place or Create Note (N)"
                aria-label="Place or create note"
            >
                <StickyNote size={14} className="text-amber-400" />
                <span>Note</span>
            </button>

            {/* Workflow Picker */}
            <button
                onClick={() => onOpenAddEntity('workflows')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                title="Place Creative Recipe / Workflow (W)"
                aria-label="Place workflow recipe"
            >
                <GitFork size={14} className="text-indigo-400" />
                <span>Recipe</span>
            </button>

            {/* Asset Picker */}
            <button
                onClick={() => onOpenAddEntity('assets')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                title="Place Project Asset (A)"
                aria-label="Place project asset"
            >
                <ImagePlus size={14} className="text-emerald-400" />
                <span>Asset</span>
            </button>

            <div className="w-px h-5 bg-zinc-800 mx-1" />

            {/* Lifecycle Templates */}
            {onOpenTemplates && (
                <button
                    onClick={onOpenTemplates}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                    title="Apply Lifecycle Template"
                    aria-label="Lifecycle templates"
                >
                    <LayoutTemplate size={14} className="text-purple-400" />
                    <span>Templates</span>
                </button>
            )}

            {/* Canvas Snapshots / History */}
            {onOpenSnapshots && (
                <button
                    onClick={onOpenSnapshots}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
                    title="Layout Snapshots & History"
                    aria-label="Layout history"
                >
                    <History size={14} className="text-amber-400" />
                    <span>History</span>
                </button>
            )}

            {/* Compare Versions (Active when 2 items selected) */}
            {canCompare && onOpenCompare && (
                <button
                    onClick={onOpenCompare}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/40 transition-all"
                    title="Compare Selected Versions Side-by-Side"
                    aria-label="Compare versions"
                >
                    <Split size={14} />
                    <span>Compare</span>
                </button>
            )}

            {/* Promote Selection to Recipe */}
            {selectedCount >= 2 && onPromoteSelection && (
                <>
                    <div className="w-px h-5 bg-zinc-800 mx-1" />
                    <button
                        onClick={onPromoteSelection}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all animate-pulse"
                        title="Promote selected blocks to a reusable Creative Recipe"
                        aria-label="Promote selection to recipe"
                    >
                        <Sparkles size={13} />
                        <span>Promote ({selectedCount})</span>
                    </button>
                </>
            )}

            {/* Active Multiplayer Collaborators */}
            {collaborators.length > 0 && (
                <>
                    <div className="w-px h-5 bg-zinc-800 mx-1" />
                    <CollaboratorPills collaborators={collaborators} className="pl-1" />
                </>
            )}
        </div>
    );
};
