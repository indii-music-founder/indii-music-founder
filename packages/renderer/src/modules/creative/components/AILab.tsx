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
    Target,
    ArrowRight,
    Wand2,
    Clock,
    UploadCloud,
    Film,
    Sparkles,
    ChevronDown,
    ChevronUp,
    X,
    Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { logger } from '@/utils/logger';

type SequenceItem = {
    id: string;
    type: 'seconds' | 'beats';
    value: number;
};

export default function AILab() {
    const {
        userProfile,
        addToHistory,
        currentProjectId,
        generatedHistory,
        uploadedImages,
        setViewMode,
        setVideoInputs,
        setStudioControls,
        setGenerationMode
    } = useStore(useShallow(state => ({
        userProfile: state.userProfile,
        addToHistory: state.addToHistory,
        currentProjectId: state.currentProjectId,
        generatedHistory: state.generatedHistory,
        uploadedImages: state.uploadedImages,
        setViewMode: state.setViewMode,
        setVideoInputs: state.setVideoInputs,
        setStudioControls: state.setStudioControls,
        setGenerationMode: state.setGenerationMode
    })));

    const toast = useToast();

    const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
    const [currentStep, setCurrentStep] = useState(0);
    const [seedImage, setSeedImage] = useState<HistoryItem | null>(null);
    const [targetImage, setTargetImage] = useState<HistoryItem | null>(null);
    const [predictedPrompt, setPredictedPrompt] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [sequenceItems, setSequenceItems] = useState<SequenceItem[]>([{ id: crypto.randomUUID(), type: 'seconds', value: 6 }]);
    const [bpm, setBpm] = useState<number>(120);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isTrajectoryOpen, setIsTrajectoryOpen] = useState(false);
    const [customValue, setCustomValue] = useState<number>(4);
    const [customType, setCustomType] = useState<'seconds' | 'beats'>('seconds');

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

        const durationsInSeconds = sequenceItems.map(item => item.type === 'seconds' ? item.value : (item.value * 60) / bpm);

        setVideoInputs({
            firstFrame: seedImage,
            lastFrame: targetImage,
            isDaisyChain: durationsInSeconds.length > 1,
            sequenceDurations: durationsInSeconds,
            timeOffset: 0,
            ingredients: []
        });

        const totalDuration = durationsInSeconds.reduce((a, b) => a + b, 0);
        setStudioControls({ duration: totalDuration });

        // CRITICAL: Set generationMode FIRST so CreativeStudio routing cooperates
        // and the Director tab becomes visible in CreativeNavbar
        setGenerationMode('video');
        setViewMode('video_production');
        toast.success(`Sequence locked (${totalDuration.toFixed(1)}s). Director Mode active.`);
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

    const handleAddCustom = () => {
        const sec = customType === 'seconds' ? customValue : (customValue * 60) / bpm;
        const currentTotal = sequenceItems.reduce((acc, item) => acc + (item.type === 'seconds' ? item.value : (item.value * 60) / bpm), 0);
        if (currentTotal + sec <= 60) {
            setSequenceItems([...sequenceItems, { id: crypto.randomUUID(), type: customType, value: customValue }]);
        } else {
            toast.error("Sequence exceeds 60 seconds limit.");
        }
    };

    const currentTotalSec = sequenceItems.reduce((acc, item) => acc + (item.type === 'seconds' ? item.value : (item.value * 60) / bpm), 0);

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
                        <Card className="p-8 bg-black/40 border-white/[0.06] backdrop-blur-xl rounded-2xl shadow-2xl transition-all duration-300">
                            <button 
                                onClick={() => setIsTrajectoryOpen(!isTrajectoryOpen)}
                                className="w-full flex items-center justify-between focus:outline-none group"
                            >
                                <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Engine Trajectory
                                </h2>
                                <div className="p-1 rounded-full bg-white/[0.02] border border-white/[0.05] group-hover:bg-white/[0.05] transition-colors">
                                    {isTrajectoryOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                </div>
                            </button>
                            
                            {isTrajectoryOpen && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                                    className="overflow-hidden"
                                >
                                    <textarea 
                                        value={predictedPrompt}
                                        onChange={(e) => setPredictedPrompt(e.target.value)}
                                        className="w-full min-h-[300px] bg-black/20 border border-white/[0.05] rounded-xl p-5 text-sm text-gray-300 leading-relaxed font-light italic resize-y outline-none focus:border-blue-500/50 focus:bg-black/40 transition-all custom-scrollbar"
                                        placeholder="Review and edit the cinematic trajectory..."
                                    />
                                    <div className="mt-3 flex justify-end">
                                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold px-2 py-1 bg-white/[0.03] rounded-md border border-white/[0.05]">Editable Context</span>
                                    </div>
                                </motion.div>
                            )}
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
                                    <Clock className="w-3.5 h-3.5" /> Sequence Builder
                                </span>
                                
                                <div className="flex items-center justify-between w-full px-2 mb-2 bg-white/[0.02] rounded-lg p-2 border border-white/[0.05]">
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Global Tempo</span>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={bpm} 
                                            onChange={e => setBpm(Math.max(60, Math.min(240, Number(e.target.value) || 120)))}
                                            className="w-16 bg-black/40 border border-white/[0.08] focus:border-blue-500/50 rounded px-2 py-1 text-xs text-white text-right outline-none transition-colors"
                                        />
                                        <span className="text-[10px] text-gray-500 font-bold">BPM</span>
                                    </div>
                                </div>


                                
                                <div className="text-[10px] text-gray-400 font-mono mb-2">
                                    TOTAL: {currentTotalSec.toFixed(1)}s / 60.0s
                                </div>

                                {/* Visual Timeline */}
                                <div className="w-full relative h-16 bg-black/60 rounded-xl border border-white/[0.08] overflow-hidden flex shadow-inner mb-4">
                                    {sequenceItems.map((item) => {
                                        const sec = item.type === 'seconds' ? item.value : (item.value * 60) / bpm;
                                        const widthPct = (sec / 60) * 100;
                                        return (
                                            <div 
                                                key={item.id}
                                                style={{ width: `${widthPct}%` }} 
                                                className="h-full border-r border-white/10 bg-gradient-to-b from-blue-500/20 to-blue-600/10 hover:from-blue-500/30 hover:to-blue-600/20 transition-all flex flex-col items-center justify-center relative group"
                                            >
                                                <span className="text-[11px] font-bold text-blue-300 drop-shadow-md">
                                                    {item.value}{item.type === 'seconds' ? 's' : 'b'}
                                                </span>
                                                <span className="text-[8px] text-blue-200/70">{sec.toFixed(1)}s</span>
                                                
                                                <button 
                                                    onClick={() => setSequenceItems(items => items.filter(i => i.id !== item.id))}
                                                    className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white backdrop-blur-sm"
                                                >
                                                    <X className="w-4 h-4 mb-0.5" />
                                                    <span className="text-[8px] font-bold uppercase tracking-wider">Remove</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                    <div style={{ width: `${((60 - currentTotalSec) / 60) * 100}%`}} className="h-full bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_20px)] flex flex-col items-center justify-center">
                                        {currentTotalSec < 60 && (
                                            <span className="text-[9px] text-gray-600 uppercase tracking-widest font-semibold">{ (60 - currentTotalSec).toFixed(1) }s remaining</span>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full space-y-4 bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                                    <div className="flex flex-col xl:flex-row gap-6">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold ml-1">Time Presets (s)</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 w-full">
                                                {[3, 4, 5, 8].map(sec => {
                                                    const disabled = currentTotalSec + sec > 60;
                                                    const beats = (sec * bpm) / 60;
                                                    return (
                                                        <button
                                                            key={`sec-${sec}`}
                                                            disabled={disabled}
                                                            onClick={() => setSequenceItems([...sequenceItems, { id: crypto.randomUUID(), type: 'seconds', value: sec }])}
                                                            className={`relative overflow-hidden w-full py-1.5 rounded-md transition-all duration-300 flex flex-col items-center justify-center ${
                                                                disabled 
                                                                    ? 'opacity-30 cursor-not-allowed bg-white/[0.02]' 
                                                                    : 'bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05]'
                                                            }`}
                                                        >
                                                            <span className={`text-[11px] font-bold tracking-wider ${disabled ? 'text-gray-500' : 'text-gray-300'}`}>+{sec}s</span>
                                                            <span className={`text-[8px] font-medium mt-0.5 ${disabled ? 'text-gray-600' : 'text-blue-400/80'}`}>
                                                                {beats % 1 === 0 ? beats : beats.toFixed(1)} b
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] uppercase tracking-widest text-blue-400/70 font-bold ml-1">Beat Presets (b)</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 w-full">
                                                {[4, 8, 16, 32].map(beats => {
                                                    const sec = (beats * 60) / bpm;
                                                    const disabled = currentTotalSec + sec > 60;
                                                    return (
                                                        <button
                                                            key={`beats-${beats}`}
                                                            disabled={disabled}
                                                            onClick={() => setSequenceItems([...sequenceItems, { id: crypto.randomUUID(), type: 'beats', value: beats }])}
                                                            className={`relative overflow-hidden w-full py-1.5 rounded-md transition-all duration-300 flex flex-col items-center justify-center ${
                                                                disabled 
                                                                    ? 'opacity-30 cursor-not-allowed bg-white/[0.02]' 
                                                                    : 'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20'
                                                            }`}
                                                        >
                                                            <span className={`text-[11px] font-bold tracking-wider ${disabled ? 'text-gray-500' : 'text-blue-300'}`}>+{beats}b</span>
                                                            <span className={`text-[8px] font-medium mt-0.5 ${disabled ? 'text-gray-600' : 'text-gray-400'}`}>
                                                                {sec % 1 === 0 ? sec : sec.toFixed(1)}s
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 mt-4 border-t border-white/[0.05] flex items-end gap-3">
                                        <div className="flex-1">
                                            <label className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1.5 block">Custom Length</label>
                                            <div className="flex bg-black/40 border border-white/[0.08] rounded-lg overflow-hidden focus-within:border-blue-500/50 transition-colors">
                                                <input 
                                                    type="number" 
                                                    value={customValue}
                                                    onChange={e => setCustomValue(Math.max(1, Number(e.target.value)))}
                                                    className="w-full bg-transparent px-3 py-2 text-sm text-white outline-none"
                                                    min="1"
                                                />
                                                <select 
                                                    value={customType}
                                                    onChange={e => setCustomType(e.target.value as 'seconds'|'beats')}
                                                    className="bg-white/[0.05] border-l border-white/[0.05] px-3 py-2 text-xs text-gray-300 outline-none hover:bg-white/[0.08] transition-colors appearance-none cursor-pointer font-semibold"
                                                >
                                                    <option value="seconds" className="bg-gray-900">Seconds</option>
                                                    <option value="beats" className="bg-gray-900">Beats</option>
                                                </select>
                                            </div>
                                        </div>
                                        <Button 
                                            onClick={handleAddCustom}
                                            disabled={currentTotalSec + (customType === 'seconds' ? customValue : (customValue * 60) / bpm) > 60}
                                            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg h-[38px] px-6 rounded-lg transition-all"
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Add
                                        </Button>
                                    </div>
                                </div>

                                {sequenceItems.length > 0 && (
                                    <button
                                        onClick={() => setSequenceItems([])}
                                        className="text-[9px] uppercase tracking-widest text-red-400 hover:text-red-300 mt-2 font-semibold transition-colors"
                                    >
                                        Clear Sequence
                                    </button>
                                )}
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
                            className="mt-12 space-y-6"
                        >
                            {/* Filmstrip: Visual Frame Succession */}
                            {sequenceItems.length > 1 && seedImage && targetImage && (
                                <div className="p-5 bg-black/40 border border-white/[0.06] rounded-2xl">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                                        <Film className="w-3.5 h-3.5 text-blue-400" /> Frame Succession Preview
                                    </h3>
                                    <div className="flex items-center gap-1 overflow-x-auto pb-2 custom-scrollbar">
                                        {sequenceItems.map((item, idx) => {
                                            const sec = item.type === 'seconds' ? item.value : (item.value * 60) / bpm;
                                            const isFirst = idx === 0;
                                            const isLast = idx === sequenceItems.length - 1;
                                            return (
                                                <React.Fragment key={item.id}>
                                                    {/* Segment start frame */}
                                                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                                                        <div className="w-16 h-20 rounded-lg border-2 border-blue-500/30 overflow-hidden bg-black/60 relative">
                                                            <img
                                                                src={isFirst ? seedImage.url : targetImage.url}
                                                                alt={isFirst ? 'Seed' : `Seg ${idx + 1} Start`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute bottom-0 inset-x-0 bg-black/70 py-0.5 text-center">
                                                                <span className="text-[7px] font-bold text-blue-300 uppercase">
                                                                    {isFirst ? 'Seed' : 'Chain'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[8px] text-gray-500 font-mono">F{idx * 2 + 1}</span>
                                                    </div>
                                                    {/* Duration bridge */}
                                                    <div className="flex flex-col items-center gap-0.5 px-1 shrink-0">
                                                        <div className="h-px w-8 bg-gradient-to-r from-blue-500/40 to-blue-500/40" />
                                                        <span className="text-[8px] text-blue-400/70 font-bold">{sec.toFixed(1)}s</span>
                                                        <div className="h-px w-8 bg-gradient-to-r from-blue-500/40 to-blue-500/40" />
                                                    </div>
                                                    {/* Segment end frame */}
                                                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                                                        <div className={`w-16 h-20 rounded-lg border-2 overflow-hidden bg-black/60 relative ${isLast ? 'border-green-500/30' : 'border-white/10'}`}>
                                                            <img
                                                                src={targetImage.url}
                                                                alt={isLast ? 'Conclusion' : `Seg ${idx + 1} End`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute bottom-0 inset-x-0 bg-black/70 py-0.5 text-center">
                                                                <span className={`text-[7px] font-bold uppercase ${isLast ? 'text-green-300' : 'text-gray-400'}`}>
                                                                    {isLast ? 'End' : 'Link'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[8px] text-gray-500 font-mono">F{idx * 2 + 2}</span>
                                                    </div>
                                                    {/* Chain arrow between segments */}
                                                    {!isLast && (
                                                        <div className="flex items-center px-0.5 shrink-0">
                                                            <ArrowRight className="w-3.5 h-3.5 text-blue-500/50" />
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-3 italic">
                                        Each segment's last frame becomes the next segment's first frame for seamless continuity.
                                    </p>
                                </div>
                            )}

                            {/* CTA Banner */}
                            <div className="p-6 bg-gradient-to-r from-blue-900/20 to-transparent border border-blue-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">Sequence Primed</h3>
                                        <p className="text-xs text-blue-200/60 mt-1">
                                            {sequenceItems.length > 1
                                                ? `${sequenceItems.length} segments (${currentTotalSec.toFixed(1)}s) ready for daisy-chain generation.`
                                                : 'Frames are ready to be sent to the generation pipeline.'}
                                        </p>
                                    </div>
                                </div>
                                <Button onClick={transferToProduction} className="bg-white text-black hover:bg-gray-200 font-semibold tracking-wide px-8 py-5 rounded-xl whitespace-nowrap shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                                    <Film className="w-4 h-4 mr-2" />
                                    Enter Director Mode
                                </Button>
                            </div>
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
