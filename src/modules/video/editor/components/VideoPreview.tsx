import React from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MyComposition } from '../../remotion/MyComposition';
import { VideoProject } from '../../store/videoEditorStore';

interface VideoPreviewProps {
    playerRef: React.RefObject<PlayerRef | null>;
    project: VideoProject;
    onFrameUpdate?: (frame: number) => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ playerRef, project, onFrameUpdate }) => {
    const aspectRatio = project.width / project.height;

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-12 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-blue-500/5 blur-[120px] pointer-events-none" />

            <div className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden border border-white/10 bg-black group">
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
                        aspectRatio: `${aspectRatio}`,
                    }}
                    controls
                    loop

                />

                {/* Glassmorphic Overlay Border */}
                <div className="absolute inset-0 pointer-events-none rounded-xl border border-white/5 shadow-inner" />
            </div>

            {/* Scale Info Label */}
            <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-pulse" />
                Live Preview: {project.width}x{project.height} @ {project.fps}FPS
            </div>
        </div>
    );
};
