import React, { useState, useRef } from 'react';
import {
    X,
    Upload,
    Music,
    Image as ImageIcon,
    Download,
    Trash2,
    Save,
    CheckCircle2,
    AlertCircle,
    Play,
    Pause,
    Sparkles,
} from 'lucide-react';
import {
    FreeMiniCampaignService,
    type MiniCampaignPack,
    type SaveOrDeleteResult,
} from '@/services/creative/FreeMiniCampaignService';
import { useToast } from '@/core/context/ToastContext';

interface FreeMiniCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId?: string;
    projectId?: string;
}

export const FreeMiniCampaignModal: React.FC<FreeMiniCampaignModalProps> = ({
    isOpen,
    onClose,
}) => {
    const toast = useToast();
    const [step, setStep] = useState<'intake' | 'preview' | 'decision'>('intake');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [visualFile, setVisualFile] = useState<File | null>(null);
    const [visualUrl, setVisualUrl] = useState<string>('');
    const [audioUrl, setAudioUrl] = useState<string>('');
    const [trackTitle, setTrackTitle] = useState<string>('');
    const [artistName, setArtistName] = useState<string>('');
    const [durationSeconds, setDurationSeconds] = useState<number>(180);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [pack, setPack] = useState<MiniCampaignPack | null>(null);
    const [decisionResult, setDecisionResult] = useState<SaveOrDeleteResult | null>(null);
    const [isPlayingTeaser, setIsPlayingTeaser] = useState<boolean>(false);

    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    if (!isOpen) return null;

    const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        try {
            FreeMiniCampaignService.validateAudioFile(file);
            setAudioFile(file);
            const objectUrl = URL.createObjectURL(file);
            setAudioUrl(objectUrl);

            // Auto-fill title from filename
            const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
            if (!trackTitle) setTrackTitle(cleanName);

            const duration = await FreeMiniCampaignService.getAudioDuration(file);
            setDurationSeconds(duration);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Invalid audio file');
            setAudioFile(null);
        }
    };

    const handleVisualSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        try {
            FreeMiniCampaignService.validateVisualFile(file);
            setVisualFile(file);
            const objectUrl = URL.createObjectURL(file);
            setVisualUrl(objectUrl);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Invalid visual file');
            setVisualFile(null);
        }
    };

    const handleGenerate = () => {
        if (!audioFile) {
            setError('Please upload an audio track.');
            return;
        }
        if (!visualUrl) {
            setError('Please upload an image visual.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const newPack = FreeMiniCampaignService.createMiniCampaignPack({
                title: trackTitle || 'My Track',
                artistName: artistName || 'Independent Artist',
                visualUrl,
                audioUrl,
                durationSeconds,
                clipStartSeconds: 0,
            });

            setPack(newPack);
            setStep('preview');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create mini-campaign pack');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadAll = () => {
        if (!pack) return;
        pack.assets.forEach((asset) => {
            FreeMiniCampaignService.downloadAsset(asset);
        });
        toast.success('Unwatermarked campaign pack assets downloaded successfully.');
        setStep('decision');
    };

    const handleSaveChoice = async (choice: 'save' | 'delete') => {
        if (!pack) return;
        setLoading(true);
        try {
            const result = await FreeMiniCampaignService.enforceSaveOrDelete(choice, pack);
            setDecisionResult(result);
            if (choice === 'save') {
                toast.success(result.message);
            } else {
                toast.info(result.message);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to enforce data choice');
        } finally {
            setLoading(false);
        }
    };

    const toggleTeaserPlay = () => {
        if (!audioPlayerRef.current) return;
        if (isPlayingTeaser) {
            audioPlayerRef.current.pause();
            setIsPlayingTeaser(false);
        } else {
            audioPlayerRef.current.currentTime = pack?.trackMeta.clipStartSeconds ?? 0;
            void audioPlayerRef.current.play();
            setIsPlayingTeaser(true);
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mini-campaign-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        >
            <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl md:p-8">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-5">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                            <Sparkles size={12} />
                            Verified Free Experience
                        </div>
                        <h2 id="mini-campaign-title" className="mt-2 text-2xl font-bold text-white">
                            Guided Free Mini-Campaign
                        </h2>
                        <p className="mt-1 text-sm text-neutral-400">
                            Coordinated unwatermarked release pack with full privacy: save or permanently delete.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close modal"
                        className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="py-6">
                    {error && (
                        <div
                            role="alert"
                            className="mb-5 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
                        >
                            <AlertCircle size={18} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 'intake' && (
                        <div className="space-y-6">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="track-title-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                                        Track Title
                                    </label>
                                    <input
                                        id="track-title-input"
                                        type="text"
                                        value={trackTitle}
                                        onChange={(e) => setTrackTitle(e.target.value)}
                                        placeholder="e.g. Electric Dreams"
                                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-900 px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-amber-400"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="artist-name-input" className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                                        Artist Name
                                    </label>
                                    <input
                                        id="artist-name-input"
                                        type="text"
                                        value={artistName}
                                        onChange={(e) => setArtistName(e.target.value)}
                                        placeholder="e.g. Marcus Vance"
                                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-900 px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-amber-400"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                {/* Audio Upload */}
                                <div className="rounded-xl border border-dashed border-white/15 bg-neutral-900/50 p-5 text-center transition-colors hover:border-amber-400/50">
                                    <Music className="mx-auto text-amber-400" size={32} />
                                    <div className="mt-3 text-sm font-semibold text-white">Finished Audio Track</div>
                                    <p className="mt-1 text-xs text-neutral-400">
                                        MP3, WAV, AAC, or FLAC up to 35MB (max 7 min)
                                    </p>
                                    <label className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-700">
                                        <Upload size={14} />
                                        {audioFile ? audioFile.name : 'Select song file'}
                                        <input
                                            type="file"
                                            accept="audio/*"
                                            className="hidden"
                                            onChange={handleAudioSelect}
                                        />
                                    </label>
                                    {audioFile && (
                                        <p className="mt-2 text-xs text-emerald-400">
                                            Loaded ({Math.round(durationSeconds)}s)
                                        </p>
                                    )}
                                </div>

                                {/* Visual Upload */}
                                <div className="rounded-xl border border-dashed border-white/15 bg-neutral-900/50 p-5 text-center transition-colors hover:border-amber-400/50">
                                    <ImageIcon className="mx-auto text-cyan-400" size={32} />
                                    <div className="mt-3 text-sm font-semibold text-white">Artwork Image</div>
                                    <p className="mt-1 text-xs text-neutral-400">
                                        PNG, JPEG, or WebP up to 15MB
                                    </p>
                                    <label className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-700">
                                        <Upload size={14} />
                                        {visualFile ? visualFile.name : 'Select image file'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleVisualSelect}
                                        />
                                    </label>
                                    {visualUrl && (
                                        <div className="mt-2 flex justify-center">
                                            <img
                                                src={visualUrl}
                                                alt="Visual preview"
                                                className="h-12 w-12 rounded object-cover"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={!audioFile || !visualUrl || loading}
                                className="w-full rounded-xl bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] py-3.5 text-sm font-black text-black shadow-lg transition-all hover:scale-[1.01] disabled:opacity-50"
                            >
                                {loading ? 'Building Mini-Campaign Pack...' : 'Generate Unwatermarked Campaign Pack'}
                            </button>
                        </div>
                    )}

                    {step === 'preview' && pack && (
                        <div className="space-y-6">
                            <div className="grid gap-4 sm:grid-cols-3">
                                {/* Square Cover */}
                                <div className="rounded-xl border border-white/10 bg-neutral-900 p-4">
                                    <div className="aspect-square overflow-hidden rounded-lg bg-black">
                                        <img
                                            src={visualUrl}
                                            alt="1:1 Cover"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="mt-3 font-semibold text-white">Square Cover</div>
                                    <p className="text-xs text-neutral-400">1:1 DSP & Release Artwork</p>
                                </div>

                                {/* Story Promo */}
                                <div className="rounded-xl border border-white/10 bg-neutral-900 p-4">
                                    <div className="aspect-[9/16] max-h-48 overflow-hidden rounded-lg bg-black">
                                        <img
                                            src={visualUrl}
                                            alt="9:16 Story"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="mt-3 font-semibold text-white">Story / Reel Promo</div>
                                    <p className="text-xs text-neutral-400">9:16 Portrait Social Asset</p>
                                </div>

                                {/* 8-Second Teaser */}
                                <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-neutral-900 p-4">
                                    <div>
                                        <div className="flex aspect-square items-center justify-center rounded-lg bg-black/60">
                                            <button
                                                type="button"
                                                onClick={toggleTeaserPlay}
                                                className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg hover:scale-105"
                                            >
                                                {isPlayingTeaser ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                                            </button>
                                        </div>
                                        <div className="mt-3 font-semibold text-white">8s Teaser Clip</div>
                                        <p className="text-xs text-neutral-400">Synchronized audio preview</p>
                                        <audio
                                            ref={audioPlayerRef}
                                            src={audioUrl}
                                            onEnded={() => setIsPlayingTeaser(false)}
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg bg-neutral-900/80 p-3.5 text-center text-xs text-amber-300">
                                ✨ 100% Unwatermarked. Zero forced branding. Keep your exports.
                            </div>

                            <button
                                type="button"
                                onClick={handleDownloadAll}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] py-3.5 text-sm font-black text-black shadow-lg hover:scale-[1.01]"
                            >
                                <Download size={18} />
                                Download Complete Pack (No Watermarks)
                            </button>
                        </div>
                    )}

                    {step === 'decision' && (
                        <div className="space-y-6">
                            {!decisionResult ? (
                                <>
                                    <div className="text-center">
                                        <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
                                        <h3 className="mt-3 text-lg font-bold text-white">
                                            Pack Exported Successfully
                                        </h3>
                                        <p className="mt-1 text-sm text-neutral-400">
                                            Now choose what to do with your uploaded audio and generated assets:
                                        </p>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {/* Save Option */}
                                        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-neutral-900 p-5">
                                            <div>
                                                <div className="flex items-center gap-2 text-base font-bold text-white">
                                                    <Save className="text-emerald-400" size={20} />
                                                    Save to My Project
                                                </div>
                                                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                                                    Keep these assets in your creative library so you can edit, extend, or release them in your artist workspace.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => handleSaveChoice('save')}
                                                className="mt-5 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                                            >
                                                Save to Library
                                            </button>
                                        </div>

                                        {/* Delete Option */}
                                        <div className="flex flex-col justify-between rounded-xl border border-red-500/20 bg-neutral-900 p-5">
                                            <div>
                                                <div className="flex items-center gap-2 text-base font-bold text-red-300">
                                                    <Trash2 className="text-red-400" size={20} />
                                                    Permanently Delete
                                                </div>
                                                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                                                    Purge the uploaded audio and all generated derivatives from cloud storage. Enforces complete privacy.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={loading}
                                                onClick={() => handleSaveChoice('delete')}
                                                className="mt-5 rounded-lg bg-red-600/90 py-2.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                                            >
                                                Permanently Delete All
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-xl border border-white/10 bg-neutral-900 p-6 text-center">
                                    <CheckCircle2 size={44} className="mx-auto text-emerald-400" />
                                    <h3 className="mt-3 text-lg font-bold text-white">Choice Enforced</h3>
                                    <p className="mt-2 text-sm text-neutral-300">{decisionResult.message}</p>
                                    <p className="mt-1 font-mono text-[10px] text-neutral-500">
                                        Audit timestamp: {decisionResult.timestamp}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="mt-6 rounded-lg bg-neutral-800 px-6 py-2.5 text-xs font-bold text-white hover:bg-neutral-700"
                                    >
                                        Close Experience
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
