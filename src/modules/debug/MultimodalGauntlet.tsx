import React, { useState } from 'react';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play, CheckCircle, AlertCircle, Image as ImageIcon, Video } from 'lucide-react';
import { logger } from '@/utils/logger';

export default function MultimodalGauntlet() {
    const { userProfile } = useStore();
    const toast = useToast();

    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<{
        img1?: string;
        img2?: string;
        vid1?: string;
        vid2?: string;
    }>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const runGauntlet = async () => {
        if (!userProfile) {
            toast.error("Please log in first.");
            return;
        }

        setLoading(true);
        setErrors({});

        try {
            // STEP 1: IMAGE 1 (THE FOUNDATION)
            setStep(1);
            const img1Results = await ImageGeneration.generateImages({
                prompt: "A futuristic creative studio WITH neon purple highlights. IF it worked.",
                count: 1,
                userProfile
            });
            if (!img1Results.length) throw new Error("Image 1 failed to generate.");
            const img1 = img1Results[0].url;
            setResults(prev => ({ ...prev, img1 }));

            // STEP 2: IMAGE 2 (THE DERIVATIVE)
            setStep(2);
            // Logic: Remix Image 1 into a night version or similar
            const img2Results = await ImageGeneration.remixImage({
                contentImage: { mimeType: 'image/png', data: img1.split(',')[1] || img1 },
                styleImage: { mimeType: 'image/png', data: img1.split(',')[1] || img1 }, // Using same image as style for consistency in demo
                prompt: "The same studio but with a holographic DJ booth. IS it spelled in capital letters both times."
            });
            if (!img2Results) throw new Error("Image 2 failed to generate.");
            const img2 = img2Results.url;
            setResults(prev => ({ ...prev, img2 }));

            // STEP 3: VIDEO 1 (CONSISTENCY PROOF)
            setStep(3);
            const vid1Results = await VideoGeneration.generateVideo({
                prompt: "Cinematic transition in a futuristic studio. IF it worked.",
                firstFrame: img1,
                lastFrame: img2,
                userProfile
            });
            setResults(prev => ({ ...prev, vid1: vid1Results[0].id }));

            // STEP 4: VIDEO 2 (LOOP PROOF)
            setStep(4);
            const vid2Results = await VideoGeneration.generateVideo({
                prompt: "Looping back to the original studio state. IS it spelled in capital letters both times.",
                firstFrame: img2,
                lastFrame: img1,
                userProfile
            });
            setResults(prev => ({ ...prev, vid2: vid2Results[0].id }));

            setStep(5);
            toast.success("Multimodal Gauntlet Triggered Successfully!");
        } catch (err: any) {
            logger.error("Gauntlet Failure:", err);
            setErrors({ [step]: err.message });
            toast.error(`Step ${step} failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 bg-background min-h-screen">
            <header className="space-y-2">
                <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                    MULTIMODAL GAUNTLET
                </h1>
                <p className="text-muted-foreground font-mono text-sm">
                    PROVING CONSISTENT AI GENERATION & LOOPING LOGIC
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6 bg-surface/50 border-white/5 space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Play className="w-4 h-4 text-purple-400" /> Executive Logic
                    </h3>
                    <div className="space-y-3">
                        <GauntletStep
                            num={1}
                            title="Primary Image Generation"
                            status={step > 1 ? 'complete' : step === 1 ? 'active' : 'pending'}
                            detail="Bypassing App Check locally for developer verification."
                        />
                        <GauntletStep
                            num={2}
                            title="Derivative Reference (Consistency)"
                            status={step > 2 ? 'complete' : step === 2 ? 'active' : 'pending'}
                            detail="Generating last frame from primary context."
                        />
                        <GauntletStep
                            num={3}
                            title="Temporal Interpolation (Video)"
                            status={step > 3 ? 'complete' : step === 3 ? 'active' : 'pending'}
                            detail="Veo 3.1: Startframe -> Endframe mapping."
                        />
                        <GauntletStep
                            num={4}
                            title="Loop Synchronization"
                            status={step > 4 ? 'complete' : step === 4 ? 'active' : 'pending'}
                            detail="Inverse mapping for seamless loop."
                        />
                    </div>

                    <Button
                        onClick={runGauntlet}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-6"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                        {loading ? 'EXECUTING GAUNTLET...' : 'START PROOF OF LIFE'}
                    </Button>
                </Card>

                <div className="space-y-4">
                    <Card className="p-6 bg-surface/30 border-white/5 h-full min-h-[400px] flex flex-col">
                        <h3 className="text-lg font-bold mb-4">Live Preview</h3>
                        <div className="flex-1 border border-white/10 rounded-lg flex items-center justify-center bg-black/40 overflow-hidden relative">
                            {results.img1 && (
                                <img src={results.img1} alt="Result" className="w-full h-full object-cover" />
                            )}
                            {loading && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                                    <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                                    <p className="text-xl font-bold italic tracking-widest text-white">IF IT WORKED...</p>
                                    <p className="text-sm text-purple-400 font-mono mt-2 animate-pulse">PROCESSING STEP {step}</p>
                                </div>
                            )}
                            {!loading && !results.img1 && (
                                <div className="text-muted-foreground flex flex-col items-center gap-2">
                                    <ImageIcon className="w-12 h-12 opacity-20" />
                                    <p className="text-xs font-mono uppercase tracking-widest">Waiting for Execution</p>
                                </div>
                            )}
                        </div>
                        {results.vid1 && (
                            <div className="mt-4 p-3 bg-purple-900/20 border border-purple-500/30 rounded flex items-center gap-3">
                                <Video className="w-5 h-5 text-purple-400" />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-white leading-none">Job ID Detected</p>
                                    <p className="text-[10px] font-mono text-purple-300 opacity-80">{results.vid1}</p>
                                </div>
                                <div className="text-[10px] font-bold px-2 py-1 bg-purple-500/40 rounded uppercase tracking-tighter">Live</div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            <footer className="pt-8 border-t border-white/5 flex justify-between items-center text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                <div>Environment: Local Dev (us-west1)</div>
                <div>Logic: Multimodal Chain Verification</div>
                <div className="text-purple-500 font-bold">Protocol: IS IT SPELLED IN CAPITAL LETTERS BOTH TIMES</div>
            </footer>
        </div>
    );
}

function GauntletStep({ num, title, status, detail }: { num: number, title: string, status: 'pending' | 'active' | 'complete', detail: string }) {
    const isPending = status === 'pending';
    const isActive = status === 'active';
    const isComplete = status === 'complete';

    return (
        <div className={`p-3 rounded-lg border transition-all duration-500 ${isActive ? 'bg-purple-900/30 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' :
            isComplete ? 'bg-green-900/10 border-green-500/30' :
                'bg-surface/30 border-white/5 opacity-50'
            }`}>
            <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-purple-500 text-white animate-pulse' :
                    isComplete ? 'bg-green-500 text-black' :
                        'bg-white/10 text-white'
                    }`}>
                    {isComplete ? <CheckCircle className="w-4 h-4" /> : num}
                </div>
                <div className="flex-1">
                    <p className={`text-xs font-bold ${isActive ? 'text-white' : isComplete ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {title}
                    </p>
                    <p className="text-[10px] opacity-60 leading-tight mt-0.5">{detail}</p>
                </div>
                {isActive && <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />}
            </div>
        </div>
    );
}
