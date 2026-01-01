import React, { useState } from 'react';
import { useToast } from '@/core/context/ToastContext';
import { AssetLibrary } from './components/AssetLibrary';
import { BananaCanvas } from './components/BananaCanvas';
import { AnalyticsOverlay } from './components/AnalyticsOverlay';
import ManufacturingPanel from './components/ManufacturingPanel';
import { StandardTheme, ProTheme, BananaTheme } from './themes';
import { LayoutDashboard, Zap, Share2, Factory, Undo2, Redo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ProductType } from './components/AssetRack';
import { useDesignHistory } from './hooks/useDesignHistory';

export default function BananaStudio() {
    // Mode State
    const [isProMode, setIsProMode] = useState(false);
    const theme: BananaTheme = isProMode ? ProTheme : StandardTheme;

    // View State
    const [showManufacturing, setShowManufacturing] = useState(false);

    // Orchestrated Studio State
    // Orchestrated Studio State (Managed by History)
    const { state, updateState, undo, redo, canUndo, canRedo } = useDesignHistory({
        selectedAsset: null,
        productType: 'T-Shirt',
        scenePrompt: '',
        motionPrompt: '',
        mockupImage: null,
        placement: 'Front',
        scale: 100
    });

    const [isGenerating, setIsGenerating] = useState(false);

    // Helpers to update specific fields
    const handleProductTypeChange = (type: ProductType) => updateState({ productType: type });
    const handleAssetUpload = (asset: string | null) => updateState({ selectedAsset: asset });
    const handleScenePromptChange = (prompt: string) => updateState({ scenePrompt: prompt });
    const handleMotionPromptChange = (prompt: string) => updateState({ motionPrompt: prompt });
    const handleMockupChange = (img: string | null) => updateState({ mockupImage: img });
    const handlePlacementChange = (val: 'Front' | 'Back' | 'Sleeve') => updateState({ placement: val });
    const handleScaleChange = (val: number) => updateState({ scale: val });

    // Video URL is transient result
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

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
                        <div className="flex items-center gap-1 ml-4 border-l border-white/10 pl-4 h-6">
                            <button
                                onClick={undo}
                                disabled={!canUndo}
                                className={`p-1 rounded transition-colors ${canUndo ? `hover:bg-white/10 ${theme.colors.text}` : 'text-gray-600 cursor-not-allowed'}`}
                                title="Undo"
                            >
                                <Undo2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={redo}
                                disabled={!canRedo}
                                className={`p-1 rounded transition-colors ${canRedo ? `hover:bg-white/10 ${theme.colors.text}` : 'text-gray-600 cursor-not-allowed'}`}
                                title="Redo"
                            >
                                <Redo2 className="w-4 h-4" />
                            </button>
                        </div>
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
                    theme={theme}
                    productType={state.productType}
                    selectedAsset={state.selectedAsset}
                    onTypeChange={handleProductTypeChange}
                    onAssetUpload={handleAssetUpload}
                    placement={state.placement}
                    onPlacementChange={handlePlacementChange}
                    scale={state.scale}
                    onScaleChange={handleScaleChange}
                />

                {/* Center Stage: Canvas */}
                <BananaCanvas
                    theme={theme}
                    selectedAsset={state.selectedAsset}
                    productType={state.productType}
                    mockupImage={state.mockupImage}
                    setMockupImage={handleMockupChange}
                    videoUrl={videoUrl}
                    setVideoUrl={setVideoUrl}
                    scenePrompt={state.scenePrompt}
                    setScenePrompt={handleScenePromptChange}
                    motionPrompt={state.motionPrompt}
                    setMotionPrompt={handleMotionPromptChange}
                    isGenerating={isGenerating}
                    setIsGenerating={setIsGenerating}
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
                                productType={state.productType}
                                onClose={() => setShowManufacturing(false)}
                            />
                        </motion.div>
                    ) : (isProMode ? (
                        <motion.div
                            key="analytics"
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            className="h-full z-20"
                        >
                            <AnalyticsOverlay theme={theme} />
                        </motion.div>
                    ) : null)}
                </AnimatePresence>
            </div>
        </div>
    );
}
