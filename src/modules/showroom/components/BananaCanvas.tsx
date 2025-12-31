import React, { useState } from 'react';
import ShowroomStage from './ShowroomStage';
import ScenarioBuilder from './ScenarioBuilder';
import { Sliders, Sparkles } from 'lucide-react';
import { ShowroomService } from '@/services/showroom/ShowroomService';
import { useToast } from '@/core/context/ToastContext';
import { BananaTheme } from '../themes';
import { ProductType } from './AssetRack';

interface BananaCanvasProps {
    theme: BananaTheme;
    selectedAsset: string | null;
    productType: ProductType;
    mockupImage: string | null;
    setMockupImage: (img: string | null) => void;
    videoUrl: string | null;
    setVideoUrl: (url: string | null) => void;
    scenePrompt: string;
    setScenePrompt: (p: string) => void;
    motionPrompt: string;
    setMotionPrompt: (p: string) => void;
    isGenerating: boolean;
    setIsGenerating: (b: boolean) => void;
}

export function BananaCanvas({
    theme,
    selectedAsset,
    productType,
    mockupImage,
    setMockupImage,
    videoUrl,
    setVideoUrl,
    scenePrompt,
    setScenePrompt,
    motionPrompt,
    setMotionPrompt,
    isGenerating,
    setIsGenerating
}: BananaCanvasProps) {
    const toast = useToast();
    const [showControls, setShowControls] = useState(true);

    const handleGenerate = async () => {
        if (!selectedAsset || !scenePrompt) {
            toast.error("Asset and scene prompt required.");
            return;
        }

        setIsGenerating(true);
        setVideoUrl(null);

        try {
            const resultUrl = await ShowroomService.generateMockup(selectedAsset, productType, scenePrompt);
            setMockupImage(resultUrl);
            toast.success("High-fidelity rendering complete.");
        } catch (err) {
            console.error(err);
            toast.error("Could not generate mockup.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAnimate = async () => {
        if (!mockupImage || !motionPrompt) {
            toast.error("Generate mockup first and provide motion prompt.");
            return;
        }

        setIsGenerating(true);
        try {
            const resultVideo = await ShowroomService.generateVideo(mockupImage, motionPrompt);
            setVideoUrl(resultVideo);
            toast.success("Scene successfully animated.");
        } catch (err) {
            console.error(err);
            toast.error("Could not animate scene.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className={`flex-1 h-full relative overflow-hidden transition-colors duration-500 ${theme.name === 'pro' ? 'bg-gray-900' : 'bg-yellow-100'}`}>
            {/* Main Stage */}
            <div className="absolute inset-0 z-0">
                <ShowroomStage
                    mockupImage={mockupImage}
                    videoUrl={videoUrl}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerate}
                    onAnimate={handleAnimate}
                    canGenerate={!!selectedAsset && !!scenePrompt}
                    canAnimate={!!mockupImage && !!motionPrompt}
                />
            </div>

            {/* Floating Controls Overlay */}
            <div className={`absolute bottom-8 left-8 z-30 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`${theme.colors.surface} ${theme.effects.glass} border ${theme.colors.border} rounded-2xl p-4 w-[400px] shadow-2xl`}>
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles className={`w-4 h-4 ${theme.name === 'pro' ? 'text-yellow-400' : 'text-yellow-600'}`} />
                        <span className={`text-sm font-bold ${theme.colors.text}`}>Magic Controls</span>
                    </div>
                    <ScenarioBuilder
                        theme={theme}
                        scenePrompt={scenePrompt}
                        motionPrompt={motionPrompt}
                        onSceneChange={setScenePrompt}
                        onMotionChange={setMotionPrompt}
                    />
                </div>
            </div>

            {/* Toggle Controls */}
            <button
                onClick={() => setShowControls(!showControls)}
                className={`absolute bottom-8 right-8 z-40 p-3 ${theme.name === 'pro' ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'} rounded-full ${theme.colors.text} backdrop-blur-md transition-all`}
            >
                <Sliders className="w-5 h-5" />
            </button>
        </div>
    );
}
