import React from 'react';
import { Eye, EyeOff, Lock, LockOpen } from 'lucide-react';
import type { CanvasLayer } from '@/services/canvas/CanvasDoc';

interface LayerListProps {
    layers: CanvasLayer[];
    selectedLayerId: string | null;
    onSelect: (id: string) => void;
    onToggleVisible: (id: string) => void;
    onToggleLock: (id: string) => void;
}

/**
 * LayerList — the document's layer stack. Selecting a layer drives the
 * AdjustPanel; visibility/lock toggles dispatch `updateLayer` patches so the
 * doc (not Fabric state) stays the single source of truth (DEC-4).
 */
export const LayerList: React.FC<LayerListProps> = ({
    layers,
    selectedLayerId,
    onSelect,
    onToggleVisible,
    onToggleLock,
}) => {
    if (layers.length === 0) {
        return <div className="text-xs text-white/40 px-3 py-2">No layers.</div>;
    }

    return (
        <div className="flex flex-col" data-testid="layer-list" aria-label="Layers">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40 border-b border-white/5">
                Layers
            </div>
            {layers.map((layer) => {
                const selected = layer.id === selectedLayerId;
                return (
                    <div
                        key={layer.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(layer.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onSelect(layer.id);
                            }
                        }}
                        data-testid={`layer-row-${layer.id}`}
                        aria-label={`Layer ${layer.name}`}
                        aria-pressed={selected}
                        className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-b border-white/5 transition-colors ${
                            selected ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
                        }`}
                    >
                        <span className="flex-1 truncate">{layer.name}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleVisible(layer.id);
                            }}
                            data-testid={`layer-visibility-${layer.id}`}
                            aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                            title={layer.visible ? 'Hide' : 'Show'}
                            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
                        >
                            {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleLock(layer.id);
                            }}
                            data-testid={`layer-lock-${layer.id}`}
                            aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                            title={layer.locked ? 'Unlock' : 'Lock'}
                            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white"
                        >
                            {layer.locked ? <Lock size={14} /> : <LockOpen size={14} />}
                        </button>
                    </div>
                );
            })}
        </div>
    );
};
