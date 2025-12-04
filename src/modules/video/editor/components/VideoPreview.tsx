import React from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { MyComposition } from '../../remotion/MyComposition';
import { VideoProject } from '../../store/videoEditorStore';

interface VideoPreviewProps {
    playerRef: React.RefObject<PlayerRef | null>;
    project: VideoProject;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ playerRef, project }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-black/50 p-8 relative">
            <div className="shadow-2xl rounded-lg overflow-hidden border border-gray-800 bg-black">
                <Player
                    ref={playerRef}
                    component={MyComposition}
                    inputProps={{ project }}
                    durationInFrames={project.durationInFrames}
                    compositionWidth={project.width}
                    compositionHeight={project.height}
                    fps={project.fps}
                    style={{
                        width: 640,
                        height: 360,
                    }}
                    controls
                    loop
                />
            </div>
        </div>
    );
};
