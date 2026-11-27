import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, Video, Wand2, ArrowRight, CheckCircle2, Download, RefreshCw, FileAudio, Sparkles, LayoutGrid } from 'lucide-react';
import { featureFlags, FEATURE_FLAG_NAMES } from '@/config/featureFlags';
import { useStore } from '@/core/store';
import type { ShortFormHookCandidate } from '@/services/marketing/ShortFormReelService';
import type { AdMatrixRunReport } from '@/services/marketing/MultiShapeAdMatrixService';
import type { AdAspectShape, AdDurationSec } from '@indii/video-compiler';
import type { ReleaseLaunchKit, ScoredAdVariantRecord } from '@indii/shared';

export default function MarketingAssetGeneratorUI() {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [style, setStyle] = useState<string>('cinematic');
    const [showMoreStyles, setShowMoreStyles] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isGenerating, setIsGenerating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [resultJobId, setResultJobId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generatorMode, setGeneratorMode] = useState<'reel' | 'audio-reel' | 'ad-matrix' | 'avatar'>('reel');
    const [avatarImage, setAvatarImage] = useState<File | null>(null);
    const [detectedHooks, setDetectedHooks] = useState<ShortFormHookCandidate[]>([]);
    const [selectedHookIndex, setSelectedHookIndex] = useState<number>(0);
    const [isDetectingHooks, setIsDetectingHooks] = useState<boolean>(false);
    const [hookHeadline, setHookHeadline] = useState<string>('');
    const [adMatrixShapes, setAdMatrixShapes] = useState<AdAspectShape[]>(['9:16', '1:1', '4:5', '16:9']);
    const [adMatrixDurations, setAdMatrixDurations] = useState<AdDurationSec[]>([15]);
    const [adMatrixCta, setAdMatrixCta] = useState<string>('Stream now');
    const [adMatrixFootageUrl, setAdMatrixFootageUrl] = useState<string>('');
    const [adMatrixSmartLinkUrl, setAdMatrixSmartLinkUrl] = useState<string>('');
    const [adMatrixReport, setAdMatrixReport] = useState<AdMatrixRunReport | null>(null);
    const [launchKit, setLaunchKit] = useState<ReleaseLaunchKit | null>(null);
    const [isBuildingLaunchKit, setIsBuildingLaunchKit] = useState<boolean>(false);
    const artistDisplayName = useStore(state => state.userProfile?.displayName) || 'Artist';
    const audioInputRef = useRef<HTMLInputElement | null>(null);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const avatarGenerationEnabled = featureFlags.isEnabled(FEATURE_FLAG_NAMES.AVATAR_GENERATION);

    const toggleAdShape = (shape: AdAspectShape) => {
        setAdMatrixShapes(prev =>
            prev.includes(shape) ? prev.filter(item => item !== shape) : [...prev, shape],
        );
    };

    const toggleAdDuration = (duration: AdDurationSec) => {
        setAdMatrixDurations(prev =>
            prev.includes(duration) ? prev.filter(item => item !== duration) : [...prev, duration].sort((a, b) => a - b),
        );
    };

    const handleAudioSelected = async (file: File | null) => {
        setAudioFile(file);
        setDetectedHooks([]);
        setSelectedHookIndex(0);
        setError(null);
        if (!file || generatorMode !== 'audio-reel') return;
        setIsDetectingHooks(true);
        try {
            const { ShortFormReelService } = await import('@/services/marketing/ShortFormReelService');
            const { hooks } = await ShortFormReelService.detectHooks(file);
            setDetectedHooks(hooks);
            if (hooks[0]?.lyricSnippet) {
                setHookHeadline(hooks[0].lyricSnippet);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to detect song hooks.');
        } finally {
            setIsDetectingHooks(false);
        }
    };

    const readAsDataUri = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });

    const handleGenerate = async () => {
        if (generatorMode === 'reel' && !prompt.trim()) return;
        if (generatorMode === 'audio-reel' && (!audioFile || !prompt.trim())) return;
        if (generatorMode === 'ad-matrix' && (!hookHeadline.trim() || !adMatrixFootageUrl.trim() || adMatrixShapes.length === 0 || adMatrixDurations.length === 0)) return;
        if (generatorMode === 'avatar' && (!audioFile || !avatarImage)) return;
        if (generatorMode === 'avatar' && !avatarGenerationEnabled) {
            setError('Avatar generation is unavailable until the backend worker is deployed.');
            return;
        }

        setStep(3);
        setIsGenerating(true);
        setLaunchKit(null);
        setError(null);

        try {
            if (generatorMode === 'reel') {
                const { CampaignIntelligence } = await import('@/services/marketing/CampaignIntelligenceService');
                const url = await CampaignIntelligence.generateMarketingVideo(prompt, style);
                setVideoUrl(url);
                setResultJobId(null);
            } else if (generatorMode === 'audio-reel') {
                const { ShortFormReelService } = await import('@/services/marketing/ShortFormReelService');
                const activeHook: ShortFormHookCandidate = detectedHooks[selectedHookIndex] ?? {
                    section: 'CHORUS',
                    startTimeSeconds: 0,
                    endTimeSeconds: 15,
                    durationSeconds: 15,
                    energyLevel: 'high',
                    lyricSnippet: hookHeadline,
                };
                const { url: hookAudioUrl } = await ShortFormReelService.extractHookAudio(audioFile!, activeHook);
                const result = await ShortFormReelService.generateHookReel({
                    trackTitle: audioFile!.name.replace(/\.[^/.]+$/, ''),
                    artistName: artistDisplayName,
                    hook: activeHook,
                    hookAudioUrl,
                    visualPrompt: prompt,
                    style,
                    aspectRatio: '9:16',
                    hookHeadline: hookHeadline || activeHook.lyricSnippet,
                });
                setVideoUrl(result.videoUrl);
                setResultJobId(result.project.id);
            } else if (generatorMode === 'ad-matrix') {
                const { MultiShapeAdMatrixService } = await import('@/services/marketing/MultiShapeAdMatrixService');
                const report = await MultiShapeAdMatrixService.generateAndScoreMatrix({
                    campaignId: `camp_ui_${Date.now()}`,
                    title: prompt.trim() || hookHeadline.trim(),
                    brandOrArtistName: artistDisplayName,
                    hookHeadline: hookHeadline.trim(),
                    ctaText: adMatrixCta.trim() || 'Stream now',
                    verticalFootageUrl: adMatrixFootageUrl.trim(),
                    shapes: adMatrixShapes,
                    durations: adMatrixDurations,
                });
                setAdMatrixReport(report);
                setVideoUrl(null);
                setResultJobId(report.campaignId);
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
                    `avatar_audio_${crypto.randomUUID()}`,
                    userId,
                    audioFile!.type || 'audio/wav'
                );
                const imageDataUri = await readAsDataUri(avatarImage!);
                const imageUpload = await CloudStorageService.uploadImage(
                    imageDataUri,
                    `avatar_image_${crypto.randomUUID()}`,
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
        setShowMoreStyles(false);
        setVideoUrl(null);
        setResultJobId(null);
        setAdMatrixReport(null);
        setLaunchKit(null);
        setError(null);
    };

    const handleBuildLaunchKit = async () => {
        if (!adMatrixReport || isBuildingLaunchKit) return;
        setIsBuildingLaunchKit(true);
        setError(null);
        try {
            const { CampaignIntelligence } = await import('@/services/marketing/CampaignIntelligenceService');
            const adVariants: ScoredAdVariantRecord[] = [
                ...adMatrixReport.approvedVariants,
                ...adMatrixReport.heldBackVariants,
            ].map((item) => ({
                variantId: item.variant.variantId,
                shape: item.variant.shape,
                durationSeconds: item.variant.durationSeconds,
                channelLabel: item.variant.channelLabel,
                overallScore: item.evaluation.bestScore?.overallScore ?? 0,
                brandQcApproved: item.evaluation.brandQc ? item.evaluation.brandQc.approved : item.evaluation.approved,
                approved: item.evaluation.approved,
                discardedForRegression: item.evaluation.discardedForRegression,
                attemptsUsed: item.evaluation.attemptsUsed,
                gapsFound: item.evaluation.bestScore?.gapsFound ?? item.evaluation.brandQc?.reason ?? 'None',
            }));

            const builtKit = await CampaignIntelligence.generateReleaseLaunchKit({
                title: prompt.trim() || hookHeadline.trim(),
                artistOrBrandName: artistDisplayName,
                topic: hookHeadline.trim(),
                ...(adMatrixSmartLinkUrl.trim() ? { smartLinkUrl: adMatrixSmartLinkUrl.trim() } : {}),
                adVariants,
            });
            setLaunchKit(builtKit);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unable to build Release Launch Kit.');
        } finally {
            setIsBuildingLaunchKit(false);
        }
    };

    const handleExport = () => {
        if (!videoUrl) return;
        const link = document.createElement('a');
        link.href = videoUrl;
        link.download = `marketing-video-${crypto.randomUUID().substring(0, 8)}.mp4`;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleDownloadLaunchKitJson = () => {
        if (!launchKit) return;
        const blob = new Blob([JSON.stringify(launchKit, null, 2)], { type: 'application/json' });
        const objectUrl = URL.createObjectURL(blob);
        try {
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `${launchKit.kitId}.json`;
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            link.remove();
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    };

    const styles = [
        { id: 'cinematic', label: 'Cinematic', desc: 'Moody, high contrast, filmic look' },
        { id: 'anime', label: 'Anime', desc: 'Japanese animation style, vibrant' },
        { id: '3d-render', label: '3D Render', desc: 'Octane render, glossy, surreal' },
        { id: 'analog-film', label: 'Analog Film', desc: 'Warm grain, soft halation, vintage color' },
        { id: 'documentary', label: 'Documentary', desc: 'Candid framing, natural light, lived-in detail' },
        { id: 'stop-motion', label: 'Stop Motion', desc: 'Handcrafted textures, tactile sets, playful movement' },
        { id: 'watercolor', label: 'Watercolor', desc: 'Flowing pigment, paper textures, soft washes' },
        { id: 'editorial', label: 'Editorial', desc: 'Bold composition, refined lighting, graphic simplicity' },
        { id: 'soulful-monochrome', label: 'Soulful Monochrome', desc: 'Rich black and white, expressive shadows, timeless mood' },
        { id: 'dreamlike', label: 'Dreamlike', desc: 'Soft focus, floating forms, gentle surrealism' },
        { id: 'collage', label: 'Collage', desc: 'Cut-paper layers, mixed media, rhythmic transitions' },
        { id: 'retro-print', label: 'Retro Print', desc: 'Screen-print texture, limited palettes, poster-inspired forms' },
    ];

    return (
        <div className="h-full flex flex-col p-6 lg:p-6 relative overflow-y-auto custom-scrollbar">
            <input
                ref={audioInputRef}
                type="file"
                accept="audio/wav,audio/mpeg,audio/flac,audio/mp3"
                className="hidden"
                onChange={(event) => void handleAudioSelected(event.target.files?.[0] ?? null)}
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

            <div className="max-w-4xl w-full mx-auto z-10 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-linear-to-br from-dept-marketing to-green-500 p-px shadow-lg shadow-dept-marketing/20">
                        <div className="w-full h-full bg-background rounded-[11px] flex items-center justify-center">
                            <Wand2 className="text-dept-marketing" size={24} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-base lg:text-lg font-black text-white uppercase tracking-tighter">
                            Short-Form Asset Generator
                        </h1>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <button
                                onClick={() => setGeneratorMode('reel')}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-colors ${generatorMode === 'reel' ? 'bg-dept-marketing text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
                            >
                                Cinematic Reel
                            </button>
                            <button
                                onClick={() => setGeneratorMode('audio-reel')}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${generatorMode === 'audio-reel' ? 'bg-dept-marketing text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
                            >
                                <Sparkles size={10} /> Audio-Synced Hook Reel
                            </button>
                            <button
                                onClick={() => setGeneratorMode('ad-matrix')}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${generatorMode === 'ad-matrix' ? 'bg-dept-marketing text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
                            >
                                <LayoutGrid size={10} /> Multi-Shape Ad Matrix
                            </button>
                            <button
                                onClick={() => setGeneratorMode('avatar')}
                                disabled={!avatarGenerationEnabled}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded transition-colors ${generatorMode === 'avatar' ? 'bg-dept-marketing text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'} ${!avatarGenerationEnabled ? 'opacity-40 cursor-not-allowed hover:text-gray-500' : ''}`}
                            >
                                Autonomous Avatar Lip-Sync{!avatarGenerationEnabled ? ' (Unavailable)' : ''}
                            </button>
                        </div>
                        {!avatarGenerationEnabled && (
                            <p className="mt-2 text-[10px] text-neutral-500">
                                Avatar lip-sync is unavailable until the backend worker is deployed.
                            </p>
                        )}
                    </div>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4].map((s) => (
                        <React.Fragment key={s}>
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
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 lg:p-6 backdrop-blur-3xl shadow-2xl relative overflow-hidden min-h-[450px] flex flex-col">
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
                                    {generatorMode === 'avatar'
                                        ? 'Select Source Media'
                                        : generatorMode === 'ad-matrix'
                                            ? 'Select Ad Shapes & Durations'
                                            : 'Source Media'}
                                </h2>
                                <p className="text-sm text-gray-400 mb-6">
                                    {generatorMode === 'avatar'
                                        ? 'Choose the portrait and audio clip for the avatar render.'
                                        : generatorMode === 'ad-matrix'
                                            ? 'Compile parallel cuts with Jev pre-flight refinement and Gemini /10 scorecard gating.'
                                            : 'Text-to-video generation starts from the visual direction in the next step.'}
                                </p>

                                {/* ISSUE-954: reel mode is text-to-video only — GenAI.generateVideo
                                    never receives or conditions on audio, so this upload step only
                                    appears for avatar mode, where the audio genuinely drives lip-sync. */}
                                {generatorMode === 'ad-matrix' ? (
                                    <div className="flex-1 space-y-6">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Target Aspect Shapes</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {(['9:16', '1:1', '4:5', '16:9'] as AdAspectShape[]).map((shape) => {
                                                    const selected = adMatrixShapes.includes(shape);
                                                    return (
                                                        <button
                                                            key={shape}
                                                            type="button"
                                                            aria-pressed={selected}
                                                            onClick={() => toggleAdShape(shape)}
                                                            className={`p-3 rounded-xl border text-left transition-all ${selected ? 'bg-dept-marketing/15 border-dept-marketing text-white' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/25'}`}
                                                        >
                                                            <div className="font-mono font-bold text-sm">{shape}</div>
                                                            <div className="text-[10px] opacity-75">
                                                                {shape === '9:16' ? 'Reels / TikTok / Shorts' : shape === '1:1' ? 'X / Square Feed' : shape === '4:5' ? 'Meta / IG Feed' : 'YouTube / Web Hero'}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Cut Durations</p>
                                            <div className="flex flex-wrap gap-3">
                                                {([6, 15, 30] as AdDurationSec[]).map((dur) => {
                                                    const selected = adMatrixDurations.includes(dur);
                                                    return (
                                                        <button
                                                            key={dur}
                                                            type="button"
                                                            aria-pressed={selected}
                                                            onClick={() => toggleAdDuration(dur)}
                                                            className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all ${selected ? 'bg-dept-marketing/15 border-dept-marketing text-white' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/25'}`}
                                                        >
                                                            {dur}s
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ) : generatorMode === 'avatar' || generatorMode === 'audio-reel' ? (
                                    <div className="flex-1 flex flex-col gap-4">
                                        <div
                                            className="flex-1 border-2 border-dashed border-white/10 hover:border-dept-marketing/50 bg-white/[0.02] hover:bg-dept-marketing/5 transition-all rounded-xl flex flex-col items-center justify-center cursor-pointer group p-6"
                                            onClick={() => audioInputRef.current?.click()}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-dept-marketing/20 text-gray-400 group-hover:text-dept-marketing flex items-center justify-center mb-4 transition-colors">
                                                {audioFile ? <FileAudio size={20} /> : <Upload size={20} />}
                                            </div>
                                            <h3 className="text-white font-semibold mb-1">
                                                {audioFile ? audioFile.name : 'Click or drag to upload track'}
                                            </h3>
                                            <p className="text-gray-500 text-sm">
                                                {isDetectingHooks
                                                    ? 'Analyzing track with Gemini to find your best 15s hooks...'
                                                    : audioFile
                                                        ? 'Ready to proceed'
                                                        : 'WAV, MP3, or FLAC'}
                                            </p>
                                        </div>
                                        {generatorMode === 'audio-reel' && detectedHooks.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detected Hook Windows</p>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                    {detectedHooks.map((hook, idx) => (
                                                        <button
                                                            key={`${hook.section}-${hook.startTimeSeconds}`}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedHookIndex(idx);
                                                                if (hook.lyricSnippet) setHookHeadline(hook.lyricSnippet);
                                                            }}
                                                            className={`text-left p-3 rounded-xl border transition-all ${selectedHookIndex === idx ? 'bg-dept-marketing/15 border-dept-marketing text-white' : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/25'}`}
                                                        >
                                                            <div className="text-xs font-bold uppercase">{hook.section} · {hook.durationSeconds}s</div>
                                                            <div className="text-[11px] opacity-75">{hook.startTimeSeconds.toFixed(1)}s – {hook.endTimeSeconds.toFixed(1)}s ({hook.energyLevel})</div>
                                                            {hook.lyricSnippet && (
                                                                <div className="text-[10px] mt-1 truncate opacity-90">&ldquo;{hook.lyricSnippet}&rdquo;</div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-1 border-2 border-dashed border-white/10 bg-white/[0.02] rounded-xl flex flex-col items-center justify-center p-6">
                                        <Video size={20} className="text-gray-500 mb-4" />
                                        <p className="text-gray-500 text-sm text-center max-w-xs">
                                            Cinematic Reel mode generates video from your text prompt only — no audio is uploaded or synchronized.
                                        </p>
                                    </div>
                                )}

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
                                        disabled={
                                            (generatorMode === 'avatar' && (!audioFile || !avatarImage)) ||
                                            (generatorMode === 'audio-reel' && (!audioFile || isDetectingHooks)) ||
                                            (generatorMode === 'ad-matrix' && (adMatrixShapes.length === 0 || adMatrixDurations.length === 0))
                                        }
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
                                <p className="text-sm text-gray-400 mb-6">Describe what you want the video to look like.</p>

                                <div className="space-y-6 flex-1">
                                    {generatorMode === 'ad-matrix' ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Hook Headline</label>
                                                <input
                                                    type="text"
                                                    value={hookHeadline}
                                                    onChange={(e) => setHookHeadline(e.target.value)}
                                                    placeholder="E.g., Drop Friday — Out Now"
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-marketing/50 transition-colors"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Call to Action (CTA)</label>
                                                    <input
                                                        type="text"
                                                        value={adMatrixCta}
                                                        onChange={(e) => setAdMatrixCta(e.target.value)}
                                                        placeholder="E.g., Stream Now / Pre-Save"
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-marketing/50 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Source Hero Footage URL</label>
                                                    <input
                                                        type="text"
                                                        value={adMatrixFootageUrl}
                                                        onChange={(e) => setAdMatrixFootageUrl(e.target.value)}
                                                        placeholder="https://... or gs://..."
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-marketing/50 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Campaign Title (Optional)</label>
                                                    <input
                                                        type="text"
                                                        value={prompt}
                                                        onChange={(e) => setPrompt(e.target.value)}
                                                        placeholder="Optional internal campaign label"
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-marketing/50 transition-colors"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">SmartLink URL (Optional)</label>
                                                    <input
                                                        type="text"
                                                        value={adMatrixSmartLinkUrl}
                                                        onChange={(e) => setAdMatrixSmartLinkUrl(e.target.value)}
                                                        placeholder="https://indii.link/... (Optional SmartLink)"
                                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-marketing/50 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Prompt</label>
                                                <textarea
                                                    value={prompt}
                                                    onChange={(e) => setPrompt(e.target.value)}
                                                    placeholder="E.g., A slow tracking shot through a recording studio, warm amber light, film grain..."
                                                    className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-dept-marketing/50 resize-none transition-colors"
                                                />
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aesthetic Style</span>
                                                    <button
                                                        type="button"
                                                        aria-expanded={showMoreStyles}
                                                        aria-controls="marketing-aesthetic-styles"
                                                        onClick={() => setShowMoreStyles(value => !value)}
                                                        className="text-xs font-medium text-dept-marketing rounded px-2 py-1 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dept-marketing"
                                                    >
                                                        {showMoreStyles ? 'Fewer styles' : 'More styles'}
                                                    </button>
                                                </div>
                                                <div id="marketing-aesthetic-styles" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                                    {styles.filter((s, index) => showMoreStyles || index < 3 || s.id === style).map(s => (
                                                        <button
                                                            type="button"
                                                            key={s.id}
                                                            aria-pressed={style === s.id}
                                                            onClick={() => {
                                                                setStyle(s.id);
                                                                setShowMoreStyles(false);
                                                            }}
                                                            className={`cursor-pointer text-left border rounded-xl p-4 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dept-marketing ${style === s.id
                                                                ? 'bg-dept-marketing/10 border-dept-marketing text-white'
                                                                : 'bg-white/[0.02] border-white/5 text-gray-400 py-4 hover:border-white/20'
                                                                }`}
                                                        >
                                                            <span className={`block font-bold mb-1 ${style === s.id ? 'text-dept-marketing' : 'text-gray-300'}`}>{s.label}</span>
                                                            <span className="block text-[10px] opacity-80 leading-relaxed">{s.desc}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex justify-between mt-8">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        disabled={
                                            (generatorMode === 'ad-matrix' && (!hookHeadline.trim() || !adMatrixFootageUrl.trim())) ||
                                            ((generatorMode === 'reel' || generatorMode === 'audio-reel') && !prompt.trim())
                                        }
                                        onClick={handleGenerate}
                                        className="btn-primary bg-linear-to-r from-dept-marketing to-green-600 hover:opacity-90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(var(--color-dept-marketing),0.3)]"
                                    >
                                        <Wand2 size={18} /> {generatorMode === 'avatar' ? 'Begin Lip-Sync' : generatorMode === 'ad-matrix' ? 'Compile & Score Matrix' : 'Generate Video'}
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
                                className="flex-1 flex flex-col items-center justify-center py-8"
                            >
                                <div className="relative w-32 h-32 mb-8">
                                    <div className="absolute inset-0 border-4 border-dept-marketing/20 rounded-full" />
                                    <div className="absolute inset-0 border-4 border-dept-marketing border-t-transparent rounded-full animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Video className="text-dept-marketing animate-pulse" size={24} />
                                    </div>
                                </div>
                                <h2 className="text-base font-black text-white mb-3">Creating visuals</h2>
                                <p className="text-gray-400 text-center max-w-sm">
                                    {generatorMode === 'avatar'
                                        ? 'Rendering the avatar lip-sync from your audio and portrait. This normally takes a few minutes via background job...'
                                        : 'Rendering highly-detailed frames from your prompt. This normally takes a few minutes via background job...'}
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
                                            {generatorMode === 'ad-matrix' && adMatrixReport
                                                ? 'Ad Matrix Report'
                                                : videoUrl
                                                    ? 'Generation Complete'
                                                    : resultJobId
                                                        ? 'Generation Job Queued'
                                                        : 'Generation Complete'}
                                        </h2>
                                        <p className="text-sm text-green-400 flex items-center gap-1">
                                            <CheckCircle2 size={14} />{' '}
                                            {generatorMode === 'ad-matrix' && adMatrixReport
                                                ? `${adMatrixReport.approvedVariants.length} approved · ${adMatrixReport.heldBackVariants.length} held back`
                                                : videoUrl
                                                    ? 'Video asset returned by generator'
                                                    : resultJobId
                                                        ? `Backend job: ${resultJobId}`
                                                        : 'Video asset returned by generator'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {generatorMode === 'ad-matrix' && adMatrixReport && (
                                            <button
                                                type="button"
                                                onClick={() => void handleBuildLaunchKit()}
                                                disabled={isBuildingLaunchKit}
                                                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                                            >
                                                <Sparkles size={14} /> {isBuildingLaunchKit ? 'Building Kit...' : 'Build Release Launch Kit'}
                                            </button>
                                        )}
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

                                {error && (
                                    <div
                                        role="alert"
                                        className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg mb-4 flex items-center gap-2"
                                    >
                                        <RefreshCw size={14} /> {error}
                                    </div>
                                )}

                                <div className="flex-1 rounded-xl bg-black/60 border border-white/5 flex items-center justify-center relative overflow-hidden group">
                                    {generatorMode === 'ad-matrix' && adMatrixReport ? (
                                        <div className="w-full h-full p-4 overflow-y-auto space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {[...adMatrixReport.approvedVariants, ...adMatrixReport.heldBackVariants].map((item) => {
                                                    const score = item.evaluation.bestScore?.overallScore;
                                                    return (
                                                        <div
                                                            key={item.variant.variantId}
                                                            className={`p-3 rounded-xl border ${item.evaluation.approved ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                                <span className="font-mono text-xs font-bold text-white">
                                                                    {item.variant.shape} · {item.variant.durationSeconds}s
                                                                </span>
                                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${item.evaluation.approved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                                                    {item.evaluation.approved ? 'Approved' : 'Held Back'}
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-gray-300 mb-1">{item.variant.channelLabel}</div>
                                                            <div className="flex items-center gap-2 text-[11px] font-mono text-gray-300">
                                                                <span>{typeof score === 'number' ? `${score.toFixed(1)}/10` : 'Awaiting visual inspection'}</span>
                                                                <span>· Jev {item.jevVerdict.compositeScore.toFixed(1)}</span>
                                                                {item.jevImproved && (
                                                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">Jev Refined</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 mt-1">
                                                                {item.evaluation.bestScore?.gapsFound ?? item.evaluation.brandQc?.reason ?? 'Pending keyframe inspection'}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {launchKit && (
                                                <div data-testid="release-launch-kit-panel" className="border-t border-white/10 pt-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                                                            Release Launch Kit · {launchKit.kitId}
                                                        </span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[11px] text-gray-400">
                                                                {launchKit.socialPosts.length} coordinated channel posts
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={handleDownloadLaunchKitJson}
                                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors"
                                                            >
                                                                <Download size={12} /> Download Launch Kit JSON
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {launchKit.socialPosts.map((post) => (
                                                            <div key={post.id} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 space-y-1">
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="font-bold text-white">{post.platform}</span>
                                                                    <span className="font-mono text-gray-400">
                                                                        {post.attachedVariantId || 'banner-copy'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-gray-300 line-clamp-2">{post.copy}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : videoUrl ? (
                                        <video
                                            src={videoUrl}
                                            controls
                                            className="w-full h-full object-contain"
                                        />
                                    ) : resultJobId ? (
                                        <div className="p-6 text-center">
                                            <CheckCircle2 className="mx-auto mb-4 text-green-400" size={20} />
                                            <p className="text-sm font-bold text-white">Avatar render is queued.</p>
                                            <p className="text-xs text-gray-500 mt-2 font-mono break-all">{resultJobId}</p>
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-sm text-gray-400">
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
