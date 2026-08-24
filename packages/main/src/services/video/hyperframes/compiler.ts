/**
 * IndiiVideoProject -> HyperFrames HTML compiler (MIG-008, ADR-001).
 *
 * Engines adapt to indii's canonical project model. The emitted document is
 * deterministic and uses only HyperFrames-owned timing/media attributes plus
 * one paused, synchronously registered GSAP timeline.
 */

import type { IndiiVideoClip, IndiiVideoProject, IndiiVideoTrack } from '@indii/shared';

const CSS_ESCAPE = /[^a-zA-Z0-9_-]/g;
const US_PER_SECOND = 1_000_000;

const safeId = (raw: string): string => `el-${raw.replace(CSS_ESCAPE, '-')}`;

const secondsString = (seconds: number): string =>
    (Math.round(seconds * US_PER_SECOND) / US_PER_SECOND)
        .toFixed(6)
        .replace(/\.?0+$/, '') || '0';

const framesToSeconds = (frames: number, fps: number): string =>
    secondsString(frames / fps);

const escapeHtml = (raw: string): string =>
    raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const filterToCss = (filter: NonNullable<IndiiVideoClip['filter']>): string => {
    switch (filter.type) {
        case 'blur': return `blur(${(filter.intensity / 10).toFixed(1)}px)`;
        case 'grayscale': return `grayscale(${filter.intensity}%)`;
        case 'sepia': return `sepia(${filter.intensity}%)`;
        case 'contrast': return `contrast(${50 + filter.intensity / 2}%)`;
        case 'brightness': return `brightness(${50 + filter.intensity / 2}%)`;
    }
};

interface CompiledTrack {
    index: number;
    audioIndex: number;
    isMuted: boolean;
    isHidden: boolean;
}

const clipDurationSeconds = (clip: IndiiVideoClip, fps: number): number => {
    const sourceInUs = clip.sourceInUs;
    const sourceOutUs = clip.sourceOutUs;
    const hasSourceIn = sourceInUs !== undefined;
    const hasSourceOut = sourceOutUs !== undefined;
    if (hasSourceIn !== hasSourceOut) {
        throw new Error(`compiler: clip ${clip.id} must provide sourceInUs and sourceOutUs together`);
    }
    if (sourceInUs !== undefined && sourceOutUs !== undefined) {
        if (
            !Number.isSafeInteger(sourceInUs)
            || !Number.isSafeInteger(sourceOutUs)
            || sourceInUs < 0
            || sourceOutUs <= sourceInUs
        ) {
            throw new Error(`compiler: clip ${clip.id} has invalid source range`);
        }
        return (sourceOutUs - sourceInUs) / US_PER_SECOND;
    }
    return clip.durationInFrames / fps;
};

/** Percentage-based positioning against the composition canvas. */
const boxStyleFor = (clip: IndiiVideoClip): string => {
    const styles = [
        'position:absolute',
        `left:${((clip.x ?? 0) * 100).toFixed(2)}%`,
        `top:${((clip.y ?? 0) * 100).toFixed(2)}%`,
        `width:${((clip.width ?? 1) * 100).toFixed(2)}%`,
        `height:${((clip.height ?? 1) * 100).toFixed(2)}%`,
    ];
    if (clip.borderRadius !== undefined) styles.push(`border-radius:${clip.borderRadius}px`, 'overflow:hidden');
    if (clip.filter) styles.push(`filter:${filterToCss(clip.filter)}`);
    return `${styles.join(';')};`;
};

const motionStyleFor = (clip: IndiiVideoClip): string =>
    `transform-origin:${((clip.anchorX ?? 0.5) * 100).toFixed(1)}% ${((clip.anchorY ?? 0.5) * 100).toFixed(1)}%;`;

const hiddenAttribute = (track: CompiledTrack): string =>
    track.isHidden ? ' data-hidden="true"' : '';

const timingAttributes = (clip: IndiiVideoClip, fps: number, trackIndex: number): string => {
    const sourceStart = clip.sourceInUs !== undefined
        ? ` data-media-start="${secondsString(clip.sourceInUs / US_PER_SECOND)}"`
        : '';
    return `data-start="${framesToSeconds(clip.startFrame, fps)}" data-duration="${secondsString(clipDurationSeconds(clip, fps))}" data-track-index="${trackIndex}"${sourceStart}`;
};

