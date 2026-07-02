import React from 'react';
import { MousePointer, Type, Image as ImageIcon, Box, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface DesignToolbarProps {
    activeTool: string;
    onToolSelect: (tool: string) => void;
}

export const DesignToolbar: React.FC<DesignToolbarProps> = ({ activeTool, onToolSelect }) => {
    const tools = [
        { id: 'select', icon: MousePointer, label: 'Select' },
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'image', icon: ImageIcon, label: 'Image' },
        { id: 'shape', icon: Box, label: 'Shape' },
    ];

    return (
        <div className="w-16 flex flex-col items-center py-4 bg-neutral-900/50 backdrop-blur-xl border-r border-white/5 z-10">
            <div className="space-y-4 flex flex-col items-center">
                {tools.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => onToolSelect(tool.id)}
                        className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTool === tool.id
                            ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                            : 'text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800'
                            }`}
                        title={tool.label}
                    >
                        <tool.icon className="w-5 h-5" />
                        {activeTool === tool.id && (
                            <motion.div
                                layoutId="activeToolGlow"
                                className="absolute inset-0 rounded-xl bg-cyan-500/20 blur-md -z-10"
                            />
                        )}
                    </button>
                ))}
            </div>

        </div>
    );
};
