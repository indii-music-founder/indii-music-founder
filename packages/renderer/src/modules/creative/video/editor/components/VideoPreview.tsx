import React from 'react';

import { logger } from '@/utils/logger';
import type { IndiiVideoProject } from '@indii/shared';

import { attachPreviewElement, detachPreviewElement, previewSeekToFrame } from '../previewTransport';

interface VideoPreviewProps {
    /** Rendered artifact for the current project (indii pipeline output). */
    artifactUrl: string | null;
    project: IndiiVideoProject;
    onFrameUpdate?: (frame: number) => void;
    /** External seek requests (timeline scrubs), in frames. */
    seekRequest?: { frame: number; nonce: number } | null;
}

/**
 * Engine-free preview surface: plays the rendered artifact through a plain
 * <video> element (MIG-011 Option B). Renders are produced by the indii
 * pipeline (FFmpeg fast path / composition engine behind the contract).
 */
export const VideoPreview: React.FC<VideoPreviewProps> = ({ artifactUrl, project, onFrameUpdate, seekRequest }) => {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const aspectRatio = project.width / project.height;

    React.useEffect(() => {
        const el = videoRef.current;
        attachPreviewElement(el);
        return () => detachPreviewElement(el);
    }, [artifactUrl]);

    // timeupdate → frame callback for the timeline playhead.
    React.useEffect(() => {
        const el = videoRef.current;
        if (!el || !onFrameUpdate) return;
        const onTime = () => {
            const frame = Math.round(el.currentTime * (project.fps || 30));
            if (Number.isFinite(frame)) onFrameUpdate(frame);
        };
        el.addEventListener('timeupdate', onTime);
        return () => el.removeEventListener('timeupdate', onTime);
    }, [onFrameUpdate, project.fps]);

    // External seeks (timeline scrubbing).
    React.useEffect(() => {
        if (!seekRequest) return;
        previewSeekToFrame(seekRequest.frame, project.fps);
    }, [seekRequest, project.fps]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-12 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-blue-500/5 blur-[120px] pointer-events-none" />

            <div className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden border border-white/10 bg-black group w-full max-w-4xl aspect-video flex items-center justify-center">
                {artifactUrl ? (
                    <video
                        ref={videoRef}
                        src={artifactUrl}
                        loop
                        playsInline
                        data-testid="preview-video"
                        style={{ width: '100%', maxWidth: '800px', maxHeight: '100%', aspectRatio: `${aspectRatio}` }}
                    />
                ) : (
                    <div
                        data-testid="preview-empty"
                        className="flex flex-col items-center gap-3 text-gray-500 text-sm"
                    >
                        <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="font-mono uppercase tracking-widest text-xs">Render to preview</span>
                        <span className="text-xs opacity-60">Exports run through the indii pipeline</span>
                    </div>
                )}

                {/* Glassmorphic Overlay Border */}
                <div className="absolute inset-0 pointer-events-none rounded-xl border border-white/5 shadow-inner" />
            </div>

            {/* Footer with Scale Info and Pop-Out Button */}
            <div className="mt-4 flex items-center justify-between w-full max-w-4xl px-4">
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                    <span className={`w-1.5 h-1.5 rounded-full ${artifactUrl ? 'bg-emerald-500/60' : 'bg-blue-500/50'} animate-pulse`} />
                    Preview: {project.width}x{project.height} @ {project.fps}FPS
                </div>

                <button
                    onClick={() => {
                        import('@/services/screen/ScreenControlService').then(({ ScreenControl }) => {
                            ScreenControl.requestPermission().then((granted) => {
                                ScreenControl.openProjectorWindow('/video-popout', 1);
                                import('../../store/videoEditorStore').then(({ useVideoEditorStore }) => {
                                    useVideoEditorStore.getState().setIsPopoutActive(true);
                                }).catch((err) => logger.error('Failed to load video editor store for pop-out:', err));
                            }).catch((err) => logger.error('Screen control permission request failed:', err));
                        }).catch((err) => logger.error('Failed to load screen control service:', err));
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-gray-300 font-medium transition-colors ring-1 ring-white/10 hover:ring-white/20"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Pop Out Viewer
                </button>
            </div>
        </div>
    );
};
