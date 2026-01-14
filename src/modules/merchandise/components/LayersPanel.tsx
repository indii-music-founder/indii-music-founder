import React from 'react';
import { MerchCard } from './MerchCard';
import { Layers, Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Type, Image as ImageIcon, Square } from 'lucide-react';
import type { CanvasObject } from './DesignCanvas';

export interface LayersPanelProps {
    layers: CanvasObject[];
    selectedLayer: CanvasObject | null;
    onSelectLayer: (layer: CanvasObject) => void;
    onToggleVisibility: (layer: CanvasObject) => void;
    onToggleLock: (layer: CanvasObject) => void;
    onDeleteLayer: (layer: CanvasObject) => void;
    onReorderLayer: (layer: CanvasObject, direction: 'up' | 'down') => void;
    onUpdateProperty?: (layer: CanvasObject, property: string, value: any) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
    layers,
    selectedLayer,
    onSelectLayer,
    onToggleVisibility,
    onToggleLock,
    onDeleteLayer,
    onReorderLayer,
    onUpdateProperty
}) => {
    // Reverse layers for display (top layer first)
    const displayLayers = [...layers].reverse();

    const getLayerIcon = (type: string) => {
        switch (type) {
            case 'text':
                return <Type size={14} className="text-[#FFE135]" />;
            case 'image':
                return <ImageIcon size={14} className="text-blue-400" />;
            case 'shape':
                return <Square size={14} className="text-green-400" />;
            default:
                return <Square size={14} className="text-neutral-500" />;
        }
    };

    return (
        <div className="space-y-4 flex flex-col h-full overflow-hidden">
            {/* Layers List */}
            <MerchCard className="flex-1 p-4 overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                    <Layers size={16} className="text-[#FFE135]" />
                    <h4 className="text-sm font-bold text-white">Layers</h4>
                    <span className="ml-auto text-xs text-neutral-500">{layers.length}</span>
                </div>

                {layers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                        <Layers size={32} className="text-neutral-700 mb-2" />
                        <p className="text-xs text-neutral-500">No layers yet</p>
                        <p className="text-[10px] text-neutral-600 mt-1">Add text, images, or shapes</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                        {displayLayers.map((layer, index) => {
                            const isSelected = selectedLayer?.id === layer.id;
                            const actualIndex = layers.length - 1 - index;

                            return (
                                <div
                                    key={layer.id}
                                    onClick={() => onSelectLayer(layer)}
                                    className={`group relative p-2 rounded-lg cursor-pointer transition-all ${
                                        isSelected
                                            ? 'bg-[#FFE135]/20 border border-[#FFE135]/40'
                                            : 'bg-neutral-900/50 hover:bg-neutral-800/50 border border-transparent hover:border-white/10'
                                    }`}
                                >
                                    {/* Layer Info */}
                                    <div className="flex items-center gap-2 mb-1">
                                        {getLayerIcon(layer.type)}
                                        <span className={`text-xs font-medium flex-1 truncate ${
                                            isSelected ? 'text-[#FFE135]' : 'text-neutral-300'
                                        }`}>
                                            {layer.name}
                                        </span>
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center gap-1">
                                        {/* Visibility Toggle */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleVisibility(layer);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            title={layer.visible ? 'Hide' : 'Show'}
                                        >
                                            {layer.visible ? (
                                                <Eye size={12} className="text-neutral-400 hover:text-white" />
                                            ) : (
                                                <EyeOff size={12} className="text-neutral-600" />
                                            )}
                                        </button>

                                        {/* Lock Toggle */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleLock(layer);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            title={layer.locked ? 'Unlock' : 'Lock'}
                                        >
                                            {layer.locked ? (
                                                <Lock size={12} className="text-neutral-600" />
                                            ) : (
                                                <Unlock size={12} className="text-neutral-400 hover:text-white" />
                                            )}
                                        </button>

                                        {/* Reorder Up */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReorderLayer(layer, 'up');
                                            }}
                                            disabled={index === 0}
                                            className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Move up"
                                        >
                                            <ChevronUp size={12} className="text-neutral-400 hover:text-white" />
                                        </button>

                                        {/* Reorder Down */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReorderLayer(layer, 'down');
                                            }}
                                            disabled={index === displayLayers.length - 1}
                                            className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Move down"
                                        >
                                            <ChevronDown size={12} className="text-neutral-400 hover:text-white" />
                                        </button>

                                        {/* Delete */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteLayer(layer);
                                            }}
                                            className="p-1 hover:bg-red-500/20 rounded transition-colors ml-auto"
                                            title="Delete"
                                        >
                                            <Trash2 size={12} className="text-neutral-400 hover:text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </MerchCard>

            {/* Properties Panel (only shown when layer is selected) */}
            {selectedLayer && (
                <MerchCard className="p-4">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Properties</h4>
                    <div className="space-y-3">
                        {/* Opacity */}
                        <div>
                            <label className="text-xs text-neutral-400 block mb-1.5">Opacity</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                defaultValue={
                                    selectedLayer.fabricObject.opacity
                                        ? Math.round(selectedLayer.fabricObject.opacity * 100)
                                        : 100
                                }
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) / 100;
                                    onUpdateProperty?.(selectedLayer, 'opacity', value);
                                }}
                                className="w-full accent-[#FFE135]"
                            />
                        </div>

                        {/* Text-specific properties */}
                        {selectedLayer.type === 'text' && (
                            <>
                                <div>
                                    <label className="text-xs text-neutral-400 block mb-1.5">Font Size</label>
                                    <input
                                        type="number"
                                        min="8"
                                        max="200"
                                        defaultValue={(selectedLayer.fabricObject as any).fontSize || 60}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value);
                                            onUpdateProperty?.(selectedLayer, 'fontSize', value);
                                        }}
                                        className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFE135]"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-neutral-400 block mb-1.5">Color</label>
                                    <input
                                        type="color"
                                        defaultValue={(selectedLayer.fabricObject as any).fill || '#FFE135'}
                                        onChange={(e) => {
                                            onUpdateProperty?.(selectedLayer, 'fill', e.target.value);
                                        }}
                                        className="w-full h-8 bg-neutral-900 border border-white/10 rounded cursor-pointer"
                                    />
                                </div>
                            </>
                        )}

                        {/* Blend Mode */}
                        <div>
                            <label className="text-xs text-neutral-400 block mb-1.5">Blend Mode</label>
                            <select
                                defaultValue={selectedLayer.fabricObject.globalCompositeOperation || 'source-over'}
                                onChange={(e) => {
                                    onUpdateProperty?.(selectedLayer, 'globalCompositeOperation', e.target.value);
                                }}
                                className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFE135]"
                            >
                                <option value="source-over">Normal</option>
                                <option value="multiply">Multiply</option>
                                <option value="screen">Screen</option>
                                <option value="overlay">Overlay</option>
                                <option value="darken">Darken</option>
                                <option value="lighten">Lighten</option>
                                <option value="color-dodge">Color Dodge</option>
                                <option value="color-burn">Color Burn</option>
                            </select>
                        </div>
                    </div>
                </MerchCard>
            )}
        </div>
    );
};
