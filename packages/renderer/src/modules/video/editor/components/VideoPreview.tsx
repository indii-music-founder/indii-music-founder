import React from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MyComposition } from '../../remotion/MyComposition';
import { VideoProject } from '../../store/videoEditorStore';

interface VideoPreviewProps {
    playerRef: React.RefObject<PlayerRef>;
    project: VideoProject;
    onFrameUpdate?: (frame: number) => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ playerRef, project, onFrameUpdate }) => {
    const aspectRatio = project.width / project.height;

    React.useEffect(() => {
        if (!playerRef.current || !onFrameUpdate) return;

        const { current } = playerRef;
        const callback = (e: { detail: { frame: number } }) => {
            if (typeof e.detail?.frame === 'number') {
                onFrameUpdate(e.detail.frame);
            }
        };

        // @ts-ignore - The remotion typings might complain but this is the valid API
        current.addEventListener('frameupdate', callback);

        return () => {
            if (typeof current.removeEventListener === 'function') {
                // @ts-ignore
                current.removeEventListener('frameupdate', callback);
            }
        };
    }, [playerRef, onFrameUpdate]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-12 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-blue-500/5 blur-[120px] pointer-events-none" />

            <div className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden border border-white/10 bg-black group w-full max-w-4xl aspect-video flex items-center justify-center">
                <Player
                    ref={playerRef}
                    component={MyComposition}
                    inputProps={{ project }}
                    durationInFrames={project.durationInFrames}
                    compositionWidth={project.width}
                    compositionHeight={project.height}
                    fps={project.fps}
                    style={{
                        width: '100%',
                        maxWidth: '800px',
                        maxHeight: '100%',
                        aspectRatio: `${aspectRatio}`,
                    }}
                    loop
                // No native controls, we use the timeline transport
                />

                {/* Glassmorphic Overlay Border */}
                <div className="absolute inset-0 pointer-events-none rounded-xl border border-white/5 shadow-inner" />
            </div>

            {/* Footer with Scale Info and Pop-Out Button */}
            <div className="mt-4 flex items-center justify-between w-full max-w-4xl px-4">
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-pulse" />
                    Live Preview: {project.width}x{project.height} @ {project.fps}FPS
                </div>

                <button
                    onClick={() => {
                        import('@/services/screen/ScreenControlService').then(({ ScreenControl }) => {
                            // Ensure Window Management API permission is granted
                            ScreenControl.requestPermission().then((granted) => {
                                // Default to the second screen if they have 2, otherwise first
                                ScreenControl.openProjectorWindow('/video-popout', 1);
                                import('../../store/videoEditorStore').then(({ useVideoEditorStore }) => {
                                    useVideoEditorStore.getState().setIsPopoutActive(true);
                                });
                            });
                        });
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
