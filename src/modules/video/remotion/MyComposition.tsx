import React from 'react';
import { AbsoluteFill, Sequence, Video, Img, Audio, useCurrentFrame, interpolate, Easing, EasingFunction } from 'remotion';
import { VideoProject, VideoClip } from '../store/videoEditorStore';

const ClipRenderer: React.FC<{ clip: VideoClip }> = ({ clip }) => {
    const frame = useCurrentFrame();
    const { durationInFrames, transitionIn, transitionOut } = clip;

    // --- Opacity Calculation ---
    let opacity = clip.opacity ?? 1;

    // Fade In
    if (transitionIn?.type === 'fade') {
        const fadeOpacity = interpolate(frame, [0, transitionIn.duration], [0, 1], { extrapolateRight: 'clamp' });
        opacity *= fadeOpacity;
    }

    // Fade Out
    if (transitionOut?.type === 'fade') {
        const fadeOpacity = interpolate(frame, [durationInFrames - transitionOut.duration, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
        opacity *= fadeOpacity;
    }

    // --- Transform Calculation ---
    let translateX = clip.x || 0;
    let translateY = clip.y || 0;
    let scale = clip.scale ?? 1;
    let rotation = clip.rotation ?? 0;
    let anchorX = clip.anchorX ?? 0.5;
    let anchorY = clip.anchorY ?? 0.5;
    let borderRadius = clip.borderRadius ?? 0;
    let volume = clip.volume ?? 1;

    // Slide In
    if (transitionIn?.type === 'slide') {
        const slideOffset = interpolate(frame, [0, transitionIn.duration], [100, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) });
        translateY += slideOffset;
    }
    // Slide Out
    if (transitionOut?.type === 'slide') {
        const slideOffset = interpolate(frame, [durationInFrames - transitionOut.duration, durationInFrames], [0, 100], { extrapolateLeft: 'clamp', easing: Easing.in(Easing.ease) });
        translateY += slideOffset;
    }

    // Zoom In
    if (transitionIn?.type === 'zoom') {
        const zoomScale = interpolate(frame, [0, transitionIn.duration], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.ease) });
        scale *= zoomScale;
    }
    // Zoom Out
    if (transitionOut?.type === 'zoom') {
        const zoomScale = interpolate(frame, [durationInFrames - transitionOut.duration, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', easing: Easing.in(Easing.ease) });
        scale *= zoomScale;
    }

    // Wipe In (Simple clip-path implementation)
    let clipPath = 'none';
    if (transitionIn?.type === 'wipe') {
        const percentage = interpolate(frame, [0, transitionIn.duration], [0, 100], { extrapolateRight: 'clamp' });
        clipPath = `inset(0 ${100 - percentage}% 0 0)`;
    }
    // Wipe Out
    if (transitionOut?.type === 'wipe') {
        const percentage = interpolate(frame, [durationInFrames - transitionOut.duration, durationInFrames], [0, 100], { extrapolateLeft: 'clamp' });
        clipPath = `inset(0 0 0 ${percentage}%)`;
    }

    // --- Keyframe Interpolation ---
    if (clip.keyframes) {
        Object.entries(clip.keyframes).forEach(([property, keyframes]) => {
            if (keyframes.length < 2) return;

            const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);
            const inputRange = sortedKeyframes.map(k => k.frame);
            const outputRange = sortedKeyframes.map(k => k.value);

            // Map easing strings to Remotion Easing functions
            // The easing on keyframe[i] applies to the segment from i to i+1
            const easingFunctions = sortedKeyframes.slice(0, -1).map(k => {
                switch (k.easing) {
                    case 'easeIn': return Easing.in(Easing.quad);
                    case 'easeOut': return Easing.out(Easing.quad);
                    case 'easeInOut': return Easing.inOut(Easing.quad);
                    case 'linear':
                    default: return Easing.linear;
                }
            });

            const value = interpolate(frame, inputRange, outputRange, {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: easingFunctions as unknown as EasingFunction
            });

            switch (property) {
                case 'opacity': opacity = value; break;
                case 'scale': scale = value; break;
                case 'rotation': rotation = value; break;
                case 'x': translateX = value; break;
                case 'y': translateY = value; break;
                case 'anchorX': anchorX = value; break;
                case 'anchorY': anchorY = value; break;
                case 'borderRadius': borderRadius = value; break;
                case 'volume': volume = value; break;
            }
        });
    }

    // --- Filters ---
    let filter = '';
    if (clip.filter) {
        switch (clip.filter.type) {
            case 'blur':
                filter = `blur(${clip.filter.intensity / 10}px)`;
                break;
            case 'grayscale':
                filter = `grayscale(${clip.filter.intensity}%)`;
                break;
            case 'sepia':
                filter = `sepia(${clip.filter.intensity}%)`;
                break;
            case 'contrast':
                filter = `contrast(${100 + clip.filter.intensity}%)`;
                break;
            case 'brightness':
                filter = `brightness(${100 + clip.filter.intensity}%)`;
                break;
        }
    }

    const style: React.CSSProperties = {
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: clip.type === 'text' ? (clip.textAlign === 'left' ? 'flex-start' : clip.textAlign === 'right' ? 'flex-end' : 'center') : 'center',
        alignItems: 'center',
        fontSize: clip.fontSize ?? 50,
        fontWeight: clip.fontWeight ?? 'bold',
        color: clip.textColor ?? 'white',
        textAlign: clip.textAlign ?? 'center',
        opacity,
        transformOrigin: `${anchorX * 100}% ${anchorY * 100}%`,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`,
        clipPath,
        filter,
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden'
    };

    switch (clip.type) {
        case 'text':
            return (
                <div style={style}>
                    {clip.text}
                </div>
            );
        case 'video':
            if (!clip.src) return null;
            return <Video src={clip.src} style={style} crossOrigin="anonymous" volume={volume} />;
        case 'image':
            if (!clip.src) return null;
            return <Img src={clip.src} style={style} crossOrigin="anonymous" />;
        case 'audio':
            if (!clip.src) return null;
            return <Audio src={clip.src} volume={volume} />;
        default:
            return null;
    }
};

export const MyComposition: React.FC<{ project: VideoProject }> = ({ project }) => {
    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {project.tracks.map((track) => {
                const trackClips = project.clips.filter((c) => c.trackId === track.id);

                return (
                    <React.Fragment key={track.id}>
                        {trackClips.map((clip) => (
                            <Sequence
                                key={clip.id}
                                from={clip.startFrame}
                                durationInFrames={clip.durationInFrames}
                            >
                                <ClipRenderer clip={clip} />
                            </Sequence>
                        ))}
                    </React.Fragment>
                );
            })}
        </AbsoluteFill>
    );
};
