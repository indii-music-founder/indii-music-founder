import React, { useState, useEffect, useMemo } from 'react';
import { MerchCard } from './MerchCard';
import { Layers, Eye, EyeOff, Lock, Unlock, Trash2, ChevronUp, ChevronDown, Type, Image as ImageIcon, Square } from 'lucide-react';
import type { CanvasObject } from './DesignCanvas';

// Debounce helper
const debounce = <T extends (...args: any[]) => any>(fn: T, ms: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
    };
};

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

// Extracted Properties Component
const LayerProperties: React.FC<{
    layer: CanvasObject;
    onUpdateProperty?: (layer: CanvasObject, property: string, value: any) => void;
}> = ({ layer, onUpdateProperty }) => {
    // Initialize state from props - key={layer.id} will ensure reset
    const [localOpacity, setLocalOpacity] = useState(
        layer.fabricObject.opacity ? Math.round(layer.fabricObject.opacity * 100) : 100
    );
    const [localFontSize, setLocalFontSize] = useState(
        layer.type === 'text' ? ((layer.fabricObject as any).fontSize || 60) : 60
    );
    const [localColor, setLocalColor] = useState(
        layer.type === 'text' ? ((layer.fabricObject as any).fill || '#FFE135') : '#FFE135'
    );
    const [localBlendMode, setLocalBlendMode] = useState<GlobalCompositeOperation>(
        (layer.fabricObject.globalCompositeOperation as GlobalCompositeOperation) || 'source-over'
    );

    // Debounced updaters
    const debouncedOpacityUpdate = useMemo(
        () => debounce((l: CanvasObject, value: number) => {
            onUpdateProperty?.(l, 'opacity', value / 100);
        }, 150),
        [onUpdateProperty]
    );

    const debouncedFontSizeUpdate = useMemo(
        () => debounce((l: CanvasObject, value: number) => {
            onUpdateProperty?.(l, 'fontSize', value);
        }, 150),
        [onUpdateProperty]
    );

    return (
        <MerchCard className="p-4">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Properties</h4>
            <div className="space-y-3">
                {/* Opacity */}
                <div>
                    <label className="text-xs text-neutral-400 block mb-1.5">
                        Opacity
                        <span className="ml-2 text-[#FFE135]">{localOpacity}%</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={localOpacity}
                        onChange={(e) => {
                            const value = parseInt(e.target.value);
                            setLocalOpacity(value);
                            debouncedOpacityUpdate(layer, value);
                        }}
                        className="w-full accent-[#FFE135]"
                    />
                </div>

                {/* Text-specific properties */}
                {layer.type === 'text' && (
                    <>
                        <div>
                            <label className="text-xs text-neutral-400 block mb-1.5">Font Size</label>
                            <input
                                type="number"
                                min="8"
                                max="200"
                                value={localFontSize}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) || 60;
                                    setLocalFontSize(value);
                                    debouncedFontSizeUpdate(layer, value);
                                }}
                                className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFE135]"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-neutral-400 block mb-1.5">Color</label>
                            <input
                                type="color"
                                value={localColor}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setLocalColor(value);
                                    onUpdateProperty?.(layer, 'fill', value);
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
                        value={localBlendMode}
                        onChange={(e) => {
                            const value = e.target.value as GlobalCompositeOperation;
                            setLocalBlendMode(value);
                            onUpdateProperty?.(layer, 'globalCompositeOperation', value);
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
    );
};

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
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Layer ${layer.name}, ${layer.type}, ${layer.visible ? 'visible' : 'hidden'}, ${layer.locked ? 'locked' : 'unlocked'}`}
                                    aria-selected={isSelected}
                                    onClick={() => onSelectLayer(layer)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onSelectLayer(layer);
                                        } else if (e.key === 'Delete' || e.key === 'Backspace') {
                                            e.preventDefault();
                                            onDeleteLayer(layer);
                                        } else if (e.key === 'ArrowUp' && index > 0) {
                                            e.preventDefault();
                                            onSelectLayer(displayLayers[index - 1]);
                                        } else if (e.key === 'ArrowDown' && index < displayLayers.length - 1) {
                                            e.preventDefault();
                                            onSelectLayer(displayLayers[index + 1]);
                                        }
                                    }}
                                    className={`group relative p-2 rounded-lg cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-[#FFE135]/50 ${isSelected
                                        ? 'bg-[#FFE135]/20 border border-[#FFE135]/40'
                                        : 'bg-neutral-900/50 hover:bg-neutral-800/50 border border-transparent hover:border-white/10'
                                        }`}
                                >
                                    {/* Layer Info */}
                                    <div className="flex items-center gap-2 mb-1">
                                        {/* Thumbnail (if available) */}
                                        {(layer.fabricObject as any).thumbnail ? (
                                            <img
                                                src={(layer.fabricObject as any).thumbnail}
                                                alt={layer.name}
                                                className="w-10 h-10 rounded border border-white/10 object-cover bg-neutral-800 flex-shrink-0"
                                            />
                                        ) : (
                                            getLayerIcon(layer.type)
                                        )}
                                        <span className={`text-xs font-medium flex-1 truncate ${isSelected ? 'text-[#FFE135]' : 'text-neutral-300'
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
                                            aria-label={layer.visible ? `Hide layer ${layer.name}` : `Show layer ${layer.name}`}
                                            className="p-1 hover:bg-white/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFE135]/50"
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
                                            aria-label={layer.locked ? `Unlock layer ${layer.name}` : `Lock layer ${layer.name}`}
                                            className="p-1 hover:bg-white/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFE135]/50"
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
                                            aria-label={`Move layer ${layer.name} up`}
                                            className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#FFE135]/50"
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
                                            aria-label={`Move layer ${layer.name} down`}
                                            className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#FFE135]/50"
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
                                            aria-label={`Delete layer ${layer.name}`}
                                            className="p-1 hover:bg-red-500/20 rounded transition-colors ml-auto focus:outline-none focus:ring-2 focus:ring-red-500/50"
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
                <LayerProperties
                    key={selectedLayer.id}
                    layer={selectedLayer}
                    onUpdateProperty={onUpdateProperty}
                />
            )}
        </div>
    );
};
