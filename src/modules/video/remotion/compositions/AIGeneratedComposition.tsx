import React from 'react';
import { AbsoluteFill, Sequence, Video, Img, Audio, useCurrentFrame, interpolate, Easing } from 'remotion';
import { AIComposition, Scene, SceneElement } from '../../schemas/AICompositionSchema';

const ElementRenderer: React.FC<{ element: SceneElement; sceneDuration: number }> = ({ element, sceneDuration }) => {
    const frame = useCurrentFrame();
    const { animation, style } = element;

    let opacity = style?.opacity ?? 1;
    const enterDur = animation?.enterDuration ?? 15;
    const exitDur = animation?.exitDuration ?? 15;

    // Enter animation
    if (animation?.enter === 'fade') {
        opacity *= interpolate(frame, [0, enterDur], [0, 1], { extrapolateRight: 'clamp' });
    }
    // Exit animation
    if (animation?.exit === 'fade') {
        opacity *= interpolate(frame, [sceneDuration - exitDur, sceneDuration], [1, 0], { extrapolateLeft: 'clamp' });
    }

    const baseStyle: React.CSSProperties = {
        position: 'absolute',
        left: element.position.x === 'center' ? '50%' : element.position.x,
        top: element.position.y === 'center' ? '50%' : element.position.y,
        transform: element.position.x === 'center' || element.position.y === 'center'
            ? `translate(${element.position.x === 'center' ? '-50%' : '0'}, ${element.position.y === 'center' ? '-50%' : '0'})`
            : undefined,
        opacity,
        fontSize: style?.fontSize,
        fontFamily: style?.fontFamily,
        fontWeight: style?.fontWeight as any,
        color: style?.color,
        backgroundColor: style?.backgroundColor,
        borderRadius: style?.borderRadius,
        padding: style?.padding,
    };

    switch (element.type) {
        case 'text':
            return <div style={baseStyle}>{element.content}</div>;
        case 'image':
            return element.content ? <Img src={element.content} style={baseStyle} /> : null;
        case 'video':
            return element.content ? <Video src={element.content} style={baseStyle} volume={element.volume ?? 1} /> : null;
        case 'audio':
            return element.content ? <Audio src={element.content} volume={element.volume ?? 1} /> : null;
        default:
            return null;
    }
};

const SceneRenderer: React.FC<{ scene: Scene }> = ({ scene }) => {
    const bgStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        background: scene.background?.type === 'color' ? scene.background.value
            : scene.background?.type === 'gradient' ? scene.background.value
                : '#000000',
    };

    return (
        <AbsoluteFill style={bgStyle}>
            {scene.background?.type === 'image' && scene.background.value && (
                <Img src={scene.background.value} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {scene.background?.type === 'video' && scene.background.value && (
                <Video src={scene.background.value} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {scene.elements.map((el) => (
                <ElementRenderer key={el.id} element={el} sceneDuration={scene.durationInFrames} />
            ))}
        </AbsoluteFill>
    );
};

export const AIGeneratedComposition: React.FC<{ composition: AIComposition }> = ({ composition }) => {
    if (!composition) return <AbsoluteFill style={{ background: '#000' }} />;

    return (
        <AbsoluteFill>
            {composition.scenes.map((scene) => (
                <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
                    <SceneRenderer scene={scene} />
                </Sequence>
            ))}
            {composition.audio?.backgroundMusic?.src && (
                <Audio src={composition.audio.backgroundMusic.src} volume={composition.audio.backgroundMusic.volume ?? 0.5} />
            )}
        </AbsoluteFill>
    );
};
