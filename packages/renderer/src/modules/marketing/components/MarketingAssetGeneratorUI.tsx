import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Video, Wand2, ArrowRight, CheckCircle2, Download, RefreshCw, FileAudio } from 'lucide-react';

export default function MarketingAssetGeneratorUI() {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [style, setStyle] = useState<string>('cinematic');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [resultJobId, setResultJobId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generatorMode, setGeneratorMode] = useState<'reel' | 'avatar'>('reel');
    const [avatarImage, setAvatarImage] = useState<File | null>(null);
    const audioInputRef = useRef<HTMLInputElement | null>(null);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);

    const readAsDataUri = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });

    const handleGenerate = async () => {
        if (generatorMode === 'reel' && !prompt.trim()) return;
        if (generatorMode === 'avatar' && (!audioFile || !avatarImage)) return;

        setStep(3);
        setIsGenerating(true);
        setError(null);

        try {
            if (generatorMode === 'reel') {
                const { CampaignIntelligence } = await import('@/services/marketing/CampaignIntelligenceService');
                const url = await CampaignIntelligence.generateMarketingVideo(prompt, style);
                setVideoUrl(url);
                setResultJobId(null);
            } else {
                const { auth } = await import('@/services/firebase');
                const userId = auth.currentUser?.uid;
                if (!userId) {
                    throw new Error('You must be signed in to generate avatar video.');
                }
                const { CloudStorageService } = await import('@/services/CloudStorageService');
                const { avatarGenerationService } = await import('@/services/video/AvatarGenerationService');
                const audioUrl = await CloudStorageService.uploadAudio(
                    audioFile!,
                    `avatar_audio_${Date.now()}`,
                    userId,
                    audioFile!.type || 'audio/wav'
                );
                const imageDataUri = await readAsDataUri(avatarImage!);
                const imageUpload = await CloudStorageService.uploadImage(
                    imageDataUri,
                    `avatar_image_${Date.now()}`,
                    userId
                );
                const jobId = await avatarGenerationService.generateLipSync(imageUpload.url, audioUrl);
                setResultJobId(jobId);
                setVideoUrl(null);
            }
            setStep(4);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to generate asset');
            setStep(2);
        } finally {
            setIsGenerating(false);
        }
    };

    const reset = () => {
        setStep(1);
        setAudioFile(null);
        setAvatarImage(null);
        setPrompt('');
        setStyle('cinematic');
        setVideoUrl(null);
        setResultJobId(null);
        setError(null);
    };

    const handleExport = () => {
        if (!videoUrl) return;
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `marketing-video-${Date.now()}.mp4`;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const styles = [
        { id: 'cinematic', label: 'Cinematic', desc: 'Moody, high contrast, filmic look' },
        { id: 'anime', label: 'Anime', desc: 'Japanese animation style, vibrant' },
        { id: '3d-render', label: '3D Render', desc: 'Octane render, glossy, surreal' },
        { id: 'neon-cyberpunk', label: 'Cyberpunk', desc: 'Neon lights, futuristic, gritty' },
    ];

    return (
        <div className="h-full flex flex-col p-6 lg:p-10 relative overflow-y-auto custom-scrollbar">
            <input
                ref={audioInputRef}
                type="file"
                accept="audio/wav,audio/mpeg,audio/flac,audio/mp3"
                className="hidden"
                onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
            />
            <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => setAvatarImage(event.target.files?.[0] ?? null)}
            />
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-dept-marketing/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-4xl w-full mx-auto z-10 flex flex-col gap-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-linear-to-br from-dept-marketing to-purple-500 p-px shadow-lg shadow-dept-marketing/20">
                        <div className="w-full h-full bg-background rounded-[11px] flex items-center justify-center">
                            <Wand2 className="text-dept-marketing" size={24} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-base lg:text-lg font-black text-white uppercase tracking-tighter">
                            Short-Form Asset Generator
                        </h1>
                        <div className="flex items-center gap-4 mt-1">
                            <button
                                onClick={() => setGeneratorMode('reel')}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-colors ${generatorMode === 'reel' ? 'bg-dept-marketing text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
                            >
                                Cinematic Reel
                            </button>
                            <button
                                onClick={() => setGeneratorMode('avatar')}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-colors ${generatorMode === 'avatar' ? 'bg-dept-marketing text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
                            >
                                Autonomous Avatar Lip-Sync
                            </button>
                        </div>
                    </div>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4].map((s) => (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <React.Fragment {...({ key: s } as any)}>
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold transition-colors ${step === s
                                ? 'bg-dept-marketing border-dept-marketing text-white shadow-[0_0_15px_rgba(var(--color-dept-marketing),0.5)]'
                                : step > s
                                    ? 'bg-dept-marketing/20 border-dept-marketing text-dept-marketing'
                                    : 'bg-black/40 border-white/10 text-gray-500'
                                }`}>
                                {step > s ? <CheckCircle2 size={14} /> : s}
                            </div>
                            {s < 4 && (
                                <div className={`h-px flex-1 transition-colors ${step > s ? 'bg-dept-marketing/50' : 'bg-white/10'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Main Card */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 lg:p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden min-h-[450px] flex flex-col">
                    <AnimatePresence mode="wait">

                        {/* STEP 1: AUDIO SELECTION */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex-1 flex flex-col"
                            >
                                <h2 className="text-xl font-bold text-white mb-2">
                                    {generatorMode === 'avatar' ? 'Select Source Media' : 'Source Media'}
                                </h2>
                                <p className="text-sm text-gray-400 mb-6">
                                    {generatorMode === 'avatar'
                                        ? 'Choose the portrait and audio clip for the avatar render.'
                                        : 'Text-to-video generation starts from the visual direction in the next step.'}
                                </p>

                                <div
                                    className="flex-1 border-2 border-dashed border-white/10 hover:border-dept-marketing/50 bg-white/[0.02] hover:bg-dept-marketing/5 transition-all rounded-xl flex flex-col items-center justify-center cursor-pointer group p-8"
                                    onClick={() => audioInputRef.current?.click()}
                                >
                                    <div className="w-16 h-16 rounded-full bg-white/5 group-hover:bg-dept-marketing/20 text-gray-400 group-hover:text-dept-marketing flex items-center justify-center mb-4 transition-colors">
                                        {audioFile ? <FileAudio size={32} /> : <Upload size={32} />}
                                    </div>
                                    <h3 className="text-white font-semibold mb-1">
                                        {audioFile ? audioFile.name : 'Click or drag to upload audio'}
                                    </h3>
                                    <p className="text-gray-500 text-sm">
                                        {audioFile ? 'Ready to proceed' : 'WAV, MP3, or FLAC (max 60s)'}
                                    </p>
                                </div>

                                {generatorMode === 'avatar' && (
                                    <div className="mt-4 flex-1">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Target Avatar (Static Portrait)</h3>
                                        <div
                                            className="h-32 border-2 border-dashed border-white/10 hover:border-dept-marketing/50 bg-white/[0.02] hover:bg-dept-marketing/5 transition-all rounded-xl flex flex-col items-center justify-center cursor-pointer group p-4"
                                            onClick={() => avatarInputRef.current?.click()}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-dept-marketing/20 text-gray-400 group-hover:text-dept-marketing flex items-center justify-center mb-2 transition-colors">
                                                {avatarImage ? <CheckCircle2 size={20} /> : <Upload size={20} />}
                                            </div>
                                            <p className="text-white text-xs font-semibold">
                                                {avatarImage ? avatarImage.name : 'Upload Avatar Image'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end mt-8">
                                    <button
                                        disabled={generatorMode === 'avatar' && (!audioFile || !avatarImage)}
                                        onClick={() => setStep(2)}
                                        className="btn-primary bg-dept-marketing hover:bg-dept-marketing/80 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Continue <ArrowRight size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: PROMPT & STYLE */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="flex-1 flex flex-col"
                            >
                                <h2 className="text-xl font-bold text-white mb-2">Visual Direction</h2>
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg mb-4 flex items-center gap-2">
                                        <RefreshCw size={14} /> {error}
                                    </div>
                                )}
                                <p className="text-sm text-gray-400 mb-6">Describe what you want the Autonomous video to look like.</p>

                                <div className="space-y-6 flex-1">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Prompt</label>
                                        <textarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder="E.g., A lone astronaut floating through a neon-lit cyber city, synchronized to the beat..."
                                            className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-marketing/50 resize-none transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Aesthetic Style</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            {styles.map(s => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => setStyle(s.id)}
                                                    className={`cursor-pointer border rounded-xl p-4 transition-all ${style === s.id
                                                        ? 'bg-dept-marketing/10 border-dept-marketing text-white'
                                                        : 'bg-white/[0.02] border-white/5 text-gray-400 py-4 hover:border-white/20'
                                                        }`}
                                                >
                                                    <h4 className={`font-bold mb-1 ${style === s.id ? 'text-dept-marketing' : 'text-gray-300'}`}>{s.label}</h4>
                                                    <p className="text-[10px] opacity-80 leading-relaxed">{s.desc}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between mt-8">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        disabled={generatorMode === 'reel' ? !prompt.trim() : false}
                                        onClick={handleGenerate}
                                        className="btn-primary bg-linear-to-r from-dept-marketing to-purple-600 hover:opacity-90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(var(--color-dept-marketing),0.3)]"
                                    >
                                        <Wand2 size={18} /> {generatorMode === 'reel' ? 'Generate Video' : 'Begin Lip-Sync'}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: GENERATING */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                className="flex-1 flex flex-col items-center justify-center py-12"
                            >
                                <div className="relative w-32 h-32 mb-8">
                                    <div className="absolute inset-0 border-4 border-dept-marketing/20 rounded-full" />
                                    <div className="absolute inset-0 border-4 border-dept-marketing border-t-transparent rounded-full animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Video className="text-dept-marketing animate-pulse" size={40} />
                                    </div>
                                </div>
                                <h2 className="text-base font-black text-white mb-3">Synthesizing Visuals</h2>
                                <p className="text-gray-400 text-center max-w-sm">
                                    Rendering highly-detailed frames synced with your audio. This normally takes a few minutes via background job...
                                </p>
                            </motion.div>
                        )}

                        {/* STEP 4: RESULT */}
                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex-1 flex flex-col"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-white mb-1">
                                            {resultJobId ? 'Generation Job Queued' : 'Generation Complete'}
                                        </h2>
                                        <p className="text-sm text-green-400 flex items-center gap-1">
                                            <CheckCircle2 size={14} /> {resultJobId ? `Backend job: ${resultJobId}` : 'Video asset returned by generator'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={reset} className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                                            <RefreshCw size={18} />
                                        </button>
                                        <button
                                            onClick={handleExport}
                                            disabled={!videoUrl}
                                            className="flex items-center gap-2 px-4 py-2 bg-dept-marketing hover:bg-dept-marketing/80 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                                        >
                                            <Download size={16} /> Export
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 rounded-xl bg-black/60 border border-white/5 flex items-center justify-center relative overflow-hidden group">
                                    {videoUrl ? (
                                        <video
                                            src={videoUrl}
                                            controls
                                            className="w-full h-full object-contain"
                                        />
                                    ) : resultJobId ? (
                                        <div className="p-8 text-center">
                                            <CheckCircle2 className="mx-auto mb-4 text-green-400" size={36} />
                                            <p className="text-sm font-bold text-white">Avatar render is queued.</p>
                                            <p className="text-xs text-gray-500 mt-2 font-mono break-all">{resultJobId}</p>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-sm text-gray-400">
                                            No generated video URL was returned.
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
