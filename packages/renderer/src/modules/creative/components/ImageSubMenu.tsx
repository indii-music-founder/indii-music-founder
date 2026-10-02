import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { Sparkles, Tags } from 'lucide-react';
import { parseColor } from '@/utils/colorUtils';
import { printReadyUpscaleService } from '@/services/upscale/PrintReadyUpscaleService';
import type { HistoryItem } from '@/core/types/history';

interface ImageSubMenuProps {
    onShowBrandAssets: () => void;
    showBrandAssets: boolean;
    onTogglePromptBuilder: () => void;
    showPromptBuilder: boolean;
}

export default function ImageSubMenu({ onShowBrandAssets, showBrandAssets, onTogglePromptBuilder, showPromptBuilder }: ImageSubMenuProps) {
    const [isUpscaling, setIsUpscaling] = useState(false);
    const [upscaleStage, setUpscaleStage] = useState('');

    const {
        generatedHistory,
        currentProjectId,
        setSelectedItem,
        setActiveReferenceImage,
        setVideoInputs,
        setGenerationMode,
        setViewMode,
        setCreativePrompt,
        addToHistory,
        userProfile
    } = useStore(useShallow(state => ({
        generatedHistory: state.generatedHistory,
        currentProjectId: state.currentProjectId,
        setSelectedItem: state.setSelectedItem,
        setActiveReferenceImage: state.setActiveReferenceImage,
        setVideoInputs: state.setVideoInputs,
        setGenerationMode: state.setGenerationMode,
        setViewMode: state.setViewMode,
        setCreativePrompt: state.setCreativePrompt,
        addToHistory: state.addToHistory,
        userProfile: state.userProfile
    })));
    const toast = useToast();

    // ISSUE-776: Edit/Reference/Remix must target the latest IMAGE in the
    // ACTIVE project, not just generatedHistory[0] (which can be another
    // project's item or a video).
    const latestImage = generatedHistory.find(
        item => item.type === 'image' && item.projectId === currentProjectId
    ) ?? null;

    return (
        <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar w-full">
            <button
                onClick={() => setViewMode('gallery')}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors"
            >
                Gallery
            </button>
            <span className="text-xs text-green-400 font-bold px-2 py-1 bg-green-900/20 rounded">Image</span>

            <button
                onClick={onTogglePromptBuilder}
                className={`text-xs px-2 py-1 rounded transition-colors flex items-center gap-1 ${showPromptBuilder ? 'bg-green-500/20 text-green-300' : 'text-gray-400 hover:text-white'}`}
            >
                <Tags size={12} /> Chips
            </button>

            <button
                onClick={() => latestImage && setSelectedItem(latestImage)}
                disabled={!latestImage}
                title={latestImage ? undefined : 'No image in this project yet'}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400"
            >
                Edit
            </button>
            <button
                onClick={() => {
                    if (latestImage) {
                        // Direct image generation consumes the shared ingredient list.
                        // Keep the legacy selection for visual context, but write the
                        // actual generator input and open the active generation surface.
                        setActiveReferenceImage(latestImage);
                        setVideoInputs({ ingredients: [latestImage] });
                        setGenerationMode('image');
                        setViewMode('direct');
                        toast.success("Latest image added as a generation reference");
                    }
                }}
                disabled={!latestImage}
                title={latestImage ? undefined : 'No image in this project yet'}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400"
            >
                Reference
            </button>
            <button
                onClick={() => {
                    if (latestImage) {
                        setCreativePrompt(latestImage.prompt);
                        toast.success("Prompt copied from latest image");
                    }
                }}
                disabled={!latestImage}
                title={latestImage ? undefined : 'No image in this project yet'}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400"
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

            <button
                onClick={async () => {
                    if (!latestImage) return;
                    setIsUpscaling(true);
                    try {
                        toast.info("Upscaling to 3000x3000px @ 300 DPI print spec...");
                        const result = await printReadyUpscaleService.upscaleToPrintReady({
                            dataUrl: latestImage.url,
                            prompt: latestImage.prompt,
                            onProgress: (_frac, stage) => {
                                setUpscaleStage(stage);
                            }
                        });
                        const upscaledItem: HistoryItem = {
                            ...latestImage,
                            id: `print-3000-${Date.now()}`,
                            url: result.dataUrl,
                            timestamp: Date.now(),
                            origin: 'editor',
                            distributorCompliance: {
                                valid: true,
                                errors: [],
                                warnings: [],
                                measuredWidth: 3000,
                                measuredHeight: 3000,
                                mimeType: result.format,
                            },
                            meta: JSON.stringify({
                                width: 3000,
                                height: 3000,
                                dpi: 300,
                                upscaled: true,
                                upscaleMethod: result.method,
                            }),
                        };
                        addToHistory(upscaledItem);
                        setSelectedItem(upscaledItem);
                        toast.success(`Upscaled to 3000x3000px (300 DPI) via ${result.method === 'desktop-realesrgan' ? 'Desktop AI' : 'Bicubic High-DPI'}`);
                    } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : 'Upscaling failed');
                    } finally {
                        setIsUpscaling(false);
                        setUpscaleStage('');
                    }
                }}
                disabled={!latestImage || isUpscaling}
                title={latestImage ? (isUpscaling ? upscaleStage || 'Upscaling...' : 'Upscale latest image to 3000x3000px 300 DPI print standard') : 'No image in this project yet'}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
                {isUpscaling ? (
                    <span>{upscaleStage || 'Upscaling...'}</span>
                ) : (
                    <span>3000px Print</span>
                )}
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
                {(userProfile.brandKit?.colors?.length || 0) > 0 && !showBrandAssets && (
                    <div className="flex gap-1">
                        {userProfile.brandKit?.colors?.map((color, i) => {
                            const parsed = parseColor(color);
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    aria-label={`Copy color ${parsed.label}`}
                                    className="w-4 h-4 rounded-full border border-gray-600 hover:scale-110 cursor-pointer focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-transform relative group outline-none"
                                    style={{ backgroundColor: parsed.hex }}
                                    onClick={() => {
                                        navigator.clipboard.writeText(parsed.hex);
                                        toast.success(`Copied ${parsed.label} (${parsed.hex})`);
                                    }}
                                >
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black text-white text-[9px] rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                                        {parsed.label}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
