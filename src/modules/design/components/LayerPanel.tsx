import React from 'react';
import { Eye, EyeOff, GripVertical, Lock, Unlock } from 'lucide-react';

interface Layer {
    id: string;
    name: string;
    type: 'text' | 'image' | 'shape' | 'banana';
    visible: boolean;
    locked: boolean;
}

interface LayerPanelProps {
    layers: Layer[];
    activeLayerId: string | null;
    onLayerSelect: (id: string) => void;
    onLayerToggleVisibility: (id: string) => void;
    onLayerToggleLock: (id: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
    layers,
    activeLayerId,
    onLayerSelect,
    onLayerToggleVisibility,
    onLayerToggleLock
}) => {
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-neutral-800">
                <h3 className="text-xs font-bold text-[#FACC15] uppercase tracking-wider">Layers</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {layers.length === 0 ? (
                    <div className="text-center py-8 text-neutral-600 text-xs">
                        No layers yet
                    </div>
                ) : (
                    layers.map((layer) => (
                        <div
                            key={layer.id}
                            onClick={() => onLayerSelect(layer.id)}
                            className={`group flex items-center p-2 rounded-lg cursor-pointer transition-all border ${activeLayerId === layer.id
                                    ? 'bg-[#FACC15]/10 border-[#FACC15]/30'
                                    : 'hover:bg-neutral-800 border-transparent hover:border-neutral-700'
                                }`}
                        >
                            <GripVertical className="w-4 h-4 text-neutral-600 hover:text-white mr-2 cursor-grab active:cursor-grabbing" />

                            <div className="flex-1 min-w-0">
                                <div className={`text-sm truncate ${activeLayerId === layer.id ? 'text-[#FACC15]' : 'text-neutral-300'}`}>
                                    {layer.name}
                                </div>
                                <div className="text-[10px] text-neutral-500 capitalize">{layer.type}</div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onLayerToggleLock(layer.id); }}
                                    className="p-1 hover:text-white text-neutral-500 transition-colors"
                                >
                                    {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onLayerToggleVisibility(layer.id); }}
                                    className="p-1 hover:text-white text-neutral-500 transition-colors"
                                >
                                    {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
