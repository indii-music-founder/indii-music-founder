import React, { useState, useEffect, useRef } from 'react';
import { MerchLayout } from './components/Layout';
import { BananaButton } from './components/BananaButton';
import { MerchCard } from './components/MerchCard';
import { Undo, Redo, Download, Layers, Type, Sticker, Wand2, Monitor, Sparkles, LayoutTemplate } from 'lucide-react';
import ShowroomStage from './components/ShowroomStage';
import ScenarioBuilder from './components/ScenarioBuilder';
import ManufacturingPanel from './components/ManufacturingPanel';
import { THEMES } from './themes';
import { MerchandiseService } from '@/services/merchandise/MerchandiseService';
import { useToast } from '@/core/context/ToastContext';

export default function MerchDesigner() {
    const [mode, setMode] = useState<'design' | 'showroom'>('design');
    const [selectedTool, setSelectedTool] = useState('sticker');

    // Showroom State
    const [scenePrompt, setScenePrompt] = useState("");
    const [motionPrompt, setMotionPrompt] = useState("");
    const [mockupUrl, setMockupUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentVideoJobId, setCurrentVideoJobId] = useState<string | null>(null);

    const toast = useToast();
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Clean up subscription on unmount
    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    // Monitor video job
    useEffect(() => {
        if (!currentVideoJobId) return;

        // Clean up previous subscription
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }

        setIsGenerating(true);
        unsubscribeRef.current = MerchandiseService.subscribeToVideoJob(currentVideoJobId, (job) => {
            if (!job) return;

            if (job.status === 'completed' && job.videoUrl) {
                setVideoUrl(job.videoUrl);
                setIsGenerating(false);
                setCurrentVideoJobId(null);
                toast.success("Video generated successfully!");
            } else if (job.status === 'failed') {
                setIsGenerating(false);
                setCurrentVideoJobId(null);
                toast.error(`Video generation failed: ${job.error || 'Unknown error'}`);
            }
        });

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        };
    }, [currentVideoJobId, toast]);

    const handleGenerateMockup = async () => {
        if (!scenePrompt) {
            toast.error("Please describe the scene first!");
            return;
        }

        setIsGenerating(true);
        try {
            // In a real app, passing the actual asset ID or canvas data
            // For now using a placeholder ID as per previous logic, but connected to real AI
            const url = await MerchandiseService.generateMockup("current-design-id", "t-shirt", scenePrompt);
            setMockupUrl(url);
            toast.success("Mockup generated!");
        } catch (error) {
            toast.error("Failed to generate mockup.");
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!mockupUrl || !motionPrompt) {
            toast.error("Need a mockup and motion prompt!");
            return;
        }

        setIsGenerating(true);
        try {
            const jobId = await MerchandiseService.generateVideo(mockupUrl, motionPrompt);
            setCurrentVideoJobId(jobId);
            toast.success("Video generation started...");
        } catch (error) {
            toast.error("Failed to start video generation.");
            console.error(error);
            setIsGenerating(false);
        }
    };

    return (
        <MerchLayout>
            <div className="h-full flex flex-col">

                {/* Toolbar Header */}
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-white/5">
                            <ModeToggle
                                active={mode === 'design'}
                                onClick={() => setMode('design')}
                                icon={<LayoutTemplate size={16} />}
                                label="Design"
                            />
                            <ModeToggle
                                active={mode === 'showroom'}
                                onClick={() => setMode('showroom')}
                                icon={<Monitor size={16} />}
                                label="Showroom"
                            />
                        </div>

                        <div className="h-6 w-px bg-white/10 mx-2" />

                        <div className="flex items-center gap-1 bg-neutral-900 rounded-lg p-1 border border-white/5">
                            <IconButton icon={<Undo size={16} />} />
                            <IconButton icon={<Redo size={16} />} />
                        </div>
                        <span className="text-sm font-bold text-neutral-500">Untitled Design_01</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="text-sm text-neutral-400 hover:text-white transition-colors">Save Draft</button>
                        <BananaButton size="sm" glow>
                            <Download size={16} />
                            Export
                        </BananaButton>
                    </div>
                </header>

                {/* Main Workspace */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">

                    {/* Left Panel */}
                    <div className="space-y-4 flex flex-col overflow-hidden">
                        {mode === 'design' ? (
                            <>
                                <div className="flex gap-2 mb-2">
                                    <ToolButton active={selectedTool === 'sticker'} onClick={() => setSelectedTool('sticker')} icon={<Sticker size={18} />} label="Stickers" />
                                    <ToolButton active={selectedTool === 'text'} onClick={() => setSelectedTool('text')} icon={<Type size={18} />} label="Text" />
                                    <ToolButton active={selectedTool === 'ai'} onClick={() => setSelectedTool('ai')} icon={<Wand2 size={18} />} label="AI Gen" />
                                </div>

                                <MerchCard className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col">
                                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Assets</h4>

                                    <div className="grid grid-cols-3 gap-2">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                                            <div key={i} className="aspect-square bg-neutral-800 rounded-lg border border-white/5 hover:border-[#FFE135] hover:bg-neutral-700 transition-all cursor-pointer flex items-center justify-center">
                                                <span className="text-xl">🍌</span>
                                            </div>
                                        ))}
                                    </div>
                                </MerchCard>
                            </>
                        ) : (
                            <ScenarioBuilder
                                scenePrompt={scenePrompt}
                                motionPrompt={motionPrompt}
                                onSceneChange={setScenePrompt}
                                onMotionChange={setMotionPrompt}
                                theme={THEMES.pro}
                            />
                        )}
                    </div>

                    {/* Center Canvas / Showroom Stage */}
                    <div className="lg:col-span-2 relative bg-neutral-900/20 rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                        {mode === 'design' ? (
                            <div className="flex-1 relative flex items-center justify-center">
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]" />

                                <div className="relative w-3/4 max-w-md aspect-[3/4] bg-black rounded-3xl shadow-2xl flex items-center justify-center border border-white/5 ring-1 ring-white/5">
                                    <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.1),transparent_70%)]" />
                                    <div className="relative z-10 text-center">
                                        <h1 className="text-6xl font-black text-[#FFE135] drop-shadow-[0_0_15px_rgba(255,225,53,0.5)] tracking-tighter transform -rotate-6">
                                            BANANA<br />PRO
                                        </h1>
                                    </div>
                                </div>

                                <div className="absolute bottom-6 flex gap-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-20">
                                    <div className="w-6 h-6 rounded-full bg-black border border-white cursor-pointer" />
                                    <div className="w-6 h-6 rounded-full bg-white border border-gray-300 cursor-pointer" />
                                    <div className="w-6 h-6 rounded-full bg-[#FFE135] border border-yellow-600 ring-2 ring-white/20 cursor-pointer" />
                                    <div className="w-6 h-6 rounded-full bg-blue-600 border border-blue-800 cursor-pointer" />
                                </div>
                            </div>
                        ) : (
                            <ShowroomStage
                                mockupImage={mockupUrl}
                                videoUrl={videoUrl}
                                isGenerating={isGenerating}
                                onGenerate={handleGenerateMockup}
                                onAnimate={handleGenerateVideo}
                                canGenerate={!!scenePrompt}
                                canAnimate={!!mockupUrl && !!motionPrompt}
                            />
                        )}
                    </div>

                    {/* Right Properties / Production Panel */}
                    <div className="space-y-4 flex flex-col h-full overflow-hidden">
                        {mode === 'design' ? (
                            <>
                                <MerchCard className="p-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Layers size={16} className="text-[#FFE135]" />
                                        <h4 className="text-sm font-bold text-white">Layers</h4>
                                    </div>
                                    <div className="space-y-2">
                                        <LayerItem active label="Text: BANANA PRO" visible />
                                        <LayerItem label="Image: Peel.png" visible />
                                        <LayerItem label="Base: Heavy Cotton Tee" visible={false} locked />
                                    </div>
                                </MerchCard>

                                <MerchCard className="flex-1 p-4">
                                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Properties</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-neutral-400 block mb-1">Blend Mode</label>
                                            <select className="w-full bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFE135]">
                                                <option>Normal</option>
                                                <option>Multiply</option>
                                                <option>Screen</option>
                                                <option>Overlay</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs text-neutral-400 block mb-1">Opacity</label>
                                            <input type="range" className="w-full accent-[#FFE135]" />
                                        </div>
                                    </div>
                                </MerchCard>
                            </>
                        ) : (
                            <ManufacturingPanel
                                theme={THEMES.pro}
                                productType="T-Shirt"
                            />
                        )}
                    </div>
                </div>
            </div>
        </MerchLayout>
    );
}

const IconButton = ({ icon }: { icon: React.ReactNode }) => (
    <button className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded transition-colors">
        {icon}
    </button>
);

const ModeToggle = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${active
                ? 'bg-[#FFE135] text-black shadow-lg shadow-[#FFE135]/20'
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
        className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${active ? 'bg-[#FFE135] border-[#FFE135] text-black shadow-[0_0_15px_rgba(255,225,53,0.3)]' : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20 hover:text-white'}`}
    >
        {icon}
        <span className="text-[10px] font-bold mt-1 uppercase tracking-tight">{label}</span>
    </button>
);

const LayerItem = ({ label, active, visible, locked }: { label: string, active?: boolean, visible?: boolean, locked?: boolean }) => (
    <div className={`p-2 rounded flex items-center justify-between text-sm ${active ? 'bg-[#FFE135]/20 text-[#FFE135] border border-[#FFE135]/20' : 'text-neutral-400 hover:bg-white/5'}`}>
        <span>{label}</span>
        <div className="flex gap-2 opacity-50">
            {locked && <span>🔒</span>}
        </div>
    </div>
);
