import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Compass, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import {
    deterministicCreativeJourneyFallback,
    judgeCreativeJourneyIntent,
    type CreativeJourneyContext,
    type CreativeJourneyIntent,
    type CreativeJourneyIntentVerdict,
} from '@/config/typesafeJudgments';
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
import { instantiateQuickWorkflow } from '@/modules/workflow/services/quickWorkflowTemplates';

const CharacterLibrary = lazy(() =>
    import('./CharacterLibrary').then((module) => ({ default: module.CharacterLibrary }))
);

const JOURNEYS: { id: CreativeJourneyIntent; label: string; description: string }[] = [
    { id: 'phone_recording', label: 'Phone recording', description: 'Review a long take or live recording.' },
    { id: 'music_video', label: 'Music video', description: 'Build a visual story around a finished track.' },
    { id: 'social_clips', label: 'Social clips', description: 'Cut a short reel, short, or vertical promo.' },
    { id: 'album_artwork', label: 'Artwork', description: 'Create cover art, portraits, or promo stills.' },
    { id: 'band_references', label: 'Band references', description: 'Organize permitted artist and band references.' },
    { id: 'guided_campaign', label: 'Guided campaign', description: 'Plan a release campaign with review at each step.' },
];

export default function CreativeJourney() {
    const [isFolded, setIsFolded] = useState(false);
    const [isJourneysOpen, setIsJourneysOpen] = useState(false);
    const [faces, setFaces] = useState(false);
    const [journeyHint, setJourneyHint] = useState('');
    const journeysToggleRef = useRef<HTMLButtonElement>(null);

    const { creativePrompt, generationMode, viewMode, activeReferenceImage, videoInputs, setViewMode, setGenerationMode, setModule, setNodes, setEdges } = useStore(useShallow(state => ({
        creativePrompt: state.creativePrompt,
        generationMode: state.generationMode,
        viewMode: state.viewMode,
        activeReferenceImage: state.activeReferenceImage,
        videoInputs: state.videoInputs,
        setViewMode: state.setViewMode,
        setGenerationMode: state.setGenerationMode,
        setModule: state.setModule,
        setNodes: state.setNodes,
        setEdges: state.setEdges,
    })));
    const hasAudio = useVideoEditorStore(state => Boolean(state.inputAudio) || Boolean(state.project?.clips?.some(clip => clip.type === 'audio')));
    const hasVideo = useVideoEditorStore(state => Boolean(state.project?.clips?.some(clip => clip.type === 'video')));

    const context = useMemo<CreativeJourneyContext>(() => ({
        prompt: creativePrompt || '',
        generationMode,
        viewMode,
        ingredients: {
            audio: hasAudio,
            image: Boolean(activeReferenceImage || videoInputs?.firstFrame || videoInputs?.lastFrame || videoInputs?.ingredients?.length),
            video: hasVideo,
        },
    }), [creativePrompt, generationMode, viewMode, hasAudio, hasVideo, activeReferenceImage, videoInputs]);
    const hasSignal = Boolean(context.prompt.trim() || context.ingredients.audio || context.ingredients.image || context.ingredients.video);
    const contextKey = JSON.stringify(context);
    const [judgedContext, setJudgedContext] = useState<{ key: string; verdict: CreativeJourneyIntentVerdict } | null>(null);
    const recommendation = judgedContext?.key === contextKey
        ? judgedContext.verdict
        : deterministicCreativeJourneyFallback(context);

    useEffect(() => {
        let current = true;
        const timer = window.setTimeout(() => {
            void judgeCreativeJourneyIntent(context).then(result => {
                if (current) setJudgedContext({ key: contextKey, verdict: result });
            });
        }, 350);
        return () => {
            current = false;
            window.clearTimeout(timer);
        };
    }, [context, contextKey]);

    const openJourney = (intent: CreativeJourneyIntent) => {
        setIsJourneysOpen(false);
        journeysToggleRef.current?.focus();
        setJourneyHint('');
        setFaces(false);
        if (intent === 'album_artwork') {
            const workflow = instantiateQuickWorkflow('template-simple-image');
            if (!workflow) return;
            setNodes(workflow.nodes);
            setEdges(workflow.edges);
            setModule('workflow');
            return;
        }
        if (intent === 'band_references') {
            setFaces(true);
            setJourneyHint('Optional: organize references you have permission to use. Review generated faces before publishing.');
            return;
        }
        if (intent === 'guided_campaign') {
            const params = new URLSearchParams(window.location.search);
            params.set('mode', 'free_demo');
            window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
            const workflow = instantiateQuickWorkflow('template-video-teaser');
            if (workflow) {
                setNodes(workflow.nodes);
                setEdges(workflow.edges);
                setModule('workflow');
            }
            setJourneyHint('Guided campaign: prepare a track and visual, review the pack, then choose whether to save it.');
            return;
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
        if (intent === 'music_video') {
            const workflow = instantiateQuickWorkflow('template-video-teaser');
            if (!workflow) return;
            setNodes(workflow.nodes);
            setEdges(workflow.edges);
            setModule('workflow');
            return;
        }
        const videoMode = intent === 'phone_recording' ? 'director' : intent === 'social_clips' ? 'editor' : 'storyboard';
        useVideoEditorStore.getState().setViewMode(videoMode);
        setViewMode('video_production');
        setGenerationMode('video');
        setJourneyHint(intent === 'phone_recording'
            ? 'Import the recording, then trim unwanted takes in the editor. Your source stays intact.'
            : intent === 'social_clips'
                ? 'Select a range and save it as a separate social clip without changing the source timeline.'
                : 'Add your finished track and build its visual storyboard. Reuse photos and footage alongside generated scenes.');
    };

    return (
        <section
            aria-label="Artist creative journey"
            className={`border-t border-white/5 px-3 ${isFolded ? 'py-1' : 'py-2'}`}
            data-testid="creative-journey"
        >
            <div className="flex min-h-8 items-center justify-between gap-3">
                {isFolded ? (
                    <span className="truncate text-[11px] text-gray-500">Creative journeys hidden</span>
                ) : (
                    <div className="flex min-w-0 items-center gap-2">
                        <Sparkles size={13} aria-hidden="true" className="shrink-0 text-violet-300" />
                        <p role="status" aria-live="polite" className="truncate text-xs text-gray-300">
                            {hasSignal ? recommendation.headline : 'Choose a creative journey when you’re ready.'}
                            {journeyHint && <span className="ml-2 text-gray-500">{journeyHint}</span>}
                        </p>
                    </div>
                )}
                <div className="flex shrink-0 items-center gap-2">
                    {!isFolded && hasSignal && recommendation.confidence >= 0.5 && (
                        <button
                            type="button"
                            onClick={() => openJourney(recommendation.intent)}
                            data-testid="creative-journey-recommendation"
                            className="rounded-full border border-violet-300/20 bg-violet-300/[0.08] px-3 py-1.5 text-[11px] font-medium text-violet-100 transition-colors hover:bg-violet-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
                        >
                            {recommendation.actionLabel}
                        </button>
                    )}
                    {!isFolded && (
                        <div className="relative">
                            <button
                                type="button"
                                ref={journeysToggleRef}
                                aria-expanded={isJourneysOpen}
                                aria-controls="creative-journey-options"
                                onClick={() => setIsJourneysOpen(value => !value)}
                                data-testid="creative-journeys-toggle"
                                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
                            >
                                <Compass size={12} aria-hidden="true" /> Journeys <ChevronDown size={12} aria-hidden="true" />
                            </button>
                            {isJourneysOpen && (
                                <div
                                    id="creative-journey-options"
                                    role="region"
                                    aria-label="Creative journeys"
                                    onKeyDown={event => {
                                        if (event.key === 'Escape') {
                                            setIsJourneysOpen(false);
                                            journeysToggleRef.current?.focus();
                                        }
                                    }}
                                    className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-white/10 bg-[#101014] p-1.5 shadow-2xl"
                                >
                                    {JOURNEYS.map(journey => (
                                        <button
                                            key={journey.id}
                                            type="button"
                                            onClick={() => openJourney(journey.id)}
                                            data-testid={`creative-journey-${journey.id}`}
                                            className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
                                        >
                                            <span className="text-xs font-medium text-gray-100">{journey.label}</span>
                                            <span className="mt-0.5 text-[10px] text-gray-500">{journey.description}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        type="button"
                        aria-expanded={!isFolded}
                        aria-label={isFolded ? 'Show creative journeys' : 'Hide creative journeys'}
                        title={isFolded ? 'Show creative journeys' : 'Hide creative journeys'}
                        data-testid="creative-journey-fold-toggle"
                        onClick={() => { setIsFolded(value => !value); setIsJourneysOpen(false); }}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-white/5 hover:text-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
                    >
                        {isFolded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                </div>
            </div>
            {faces && (
                <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-white/10 p-3">
                    <p className="mb-2 text-xs text-gray-300">Use references you have permission to use. Review generated faces before publishing; references do not guarantee an exact match.</p>
                    <Suspense fallback={<p className="text-xs text-gray-400">Loading references…</p>}><CharacterLibrary /></Suspense>
                </div>
            )}
        </section>
    );
}

