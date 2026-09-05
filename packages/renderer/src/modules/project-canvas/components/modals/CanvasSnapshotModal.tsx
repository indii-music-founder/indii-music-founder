/**
 * CanvasSnapshotModal.tsx
 *
 * Modal dialog for managing and restoring Project Canvas layout snapshots.
 *
 * Architectural Guarantees:
 * 1. Restoring a prior layout snapshot only restores spatial placements and semantic edges.
 * 2. Restoring layout NEVER deletes canonical notes, workflows, or assets.
 * 3. Shows preview of block and edge counts before restoration.
 */

import React, { useState } from 'react';
import {
    X,
    History,
    Save,
    RotateCcw,
    Trash2,
    Calendar,
    Layers,
    Share2,
    AlertCircle,
} from 'lucide-react';
import { useStore } from '@/core/store';
import type { CanvasSnapshot } from '../../types';

interface CanvasSnapshotModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CanvasSnapshotModal: React.FC<CanvasSnapshotModalProps> = ({
    isOpen,
    onClose,
}) => {
    const canvasBlocks = useStore((state) => state.canvasBlocks);
    const canvasEdges = useStore((state) => state.canvasEdges);
    const canvasViewport = useStore((state) => state.canvasViewport);
    const currentCanvas = useStore((state) => state.currentCanvas);
    const currentProjectId = useStore((state) => state.currentProjectId) || 'default_proj';

    const [snapshotName, setSnapshotName] = useState('');
    const [snapshots, setSnapshots] = useState<CanvasSnapshot[]>(() => {
        // Load initial snapshots from localStorage for durability
        try {
            const raw = localStorage.getItem(`canvas_snapshots_${currentProjectId}`);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });
    const [restoringId, setRestoringId] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleCreateSnapshot = () => {
        if (!snapshotName.trim()) return;

        const newSnapshot: CanvasSnapshot = {
            id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            canvasId: currentCanvas?.id || `canvas_${currentProjectId}`,
            projectId: currentProjectId,
            name: snapshotName.trim(),
            createdAt: Date.now(),
            blockCount: canvasBlocks.length,
            edgeCount: canvasEdges.length,
            blocks: [...canvasBlocks],
            edges: [...canvasEdges],
            viewport: { ...canvasViewport },
        };

        const updated = [newSnapshot, ...snapshots];
        setSnapshots(updated);
        try {
            localStorage.setItem(`canvas_snapshots_${currentProjectId}`, JSON.stringify(updated));
        } catch {
            // ignore
        }
        setSnapshotName('');
    };

    const handleRestoreSnapshot = (snap: CanvasSnapshot) => {
        // Restore layout to store
        useStore.setState({
            canvasBlocks: snap.blocks as unknown as import('../../types').ProjectCanvasBlock[],
            canvasEdges: snap.edges as unknown as import('../../types').ProjectCanvasEdge[],
            canvasViewport: snap.viewport as unknown as import('../../types').CanvasViewport,
            isCanvasDirty: true,
        });

        setRestoringId(snap.id);
        setTimeout(() => {
            setRestoringId(null);
            onClose();
        }, 300);
    };

    const handleDeleteSnapshot = (snapshotId: string) => {
        const updated = snapshots.filter((s) => s.id !== snapshotId);
        setSnapshots(updated);
        try {
            localStorage.setItem(`canvas_snapshots_${currentProjectId}`, JSON.stringify(updated));
        } catch {
            // ignore
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div
                className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
                role="dialog"
                aria-label="Canvas Layout Snapshots"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                            <History size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-100">Canvas Layout Snapshots</h2>
                            <p className="text-xs text-zinc-400">
                                Save and restore milestone spatial layouts without affecting canonical notes or assets.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Create Snapshot Bar */}
                <div className="p-4 bg-zinc-950/40 border-b border-zinc-800/80 flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Snapshot name (e.g., Pre-Rollout Board v1)..."
                        value={snapshotName}
                        onChange={(e) => setSnapshotName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
                        className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                    <button
                        onClick={handleCreateSnapshot}
                        disabled={!snapshotName.trim()}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/20"
                    >
                        <Save size={13} />
                        <span>Save Snapshot</span>
                    </button>
                </div>

                {/* Snapshots List */}
                <div className="p-6 overflow-y-auto space-y-3 min-h-0 flex-1">
                    {snapshots.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500">
                            <History size={32} className="mb-2 opacity-50" />
                            <p className="text-xs">No saved layout snapshots yet.</p>
                            <p className="text-[11px] text-zinc-600 mt-0.5">
                                Save milestone layouts before large reorganizations.
                            </p>
                        </div>
                    ) : (
                        snapshots.map((snap) => (
                            <div
                                key={snap.id}
                                className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center justify-between gap-4"
                            >
                                <div className="space-y-1 min-w-0">
                                    <h4 className="text-xs font-semibold text-zinc-200 truncate">{snap.name}</h4>
                                    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={11} />
                                            {new Date(snap.createdAt).toLocaleDateString()} {new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="flex items-center gap-1 font-mono">
                                            <Layers size={11} /> {snap.blockCount} blocks
                                        </span>
                                        <span className="flex items-center gap-1 font-mono">
                                            <Share2 size={11} /> {snap.edgeCount} relationships
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleRestoreSnapshot(snap)}
                                        disabled={restoringId === snap.id}
                                        className="py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                        title="Restore this canvas layout"
                                    >
                                        <RotateCcw size={12} className={restoringId === snap.id ? 'animate-spin' : ''} />
                                        <span>{restoringId === snap.id ? 'Restoring...' : 'Restore'}</span>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSnapshot(snap.id)}
                                        className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Delete Snapshot"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Warning */}
                <div className="px-6 py-3 bg-zinc-950/80 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-amber-500 shrink-0" />
                    <span>
                        Restoring a snapshot rearranges block placements and edges. Canonical notes, assets, and workflows are never deleted.
                    </span>
                </div>
            </div>
        </div>
    );
};
