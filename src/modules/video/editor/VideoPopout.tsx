import React, { useEffect } from 'react';
import { useVideoEditorStore } from '../store/videoEditorStore';
import { Player } from '@remotion/player';
import { MyComposition } from '../remotion/MyComposition';

/**
 * A standalone viewer intended to be opened in a separate window via ScreenControlService.
 * It listens to BroadcastChannel to sync state from the main editor window.
 */
export default function VideoPopout() {
    const { project, setProject } = useVideoEditorStore();

    useEffect(() => {
        // Only set up BroadcastChannel in the browser environment
        if (typeof window === 'undefined') return;

        const channel = new BroadcastChannel('indiiOS-video-editor-sync');
        channel.onmessage = (event) => {
            if (event.data?.type === 'SYNC_PROJECT') {
                setProject(event.data.project);
            }
        };

        // Let the main window know the popout just opened to request current state
        channel.postMessage({ type: 'POPOUT_OPENED' });

        const handleUnload = () => {
            channel.postMessage({ type: 'POPOUT_CLOSED' });
        };
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            channel.close();
        };
    }, [setProject]);

    // Use the actual aspect ratio from the project settings
    const aspectRatio = project.width / project.height;

    return (
        <div className="w-screen h-screen bg-black flex flex-col items-center justify-center p-8 overflow-hidden select-none">
            <div
                className="relative shadow-2xl bg-[#0d1117] rounded-xl overflow-hidden ring-1 ring-white/10"
                style={{
                    width: '100%',
                    maxWidth: '100%',
                    aspectRatio: `${project.width} / ${project.height}`
                }}
            >
                <div className="absolute top-4 left-4 z-50 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-mono ring-1 ring-white/20 select-none">
                    indiiOS Popout Director ({project.width}x{project.height})
                </div>

                <Player
                    component={MyComposition}
                    inputProps={{ project }}
                    durationInFrames={Math.max(1, project.durationInFrames)}
                    fps={project.fps}
                    compositionWidth={project.width}
                    compositionHeight={project.height}
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                    controls
                    autoPlay
                    loop
                />
            </div>
        </div>
    );
}
