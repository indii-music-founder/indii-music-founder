import React, { lazy, Suspense, useState } from 'react';
import { useStore } from '@/core/store';
import { useVideoEditorStore } from '../video/store/videoEditorStore';
import { CREATIVE_JOURNEY_LIMITS } from '../creativeJourney';
const CharacterLibrary = lazy(() => import('./CharacterLibrary').then(module => ({ default: module.CharacterLibrary })));
export default function CreativeJourney() {
    const [faces, setFaces] = useState(false);
    const [hint, setHint] = useState('Start with your finished song, photos, or phone footage. Keep what you want, then export.');
    const setViewMode = useStore(state => state.setViewMode);
    const setGenerationMode = useStore(state => state.setGenerationMode);
    const openVideo = (mode: 'director' | 'editor' | 'storyboard', message: string) => {
        useVideoEditorStore.getState().setViewMode(mode);
        setViewMode('video_production'); setGenerationMode('video'); setHint(message);
    };
    const buttonClass = 'shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-200 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-400';
    return <section aria-label="Artist creative journey" className="border-t border-white/5 px-3 py-2">
        <nav aria-label="What are you making?" className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" className={buttonClass} onClick={() => openVideo('director', 'Use Import long recording for phone footage. Open the edit proxy to trim unwanted takes; your original stays intact.')}>Phone recording</button>
            <button type="button" className={buttonClass} onClick={() => openVideo('storyboard', `Add your finished song and build its visual storyboard. Typical length: ${CREATIVE_JOURNEY_LIMITS.musicVideoSuggestedMinSeconds / 60}–${CREATIVE_JOURNEY_LIMITS.musicVideoMaxSeconds / 60} minutes; shorter songs work too. Reuse photos and footage alongside generated scenes.`)}>Music video</button>
            <button type="button" className={buttonClass} onClick={() => openVideo('editor', 'Trim a talking announcement, raw footage, or finished video. Social clip saves a separate range without changing the source timeline.')}>Edit / social clips</button>
            <button type="button" className={buttonClass} onClick={() => { setViewMode('canvas'); setGenerationMode('image'); setHint('Create release artwork or promo headshots. Optionally add artist or band-member references.'); }}>Artwork / headshots</button>
            <button type="button" className={buttonClass} aria-expanded={faces} onClick={() => setFaces(value => !value)}>Artist / band references</button>
        </nav>
        <p role="status" className="mt-1 text-xs leading-relaxed text-gray-400">{hint}</p>
        {faces && <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-white/10 p-3">
            <p className="mb-2 text-xs text-gray-300">Optional: name each artist or band member separately. Only use references you have permission to use. Review generated faces before publishing; references do not guarantee an exact match.</p>
            <Suspense fallback={<p>Loading references…</p>}><CharacterLibrary /></Suspense>
        </div>}
    </section>;
}
