import React from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { 
    Package, 
    Image as ImageIcon, 
    Layers,
    Play,
    Loader2,
    CheckCircle2,
    Info,
    Trash2,
    Zap,
    Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/core/context/ToastContext';
import FileUpload from '@/components/kokonutui/file-upload';
import { cn } from '@/lib/utils';
import { HistoryItem } from '@/core/types/history';
import { showroomService } from '@/services/creative/ShowroomService';

const PRODUCT_TYPES = ['T-Shirt', 'Hoodie', 'Mug', 'Bottle', 'Poster', 'Phone Screen'] as const;

export default function ShowroomUI() {
    const { 
        showroomState, 
        setShowroomState,
        currentProjectId,
        addToHistory
    } = useStore(useShallow((state: any) => ({
        showroomState: state.showroomState,
        setShowroomState: state.setShowroomState,
        currentProjectId: state.currentProjectId,
        addToHistory: state.addToHistory
    })));

    const toast = useToast();

    const handleAssetSelected = (files: File[]) => {
        if (files.length === 0) return;
        const file = files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                const newItem: HistoryItem = {
                    id: crypto.randomUUID(),
                    type: 'image',
                    url: e.target.result as string,
                    prompt: 'Showroom Asset',
                    timestamp: Date.now(),
                    projectId: currentProjectId,
                    origin: 'uploaded'
                };
                setShowroomState({ productAsset: newItem });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleGenerateMockup = async () => {
        if (!showroomState.productAsset) {
            toast.error("Please upload a product asset first.");
            return;
        }
        
        try {
            setShowroomState({ isGeneratingMockup: true });
            
            const result = await showroomService.runShowroomMockup({
                asset: showroomState.productAsset!,
                productType: showroomState.productType,
                sceneDescription: showroomState.sceneDescription,
                placementHint: showroomState.placementHint
            });

            setShowroomState({ 
                isGeneratingMockup: false,
                mockupResult: result
            });

            // Persist to project history
            addToHistory(result);
            
            toast.success("Mockup generated successfully!");
        } catch (error: any) {
            setShowroomState({ isGeneratingMockup: false });
            toast.error(error.message || "Failed to generate mockup.");
            console.error("[Showroom] Mockup generation failed:", error);
        }
    };

    const handleAnimateScene = async () => {
        if (!showroomState.mockupResult) {
            toast.error("Please generate a mockup first.");
            return;
        }

        try {
            setShowroomState({ isGeneratingVideo: true });
            
            const result = await showroomService.runShowroomVideo({
                mockup: showroomState.mockupResult,
                motionDescription: showroomState.motionDescription
            });

            setShowroomState({ isGeneratingVideo: false });
            
            // Persist to project history
            addToHistory(result);
            
            toast.success("Scene animated successfully!");
        } catch (error: any) {
            setShowroomState({ isGeneratingVideo: false });
            toast.error(error.message || "Failed to animate scene.");
            console.error("[Showroom] Animation failed:", error);
        }
    };

    return (
        <div className="flex-1 flex bg-[#0d1117] text-white overflow-hidden h-full">
            {/* Column 1: Asset Rack */}
            <div className="w-80 border-r border-white/10 flex flex-col p-6 space-y-6 overflow-y-auto scrollbar-hide">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-dept-creative/20 text-dept-creative">
                        <Package size={20} />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white">Asset Rack</h2>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Product Asset</label>
                    <div className="relative group">
                        {showroomState.productAsset ? (
                            <div className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5 group">
                                <img src={showroomState.productAsset.url} className="w-full h-full object-contain p-4" alt="Product graphic" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button 
                                        onClick={() => setShowroomState({ productAsset: null, mockupResult: null })}
                                        className="p-2 rounded-full bg-red-500/80 hover:bg-red-600 text-white transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <FileUpload 
                                onFilesSelected={handleAssetSelected}
                                acceptedFileTypes={['image/png', 'image/jpeg', 'image/webp']}
                                className="h-48"
                            />
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Product Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        {PRODUCT_TYPES.map((type) => (
                            <button
                                key={type}
                                onClick={() => setShowroomState({ productType: type as any })}
                                className={cn(
                                    "px-3 py-2 text-xs rounded-lg border transition-all text-left flex items-center justify-between group",
                                    showroomState.productType === type 
                                        ? "border-dept-creative bg-dept-creative/10 text-dept-creative font-bold" 
                                        : "border-white/10 bg-white/5 hover:border-white/20 text-muted-foreground hover:text-white"
                                )}
                            >
                                {type}
                                {showroomState.productType === type && <CheckCircle2 size={12} />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Placement Hint</label>
                    <div className="relative">
                        <input 
                            type="text"
                            value={showroomState.placementHint}
                            onChange={(e) => setShowroomState({ placementHint: e.target.value })}
                            placeholder="e.g. Center Chest, Full Print"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-dept-creative/50 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Column 2: Scenario */}
            <div className="flex-1 border-r border-white/10 flex flex-col p-6 space-y-6 overflow-y-auto scrollbar-hide bg-white/[0.01]">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                        <Layers size={20} />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white">Scenario</h2>
                </div>

                <div className="space-y-6 flex-1">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scene Description</label>
                            <span className="text-[10px] text-muted-foreground italic">Gemini 3 Pro</span>
                        </div>
                        <textarea 
                            value={showroomState.sceneDescription}
                            onChange={(e) => setShowroomState({ sceneDescription: e.target.value })}
                            placeholder="Describe the environment, lighting, and mood (e.g. A cyberpunk street at night with neon reflections)..."
                            className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors resize-none leading-relaxed"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Motion Description</label>
                            <span className="text-[10px] text-muted-foreground italic">Veo 3.1</span>
                        </div>
                        <textarea 
                            value={showroomState.motionDescription}
                            onChange={(e) => setShowroomState({ motionDescription: e.target.value })}
                            placeholder="Describe how the camera or subject moves (e.g. Slow cinematic zoom towards the chest)..."
                            className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors resize-none leading-relaxed"
                        />
                    </div>

                    <div className="pt-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 block">Presets</label>
                        <div className="flex flex-wrap gap-2">
                            {['Runway', 'Urban Night', 'Studio Minimal', 'Nature Hike'].map(preset => (
                                <button 
                                    key={preset}
                                    onClick={() => setShowroomState({ sceneDescription: preset })}
                                    className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-purple-500/50 text-[11px] font-medium transition-all hover:bg-purple-500/5 text-muted-foreground hover:text-white"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Column 3: Stage */}
            <div className="w-[400px] flex flex-col p-6 space-y-6 bg-black/40">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                        <Play size={20} />
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-white">Stage</h2>
                </div>

                <div className="flex-1 flex flex-col">
                    <div className="aspect-video bg-black/60 rounded-2xl border border-white/10 overflow-hidden relative shadow-2xl shadow-dept-creative/10">
                        <AnimatePresence mode="wait">
                            {showroomState.mockupResult ? (
                                <motion.img 
                                    key="mockup"
                                    initial={{ opacity: 0, scale: 1.1 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    src={showroomState.mockupResult.url} 
                                    className="w-full h-full object-cover" 
                                    alt="Mockup result" 
                                />
                            ) : showroomState.productAsset ? (
                                <motion.div 
                                    key="asset"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-white/5 to-white/10"
                                >
                                    <div className="relative">
                                        <img src={showroomState.productAsset.url} className="w-24 h-24 object-contain mb-4 opacity-30 grayscale" alt="Asset preview" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <ImageIcon size={32} className="text-white/20" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground text-center max-w-[200px] leading-relaxed">
                                        Asset loaded. Configure your scenario and click **Generate Mockup** to composite.
                                    </p>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30"
                                >
                                    <ImageIcon size={48} className="mb-4" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Preview Monitor</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Progress overlays */}
                        {(showroomState.isGeneratingMockup || showroomState.isGeneratingVideo) && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center space-y-6">
                                <div className="relative">
                                    <Loader2 className="animate-spin text-dept-creative" size={48} />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Zap size={16} fill="currentColor" className="text-dept-creative animate-pulse" />
                                    </div>
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-xs font-bold tracking-widest uppercase text-white">
                                        {showroomState.isGeneratingVideo ? 'Animating Scene...' : 'Generating Mockup...'}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Orchestrating {showroomState.isGeneratingVideo ? 'Veo 3.1' : 'Gemini 3 Pro'}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 space-y-4">
                        <button
                            onClick={handleGenerateMockup}
                            disabled={!showroomState.productAsset || showroomState.isGeneratingMockup || showroomState.isGeneratingVideo}
                            className={cn(
                                "w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs transition-all",
                                !showroomState.productAsset || showroomState.isGeneratingMockup || showroomState.isGeneratingVideo
                                    ? "bg-white/5 text-muted-foreground cursor-not-allowed border border-white/5"
                                    : "bg-dept-creative text-white hover:bg-dept-creative/90 shadow-lg shadow-dept-creative/20 active:scale-[0.98]"
                            )}
                        >
                            {showroomState.isGeneratingMockup ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Zap size={18} fill="currentColor" />
                            )}
                            Generate Mockup
                        </button>

                        <button
                            onClick={handleAnimateScene}
                            disabled={!showroomState.mockupResult || showroomState.isGeneratingMockup || showroomState.isGeneratingVideo}
                            className={cn(
                                "w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs transition-all",
                                !showroomState.mockupResult || showroomState.isGeneratingMockup || showroomState.isGeneratingVideo
                                    ? "bg-white/5 text-muted-foreground cursor-not-allowed border border-white/5"
                                    : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/20 active:scale-[0.98]"
                            )}
                        >
                            {showroomState.isGeneratingVideo ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Video size={18} />
                            )}
                            Animate Scene
                        </button>
                    </div>

                    <div className="mt-auto p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3">
                        <Info className="text-blue-400 shrink-0" size={18} />
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">How it works</p>
                            <p className="text-[10px] text-blue-100/60 leading-relaxed">
                                1. Upload a transparent graphic. 2. Describe the physical scene. 3. Gemini 3 Pro performs geometric texture mapping. 4. Veo 3.1 animates the resulting composite.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
