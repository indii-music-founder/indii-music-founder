import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MerchLayout } from './components/Layout';
import { MerchButton } from './components/MerchButton';
import { MerchCard } from './components/MerchCard';
import { Undo, Redo, Layers, Type, Sticker, Wand2, Monitor, LayoutTemplate, Send } from 'lucide-react';
import EnhancedShowroom from './components/EnhancedShowroom';
import MerchCanvas, { MerchCanvasRef } from './components/MerchCanvas';
import { useToast } from '@/core/context/ToastContext';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { useStore } from '@/core/store';

export default function MerchDesigner() {
    const toast = useToast();
    const [mode, setMode] = useState<'design' | 'showroom'>('design');
    const [selectedTool, setSelectedTool] = useState('sticker');
    const [currentDesign, setCurrentDesign] = useState<string | null>(null);
    const [aiPrompt, setAiPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const canvasRef = useRef<MerchCanvasRef>(null);
    const userProfile = useStore(state => state.userProfile);

    // Handler to export current canvas design to showroom
    const handleExportToShowroom = () => {
        if (!canvasRef.current) return;

        const loadingId = toast.loading("Processing design for staging...");

        try {
            // Capture the high-res PNG from the canvas
            const dataUrl = canvasRef.current.exportToDataURL();
            setCurrentDesign(dataUrl);

            setTimeout(() => {
                toast.dismiss(loadingId);
                toast.success("Design pushed to Showroom!");
                setMode('showroom');
            }, 800);
        } catch (error) {
            toast.dismiss(loadingId);
            toast.error("Failed to export design.");
            console.error(error);
        }
    };

    const handleAddText = () => {
        canvasRef.current?.addText("NEW DESIGN");
    };

    const handleAddEmoji = (emoji: string) => {
        canvasRef.current?.addEmoji(emoji);
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt.trim()) {
            toast.error("Please enter a prompt first");
            return;
        }

        setIsGenerating(true);
        const loadingId = toast.loading("Invoking Creative Agent...");

        try {
            const results = await ImageGeneration.generateImages({
                prompt: `Streetwear graphic design, vector art, ${aiPrompt}, isolated on black background, high contrast, professional merch design`,
                count: 1,
                userProfile: userProfile || undefined
            });

            if (results && results.length > 0) {
                canvasRef.current?.addImage(results[0].url);
                toast.dismiss(loadingId);
                toast.success("Asset generated and added to canvas!");
                setAiPrompt("");
            } else {
                toast.dismiss(loadingId);
                toast.error("No image generated. Try a different prompt.");
            }
        } catch (error) {
            toast.dismiss(loadingId);
            toast.error("AI Generation failed.");
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddAsset = (url: string) => {
        canvasRef.current?.addImage(url);
        toast.info("Asset added to design");
    };

    return (
        <MerchLayout>
            {mode === 'design' ? (
                <div className="h-full flex flex-col animate-in fade-in duration-500">
                    {/* Toolbar Header */}
                    <header className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-white/5">
                                <ModeToggle
                                    active={true}
                                    onClick={() => setMode('design')}
                                    icon={<LayoutTemplate size={16} />}
                                    label="Design"
                                    data-testid="mode-design-btn"
                                />
                                <ModeToggle
                                    active={false}
                                    onClick={() => setMode('showroom')}
                                    icon={<Monitor size={16} />}
                                    label="Showroom"
                                    data-testid="mode-showroom-btn"
                                />
                            </div>

                            <div className="h-6 w-px bg-white/10 mx-2" />

                            <div className="flex items-center gap-1 bg-neutral-900 rounded-lg p-1 border border-white/5">
                                <IconButton onClick={() => canvasRef.current?.undo()} icon={<Undo size={16} />} label="Undo" />
                                <IconButton onClick={() => canvasRef.current?.redo()} icon={<Redo size={16} />} label="Redo" />
                            </div>
                            <span className="text-sm font-bold text-neutral-500">INDII_STREETWEAR_V1</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="text-sm text-neutral-400 hover:text-white transition-colors">Save Draft</button>
                            <MerchButton size="sm" glow onClick={handleExportToShowroom}>
                                <Send size={16} />
                                Push to Showroom
                            </MerchButton>
                        </div>
                    </header>

                    {/* Main Workspace */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">

                        {/* Left Panel */}
                        <div className="space-y-4 flex flex-col overflow-hidden">
                            <div className="flex gap-2 mb-2">
                                <ToolButton active={selectedTool === 'sticker'} onClick={() => setSelectedTool('sticker')} icon={<Sticker size={18} />} label="Library" />
                                <ToolButton active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} icon={<Type size={18} />} label="Text" />
                                <ToolButton active={selectedTool === 'ai'} onClick={() => setSelectedTool('ai')} icon={<Wand2 size={18} />} label="AI Gen" />
                            </div>

                            <MerchCard className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col bg-neutral-950 border-white/5 shadow-2xl">
                                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">
                                    {selectedTool === 'sticker' ? 'Asset Library' : selectedTool === 'text' ? 'Typography' : 'AI Assistant'}
                                </h4>

                                {selectedTool === 'sticker' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-3 gap-2">
                                            {['👕', '🔥', '💀', '⚡', '🖤', '🎸', '🎨', '🚀', '💎'].map((emoji, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleAddEmoji(emoji)}
                                                    aria-label={`Add emoji ${emoji}`}
                                                    className="aspect-square bg-neutral-900 rounded-lg border border-white/5 hover:border-yellow-400 hover:bg-neutral-800 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all cursor-pointer flex items-center justify-center text-2xl group"
                                                >
                                                    <span className="group-hover:scale-125 transition-transform">{emoji}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="pt-4 border-t border-white/5">
                                            <h5 className="text-[10px] font-bold text-neutral-600 uppercase mb-3">Sample Graphics</h5>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=200&h=200&fit=crop',
                                                    'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=200&h=200&fit=crop',
                                                    'https://images.unsplash.com/photo-1515405299443-f71bb798351e?w=200&h=200&fit=crop',
                                                    'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=200&h=200&fit=crop'
                                                ].map((url, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleAddAsset(url)}
                                                        aria-label="Add sample graphic"
                                                        className="aspect-square bg-neutral-900 rounded-lg overflow-hidden border border-white/5 hover:border-yellow-400 focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 cursor-pointer p-0"
                                                    >
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedTool === 'text' && (
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleAddText}
                                            className="w-full py-3 bg-neutral-900 border border-white/10 rounded-xl hover:border-yellow-400 text-sm font-bold transition-all text-white"
                                        >
                                            Add Headline Text
                                        </button>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Inter', 'Oswald', 'Gothic', 'Serif'].map(font => (
                                                <div key={font} className="p-3 bg-neutral-900 rounded-lg border border-white/5 text-center text-xs text-neutral-400 cursor-pointer hover:border-white/20">
                                                    {font}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selectedTool === 'ai' && (
                                    <div className="flex-1 flex flex-col gap-4">
                                        <div className="flex-1 flex flex-col justify-center items-center text-center p-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-all ${isGenerating ? 'bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] animate-spin' : 'bg-yellow-400/10 text-yellow-400'}`}>
                                                <Wand2 size={24} className={isGenerating ? 'text-black' : ''} />
                                            </div>
                                            <p className="text-xs text-neutral-400">Describe what you want to create and our Creative Agent will generate a unique asset.</p>
                                        </div>

                                        <div className="space-y-3">
                                            <textarea
                                                value={aiPrompt}
                                                onChange={(e) => setAiPrompt(e.target.value)}
                                                placeholder="e.g. A cybernetic skull with neon roses..."
                                                className="w-full h-24 bg-neutral-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-yellow-400 focus:outline-none resize-none transition-all"
                                                disabled={isGenerating}
                                            />
                                            <MerchButton
                                                onClick={handleGenerateAI}
                                                loading={isGenerating}
                                                glow
                                                fullWidth
                                            >
                                                Generate Asset
                                            </MerchButton>
                                        </div>
                                    </div>
                                )}
                            </MerchCard>
                        </div>

                        {/* Center Canvas */}
                        <div className="lg:col-span-2 relative bg-neutral-950 rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-inner">
                            <div className="flex-1 relative flex items-center justify-center p-8">
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px]" />

                                <MerchCanvas ref={canvasRef} />

                                <div className="absolute bottom-6 flex gap-4 bg-black/60 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10 z-20 shadow-2xl">
                                    <ColorSwatch color="#000000" onClick={() => canvasRef.current?.changeColor('#000000')} className="bg-black border border-white/20" />
                                    <ColorSwatch color="#ffffff" onClick={() => canvasRef.current?.changeColor('#ffffff')} className="bg-white border border-gray-300" />
                                    <ColorSwatch color="#FFE135" onClick={() => canvasRef.current?.changeColor('#FFE135')} className="bg-yellow-400 border border-yellow-600 ring-2 ring-white/20" />
                                    <ColorSwatch color="#3b82f6" onClick={() => canvasRef.current?.changeColor('#3b82f6')} className="bg-blue-600 border border-blue-800" />
                                    <ColorSwatch color="#ef4444" onClick={() => canvasRef.current?.changeColor('#ef4444')} className="bg-red-600 border border-red-800" />
                                </div>
                            </div>
                        </div>

                        {/* Right Properties Panel */}
                        <div className="space-y-4 flex flex-col h-full overflow-hidden">
                            <MerchCard className="p-4 bg-neutral-950 border-white/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Layers size={16} className="text-yellow-400" />
                                    <h4 className="text-sm font-bold text-white uppercase tracking-tighter">Design Layers</h4>
                                </div>
                                <div className="space-y-2">
                                    <LayerItem active label="Headline: INDII_OS" visible />
                                    <LayerItem label="Graphic: Sticker_Fire" visible />
                                    <LayerItem label="Template: Pro Hoodie" visible={true} locked />
                                </div>
                            </MerchCard>

                            <MerchCard className="flex-1 p-4 bg-neutral-950 border-white/5">
                                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Element Tuning</h4>
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-[10px] text-neutral-500 font-bold uppercase">Exposure</label>
                                            <span className="text-[10px] text-yellow-400">100%</span>
                                        </div>
                                        <input type="range" className="w-full accent-yellow-400 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer" />
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-[10px] text-neutral-500 font-bold uppercase">Surface Blend</label>
                                            <span className="text-[10px] text-yellow-400">Overlay</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1">
                                            <button className="py-1 px-2 bg-yellow-400 text-black text-[10px] font-bold rounded">NORMAL</button>
                                            <button className="py-1 px-2 bg-neutral-900 text-neutral-500 text-[10px] font-bold rounded">MULTIPLY</button>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        <label className="text-[10px] text-neutral-500 font-bold uppercase mb-2 block">Quick Actions</label>
                                        <div className="flex gap-2">
                                            <button className="flex-1 py-2 bg-neutral-900 border border-white/5 rounded text-[10px] font-bold text-neutral-400 hover:text-white transition-colors uppercase">Center</button>
                                            <button className="flex-1 py-2 bg-neutral-900 border border-white/5 rounded text-[10px] font-bold text-neutral-400 hover:text-white transition-colors uppercase">Mirror</button>
                                        </div>
                                    </div>
                                </div>
                            </MerchCard>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col animate-in slide-in-from-right duration-500">
                    {/* Showroom Mode Toolbar */}
                    <header className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-white/5">
                                <ModeToggle
                                    active={false}
                                    onClick={() => setMode('design')}
                                    icon={<LayoutTemplate size={16} />}
                                    label="Design"
                                    data-testid="mode-design-btn"
                                />
                                <ModeToggle
                                    active={true}
                                    onClick={() => setMode('showroom')}
                                    icon={<Monitor size={16} />}
                                    label="Showroom"
                                    data-testid="mode-showroom-btn"
                                />
                            </div>
                            <div className="h-6 w-px bg-white/10 mx-2" />
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">Stage Live</span>
                            </div>
                        </div>
                        <MerchButton size="sm" onClick={() => setMode('design')}>
                            <LayoutTemplate size={16} />
                            Back to Canvas
                        </MerchButton>
                    </header>

                    {/* Enhanced Showroom */}
                    <div className="flex-1 overflow-hidden border border-white/10 rounded-2xl shadow-inner">
                        <EnhancedShowroom initialAsset={currentDesign} />
                    </div>
                </div>
            )}
        </MerchLayout>
    );
}

const IconButton = ({ icon, onClick, label }: { icon: React.ReactNode, onClick?: () => void, label?: string }) => (
    <button
        onClick={onClick}
        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE135]"
        aria-label={label}
        title={label}
    >
        {icon}
    </button>
);

const ColorSwatch = ({ color, onClick, className }: { color: string, onClick: () => void, className?: string }) => (
    <button
        onClick={onClick}
        className={cn("w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE135]", className)}
        aria-label={`Select color ${color}`}
        title={`Select color ${color}`}
    />
);

const ModeToggle = ({ icon, label, active, onClick, 'data-testid': dataTestId }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, 'data-testid'?: string }) => (
    <button
        onClick={onClick}
        data-testid={dataTestId}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${active
            ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20'
            : 'text-neutral-400 hover:text-white hover:bg-white/10'
            }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const ToolButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${active ? 'bg-yellow-400 border-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20 hover:text-white'}`}
    >
        {icon}
        <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">{label}</span>
    </button>
);

const LayerItem = ({ label, active, visible, locked }: { label: string, active?: boolean, visible?: boolean, locked?: boolean }) => (
    <div className={`p-2 rounded flex items-center justify-between text-[11px] font-medium tracking-tight ${active ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20' : 'text-neutral-500 hover:bg-white/5'}`}>
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-yellow-400' : 'bg-neutral-700'}`} />
            <span>{label}</span>
        </div>
        <div className="flex gap-2">
            {locked && <span className="text-[10px] opacity-20">🔒</span>}
            {visible && <span className="text-[10px] opacity-20">👁️</span>}
        </div>
    </div>
);

