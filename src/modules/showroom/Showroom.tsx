import React, { useState } from 'react';
import { useToast } from '@/core/context/ToastContext';
import { AssetLibrary } from './components/AssetLibrary';
import { BananaCanvas } from './components/BananaCanvas';
import { AnalyticsOverlay } from './components/AnalyticsOverlay';
import ManufacturingPanel from './components/ManufacturingPanel';
import { StandardTheme, ProTheme, BananaTheme } from './themes';
import { LayoutDashboard, Zap, Share2, Factory } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function BananaStudio() {
    const toast = useToast();

    // Theme State
    const [isProMode, setIsProMode] = useState(false);
    const theme: BananaTheme = isProMode ? ProTheme : StandardTheme;

    // View State
    const [showManufacturing, setShowManufacturing] = useState(false);

    // lifted State for synchronization
    const [productType, setProductType] = useState<string>('T-Shirt');
    const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
    const [mockupImage, setMockupImage] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [scenePrompt, setScenePrompt] = useState('');
    const [motionPrompt, setMotionPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        // Simulate generation for now
        setTimeout(() => {
            setIsGenerating(false);
            // In a real scenario, this would update mockupImage or videoUrl
            toast.success('Generated new design variant!');
        }, 3000);
    };

    return (
        <div className={`flex flex-col w-full h-full overflow-hidden relative transition-colors duration-500 ease-in-out ${theme.colors.background}`}>

            {/* Application Bar (Top) */}
            <header className={`h-16 flex items-center justify-between px-6 border-b ${theme.colors.border} ${theme.colors.surface} ${theme.effects.glass} z-50`}>
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-400 p-2 rounded-lg">
                        <LayoutDashboard className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <h1 className={`text-lg font-bold tracking-tight ${theme.colors.text}`}>
                            Banana Studio
                            {isProMode && <span className="ml-2 text-xs bg-yellow-400 text-black px-1.5 py-0.5 rounded font-black tracking-widest">PRO</span>}
                        </h1>
                    </div>
                </div>

                {/* Center: Mode Switch */}
                <div className="absolute left-1/2 transform -translate-x-1/2 flex gap-2">
                    <button
                        onClick={() => setIsProMode(!isProMode)}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-xl border transition-all duration-300
                            ${isProMode
                                ? 'bg-[#FFE600] text-black border-transparent hover:shadow-[0_0_20px_rgba(255,230,0,0.6)]'
                                : 'bg-white text-yellow-900 border-yellow-200 hover:bg-yellow-50'
                            }
                        `}
                    >
                        <Zap className={`w-4 h-4 ${isProMode ? 'fill-black' : 'fill-yellow-600'}`} />
                        {isProMode ? 'BANANA PRO' : 'GO PRO'}
                    </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowManufacturing(!showManufacturing)}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider
                            ${showManufacturing
                                ? 'bg-green-500 text-black shadow-lg shadow-green-500/20'
                                : `hover:bg-white/10 ${theme.colors.textSecondary}`
                            } transition-all
                        `}
                    >
                        <Factory className="w-4 h-4" />
                        Manufacture
                    </button>
                    <button className={`p-2 rounded-full hover:bg-white/10 ${theme.colors.textSecondary} transition-colors`}>
                        <Share2 className="w-5 h-5" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 border-2 border-white/20" />
                </div>
            </header>

            {/* Main Studio Workspace */}
            <div className="flex-1 flex overflow-hidden relative z-10">
                {/* Left Panel: Asset Management */}
                <AssetLibrary
                    productType={productType}
                    selectedAsset={selectedAsset}
                    onTypeChange={setProductType}
                    onAssetUpload={setSelectedAsset}
                    theme={theme}
                />

                {/* Center Stage: Canvas */}
                <BananaCanvas
                    mockupImage={mockupImage}
                    setMockupImage={setMockupImage}
                    videoUrl={videoUrl}
                    setVideoUrl={setVideoUrl}
                    isGenerating={isGenerating}
                    setIsGenerating={setIsGenerating}
                    scenePrompt={scenePrompt}
                    setScenePrompt={setScenePrompt}
                    motionPrompt={motionPrompt}
                    setMotionPrompt={setMotionPrompt}
                    onGenerate={handleGenerate}
                    theme={theme}
                />

                {/* Right Panel: Analytics (Pro Only) OR Manufacturing */}
                <AnimatePresence mode="wait">
                    {showManufacturing ? (
                        <motion.div
                            key="manufacturing"
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            className="w-[340px] h-full bg-black/90 backdrop-blur-xl border-l border-white/10 p-6 z-20"
                        >
                            <ManufacturingPanel
                                theme={theme}
                                onClose={() => setShowManufacturing(false)}
                            />
                        </motion.div>
                    ) : isProMode ? (
                        <motion.div
                            key="analytics"
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                        >
                            <AnalyticsOverlay theme={theme} />
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
}
