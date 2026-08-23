import React, { useEffect } from 'react';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { useShallow } from 'zustand/react/shallow';

/**
 * Standalone viewer for a second window (ScreenControlService).
 * Plays the rendered artifact; BroadcastChannel-synced transport.
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
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

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
                const el = videoRef.current;
                if (!el) return;
                const fps = project.fps || 30;
                if (action === 'play') {
                    void el.play().catch(() => undefined);
                } else if (action === 'pause') {
                    el.pause();
                } else if (action === 'seek' && typeof event.data.frame === 'number') {
                    el.currentTime = Math.max(0, event.data.frame / fps);
                }
            }
        };

        channel.postMessage({ type: 'POPOUT_OPENED' });
        return () => channel.close();
    }, [project.fps, setPreviewArtifactUrl, setProject]);

    const aspectRatio = project.width / project.height;

    return (
        <div className="w-screen h-screen bg-black flex items-center justify-center">
            {artifactUrl ? (
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
                    No rendered artifact — render in the editor first
                </div>
            )}
        </div>
    );
}
