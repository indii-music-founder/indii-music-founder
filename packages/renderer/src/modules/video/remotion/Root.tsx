import React from 'react';
import { Composition } from 'remotion';
import { MyComposition } from './MyComposition';
import { VideoProject } from '../store/videoEditorStore';

export const RemotionRoot: React.FC = () => {
    return (
        <Composition
            id="MyComp"
            component={MyComposition}
            durationInFrames={300} // Default, will be overridden by inputProps
            fps={30}
            width={1920}
            height={1080}
            defaultProps={{
                project: {
                    id: 'default',
                    name: 'Default Project',
                    width: 1920,
                    height: 1080,
                    fps: 30,
                    durationInFrames: 300,
                    tracks: [],
                    clips: []
                } as VideoProject
            }}
        />
    );
};
