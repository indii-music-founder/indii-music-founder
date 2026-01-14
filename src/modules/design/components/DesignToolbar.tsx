import React from 'react';
import { MousePointer, Type, Image as ImageIcon, Box, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

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

            <div className="mt-auto">
                <button
                    className="p-3 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all duration-300 group relative overflow-hidden"
                    title="AI Synthesis"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <Sparkles className="w-6 h-6 animate-pulse" fill="currentColor" />
                </button>
            </div>
        </div>
    );
};
