import React from 'react';
import { Disc3, Image, Share2, Sparkles, Music, Palette } from 'lucide-react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { motion } from 'motion/react';
import type { TargetMedia } from '@/core/store/slices/creative';

// Predefined style presets customized for music/creative industry
export interface StylePreset {
    id: string;
    label: string;
    icon: React.ElementType;
    prompt: string;
    aspectRatio: string;
    targetMedia?: TargetMedia; // 'image' | 'video' | 'both'
    duration?: number;
    motionIntensity?: 'low' | 'medium' | 'high';
}

export const STYLE_PRESETS: StylePreset[] = [
    { id: 'album-cover', label: 'Album Cover', icon: Disc3, prompt: 'Professional album cover art style, bold typography-ready composition, high contrast, music industry aesthetic', aspectRatio: '1:1', targetMedia: 'image' },
    { id: 'poster', label: 'Poster', icon: Image, prompt: 'Concert poster design style, bold visual impact, event-ready composition, promotional aesthetic', aspectRatio: '2:3', targetMedia: 'image' },
    { id: 'social-media', label: 'Social', icon: Share2, prompt: 'Social media optimized, eye-catching, scroll-stopping, trendy aesthetic, Instagram/TikTok ready', aspectRatio: '1:1', targetMedia: 'both' },
    { id: 'vinyl', label: 'Vinyl', icon: Music, prompt: 'Vintage vinyl record art style, retro aesthetic, classic album art composition, nostalgic feel', aspectRatio: '1:1', targetMedia: 'image' },
    { id: 'merch', label: 'Merch', icon: Palette, prompt: 'Merchandise-ready design, bold graphics suitable for t-shirts, clean vector-like aesthetic', aspectRatio: '1:1', targetMedia: 'image' },
    { id: 'promo-still', label: 'Promo', icon: Sparkles, prompt: 'Promotional still image, clean modern design, professional branding aesthetic, corporate polish with creative flair', aspectRatio: '16:9', targetMedia: 'image' },
];

interface WhiskPresetStylesProps {
    onSelectPreset: (preset: typeof STYLE_PRESETS[number]) => void;
}

export default function WhiskPresetStyles({ onSelectPreset }: WhiskPresetStylesProps) {
    const { whiskState, setTargetMedia } = useStore(useShallow(state => ({
        whiskState: state.whiskState,
        setTargetMedia: state.setTargetMedia
    })));

    const handlePresetSelect = (preset: StylePreset) => {
        if (preset.targetMedia === 'image') {
            setTargetMedia('image');
        }
        onSelectPreset(preset);
    };

    const renderPresetButton = (preset: StylePreset) => {
        const Icon = preset.icon;
        const isActive = whiskState.styles.some(s => s.content === preset.prompt && s.checked);

        return (
            <motion.button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wide transition-all border ${isActive
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(147,51,234,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200'
                    }`}
            >
                <Icon size={12} />
                {preset.label}
            </motion.button>
        );
    };

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Image Styles</h4>
                <div className="flex flex-wrap gap-1.5">
                    {STYLE_PRESETS.map(renderPresetButton)}
                </div>
            </div>
        </div>
    );
}