const mediaElementsFor = (clip: IndiiVideoClip, fps: number, track: CompiledTrack): string[] => {
    const id = safeId(clip.id);
    const src = escapeHtml(clip.src ?? '');
    const timing = timingAttributes(clip, fps, track.index);
    const hidden = hiddenAttribute(track);
    const volume = Math.max(0, Math.min(3.98, track.isMuted ? 0 : (clip.volume ?? 1)));

    switch (clip.type) {
        case 'video': {
            const audioTiming = timingAttributes(clip, fps, track.audioIndex);
            const elements = [
                `<div id="${id}-box" data-hf-id="hf-${id}-box" data-name="${escapeHtml(clip.name)}" style="${boxStyleFor(clip)}"><div id="${id}" data-hf-id="hf-${id}" style="width:100%;height:100%;${motionStyleFor(clip)}"><video id="${id}-media" data-hf-id="hf-${id}-media" src="${src}" muted playsinline preload="auto" ${timing}${hidden} style="display:block;width:100%;height:100%;object-fit:cover;"></video></div></div>`,
            ];
            if (clip.hasAudio === true) {
                elements.push(`<audio id="${id}-audio" data-hf-id="hf-${id}-audio" data-name="${escapeHtml(clip.name)} audio" src="${src}" preload="auto" ${audioTiming} data-volume="${volume}"${hidden}></audio>`);
            }
            return elements;
        }
        case 'image':
            return [
                `<section id="${id}-clip" data-hf-id="hf-${id}-clip" data-name="${escapeHtml(clip.name)}" class="clip" ${timing}${hidden} style="${boxStyleFor(clip)}"><img id="${id}" data-hf-id="hf-${id}" src="${src}" alt="" style="display:block;width:100%;height:100%;object-fit:contain;${motionStyleFor(clip)}" /></section>`,
            ];
        case 'audio':
            return [
                `<audio id="${id}" data-hf-id="hf-${id}" data-name="${escapeHtml(clip.name)}" src="${src}" preload="auto" ${timing} data-volume="${volume}"${hidden}></audio>`,
            ];
        case 'text': {
            const align = clip.textAlign ?? 'center';
            const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
            return [
                `<section id="${id}-clip" data-hf-id="hf-${id}-clip" data-name="${escapeHtml(clip.name)}" class="clip" ${timing}${hidden} style="${boxStyleFor(clip)}"><div id="${id}" data-hf-id="hf-${id}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:${justify};padding:4%;box-sizing:border-box;${motionStyleFor(clip)}"><span data-hf-id="hf-${id}-text" style="display:block;color:${escapeHtml(clip.textColor ?? '#ffffff')};font-size:${clip.fontSize ?? 32}px;font-weight:${escapeHtml(String(clip.fontWeight ?? 700))};text-align:${align};white-space:pre-wrap;">${escapeHtml(clip.text ?? '')}</span></div></section>`,
            ];
        }
    }
};

interface TweenPlan {
    atSeconds: number;
    statement: string;
}

const mapEase = (ease: string | undefined): string => {
    switch (ease) {
        case 'easeIn': return 'power2.in';
        case 'easeOut': return 'power2.out';
        case 'easeInOut': return 'power2.inOut';
        case 'linear':
        default: return 'none';
    }
};

/** Transitions and keyframes become a finite, seekable GSAP plan. */
const tweenPlanFor = (clip: IndiiVideoClip, fps: number): TweenPlan[] => {
    const plan: TweenPlan[] = [];
    const id = safeId(clip.id);
    const startS = clip.startFrame / fps;
    const baseScale = clip.scale ?? 1;

    if (clip.type === 'audio' && (clip.transitionIn || clip.transitionOut)) {
        throw new Error(`compiler: audio clip ${clip.id} cannot use visual transitions`);
    }

    const initial: Record<string, number> = {};
    if (clip.scale !== undefined) initial.scale = clip.scale;
    if (clip.rotation !== undefined) initial.rotation = clip.rotation;
    if (clip.opacity !== undefined) initial.opacity = clip.opacity;
    if (Object.keys(initial).length > 0) {
        plan.push({
            atSeconds: startS,
            statement: `tl.set("#${id}", ${JSON.stringify(initial)}, ${secondsString(startS)});`,
        });
    }

    if (clip.transitionIn) {
        const durS = clip.transitionIn.duration / fps;
        const from: Record<string, number | string> = { opacity: 0 };
        const to: Record<string, number | string> = { opacity: clip.opacity ?? 1 };
        if (clip.transitionIn.type === 'slide') { from.x = -40; to.x = 0; }
        if (clip.transitionIn.type === 'zoom') { from.scale = baseScale * 0.92; to.scale = baseScale; }
        if (clip.transitionIn.type === 'wipe') { from.clipPath = 'inset(0 100% 0 0)'; to.clipPath = 'inset(0 0% 0 0)'; }
        plan.push({
            atSeconds: startS,
            statement: `tl.fromTo("#${id}", ${JSON.stringify(from)}, ${JSON.stringify({ ...to, duration: durS, ease: 'power2.out', immediateRender: false })}, ${secondsString(startS)});`,
        });
    }
    if (clip.transitionOut) {
        const durS = clip.transitionOut.duration / fps;
        const endS = startS + clipDurationSeconds(clip, fps);
        const to: Record<string, number | string> = { opacity: 0 };
        if (clip.transitionOut.type === 'slide') to.x = 40;
        if (clip.transitionOut.type === 'zoom') to.scale = baseScale * 0.94;
        if (clip.transitionOut.type === 'wipe') to.clipPath = 'inset(0 0 0 100%)';
        plan.push({
            atSeconds: endS - durS,
            statement: `tl.to("#${id}", ${JSON.stringify({ ...to, duration: durS, ease: 'power2.in' })}, ${secondsString(endS - durS)});`,
        });
    }
    if (clip.keyframes) {
        for (const [property, unsortedKeys] of Object.entries(clip.keyframes)) {
            const keys = [...unsortedKeys].sort((a, b) => a.frame - b.frame);
            if (keys.length === 0) continue;
            const propMap: Record<string, string> = { opacity: 'opacity', scale: 'scale', x: 'x', y: 'y', rotation: 'rotation' };
            const gsapProp = propMap[property] ?? property;
            const firstAt = startS + keys[0]!.frame / fps;
            plan.push({
                atSeconds: firstAt,
                statement: `tl.set("#${id}", ${JSON.stringify({ [gsapProp]: keys[0]!.value })}, ${secondsString(firstAt)});`,
            });
            for (let i = 0; i < keys.length - 1; i += 1) {
                const segStartS = startS + keys[i]!.frame / fps;
                const segDurS = (keys[i + 1]!.frame - keys[i]!.frame) / fps;
                if (segDurS <= 0) continue;
                plan.push({
                    atSeconds: segStartS,
                    statement: `tl.to("#${id}", ${JSON.stringify({ [gsapProp]: keys[i + 1]!.value, duration: Number(secondsString(segDurS)), ease: mapEase(keys[i]!.easing) })}, ${secondsString(segStartS)});`,
                });
            }
        }
    }
    return plan;
};

