import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Compass, Sparkles, X } from 'lucide-react';
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
import { instantiateQuickWorkflow } from '@/modules/workflow/services/quickWorkflowTemplates';

const CharacterLibrary = lazy(() => import('./CharacterLibrary').then(module => ({ default: module.CharacterLibrary })));

const JOURNEYS: { id: CreativeJourneyIntent; label: string; description: string }[] = [
    { id: 'phone_recording', label: 'Phone recording', description: 'Review a long take or live recording.' },
    { id: 'music_video', label: 'Music video', description: 'Build a visual story around a finished track.' },
    { id: 'social_clips', label: 'Social clips', description: 'Cut a short reel, short, or vertical promo.' },
    { id: 'album_artwork', label: 'Artwork', description: 'Create cover art, portraits, or promo stills.' },
    { id: 'band_references', label: 'Band references', description: 'Organize permitted artist and band references.' },
    { id: 'guided_campaign', label: 'Guided campaign', description: 'Plan a release campaign with review at each step.' },
];

/** How long a step hint stays on screen before it gets out of the artist's way. */
const JOURNEY_HINT_TIMEOUT_MS = 8000;

/**
 * Inline journey controls for the single Creative Studio header row.
 * Renders the Journeys menu and the Jev (Judgment: judgeCreativeJourneyIntent)
 * recommendation chip directly inside CreativeNavbar, so the studio never
 * stacks a second horizontal bar. Step hints and the reference library open
 * as dismissible popovers anchored under the menu instead of a permanent row.
 */
export default function CreativeJourney() {
    const [isJourneysOpen, setIsJourneysOpen] = useState(false);
    const [faces, setFaces] = useState(false);
    const [journeyHint, setJourneyHint] = useState('');
    const journeysToggleRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Close the Journeys menu on an outside click so it never lingers over the canvas.
    useEffect(() => {
        if (!isJourneysOpen) return;
        const handlePointerDown = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsJourneysOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isJourneysOpen]);

    // Step hints are guidance, not furniture: they fade out on their own.
    useEffect(() => {
        if (!journeyHint || faces) return;
        const timer = window.setTimeout(() => setJourneyHint(''), JOURNEY_HINT_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, [journeyHint, faces]);

    const closeGuidance = () => {
        setJourneyHint('');
        setFaces(false);
        journeysToggleRef.current?.focus();
    };

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

    const showRecommendation = hasSignal && recommendation.confidence >= 0.5;
    const showGuidance = faces || Boolean(journeyHint);

    return (
        <div
            ref={containerRef}
            role="group"
            aria-label="Artist creative journey"
            data-testid="creative-journey"
            className="relative flex min-w-0 items-center gap-1.5"
            onKeyDown={event => {
                if (event.key !== 'Escape') return;
                if (isJourneysOpen) {
                    setIsJourneysOpen(false);
                    journeysToggleRef.current?.focus();
                } else if (showGuidance) {
                    closeGuidance();
                }
            }}
        >
            {/* Screen readers still hear Jev's headline; sighted artists get the compact chip. */}
            <p role="status" aria-live="polite" className="sr-only">
                {hasSignal ? recommendation.headline : 'Choose a creative journey when you’re ready.'}
            </p>

            <div className="relative shrink-0">
                <button
                    type="button"
                    ref={journeysToggleRef}
                    aria-expanded={isJourneysOpen}
                    aria-controls="creative-journey-options"
                    aria-label="Journeys"
                    title="Creative journeys"
                    onClick={() => setIsJourneysOpen(value => !value)}
                    data-testid="creative-journeys-toggle"
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
                >
                    <Compass size={12} aria-hidden="true" className="text-violet-300" />
                    <span className="hidden sm:inline">Journeys</span>
                    <ChevronDown
                        size={11}
                        aria-hidden="true"
                        className={`text-gray-500 transition-transform duration-150 ${isJourneysOpen ? 'rotate-180' : ''}`}
                    />
                </button>
                {isJourneysOpen && (
                    <div
                        id="creative-journey-options"
                        role="region"
                        aria-label="Creative journeys"
                        className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-[#101014] p-1.5 shadow-2xl"
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

            {showRecommendation && (
                <button
                    type="button"
                    onClick={() => openJourney(recommendation.intent)}
                    title={recommendation.headline}
                    data-testid="creative-journey-recommendation"
                    className="hidden min-w-0 max-w-[15rem] items-center gap-1.5 rounded-lg border border-violet-300/20 bg-violet-300/[0.08] px-2.5 py-1 text-[11px] font-medium text-violet-100 transition-colors hover:bg-violet-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 lg:inline-flex"
                >
                    <Sparkles size={11} aria-hidden="true" className="shrink-0 text-violet-300" />
                    <span className="truncate">{recommendation.actionLabel}</span>
                </button>
            )}

            {showGuidance && (
                <div
                    role="region"
                    aria-label="Journey guidance"
                    data-testid="creative-journey-guidance"
                    className="absolute left-0 top-full z-40 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-white/10 bg-[#101014] p-3 shadow-2xl"
                >
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-xs leading-relaxed text-gray-300">
                            {faces
                                ? 'Use references you have permission to use. Review generated faces before publishing; references do not guarantee an exact match.'
                                : journeyHint}
                        </p>
                        <button
                            type="button"
                            onClick={closeGuidance}
                            aria-label="Close journey guidance"
                            data-testid="creative-journey-guidance-close"
                            className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-white/5 hover:text-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
                        >
                            <X size={12} aria-hidden="true" />
                        </button>
                    </div>
                    {faces && (
                        <div className="mt-2 max-h-72 overflow-y-auto">
                            <Suspense fallback={<p className="text-xs text-gray-400">Loading references…</p>}>
                                <CharacterLibrary />
                            </Suspense>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
