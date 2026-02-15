import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Settings, Check } from 'lucide-react';
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
        <div className="flex flex-row md:flex-col gap-2 p-2 bg-[#111] md:border-r border-gray-800 w-full md:w-14 items-center h-full">
            <div className="mb-0 md:mb-4 md:mt-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-[10px] font-bold text-white">ID</span>
                </div>
            </div>

            <div className="flex flex-row md:flex-col gap-3 items-center flex-1 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto w-full custom-scrollbar">
                {STUDIO_COLORS.map((color) => {
                    const hasDefinition = !!colorDefinitions[color.id];
                    const isActive = activeColor.id === color.id;

                    return (
                        <div key={color.id} className="relative group shrink-0">
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
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 md:left-full md:ml-3 md:top-1/2 md:-translate-y-1/2 md:translate-x-0 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">
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
                className="ml-auto md:ml-0 md:mt-auto md:mb-2 w-10 h-10 shrink-0 rounded-xl bg-[#222] hover:bg-[#333] text-gray-400 hover:text-white flex items-center justify-center transition-colors border border-gray-800"
                title="Edit Definitions"
            >
                <Settings size={18} />
            </button>
        </div>
    );
}
