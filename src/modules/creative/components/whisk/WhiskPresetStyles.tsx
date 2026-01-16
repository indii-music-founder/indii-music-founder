import React from 'react';
import { Disc3, Image, Share2, Film, Sparkles, Music, Palette } from 'lucide-react';
import { useStore } from '@/core/store';
import { motion } from 'framer-motion';

// Predefined style presets customized for music/creative industry
export const STYLE_PRESETS = [
    { id: 'album-cover', label: 'Album Cover', icon: Disc3, prompt: 'Professional album cover art style, bold typography-ready composition, high contrast, music industry aesthetic' },
    { id: 'poster', label: 'Poster', icon: Image, prompt: 'Concert poster design style, bold visual impact, event-ready composition, promotional aesthetic' },
    { id: 'social-media', label: 'Social', icon: Share2, prompt: 'Social media optimized, eye-catching, scroll-stopping, trendy aesthetic, Instagram/TikTok ready' },
    { id: 'music-video', label: 'Music Video', icon: Film, prompt: 'Cinematic music video aesthetic, dramatic lighting, film grain, 16:9 composition, storytelling mood' },
    { id: 'promo', label: 'Promo', icon: Sparkles, prompt: 'Promotional material style, clean modern design, professional branding aesthetic' },
    { id: 'vinyl', label: 'Vinyl', icon: Music, prompt: 'Vintage vinyl record art style, retro aesthetic, classic album art composition, nostalgic feel' },
    { id: 'merch', label: 'Merch', icon: Palette, prompt: 'Merchandise-ready design, bold graphics suitable for t-shirts, clean vector-like aesthetic' },
] as const;

interface WhiskPresetStylesProps {
    onSelectPreset: (preset: typeof STYLE_PRESETS[number]) => void;
}

export default function WhiskPresetStyles({ onSelectPreset }: WhiskPresetStylesProps) {
    const { whiskState } = useStore();

    // Check if a preset is currently active (by checking if its prompt is in styles)
    const activePresetId = whiskState.styles.find(s =>
        STYLE_PRESETS.some(p => p.prompt === s.content)
    )?.content;

    return (
        <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Quick Styles</h4>
            <div className="flex flex-wrap gap-1.5">
                {STYLE_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isActive = whiskState.styles.some(s => s.content === preset.prompt && s.checked);

                    return (
                        <motion.button
                            key={preset.id}
                            onClick={() => onSelectPreset(preset)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wide transition-all border ${isActive
                                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(147,51,234,0.3)]'
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200'
                                }`}
                        >
                            <Icon size={12} />
                            {preset.label}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
