import React from 'react';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { Sparkles, Tags } from 'lucide-react';

interface ImageSubMenuProps {
    onShowBrandAssets: () => void;
    showBrandAssets: boolean;
    onTogglePromptBuilder: () => void;
    showPromptBuilder: boolean;
}

export default function ImageSubMenu({ onShowBrandAssets, showBrandAssets, onTogglePromptBuilder, showPromptBuilder }: ImageSubMenuProps) {
    const { generatedHistory, setSelectedItem, setActiveReferenceImage, setViewMode, setPrompt, userProfile } = useStore();
    const toast = useToast();

    return (
        <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar w-full">
            <button
                onClick={() => setViewMode('gallery')}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
            >
                Gallery
            </button>
            <button className="text-xs text-purple-400 font-bold px-2 py-1 bg-purple-900/20 rounded">Image</button>

            <button
                onClick={onTogglePromptBuilder}
                className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${showPromptBuilder ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:text-white'}`}
            >
                <Tags size={12} /> Chips
            </button>

            <button
                onClick={() => generatedHistory.length > 0 && setSelectedItem(generatedHistory[0])}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
            >
                Edit
            </button>
            <button
                onClick={() => {
                    if (generatedHistory.length > 0) {
                        setActiveReferenceImage(generatedHistory[0]);
                        toast.success("Latest image set as reference");
                    }
                }}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
            >
                Reference
            </button>
            <button
                onClick={() => {
                    if (generatedHistory.length > 0) {
                        setPrompt(generatedHistory[0].prompt);
                        toast.success("Prompt copied from latest image");
                    }
                }}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
            >
                Remix
            </button>
            <button
                onClick={() => setViewMode('showroom')}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
            >
                Showroom
            </button>
            <button
                onClick={() => setViewMode('canvas')}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
            >
                Canvas
            </button>

            {/* Brand Palette Section */}
            <div className="h-4 w-px bg-gray-700 mx-2 flex-shrink-0"></div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={onShowBrandAssets}
                    data-testid="brand-assets-toggle"
                    className={`text-[10px] uppercase font-bold flex items-center gap-1 px-2 py-1 rounded transition-colors ${showBrandAssets ? 'bg-yellow-900/30 text-yellow-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Sparkles size={10} className={showBrandAssets ? "text-yellow-500" : "text-gray-500"} /> Brand
                </button>
                {userProfile.brandKit?.colors?.length > 0 && !showBrandAssets && (
                    <div className="flex gap-1">
                        {userProfile.brandKit.colors.map((color, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Copy color ${color}`}
                                className="w-4 h-4 rounded-full border border-gray-600 hover:scale-110 cursor-pointer focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-transform relative group outline-none"
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    navigator.clipboard.writeText(color);
                                    toast.success(`Copied ${color}`);
                                }}
                            >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black text-white text-[9px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                                    {color}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