export interface CompiledComposition {
    html: string;
    compositionId: string;
    durationSeconds: number;
}

/** Compile a canonical project into one standalone HyperFrames composition. */
export const compileProjectToHyperFrames = (
    project: Pick<IndiiVideoProject, 'id' | 'name' | 'fps' | 'durationInFrames' | 'width' | 'height' | 'tracks' | 'clips'>,
): CompiledComposition => {
    const fps = project.fps;
    const compositionId = project.id.replace(CSS_ESCAPE, '-').toLowerCase();
    const durationSeconds = project.durationInFrames / fps;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        throw new Error(`compiler: invalid durationInFrames ${project.durationInFrames}`);
    }
    if (!Number.isInteger(fps) || fps <= 0 || fps > 240) {
        throw new Error(`compiler: invalid fps ${fps}`);
    }
    if (!Number.isInteger(project.width) || !Number.isInteger(project.height) || project.width <= 0 || project.height <= 0) {
        throw new Error('compiler: project dimensions must be positive integers');
    }

    const trackIndex = new Map<string, Omit<CompiledTrack, 'index' | 'audioIndex'>>();
    project.tracks.forEach((track: IndiiVideoTrack) => trackIndex.set(track.id, {
        isMuted: track.isMuted === true,
        isHidden: track.isHidden === true,
    }));

    const bodyClips: string[] = [];
    const tweenPlans: TweenPlan[] = [];
    for (const [clipIndex, clip] of project.clips.entries()) {
        const trackSettings = trackIndex.get(clip.trackId);
        if (!trackSettings) throw new Error(`compiler: clip ${clip.id} references unknown track ${clip.trackId}`);
        if (!Number.isInteger(clip.startFrame) || clip.startFrame < 0 || !Number.isInteger(clip.durationInFrames) || clip.durationInFrames <= 0) {
            throw new Error(`compiler: clip ${clip.id} has invalid frame timing`);
        }
        const effectiveEndSeconds = clip.startFrame / fps + clipDurationSeconds(clip, fps);
        if (effectiveEndSeconds > durationSeconds + Number.EPSILON) {
            throw new Error(`compiler: clip ${clip.id} exceeds the project duration`);
        }
        // HyperFrames tracks are non-overlapping temporal lanes, while indii
        // tracks are editor groupings that may overlap for transitions. Give
        // every clip a deterministic lane and reserve a second lane for its
        // optional companion audio element.
        const track: CompiledTrack = {
            ...trackSettings,
            index: clipIndex + 1,
            audioIndex: project.clips.length + clipIndex + 1,
        };
        bodyClips.push(...mediaElementsFor(clip, fps, track).map(element => `      ${element}`));
        tweenPlans.push(...tweenPlanFor(clip, fps));
    }

    tweenPlans.sort((a, b) => a.atSeconds - b.atSeconds);
    const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=${project.width}, height=${project.height}" />
<title>${escapeHtml(project.name)}</title>
<script src="./gsap.min.js"></script>
<style>
  html, body { margin:0; width:100%; height:100%; background:#000; }
  #root { position:relative; width:${project.width}px; height:${project.height}px; overflow:hidden; }
  .clip { position:absolute; }
</style></head>
<body>
    <div id="root" data-hf-root data-composition-id="${compositionId}" data-start="0"
      data-width="${project.width}" data-height="${project.height}" data-duration="${secondsString(durationSeconds)}" data-fps="${fps}">
${bodyClips.join('\n')}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${tweenPlans.map(tween => `      ${tween.statement}`).join('\n') || '      // no tweens — static timeline'}
      window.__timelines["${compositionId}"] = tl;
    </script>
</body></html>`;

    return { html, compositionId, durationSeconds };
};
