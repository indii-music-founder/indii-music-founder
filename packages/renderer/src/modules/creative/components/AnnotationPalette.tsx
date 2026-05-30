// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { STUDIO_COLORS, CreativeColor } from '../constants';

interface AnnotationPaletteProps {
    activeColor: CreativeColor;
    onColorSelect: (color: CreativeColor) => void;
    colorDefinitions: Record<string, string>;
    onOpenDefinitions: () => void;
}

export default function AnnotationPalette({
    activeColor,
    onColorSelect,
    colorDefinitions,
    onOpenDefinitions
}: AnnotationPaletteProps) {

    return (
        <div className="flex flex-row gap-2 px-2 py-1 items-center bg-transparent border-0 h-auto w-auto">
            <div className="mr-2">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-yellow-400 to-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-[10px] font-bold text-white">ID</span>
                </div>
            </div>

            <div className="flex flex-row gap-2 items-center">
                {STUDIO_COLORS.map((color) => {
                    const hasDefinition = !!colorDefinitions[color.id];
                    const isActive = activeColor.id === color.id;

                    return (
                        <div key={color.id} className="relative group">
                            <button
                                onClick={() => onColorSelect(color)}
                                data-testid={`color-btn-${color.id}`}
                                className={`w-8 h-8 rounded-full border-2 transition-all shadow-sm relative flex items-center justify-center
                                    ${isActive
                                        ? 'border-white scale-110 shadow-md ring-2 ring-white/20'
                                        : 'border-transparent hover:scale-105 hover:border-gray-500'
                                    }`}
                                style={{ backgroundColor: color.hex }}
                                title={`${color.name}${hasDefinition ? ': ' + colorDefinitions[color.id] : ''}`}
                            >
                                {isActive && (
                                    <div className="w-2 h-2 bg-white rounded-full shadow-sm" />
                                )}
                            </button>

                            {/* Definition Indicator Dot */}
                            {hasDefinition && !isActive && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#111] rounded-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                            )}

                            {/* Hover Label */}
                            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">
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
                className="ml-2 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Edit Definitions"
                title="Edit Definitions"
            >
                <Settings size={16} />
            </button>
        </div>
    );
}
