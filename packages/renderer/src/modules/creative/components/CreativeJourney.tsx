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
import { FreeMiniCampaignModal } from './FreeMiniCampaignModal';

const CharacterLibrary = lazy(() => import('./CharacterLibrary').then(module => ({ default: module.CharacterLibrary })));

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
    const [isMiniCampaignOpen, setIsMiniCampaignOpen] = useState(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search);
        return params.get('mode') === 'free_demo' || params.get('demo') === 'true';
    });
    const [journeyHint, setJourneyHint] = useState('');
    const journeysToggleRef = useRef<HTMLButtonElement>(null);

    const { creativePrompt, generationMode, viewMode, activeReferenceImage, videoInputs, setViewMode, setGenerationMode } = useStore(useShallow(state => ({
        creativePrompt: state.creativePrompt,
        generationMode: state.generationMode,
        viewMode: state.viewMode,
        activeReferenceImage: state.activeReferenceImage,
        videoInputs: state.videoInputs,
        setViewMode: state.setViewMode,
        setGenerationMode: state.setGenerationMode,
    })));
    const hasAudio = useVideoEditorStore(state => Boolean(state.inputAudio) || Boolean(state.project?.clips?.some(clip => clip.type === 'audio')));
    const hasVideo = useVideoEditorStore(state => Boolean(state.project?.clips?.some(clip => clip.type === 'video')));

    const context = useMemo<CreativeJourneyContext>(() => ({
        prompt: creativePrompt || '',
        generationMode,
        viewMode,
        ingredients: {
            audio: hasAudio,
            image: Boolean(activeReferenceImage || videoInputs.firstFrame || videoInputs.lastFrame || videoInputs.ingredients?.length),
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
            setViewMode('canvas');
            setGenerationMode('image');
            setJourneyHint('Create release artwork or promo portraits. Add artist or band references when they help.');
            return;
        }
        if (intent === 'band_references') {
            setFaces(true);
            setJourneyHint('Optional: organize references you have permission to use. Review generated faces before publishing.');
            return;
        }
        if (intent === 'guided_campaign') {
            setIsMiniCampaignOpen(true);
            setJourneyHint('Guided campaign: prepare a track and visual, review the pack, then choose whether to save it.');
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
            <FreeMiniCampaignModal isOpen={isMiniCampaignOpen} onClose={() => setIsMiniCampaignOpen(false)} />
        </section>
    );
}
