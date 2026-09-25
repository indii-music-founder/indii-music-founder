import React, { useEffect } from 'react';
import '@hyperframes/player';
import type { HyperframesPlayer } from '@hyperframes/player';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { useShallow } from 'zustand/react/shallow';
import { useCompiledVideoPreview } from './hooks/useCompiledVideoPreview';
import { judgePreviewErrorGuidance, type PreviewErrorAction } from '@/config/typesafeJudgments';

/** Artist-facing copy per judgment action; the raw error always stays visible too. */
const GUIDANCE_COPY: Record<Exclude<PreviewErrorAction, 'none'>, string> = {
    trim_timeline: 'A clip likely runs past the timeline bounds — trim or retime it in the editor and this preview rebuilds.',
    fix_media: 'A clip\'s media can\'t be read — re-link or replace it in the editor.',
    retry: 'Transient hiccup — make any small edit to rebuild the preview.',
};

/**
 * Standalone viewer for a second window (ScreenControlService).
 * Plays the same live composition as the editor; rendered artifact is fallback.
 */
export default function VideoPopout() {
    const { project, artifactUrl, setProject, setPreviewArtifactUrl } = useVideoEditorStore(
        useShallow((state) => ({
            project: state.project,
            artifactUrl: state.previewArtifactUrl,
            setProject: state.setProject,
            setPreviewArtifactUrl: state.setPreviewArtifactUrl,
        }))
    );
    const { html, error, isCompiling } = useCompiledVideoPreview(project);
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const [guidance, setGuidance] = React.useState<string | null>(null);
    const activeGuidance = error ? guidance : null;

    useEffect(() => {
        if (!error) return;
        let cancelled = false;
        // TypeSafe (Jev) adds artist-facing guidance on top of the raw error.
        // Unavailable flag/key/service → judgment returns null → raw error only.
        void judgePreviewErrorGuidance(error).then((action) => {
            if (!cancelled) setGuidance(action ? GUIDANCE_COPY[action] : null);
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [error]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const channel = new BroadcastChannel('indii-video-editor-sync');
        channel.onmessage = (event) => {
            if (event.data?.type === 'SYNC_PROJECT') {
                setProject(event.data.project);
                setPreviewArtifactUrl(
                    typeof event.data.artifactUrl === 'string' ? event.data.artifactUrl : null,
                );
            } else if (event.data?.type === 'SYNC_ACTION') {
                const action = event.data.action;
                const el = html
                    ? document.querySelector<HyperframesPlayer>('[data-testid="popout-hyperframes-player"]')
                    : videoRef.current;
                if (!el) return;
                const fps = project.fps || 30;
                if (action === 'play') {
                    void Promise.resolve(el.play()).catch(() => undefined);
                } else if (action === 'pause') {
                    el.pause();
                } else if (action === 'seek' && typeof event.data.frame === 'number') {
                    const seconds = Math.max(0, event.data.frame / fps);
                    if ('seek' in el && typeof el.seek === 'function') el.seek(seconds);
                    else el.currentTime = seconds;
                }
            }
        };

        channel.postMessage({ type: 'POPOUT_OPENED' });
        return () => channel.close();
    }, [html, project.fps, setPreviewArtifactUrl, setProject]);

    const aspectRatio = project.width / project.height;

    return (
        <div className="w-screen h-screen bg-black flex items-center justify-center">
            {html ? React.createElement('hyperframes-player', {
                srcdoc: html,
                loop: true,
                width: project.width,
                height: project.height,
                'data-testid': 'popout-hyperframes-player',
                style: { width: '100%', height: '100%' },
            }) : artifactUrl ? (
                <video
                    ref={videoRef}
                    src={artifactUrl}
                    loop
                    playsInline
                    data-testid="popout-video"
                    style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio }}
                />
            ) : (
                <div className="text-gray-600 font-mono text-xs uppercase tracking-widest">
                    {isCompiling ? 'Building live preview…' : error ?? 'Add a clip in the editor to preview'}
                    {activeGuidance && (
                        <div className="mt-3 max-w-md text-gray-400 normal-case tracking-normal font-sans text-sm">
                            {activeGuidance}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
