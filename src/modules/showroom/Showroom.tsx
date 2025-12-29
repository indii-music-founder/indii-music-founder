import React, { useState } from 'react';
import AssetRack from './components/AssetRack';
import ScenarioBuilder from './components/ScenarioBuilder';
import ShowroomStage from './components/ShowroomStage';
import { ShowroomService } from '../../services/showroom/ShowroomService';
import { useStore } from '@/core/store';

export default function Showroom() {
    const [productAsset, setProductAsset] = useState<string | null>(null);
    const [productType, setProductType] = useState('T-Shirt');
    const [scenePrompt, setScenePrompt] = useState('');
    const [motionPrompt, setMotionPrompt] = useState('');
    const [mockupImage, setMockupImage] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const { addAgentMessage } = useStore();

    const handleGenerateMockup = async () => {
        if (!productAsset || !scenePrompt) return;
        setIsGenerating(true);
        try {
            const url = await ShowroomService.generateMockup(productAsset, productType, scenePrompt);
            setMockupImage(url);

            addAgentMessage({
                id: Date.now().toString(),
                role: 'system',
                text: '📸 Mockup generated successfully.',
                timestamp: Date.now()
            });
        } catch (e) {
            console.error(e);
            addAgentMessage({
                id: Date.now().toString(),
                role: 'system',
                text: '❌ Failed to generate mockup. Please try again.',
                timestamp: Date.now()
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAnimate = async () => {
        if (!mockupImage || !motionPrompt) return;
        setIsGenerating(true);
        try {
            const url = await ShowroomService.generateVideo(mockupImage, motionPrompt);
            setVideoUrl(url);

            addAgentMessage({
                id: Date.now().toString(),
                role: 'system',
                text: '🎬 Video generated successfully.',
                timestamp: Date.now()
            });
        } catch (e) {
            console.error(e);
            addAgentMessage({
                id: Date.now().toString(),
                role: 'system',
                text: '❌ Failed to animate scene. Please try again.',
                timestamp: Date.now()
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex h-full w-full overflow-hidden">
            {/* Column 1: Asset (20%) */}
            <div className="w-1/5 min-w-[250px] h-full">
                <AssetRack
                    productAsset={productAsset}
                    productType={productType}
                    onAssetUpload={setProductAsset}
                    onTypeChange={setProductType}
                />
            </div>

            {/* Column 2: Scenario (20%) */}
            <div className="w-1/5 min-w-[250px] h-full">
                <ScenarioBuilder
                    scenePrompt={scenePrompt}
                    motionPrompt={motionPrompt}
                    onSceneChange={setScenePrompt}
                    onMotionChange={setMotionPrompt}
                />
            </div>

            {/* Column 3: Stage (60%) */}
            <div className="flex-1 h-full">
                <ShowroomStage
                    mockupImage={mockupImage}
                    videoUrl={videoUrl}
                    isGenerating={isGenerating}
                    onGenerate={handleGenerateMockup}
                    onAnimate={handleAnimate}
                    canGenerate={!!productAsset && !!scenePrompt}
                    canAnimate={!!mockupImage && !!motionPrompt}
                />
            </div>
        </div>
    );
}
