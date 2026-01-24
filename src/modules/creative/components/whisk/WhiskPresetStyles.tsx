import React from 'react';
import { Disc3, Image, Share2, Film, Sparkles, Music, Palette, Smartphone, PlayCircle, Tv } from 'lucide-react';
import { useStore } from '@/core/store';
import { motion } from 'framer-motion';
import type { TargetMedia } from '@/core/store/slices/creativeSlice';

// Predefined style presets customized for music/creative industry
// Now supports both image AND video generation
export interface StylePreset {
    id: string;
    label: string;
    icon: React.ElementType;
    prompt: string;
    aspectRatio: string;
    targetMedia?: TargetMedia; // 'image' | 'video' | 'both'
    duration?: number; // For video presets
    motionIntensity?: 'low' | 'medium' | 'high'; // For video presets
}

export const STYLE_PRESETS: StylePreset[] = [
    // IMAGE PRESETS
    { id: 'album-cover', label: 'Album Cover', icon: Disc3, prompt: 'Professional album cover art style, bold typography-ready composition, high contrast, music industry aesthetic', aspectRatio: '1:1', targetMedia: 'image' },
    { id: 'poster', label: 'Poster', icon: Image, prompt: 'Concert poster design style, bold visual impact, event-ready composition, promotional aesthetic', aspectRatio: '2:3', targetMedia: 'image' },
    { id: 'social-media', label: 'Social', icon: Share2, prompt: 'Social media optimized, eye-catching, scroll-stopping, trendy aesthetic, Instagram/TikTok ready', aspectRatio: '1:1', targetMedia: 'both' },
    { id: 'vinyl', label: 'Vinyl', icon: Music, prompt: 'Vintage vinyl record art style, retro aesthetic, classic album art composition, nostalgic feel', aspectRatio: '1:1', targetMedia: 'image' },
    { id: 'merch', label: 'Merch', icon: Palette, prompt: 'Merchandise-ready design, bold graphics suitable for t-shirts, clean vector-like aesthetic', aspectRatio: '1:1', targetMedia: 'image' },

    // VIDEO PRESETS
    { id: 'music-video', label: 'Music Video', icon: Film, prompt: 'Cinematic music video aesthetic, dramatic lighting, film grain, 16:9 composition, storytelling mood, professional color grading', aspectRatio: '16:9', targetMedia: 'video', duration: 8, motionIntensity: 'high' },
    { id: 'short-form', label: 'Short Form', icon: Smartphone, prompt: 'TikTok/Reels ready vertical video, dynamic transitions, attention-grabbing, trending aesthetic, mobile-first design', aspectRatio: '9:16', targetMedia: 'video', duration: 4, motionIntensity: 'high' },
    { id: 'promo', label: 'Promo Clip', icon: Sparkles, prompt: 'Promotional video style, clean modern design, professional branding aesthetic, corporate polish with creative flair', aspectRatio: '16:9', targetMedia: 'video', duration: 6, motionIntensity: 'medium' },
    { id: 'lyric-video', label: 'Lyric Video', icon: PlayCircle, prompt: 'Lyric video aesthetic, text-friendly composition, atmospheric background motion, visual rhythm matching music', aspectRatio: '16:9', targetMedia: 'video', duration: 8, motionIntensity: 'low' },
    { id: 'concert-visual', label: 'Concert Visual', icon: Tv, prompt: 'Live concert visual, LED screen ready, high-energy visuals, abstract motion graphics, stage-worthy aesthetic', aspectRatio: '16:9', targetMedia: 'video', duration: 10, motionIntensity: 'high' },
];

interface WhiskPresetStylesProps {
    onSelectPreset: (preset: typeof STYLE_PRESETS[number]) => void;
}

export default function WhiskPresetStyles({ onSelectPreset }: WhiskPresetStylesProps) {
    const { whiskState, setTargetMedia } = useStore();

    // Check if a preset is currently active (by checking if its prompt is in styles)
    const activePresetId = whiskState.styles.find(s =>
        STYLE_PRESETS.some(p => p.prompt === s.content)
    )?.content;

    // Group presets by targetMedia type
    const imagePresets = STYLE_PRESETS.filter(p => p.targetMedia === 'image' || p.targetMedia === 'both');
    const videoPresets = STYLE_PRESETS.filter(p => p.targetMedia === 'video');

    const handlePresetSelect = (preset: StylePreset) => {
        // Auto-set targetMedia when selecting a video preset
        if (preset.targetMedia === 'video') {
            setTargetMedia('video');
        } else if (preset.targetMedia === 'image') {
            setTargetMedia('image');
        }
        onSelectPreset(preset);
    };

    const renderPresetButton = (preset: StylePreset) => {
        const Icon = preset.icon;
        const isActive = whiskState.styles.some(s => s.content === preset.prompt && s.checked);
        const isVideo = preset.targetMedia === 'video';

        return (
            <motion.button
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wide transition-all border ${isActive
                    ? isVideo
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                        : 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(147,51,234,0.3)]'
                    : isVideo
                        ? 'bg-blue-500/5 border-blue-500/20 text-gray-400 hover:bg-blue-500/10 hover:border-blue-500/40 hover:text-blue-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-gray-200'
                    }`}
            >
                <Icon size={12} />
                {preset.label}
                {isVideo && (
                    <span className="absolute -top-1 -right-1 px-1 py-0.5 text-[7px] bg-blue-500 text-white rounded font-bold">
                        VIDEO
                    </span>
                )}
            </motion.button>
        );
    };

    return (
        <div className="space-y-3">
            {/* Image Presets */}
            <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Image Styles</h4>
                <div className="flex flex-wrap gap-1.5">
                    {imagePresets.map(renderPresetButton)}
                </div>
            </div>

            {/* Video Presets */}
            <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest px-1 flex items-center gap-1">
                    <Film size={10} />
                    Video Styles
                </h4>
                <div className="flex flex-wrap gap-1.5">
                    {videoPresets.map(renderPresetButton)}
                </div>
            </div>
        </div>
    );
}
