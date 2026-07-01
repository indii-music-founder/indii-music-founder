import React from 'react';
import { motion } from 'motion/react';
import { X, Layers, Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Type, Image as ImageIcon, Square, PenTool } from 'lucide-react';
import type { LayerInfo } from '../services/CanvasOperationsService';

interface LayersPanelProps {
    isOpen: boolean;
    onClose: () => void;
    layers: LayerInfo[];
    selectedLayerId: string | null;
    onSelectLayer: (id: string) => void;
    onToggleVisibility: (id: string) => void;
    onToggleLock: (id: string) => void;
    onDeleteLayer: (id: string) => void;
    onReorderLayer: (id: string, direction: 'up' | 'down') => void;
}

const getLayerIcon = (type: string) => {
    switch (type) {
        case 'i-text':
        case 'text':
            return <Type size={14} className="text-dept-creative" />;
        case 'image':
            return <ImageIcon size={14} className="text-blue-400" />;
        case 'rect':
        case 'circle':
            return <Square size={14} className="text-green-400" />;
        case 'path':
            return <PenTool size={14} className="text-orange-400" />;
        default:
            return <Square size={14} className="text-gray-500" />;
    }
};

export default function LayersPanel({
    isOpen,
    onClose,
    layers,
    selectedLayerId,
    onSelectLayer,
    onToggleVisibility,
    onToggleLock,
    onDeleteLayer,
    onReorderLayer,
}: LayersPanelProps) {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-0 right-0 bottom-0 w-80 bg-[#1a1a1a] border-l border-gray-800 shadow-2xl z-40 flex flex-col"
            data-testid="layers-panel"
        >
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#111]">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Layers className="text-dept-creative" size={16} />
                    Layers
                    <span className="text-xs text-gray-500 font-normal">{layers.length}</span>
                </h3>
                <button
                    onClick={onClose}
                    aria-label="Close layers panel"
                    className="text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative rounded"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {layers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <Layers size={32} className="text-gray-700 mb-2" />
                        <p className="text-xs text-gray-500">No layers yet</p>
                        <p className="text-[10px] text-gray-600 mt-1">Add text or shapes to the canvas</p>
                    </div>
                ) : (
                    layers.map((layer, index) => {
                        const isSelected = selectedLayerId === layer.id;
                        return (
                            <div
                                key={layer.id}
                                role="button"
                                tabIndex={0}
                                aria-label={`Layer ${layer.name}, ${layer.visible ? 'visible' : 'hidden'}, ${layer.locked ? 'locked' : 'unlocked'}`}
                                aria-selected={isSelected}
                                onClick={() => !layer.locked && onSelectLayer(layer.id)}
                                onKeyDown={(e) => {
                                    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        if (!layer.locked) onSelectLayer(layer.id);
                                    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !layer.isBaseImage) {
                                        e.preventDefault();
                                        onDeleteLayer(layer.id);
                                    }
                                }}
                                className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-dept-creative/50 ${
                                    isSelected
                                        ? 'bg-dept-creative/20 border border-dept-creative/40'
                                        : 'bg-[#222]/60 hover:bg-[#222] border border-transparent hover:border-gray-800'
                                } ${layer.locked ? 'opacity-60' : ''}`}
                            >
                                {getLayerIcon(layer.type)}
                                <span className={`text-xs font-medium flex-1 truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                    {layer.name}
                                </span>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
                                    aria-label={layer.visible ? `Hide layer ${layer.name}` : `Show layer ${layer.name}`}
                                    className="p-1 hover:bg-white/10 rounded transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/50"
                                    title={layer.visible ? 'Hide' : 'Show'}
                                >
                                    {layer.visible
                                        ? <Eye size={12} className="text-gray-400 group-hover:text-white" />
                                        : <EyeOff size={12} className="text-gray-600" />}
                                </button>

                                {!layer.isBaseImage && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleLock(layer.id); }}
                                        aria-label={layer.locked ? `Unlock layer ${layer.name}` : `Lock layer ${layer.name}`}
                                        className="p-1 hover:bg-white/10 rounded transition-colors focus-visible:ring-2 focus-visible:ring-dept-creative/50"
                                        title={layer.locked ? 'Unlock' : 'Lock'}
                                    >
                                        {layer.locked
                                            ? <Lock size={12} className="text-gray-600" />
                                            : <Unlock size={12} className="text-gray-400 group-hover:text-white" />}
                                    </button>
                                )}

                                <button
                                    onClick={(e) => { e.stopPropagation(); onReorderLayer(layer.id, 'up'); }}
                                    disabled={index === 0}
                                    aria-label={`Move layer ${layer.name} up`}
                                    className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-dept-creative/50"
                                    title="Move up"
                                >
                                    <ChevronUp size={12} className="text-gray-400 group-hover:text-white" />
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); onReorderLayer(layer.id, 'down'); }}
                                    disabled={index === layers.length - 1}
                                    aria-label={`Move layer ${layer.name} down`}
                                    className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-dept-creative/50"
                                    title="Move down"
                                >
                                    <ChevronDown size={12} className="text-gray-400 group-hover:text-white" />
                                </button>

                                {!layer.isBaseImage && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                                        aria-label={`Delete layer ${layer.name}`}
                                        className="p-1 hover:bg-red-500/20 rounded transition-colors focus-visible:ring-2 focus-visible:ring-red-500/50"
                                        title="Delete"
                                    >
                                        <Trash2 size={12} className="text-gray-400 hover:text-red-400" />
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </motion.div>
    );
}
