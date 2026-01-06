import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Camera, Image as ImageIcon } from 'lucide-react';
import { BananaTheme } from '@/modules/merchandise/themes';

interface ScenarioBuilderProps {
    scenePrompt: string;
    motionPrompt: string;
    onSceneChange: (val: string) => void;
    onMotionChange: (val: string) => void;
    theme?: BananaTheme;
}

const PRESETS = [
    {
        label: "Urban Tokyo",
        scene: "A streetwear model leaning against a graffiti wall in Tokyo at night, neon lights reflect on the fabric.",
        motion: "Slow camera pan left."
    },
    {
        label: "Studio Clean",
        scene: "Professional studio photography, white cyclorama background, soft box lighting.",
        motion: "Subtle zoom in."
    },
    {
        label: "Golden Peak",
        scene: "Hiker standing on a mountain peak during golden hour, lens flare.",
        motion: "Drone orbit shot."
    },
];

export default function ScenarioBuilder({ scenePrompt, motionPrompt, onSceneChange, onMotionChange, theme }: ScenarioBuilderProps) {
    const containerClass = theme
        ? `${theme.colors.surface} ${theme.effects.glass} border-r ${theme.colors.border}`
        : "bg-[#0a0a0a] border-r border-white/5 backdrop-blur-2xl";

    const textClass = theme ? theme.colors.text : "text-white";
    const subTextClass = theme ? theme.colors.textSecondary : "text-gray-400";
    const inputBg = theme ? "bg-white/10" : "bg-black/20";

    return (
        <div className={`flex flex-col h-full p-6 relative transition-colors duration-500 ${containerClass}`}>
            <div className="flex items-center gap-3 mb-8">
                <div className="h-8 w-1 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                <h2 className={`text-xl font-bold tracking-tight ${textClass}`}>The Scenario</h2>
            </div>

            {/* Presets */}
            <div className="mb-8">
                <label className={`text-xs font-medium uppercase tracking-wider ml-1 mb-3 block ${subTextClass}`}>
                    Quick Presets
                </label>
                <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p, i) => (
                        <motion.button
                            key={p.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => { onSceneChange(p.scene); onMotionChange(p.motion); }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`px-4 py-2 rounded-full text-xs font-medium transition-colors flex items-center gap-2 ${theme ? theme.colors.surfaceHighlight : 'bg-white/5'} ${theme ? theme.colors.border : 'border-white/10 border'} ${theme ? theme.colors.text : 'text-gray-300'}`}
                        >
                            <Sparkles className={`w-3 h-3 ${theme ? 'text-current' : 'text-purple-400'}`} />
                            {p.label}
                        </motion.button>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-6 min-h-0">
                {/* Scene Prompt */}
                <div className="flex-1 flex flex-col min-h-0">
                    <label className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider ml-1 mb-2 ${subTextClass}`}>
                        <ImageIcon className="w-3 h-3" />
                        Scene Context
                    </label>
                    <div className="flex-1 relative group">
                        <textarea
                            value={scenePrompt}
                            onChange={(e) => onSceneChange(e.target.value)}
                            className={`w-full h-full border rounded-xl p-4 text-sm outline-none resize-none transition-all placeholder:text-gray-600 ${inputBg} ${theme ? theme.colors.border : 'border-white/10'} ${textClass} focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50`}
                            placeholder="Describe the environment, lighting, and model..."
                        />
                        <div className="absolute inset-0 rounded-xl pointer-events-none border border-white/0 group-hover:border-white/5 transition-colors" />
                    </div>
                </div>

                {/* Motion Prompt */}
                <div className="h-1/3 flex flex-col min-h-0">
                    <label className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider ml-1 mb-2 ${subTextClass}`}>
                        <Camera className="w-3 h-3" />
                        Camera Motion
                    </label>
                    <div className="flex-1 relative group">
                        <textarea
                            value={motionPrompt}
                            onChange={(e) => onMotionChange(e.target.value)}
                            className={`w-full h-full border rounded-xl p-4 text-sm outline-none resize-none transition-all placeholder:text-gray-600 ${inputBg} ${theme ? theme.colors.border : 'border-white/10'} ${textClass} focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50`}
                            placeholder="Describe camera movement..."
                        />
                        <div className="absolute inset-0 rounded-xl pointer-events-none border border-white/0 group-hover:border-white/5 transition-colors" />
                    </div>
                </div>
            </div>
        </div>
    );
}
