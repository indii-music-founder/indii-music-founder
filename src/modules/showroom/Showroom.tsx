import React, { useState } from 'react';
import { useToast } from '@/core/hooks/useToast';
import AssetRack, { ProductType } from './components/AssetRack';
import ScenarioBuilder from './components/ScenarioBuilder';
import ShowroomStage from './components/ShowroomStage';
import { ShowroomService } from '@/services/showroom/ShowroomService';

export default function Showroom() {
    const { toast } = useToast();

    // State
    const [selectedAsset, setSelectedAsset] = useState<File | null>(null);
    const [productType, setProductType] = useState<ProductType>('clothing');
    const [scenePrompt, setScenePrompt] = useState('');
    const [motionPrompt, setMotionPrompt] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [mockupImage, setMockupImage] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    const handleAssetSelect = (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid File Type",
                message: "Please select a valid image file (JPG, PNG).",
                type: "error"
            });
            return;
        }
        setSelectedAsset(file);
        setMockupImage(null);
        setVideoUrl(null);
        toast({
            title: "Asset Loaded",
            message: `${file.name} ready for staging.`,
            type: "success"
        });
    };

    const handleGenerate = async () => {
        if (!selectedAsset || !scenePrompt) return;

        setIsGenerating(true);
        setVideoUrl(null);

        try {
            const resultUrl = await ShowroomService.generateMockup(selectedAsset, productType, scenePrompt);
            setMockupImage(resultUrl);
            toast({
                title: "Mockup Generated",
                message: "High-fidelity rendering complete.",
                type: "success"
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Generation Failed",
                message: "Could not generate mockup. Please try again.",
                type: "error"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAnimate = async () => {
        if (!mockupImage || !motionPrompt) return;

        setIsGenerating(true);
        try {
            const resultVideo = await ShowroomService.animateScene(mockupImage, motionPrompt);
            setVideoUrl(resultVideo);
            toast({
                title: "Animation Complete",
                message: "Scene successfully animated.",
                type: "success"
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Animation Failed",
                message: "Could not animate scene. Please verify credits and try again.",
                type: "error"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex w-full h-full bg-black overflow-hidden relative">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(76,29,149,0.1),transparent_70%)] pointer-events-none" />

            {/* Grid Layout */}
            <div className="flex w-full h-full relative z-10">
                {/* Column 1: Asset Rack */}
                <div className="w-[320px] h-full flex-shrink-0 border-r border-white/5 bg-black/40 backdrop-blur-xl">
                    <AssetRack
                        onAssetSelect={handleAssetSelect}
                        selectedAsset={selectedAsset}
                        productType={productType}
                        onTypeChange={setProductType}
                    />
                </div>

                {/* Column 2: Scenario Builder */}
                <div className="w-[360px] h-full flex-shrink-0 border-r border-white/5 bg-black/40 backdrop-blur-xl">
                    <ScenarioBuilder
                        scenePrompt={scenePrompt}
                        motionPrompt={motionPrompt}
                        onSceneChange={setScenePrompt}
                        onMotionChange={setMotionPrompt}
                    />
                </div>

                {/* Column 3: The Stage */}
                <div className="flex-1 h-full min-w-0 bg-gradient-to-br from-gray-900 to-black">
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
            </div>
        </div>
    );
}
