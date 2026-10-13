// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { STUDIO_COLORS, CreativeColor } from '../constants';

interface AnnotationPaletteProps {
    activeColor: CreativeColor;
    onColorSelect: (color: CreativeColor) => void;
    colorDefinitions: Record<string, string>;
    onOpenDefinitions: () => void;
    orientation?: 'horizontal' | 'vertical';
}

export default function AnnotationPalette({
    activeColor,
    onColorSelect,
    colorDefinitions,
    onOpenDefinitions,
    orientation = 'horizontal',
}: AnnotationPaletteProps) {
    const isVertical = orientation === 'vertical';

    return (
        <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-1 items-center bg-transparent border-0 h-auto w-auto`}>
            <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-1 items-center`}>
                {STUDIO_COLORS.map((color) => {
                    const hasDefinition = !!colorDefinitions[color.id];
                    const isActive = activeColor.id === color.id;

                    return (
                        <div key={color.id} className="relative group">
                            <button
                                onClick={() => onColorSelect(color)}
                                data-testid={`color-btn-${color.id}`}
                                aria-label={`${color.name}${hasDefinition ? ': ' + colorDefinitions[color.id] : ''}`}
                                aria-pressed={isActive}
                                className={`w-8 h-7 rounded transition-all relative flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${isActive ? 'bg-white/10 ring-2 ring-white/50' : 'hover:bg-white/10'}`}
                                title={`${color.name}${hasDefinition ? ': ' + colorDefinitions[color.id] : ''}`}
                            >
                                <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden="true">
                                    <path d="M10 1 L19 17 H1 Z" fill={color.hex} stroke={isActive ? '#ffffff' : 'transparent'} strokeWidth="1.5" />
                                    {isActive && <path d="M7 12 L9 14 L13 9" fill="none" stroke="#ffffff" strokeWidth="2" />}
                                </svg>
                            </button>

                            {/* Definition Indicator Dot */}
                            {hasDefinition && !isActive && (
                                <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#111] rounded-full flex items-center justify-center">
                                    <div className="w-1 h-1 bg-white rounded-full" />
                                </div>
                            )}

                            {/* Hover Label */}
                            <div className={`absolute ${isVertical ? 'left-full ml-3 top-1/2 -translate-y-1/2' : 'bottom-full mb-3 left-1/2 -translate-x-1/2'} px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity`}>
                                <span className="font-bold">{color.name}</span>
                                {hasDefinition && <span className="block text-[10px] text-gray-400 max-w-[150px] truncate">{colorDefinitions[color.id]}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={onOpenDefinitions}
                data-testid="palette-settings-btn"
                className={`${isVertical ? 'mt-1' : 'ml-2'} w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors`}
                aria-label="Edit Definitions"
                title="Edit Definitions"
            >
                <Settings size={16} />
            </button>
        </div>
    );
}
