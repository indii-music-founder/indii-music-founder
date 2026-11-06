import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { useVideoEditorStore } from '../video/store/videoEditorStore';
import { CREATIVE_JOURNEY_LIMITS } from '../creativeJourney';
import { FreeMiniCampaignModal } from './FreeMiniCampaignModal';
import {
    Sparkles,
    ChevronDown,
    ChevronUp,
    Compass,
    Film,
    Music,
    Scissors,
    Smartphone,
    Users,
    Palette,
    Rocket,
    X,
} from 'lucide-react';
import {
    judgeCreativeJourneyIntent,
    type CreativeJourneyVerdict,
} from '@/config/typesafeJudgments';

const CharacterLibrary = lazy(() =>
    import('./CharacterLibrary').then((module) => ({ default: module.CharacterLibrary }))
);

export default function CreativeJourney() {
    const [faces, setFaces] = useState(false);
    const [isMiniCampaignOpen, setIsMiniCampaignOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            return params.get('mode') === 'free_demo' || params.get('demo') === 'true';
        }
        return false;
    });

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [verdict, setVerdict] = useState<CreativeJourneyVerdict | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const viewMode = useStore((state) => state.viewMode);
    const generationMode = useStore((state) => state.generationMode);
    const creativePrompt = useStore((state) => state.creativePrompt);
    const videoInputs = useStore((state) => state.videoInputs);
    const setViewMode = useStore((state) => state.setViewMode);
    const setGenerationMode = useStore((state) => state.setGenerationMode);

    // JEV System One Ambient Flow Guide
    useEffect(() => {
        let isCurrent = true;
        const hasAudio = Boolean(videoInputs?.ingredients?.some((item: any) => item.type === 'audio'));
        const hasVideo = Boolean(videoInputs?.ingredients?.some((item: any) => item.type === 'video'));
        const hasImage = Boolean(videoInputs?.ingredients?.some((item: any) => item.type === 'image'));

        void judgeCreativeJourneyIntent({
            prompt: creativePrompt,
            hasAudio,
            hasVideo,
            hasImage,
            currentMode: generationMode as 'image' | 'video' | 'omni',
            currentView: viewMode,
        }).then((res) => {
            if (isCurrent) {
                setVerdict(res);
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [creativePrompt, generationMode, viewMode, videoInputs]);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const openVideo = (mode: 'director' | 'editor' | 'storyboard', message: string) => {
        useVideoEditorStore.getState().setViewMode(mode);
        setViewMode('video_production');
        setGenerationMode('video');
        setIsMenuOpen(false);
    };

    const handleApplyVerdict = () => {
        if (!verdict) return;
        if (verdict.recommendedJourney === 'guided_campaign') {
            setIsMiniCampaignOpen(true);
            return;
        }
        if (verdict.recommendedJourney === 'band_references') {
            setFaces(true);
            return;
        }
        if (verdict.targetGenMode === 'video' && verdict.targetVideoSubView) {
            useVideoEditorStore.getState().setViewMode(verdict.targetVideoSubView);
        }
        setViewMode(verdict.targetViewMode);
        setGenerationMode(verdict.targetGenMode);
    };

    if (isDismissed) {
        return (
            <div className="flex justify-end px-3 py-0.5 border-t border-white/5 bg-[#060608]/50">
                <button
                    type="button"
                    onClick={() => setIsDismissed(false)}
                    className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1 py-0.5 transition-colors"
                    title="Show studio flow guide"
                    data-testid="show-creative-journey-btn"
                >
                    <Compass size={11} />
                    <span>Flow Guide</span>
                </button>
            </div>
        );
    }

    return (
        <section
            aria-label="Artist creative journey"
            data-testid="creative-journey-flow-strip"
            className="border-t border-white/5 bg-[#060608]/70 backdrop-blur-md px-3 py-1.5 transition-all text-xs"
        >
            <div className="flex items-center justify-between gap-3 min-w-0">
                {/* Left: Ambient Jev Flow Guide */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-dept-creative/10 border border-dept-creative/20 text-dept-creative">
                        <Sparkles size={11} className="animate-pulse" />
                        <span className="text-[10px] font-mono font-bold tracking-wider uppercase">FLOW</span>
                    </div>

                    <p
                        role="status"
                        data-testid="creative-journey-headline"
                        className="text-xs text-gray-300 font-medium truncate"
                    >
                        {verdict?.headline || 'Start with your finished song, photos, or phone footage. Keep what you want, then export.'}
                    </p>

                    {verdict?.actionLabel && (
                        <button
                            type="button"
                            onClick={handleApplyVerdict}
                            data-testid="creative-journey-action-btn"
                            className="shrink-0 px-2.5 py-1 bg-dept-creative/20 hover:bg-dept-creative/35 text-white border border-dept-creative/40 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm"
                        >
                            <span>{verdict.actionLabel}</span>
                        </button>
                    )}
                </div>

                {/* Right: Quick Journeys Menu + Dismiss */}
                <div className="flex items-center gap-1.5 shrink-0" ref={menuRef}>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            data-testid="creative-journeys-menu-trigger"
                            aria-expanded={isMenuOpen}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-[11px] font-semibold"
                        >
                            <Compass size={12} className="text-gray-400" />
                            <span>Journeys</span>
                            <ChevronDown size={11} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isMenuOpen && (
                            <div
                                data-testid="creative-journeys-menu"
                                className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-white/10 bg-[#0d0d12]/95 backdrop-blur-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-150"
                            >
                                <div className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest text-gray-500 font-bold border-b border-white/5 mb-1">
                                    Studio Creation Pathways
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsMiniCampaignOpen(true);
                                        setIsMenuOpen(false);
                                    }}
                                    data-testid="journey-guided-campaign"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-amber-300 hover:bg-amber-500/10 transition-colors"
                                >
                                    <Rocket size={13} className="text-amber-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Guided Campaign Launch</div>
                                        <div className="text-[10px] text-gray-400">1 track + visual concept → unwatermarked pack</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openVideo('storyboard', `Add your finished song and build its visual storyboard.`)}
                                    data-testid="journey-music-video"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Music size={13} className="text-purple-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Music Video Storyboard</div>
                                        <div className="text-[10px] text-gray-400">Assemble visual scenes synced to audio</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openVideo('editor', 'Trim a talking announcement, raw footage, or finished video.')}
                                    data-testid="journey-social-clips"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Scissors size={13} className="text-blue-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Edit & Social Clips</div>
                                        <div className="text-[10px] text-gray-400">9:16 vertical reels and cutdowns</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => openVideo('director', 'Use Import long recording for phone footage.')}
                                    data-testid="journey-phone-recording"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Smartphone size={13} className="text-emerald-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Phone Recording & Takes</div>
                                        <div className="text-[10px] text-gray-400">Import mobile takes and trim proxy</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewMode('canvas');
                                        setGenerationMode('image');
                                        setIsMenuOpen(false);
                                    }}
                                    data-testid="journey-artwork"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Palette size={13} className="text-pink-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Release Artwork & Press</div>
                                        <div className="text-[10px] text-gray-400">DSPs, 3000px print, and headshots</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setFaces((v) => !v);
                                        setIsMenuOpen(false);
                                    }}
                                    data-testid="journey-band-references"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
                                >
                                    <Users size={13} className="text-teal-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-white">Artist & Band References</div>
                                        <div className="text-[10px] text-gray-400">Face and character consistency library</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsDismissed(true)}
                        className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors"
                        title="Dismiss flow guide"
                        data-testid="dismiss-creative-journey-btn"
                    >
                        <X size={12} />
                    </button>
                </div>
            </div>

            {faces && (
                <div className="mt-2.5 max-h-72 overflow-y-auto rounded-lg border border-white/10 p-3 bg-black/40">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-300">
                            Optional: name each artist or band member separately. Only use references you have permission to use.
                        </p>
                        <button
                            type="button"
                            onClick={() => setFaces(false)}
                            className="text-[10px] text-gray-400 hover:text-white px-2 py-0.5 rounded bg-white/5"
                        >
                            Close
                        </button>
                    </div>
                    <Suspense fallback={<p className="text-xs text-gray-500">Loading references…</p>}>
                        <CharacterLibrary />
                    </Suspense>
                </div>
            )}

            <FreeMiniCampaignModal
                isOpen={isMiniCampaignOpen}
                onClose={() => setIsMiniCampaignOpen(false)}
            />
        </section>
    );
}

