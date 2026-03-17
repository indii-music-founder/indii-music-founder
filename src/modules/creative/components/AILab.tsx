import React, { useState } from 'react';
import { useStore, HistoryItem } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    FlaskConical,
    Zap,
    MoveRight,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Play,
    Image as ImageIcon,
    Target,
    ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logger } from '@/utils/logger';

export default function AILab() {
    const {
        userProfile,
        addToHistory,
        currentProjectId,
        generatedHistory,
        setViewMode,
        setVideoInputs
    } = useStore();

    const toast = useToast();

    const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
    const [currentStep, setCurrentStep] = useState(0);
    const [seedImage, setSeedImage] = useState<HistoryItem | null>(null);
    const [targetImage, setTargetImage] = useState<HistoryItem | null>(null);
    const [predictedPrompt, setPredictedPrompt] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const steps = [
        { id: 1, name: 'Context Selection', description: 'Choose a seed asset from gallery' },
        { id: 2, name: 'Climax Prediction', description: 'AI analysis of scene evolution' },
        { id: 3, name: 'Target Synthesis', description: 'Generating the climax end-frame' },
        { id: 4, name: 'Digital Handover', description: 'Pushing frames to Production' }
    ];

    const runArchitectProcess = async () => {
        if (!seedImage || !userProfile) {
            toast.error("Please select a source image from your gallery.");
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

            // STEP 2: PREDICT CLIMAX
            toast.info("Step 2: Analyzing scene and predicting climax...");

            // Use Caption strategy but for "Next Frame"
            const climaxDescription = await ImageGeneration.captionImage(
                { mimeType: 'image/png', data: seedBase64 },
                'subject'
            );

            // Refine the prompt to be an "End State" via specialized reasoning
            const refinedTargetPrompt = `${climaxDescription}, capturing the high-energy climax of the scene with dramatic lighting and motion energy.`;
            setPredictedPrompt(refinedTargetPrompt);

            // STEP 3: SYNTHESIS
            setCurrentStep(3);
            toast.info("Step 3: Synthesizing consistent end-frame...");
            const synthResults = await ImageGeneration.remixImage({
                contentImage: { mimeType: 'image/png', data: seedBase64 },
                styleImage: { mimeType: 'image/png', data: seedBase64 },
                prompt: refinedTargetPrompt
            });

            if (!synthResults) throw new Error("End-frame synthesis failed.");

            const targetAsset: HistoryItem = {
                id: crypto.randomUUID(),
                url: synthResults.url,
                prompt: `Architect End State: ${refinedTargetPrompt.substring(0, 50)}...`,
                type: 'image',
                timestamp: Date.now(),
                projectId: currentProjectId
            };

            addToHistory(targetAsset);
            setTargetImage(targetAsset);

            // STEP 4: PREPARE INJECTION
            setCurrentStep(4);
            setStatus('complete');
            toast.success("Architectural Chain Complete. Ready for Production.");

        } catch (err: unknown) {
            logger.error("Architect Failure:", err);
            const msg = err instanceof Error ? err.message : 'Prediction chain failed.';
            setError(msg);
            setStatus('error');
            toast.error(`Architect Error: ${msg}`);
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

        // Use the proper app navigation
        setViewMode('video_production');
        toast.success("Interpolation Bridge Active: First & Last frames set.");
    };

    const recentImages = generatedHistory.filter(h => h.type === 'image').slice(0, 12);

    return (
        <div className="p-6 md:p-10 space-y-10 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-dept-creative">
                        <FlaskConical className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest text-white/50">Experimental Component</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
                        Video Keyframe Architect
                    </h1>
                    <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-tight max-w-lg leading-relaxed">
                        Contextual Morphing Engine: Analyzing a source asset to derive its
                        logical cinematic climax, and bridging the temporal gap.
                    </p>
                </div>

                <div className="flex gap-4">
                    {status === 'complete' ? (
                        <Button
                            onClick={transferToProduction}
                            className="bg-green-600 hover:bg-green-500 text-white px-8 py-8 h-auto font-black uppercase tracking-widest"
                        >
                            <Play className="w-6 h-6 mr-2 fill-current" />
                            Start Production
                        </Button>
                    ) : (
                        <Button
                            onClick={runArchitectProcess}
                            disabled={status === 'running' || !seedImage}
                            className="relative group bg-dept-creative hover:bg-dept-creative/80 text-white px-8 py-8 h-auto overflow-hidden transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-50 group-hover:opacity-80 transition-opacity" />
                            <div className="relative flex flex-col items-center gap-1">
                                <Zap className={`w-8 h-8 ${status === 'running' ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'}`} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Architect End-Frame</span>
                            </div>
                        </Button>
                    )}
                </div>
            </header>

            {/* Selection Row */}
            <section className="space-y-4">
                <h2 className="text-[10px] font-black tracking-[0.2em] text-white/30 uppercase flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> 1. Select Source Asset
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {recentImages.map((img) => (
                        <motion.button
                            key={img.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                setSeedImage(img);
                                setStatus('idle');
                                setTargetImage(null);
                            }}
                            className={`relative min-w-[120px] aspect-square rounded-xl overflow-hidden border-2 transition-all ${seedImage?.id === img.id ? 'border-dept-creative ring-4 ring-dept-creative/20' : 'border-white/5 opacity-60 hover:opacity-100'
                                }`}
                        >
                            <img src={img.url} alt="Gallery item" className="w-full h-full object-cover" />
                            {seedImage?.id === img.id && (
                                <div className="absolute inset-0 bg-dept-creative/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-white" />
                                </div>
                            )}
                        </motion.button>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Metadata & Status */}
                <div className="space-y-6">
                    <Card className="p-6 bg-surface/40 border-white/5 backdrop-blur-xl space-y-6">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-white/50 border-b border-white/5 pb-2 flex items-center gap-2">
                            <Target className="w-4 h-4" /> Architectural Steps
                        </h2>
                        <div className="space-y-3">
                            {steps.map((step) => (
                                <StepCard
                                    key={step.id}
                                    step={step}
                                    isActive={currentStep === step.id}
                                    isComplete={currentStep > step.id}
                                    isError={status === 'error' && currentStep === step.id}
                                />
                            ))}
                        </div>
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-500 font-mono">
                                ERROR: {error}
                            </div>
                        )}
                    </Card>

                    {predictedPrompt && (
                        <Card className="p-6 bg-surface/40 border-white/5 backdrop-blur-xl space-y-2">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/50 border-b border-white/5 pb-2">
                                Derived End-State Logic
                            </h2>
                            <p className="text-[11px] font-mono text-dept-creative leading-relaxed italic">
                                "{predictedPrompt}"
                            </p>
                        </Card>
                    )}
                </div>

                {/* Right: Synthesis Workspace */}
                <Card className="lg:col-span-2 p-8 bg-surface/20 border-white/5 backdrop-blur-md min-h-[500px] flex flex-col relative overflow-hidden">
                    <div className="flex-1 flex items-center justify-between gap-12 px-8">
                        {/* Frame A */}
                        <div className="flex-1 space-y-4">
                            <div className="text-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Frame A: Origin</span>
                            </div>
                            <div className="aspect-square bg-black/40 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative">
                                {seedImage ? (
                                    <img src={seedImage.url} alt="Origin" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="w-12 h-12 text-white/5" />
                                )}
                                <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center font-black text-xs">A</div>
                            </div>
                        </div>

                        {/* Bridge */}
                        <div className="flex flex-col items-center gap-4">
                            <div className={`w-16 h-1 bg-gradient-to-r ${status === 'running' ? 'from-dept-creative to-transparent animate-pulse' : 'from-white/10 to-white/10'}`} />
                            <ArrowRight className={`w-10 h-10 ${status === 'running' ? 'text-dept-creative animate-bounce' : 'text-white/10'}`} />
                            <div className={`w-16 h-1 bg-gradient-to-l ${status === 'running' ? 'from-dept-creative to-transparent animate-pulse' : 'from-white/10 to-white/10'}`} />
                        </div>

                        {/* Frame B */}
                        <div className="flex-1 space-y-4">
                            <div className="text-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Frame B: Destination</span>
                            </div>
                            <div className="aspect-square bg-black/40 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative">
                                {targetImage ? (
                                    <img src={targetImage.url} alt="Destination" className="w-full h-full object-cover shadow-[0_0_40px_rgba(168,85,247,0.3)]" />
                                ) : (
                                    <div className="flex flex-col items-center gap-3">
                                        {status === 'running' ? <Loader2 className="w-10 h-10 text-dept-creative animate-spin" /> : <Target className="w-12 h-12 text-white/5" />}
                                        <p className="text-[9px] font-black uppercase text-white/10">Pending Synthesis</p>
                                    </div>
                                )}
                                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-dept-creative/80 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-xs">B</div>
                            </div>
                        </div>
                    </div>

                    {status === 'complete' && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="mt-8 p-4 bg-dept-creative/10 border border-dept-creative/40 rounded-xl flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-dept-creative" />
                                <span className="text-xs font-bold uppercase tracking-widest text-white">Bridge Ready for Interpolation</span>
                            </div>
                            <Button size="sm" onClick={transferToProduction} className="bg-white text-black hover:bg-white/90 font-black uppercase text-[10px]">
                                Push to Video Studio
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
        <div className={`p-4 rounded-xl border transition-all duration-500 relative overflow-hidden ${isActive ? 'bg-dept-creative/10 border-dept-creative' :
            isComplete ? 'bg-green-500/5 border-green-500/20' :
                isError ? 'bg-red-500/5 border-red-500/40' :
                    'bg-white/5 border-white/5 opacity-40'
            }`}>
            <div className="relative flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border ${isActive ? 'bg-dept-creative text-white border-white/20' :
                    isComplete ? 'bg-green-500 text-black border-transparent' :
                        'bg-white/5 text-white/20 border-white/10'
                    }`}>
                    {isComplete ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                </div>
                <div>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : isComplete ? 'text-green-400' : 'text-white/40'}`}>
                        {step.name}
                    </h4>
                    <p className="text-[9px] text-white/30 tracking-tight leading-none mt-0.5">{step.description}</p>
                </div>
            </div>
        </div>
    );
}
