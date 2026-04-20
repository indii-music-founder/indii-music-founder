import React, { useState } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    CheckCircle2,
    Loader2,
    Play,
    Image as ImageIcon,
    Target,
    ArrowRight,
    Wand2,
    Clock,
    UploadCloud,
    Film,
    Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';
import { logger } from '@/utils/logger';

export default function AILab() {
    const {
        userProfile,
        addToHistory,
        currentProjectId,
        generatedHistory,
        uploadedImages,
        setViewMode,
        setVideoInputs,
        setStudioControls
    } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId,
        generatedHistory: state.generatedHistory,
        uploadedImages: state.uploadedImages,
        setViewMode: state.setViewMode,
        setVideoInputs: state.setVideoInputs,
        setStudioControls: state.setStudioControls
    })));

    const toast = useToast();

    const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
    const [currentStep, setCurrentStep] = useState(0);
    const [seedImage, setSeedImage] = useState<HistoryItem | null>(null);
    const [targetImage, setTargetImage] = useState<HistoryItem | null>(null);
    const [predictedPrompt, setPredictedPrompt] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [duration, setDuration] = useState<number>(6);
    const [isDragOver, setIsDragOver] = useState(false);

    const steps = [
        { id: 1, name: 'Establish Scene', description: 'Drop your establishing shot' },
        { id: 2, name: 'Cinematic Analysis', description: 'Engine predicts logical progression' },
        { id: 3, name: 'Synthesize', description: 'Rendering the conclusion frame' },
        { id: 4, name: 'Sequence Ready', description: 'Frames primed for generation' }
    ];

    const runArchitectProcess = async () => {
        if (!seedImage || !userProfile) {
            toast.error("Please provide an establishing shot.");
            return;
        }

        setStatus('running');
        setCurrentStep(2);
        setError(null);

        try {
            const getBase64 = async (url: string) => {
                if (url.startsWith('data:')) return url.split(',')[1] ?? '';
                const res = await fetch(url);
                const blob = await res.blob();
                return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '');
                    reader.readAsDataURL(blob);
                });
            };

            const seedBase64 = await getBase64(seedImage.url);

            toast.info("Analyzing cinematic trajectory...");

            const climaxDescription = await ImageGeneration.captionImage(
                { mimeType: 'image/png', data: seedBase64 },
                'subject'
            );

            const refinedTargetPrompt = `${climaxDescription}, capturing the logical conclusion of the scene with cinematic lighting.`;
            setPredictedPrompt(refinedTargetPrompt);

            setCurrentStep(3);
            toast.info("Synthesizing sequence conclusion...");
            const synthResults = await ImageGeneration.remixImage({
                contentImage: { mimeType: 'image/png', data: seedBase64 },
                styleImage: { mimeType: 'image/png', data: seedBase64 },
                prompt: refinedTargetPrompt
            });

            if (!synthResults) throw new Error("Synthesis failed.");

            const targetAsset: HistoryItem = {
                id: crypto.randomUUID(),
                url: synthResults.url,
                prompt: `Conclusion: ${refinedTargetPrompt.substring(0, 50)}...`,
                type: 'image',
                timestamp: Date.now(),
                projectId: currentProjectId
            };

            addToHistory(targetAsset);
            setTargetImage(targetAsset);

            setCurrentStep(4);
            setStatus('complete');
            toast.success("Sequence primed for Director mode.");

        } catch (err: unknown) {
            logger.error("Synthesis Failure:", err);
            const msg = err instanceof Error ? err.message : 'Synthesis failed.';
            setError(msg);
            setStatus('error');
            toast.error(`Error: ${msg}`);
        }
    };

    const transferToProduction = () => {
        if (!seedImage || !targetImage) return;

        setVideoInputs({
            firstFrame: seedImage,
            lastFrame: targetImage,
            isDaisyChain: false,
            timeOffset: 0,
            ingredients: []
        });

        setStudioControls({ duration });

        setViewMode('video_production');
        toast.success(`Sequence locked. Transitioning to Director.`);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        
        try {
            const assetId = e.dataTransfer.getData('text/plain');
            if (assetId) {
                const asset = generatedHistory.find(h => h.id === assetId) || uploadedImages.find(i => i.id === assetId);
                if (asset && asset.type === 'image') {
                    setSeedImage(asset);
                    setStatus('idle');
                    setTargetImage(null);
                    setCurrentStep(1);
                    return;
                } else if (asset) {
                    toast.error("Please drop an image asset.");
                    return;
                }
            }
        } catch (err) {
            logger.error('Failed to parse dropped item', err);
        }
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            toast.error("Drag assets from the side panel instead of the file system.");
        }
    };

    return (
        <div className="p-8 md:p-12 space-y-12 max-w-[1400px] mx-auto h-full overflow-y-auto custom-scrollbar bg-background">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b border-white/[0.04]">
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08]">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-300">Generative Engine</span>
                    </div>
                    <h1 className="text-4xl font-light tracking-tight text-white">
                        Sequence Architect
                    </h1>
                    <p className="text-sm text-gray-400 max-w-xl font-light leading-relaxed">
                        Design temporal sequences by defining the establishing shot. Our engine predicts and renders the cinematic conclusion, bridging the gap with high-fidelity interpolation.
                    </p>
                </div>

                <div className="flex gap-4">
                    {status === 'complete' ? (
                        <Button
                            onClick={transferToProduction}
                            className="bg-white text-black hover:bg-gray-200 px-8 py-6 h-auto rounded-xl transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                        >
                            <Film className="w-5 h-5 mr-3" />
                            <span className="font-semibold tracking-wide">Enter Director Mode</span>
                        </Button>
                    ) : (
                        <Button
                            onClick={runArchitectProcess}
                            disabled={status === 'running' || !seedImage}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-6 h-auto rounded-xl transition-all shadow-[0_0_30px_rgba(37,99,235,0.2)] disabled:opacity-50"
                        >
                            <div className="flex items-center gap-3">
                                {status === 'running' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                                <span className="font-semibold tracking-wide">Synthesize Sequence</span>
                            </div>
                        </Button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left: Metadata & Status */}
                <div className="xl:col-span-4 space-y-6">
                    <Card className="p-8 bg-black/40 border-white/[0.06] backdrop-blur-xl rounded-2xl shadow-2xl">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-3">
                            <Target className="w-4 h-4 text-gray-400" /> Pipeline Status
                        </h2>
                        <div className="space-y-4">
                            {steps.map((step) => (
                                <StepCard
                                    key={step.id}
                                    step={step}
                                    isActive={currentStep === step.id || (step.id === 1 && !seedImage)}
                                    isComplete={currentStep > step.id || (step.id === 1 && !!seedImage)}
                                    isError={status === 'error' && currentStep === step.id}
                                />
                            ))}
                        </div>
                        {error && (
                            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                                {error}
                            </div>
                        )}
                    </Card>

                    {predictedPrompt && (
                        <Card className="p-8 bg-black/40 border-white/[0.06] backdrop-blur-xl rounded-2xl shadow-2xl">
                            <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">
                                Engine Trajectory
                            </h2>
                            <p className="text-sm text-gray-300 leading-relaxed font-light italic">
                                "{predictedPrompt}"
                            </p>
                        </Card>
                    )}
                </div>

                {/* Right: Synthesis Workspace */}
                <Card className="xl:col-span-8 p-10 bg-black/20 border-white/[0.04] backdrop-blur-md rounded-2xl min-h-[600px] flex flex-col relative overflow-hidden">
                    <div className="flex-1 flex flex-col md:flex-row items-center justify-between gap-12">
                        {/* Frame A: Drop Zone */}
                        <div className="w-full md:w-2/5 flex flex-col space-y-6">
                            <div className="text-center">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Establishing Shot</span>
                            </div>
                            <div 
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`aspect-[4/5] rounded-2xl border-2 transition-all duration-300 overflow-hidden flex flex-col items-center justify-center relative group ${
                                    isDragOver 
                                        ? 'border-blue-500 bg-blue-500/10 scale-[1.02] shadow-[0_0_30px_rgba(37,99,235,0.2)]' 
                                        : seedImage 
                                            ? 'border-white/10 bg-black' 
                                            : 'border-dashed border-white/20 hover:border-white/40 hover:bg-white/[0.02]'
                                }`}
                            >
                                {seedImage ? (
                                    <>
                                        <img src={seedImage.url} alt="Start Frame" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <p className="text-xs font-semibold text-white tracking-wide">Drop to Replace</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 text-gray-500 p-8 text-center pointer-events-none">
                                        <UploadCloud className={`w-10 h-10 ${isDragOver ? 'text-blue-400 animate-bounce' : 'text-gray-600'}`} />
                                        <div>
                                            <p className="text-sm font-medium text-gray-300">Drop asset here</p>
                                            <p className="text-xs mt-1 opacity-70">Drag from the right panel</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Timeline / Bridge */}
                        <div className="flex flex-col items-center gap-8 w-full md:w-1/5">
                            <ArrowRight className={`w-6 h-6 ${status === 'running' ? 'text-blue-400 animate-pulse' : 'text-gray-700'}`} />
                            
                            <div className="flex flex-col items-center gap-4 w-full">
                                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-500 flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5" /> Interpolation
                                </span>
                                <div className="flex flex-col gap-2 w-full">
                                    {[4, 6, 8].map(sec => (
                                        <button
                                            key={sec}
                                            onClick={() => setDuration(sec)}
                                            className={`relative overflow-hidden w-full py-3 rounded-xl text-xs font-bold tracking-wider transition-all duration-300 ${
                                                duration === sec 
                                                    ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)] scale-105' 
                                                    : 'bg-white/[0.03] text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] border border-white/[0.05]'
                                            }`}
                                        >
                                            {sec} SECONDS
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Frame B: Conclusion */}
                        <div className="w-full md:w-2/5 flex flex-col space-y-6">
                            <div className="text-center">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Conclusion</span>
                            </div>
                            <div className="aspect-[4/5] bg-black/40 rounded-2xl border border-white/[0.08] overflow-hidden flex items-center justify-center relative">
                                {targetImage ? (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="w-full h-full relative"
                                    >
                                        <img src={targetImage.url} alt="End Frame" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] pointer-events-none" />
                                    </motion.div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        {status === 'running' ? (
                                            <>
                                                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                                <p className="text-[10px] uppercase tracking-widest font-bold text-blue-400/80">Rendering...</p>
                                            </>
                                        ) : (
                                            <>
                                                <Target className="w-8 h-8 text-gray-700" />
                                                <p className="text-xs font-medium text-gray-600">Awaiting establishing shot</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {status === 'complete' && (
                        <motion.div
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="mt-12 p-6 bg-gradient-to-r from-blue-900/20 to-transparent border border-blue-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">Sequence Primed</h3>
                                    <p className="text-xs text-blue-200/60 mt-1">Frames are ready to be sent to the generation pipeline.</p>
                                </div>
                            </div>
                            <Button onClick={transferToProduction} className="bg-white text-black hover:bg-gray-200 font-semibold tracking-wide px-8 py-5 rounded-xl whitespace-nowrap">
                                Enter Director Mode
                            </Button>
                        </motion.div>
                    )}
                </Card>
            </div>
        </div>
    );
}

function StepCard({ step, isActive, isComplete, isError }: { step: { id: number; name: string; description: string }, isActive: boolean, isComplete: boolean, isError: boolean }) {
    return (
        <div className={`p-5 rounded-xl border transition-all duration-500 relative overflow-hidden ${
            isActive ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_30px_rgba(37,99,235,0.1)]' :
            isComplete ? 'bg-white/[0.02] border-white/[0.08]' :
            isError ? 'bg-red-500/10 border-red-500/30' :
            'bg-transparent border-transparent opacity-40 grayscale'
        }`}>
            <div className="relative flex items-center gap-5">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' :
                    isComplete ? 'bg-white/10 text-white' :
                    'bg-white/5 text-gray-500'
                }`}>
                    {isComplete && !isActive ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </div>
                <div>
                    <h4 className={`text-sm font-semibold tracking-wide ${isActive ? 'text-white' : isComplete ? 'text-gray-300' : 'text-gray-500'}`}>
                        {step.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 font-light leading-relaxed">{step.description}</p>
                </div>
            </div>
        </div>
    );
}
