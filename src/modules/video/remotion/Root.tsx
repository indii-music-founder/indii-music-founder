import React from 'react';
import { Composition } from 'remotion';
import { MyComposition } from './MyComposition';
import { AIGeneratedComposition } from './compositions/AIGeneratedComposition';
import { VideoProject } from '../store/videoEditorStore';
import { AIComposition, Scene } from '@/modules/video/schemas/AICompositionSchema';
import { videoCompositionService } from '@/services/video/VideoCompositionService';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            {/* Legacy composition for timeline editing */}
            <Composition
                id="MyComp"
                component={MyComposition}
                durationInFrames={300}
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

            {/* AI-Generated composition with calculateMetadata */}
            <Composition
                id="AIComposition"
                component={AIGeneratedComposition}
                durationInFrames={300}
                fps={30}
                width={1920}
                height={1080}
                defaultProps={{
                    composition: null as unknown as AIComposition,
                }}
                calculateMetadata={async ({ props, abortSignal }) => {
                    const inputProps = props as { prompt?: string; composition?: AIComposition; duration?: number; aspectRatio?: '16:9' | '9:16' | '1:1' };

                    // If composition already provided, use it
                    if (inputProps.composition) {
                        const totalFrames = inputProps.composition.scenes.reduce(
                            (sum, s: Scene) => sum + s.durationInFrames, 0
                        );
                        return {
                            durationInFrames: totalFrames,
                            width: inputProps.composition.settings.width,
                            height: inputProps.composition.settings.height,
                            fps: inputProps.composition.settings.fps,
                        };
                    }

                    // Generate from prompt
                    if (inputProps.prompt) {
                        const composition = await videoCompositionService.generateComposition(
                            inputProps.prompt,
                            { duration: inputProps.duration, aspectRatio: inputProps.aspectRatio, signal: abortSignal }
                        );
                        const totalFrames = composition.scenes.reduce(
                            (sum, s: Scene) => sum + s.durationInFrames, 0
                        );
                        return {
                            durationInFrames: totalFrames,
                            width: composition.settings.width,
                            height: composition.settings.height,
                            fps: composition.settings.fps,
                            props: { composition },
                        };
                    }

                    return { durationInFrames: 300 };
                }}
            />
        </>
    );
};
