import React, { useState } from 'react';
import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import { logger } from '@/utils/logger';
import { GauntletStep } from './components/GauntletStep';
import { GauntletPreview } from './components/GauntletPreview';

/**
 * MultimodalGauntlet — Debug tool for proving consistent AI generation.
 *
 * Executes a 4-step pipeline:
 *   1. Primary Image Generation
 *   2. Derivative Image (remix/consistency test)
 *   3. Video interpolation (start→end frame)
 *   4. Loop synchronization (reverse mapping)
 *
 * Architecture:
 * - GauntletStep    → Individual step status card (pending/active/complete)
 * - GauntletPreview → Live preview panel with loading overlay + video job badge
 */
export default function MultimodalGauntlet() {
    const { userProfile } = useStore(useShallow(state => ({
        userProfile: state.userProfile
    })));
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
            const img1 = img1Results[0]!.url;
            setResults(prev => ({ ...prev, img1 }));

            // STEP 2: IMAGE 2 (THE DERIVATIVE)
            setStep(2);
            const img2Results = await ImageGeneration.remixImage({
                contentImage: { mimeType: 'image/png', data: img1.split(',')[1] || img1 },
                styleImage: { mimeType: 'image/png', data: img1.split(',')[1] || img1 },
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
            setResults(prev => ({ ...prev, vid1: vid1Results[0]!.id }));

            // STEP 4: VIDEO 2 (LOOP PROOF)
            setStep(4);
            const vid2Results = await VideoGeneration.generateVideo({
                prompt: "Looping back to the original studio state. IS it spelled in capital letters both times.",
                firstFrame: img2,
                lastFrame: img1,
                userProfile
            });
            setResults(prev => ({ ...prev, vid2: vid2Results[0]!.id }));

            setStep(5);
            toast.success("Multimodal Gauntlet Triggered Successfully!");
        } catch (err: unknown) {
            logger.error("Gauntlet Failure:", err);
            const msg = err instanceof Error ? err.message : String(err);
            setErrors({ [step]: msg });
            toast.error(`Step ${step} failed: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { num: 1, title: "Primary Image Generation", detail: "Bypassing App Check locally for developer verification." },
        { num: 2, title: "Derivative Reference (Consistency)", detail: "Generating last frame from primary context." },
        { num: 3, title: "Temporal Interpolation (Video)", detail: "Veo 3.1: Startframe -> Endframe mapping." },
        { num: 4, title: "Loop Synchronization", detail: "Inverse mapping for seamless loop." },
    ];

    const getStepStatus = (num: number) => {
        if (step > num) return 'complete' as const;
        if (step === num) return 'active' as const;
        return 'pending' as const;
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
                        {steps.map(s => (
                            <GauntletStep
                                key={s.num}
                                num={s.num}
                                title={s.title}
                                status={getStepStatus(s.num)}
                                detail={s.detail}
                            />
                        ))}
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
                    <GauntletPreview
                        loading={loading}
                        step={step}
                        resultImage={results.img1}
                        videoJobId={results.vid1}
                    />
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
