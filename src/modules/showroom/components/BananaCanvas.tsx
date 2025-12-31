import React, { useState } from 'react';
import ShowroomStage from './ShowroomStage';
import ScenarioBuilder from './ScenarioBuilder';
import { motion } from 'framer-motion';
import { Sparkles, Sliders } from 'lucide-react';
import { BananaTheme } from '../themes';

interface BananaCanvasProps {
    mockupImage: string | null;
    setMockupImage: (img: string | null) => void;
    videoUrl: string | null;
    setVideoUrl: (url: string | null) => void;
    isGenerating: boolean;
    setIsGenerating: (gen: boolean) => void;
    scenePrompt: string;
    setScenePrompt: (p: string) => void;
    motionPrompt: string;
    setMotionPrompt: (p: string) => void;
    onGenerate: () => void;
    theme: BananaTheme;
}

export function BananaCanvas({
    mockupImage,
    videoUrl,
    isGenerating,
    scenePrompt,
    setScenePrompt,
    motionPrompt,
    setMotionPrompt,
    onGenerate,
    theme
}: BananaCanvasProps) {
    const [showControls, setShowControls] = useState(true);

    return (
        <div className={`flex-1 h-full relative overflow-hidden transition-colors duration-500 ${theme.colors.background}`}>
            {/* Main Stage */}
            <div className="absolute inset-0 z-0">
                <ShowroomStage
                    mockupImage={mockupImage}
                    videoUrl={videoUrl}
                    isGenerating={isGenerating}
                    onGenerate={onGenerate}
                    onAnimate={onGenerate}
                    canGenerate={!!scenePrompt}
                    canAnimate={!!mockupImage}
                />
            </div>

            {/* Floating Controls Overlay */}
            <div className={`absolute bottom-8 left-8 z-30 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className={`border rounded-2xl p-4 w-[400px] shadow-2xl transition-all duration-500 ${theme.colors.surface} ${theme.effects.glass} ${theme.colors.border}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles className={`w-4 h-4 ${theme.colors.accent}`} />
                        <span className={`text-sm font-bold ${theme.colors.text}`}>Magic Controls</span>
                    </div>
                    <ScenarioBuilder
                        scenePrompt={scenePrompt}
                        motionPrompt={motionPrompt}
                        onSceneChange={setScenePrompt}
                        onMotionChange={setMotionPrompt}
                        theme={theme}
                    />
                </div>
            </div>

            {/* Toggle Controls */}
            <button
                onClick={() => setShowControls(!showControls)}
                className={`absolute bottom-8 right-8 z-40 p-3 rounded-full backdrop-blur-md transition-all border ${theme.colors.surface} ${theme.colors.text} ${theme.colors.border}`}
            >
                <Sliders className="w-5 h-5" />
            </button>
        </div>
    );
}
