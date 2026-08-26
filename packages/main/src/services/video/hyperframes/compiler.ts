/**
 * IndiiVideoProject -> HyperFrames HTML compiler (MIG-008, ADR-001).
 *
 * Engines adapt to indii's canonical project model. The emitted document is
 * deterministic and uses only HyperFrames-owned timing/media attributes plus
 * one paused, synchronously registered GSAP timeline.
 */

import type {
    IndiiBackground,
    IndiiSeam,
    IndiiVideoClip,
    IndiiVideoProject,
    IndiiVideoTrack,
} from '@indii/shared';

const CSS_ESCAPE = /[^a-zA-Z0-9_-]/g;
const US_PER_SECOND = 1_000_000;
const DEFAULT_CANVAS = '#0b0c0f';
const DEFAULT_ACCENT = '#F5B13D';

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
                elements.push(`<audio id="${id}-audio" data-hf-id="hf-${id}-audio" data-name="${escapeHtml(clip.name)} audio" src="${src}" preload="auto" ${audioTiming} data-volume="${clip.audioFade ? '1' : volume}"${hidden}></audio>`);
            }
            return elements;
        }
        case 'image':
            return [
                `<section id="${id}-clip" data-hf-id="hf-${id}-clip" data-name="${escapeHtml(clip.name)}" class="clip" ${timing}${hidden} style="${boxStyleFor(clip)}"><img id="${id}" data-hf-id="hf-${id}" src="${src}" alt="" style="display:block;width:100%;height:100%;object-fit:contain;${motionStyleFor(clip)}" /></section>`,
            ];
        case 'audio':
            return [
                `<audio id="${id}" data-hf-id="hf-${id}" data-name="${escapeHtml(clip.name)}" src="${src}" preload="auto" ${timing} data-volume="${clip.audioFade ? '1' : volume}"${hidden}></audio>`,
            ];
        case 'text': {
            const align = clip.textAlign ?? 'center';
            const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
            const content = clip.entrance?.type === 'waterfall'
                ? (clip.text ?? '').trim().split(/\s+/).filter(Boolean)
                    .map((word, index) =>
                        `<span id="${id}-w${index}" data-hf-id="hf-${id}-w${index}" style="display:inline-block;margin:0 0.35em 0 0;">${escapeHtml(word)}</span>`)
                    .join('')
                : escapeHtml(clip.countUp ? `${clip.countUp.prefix ?? ''}0${clip.countUp.suffix ?? ''}` : clip.text ?? '');
            return [
                `<section id="${id}-clip" data-hf-id="hf-${id}-clip" data-name="${escapeHtml(clip.name)}" class="clip" ${timing}${hidden} style="${boxStyleFor(clip)}"><div id="${id}" data-hf-id="hf-${id}" style="width:100%;height:100%;display:flex;align-items:center;justify-content:${justify};padding:4%;box-sizing:border-box;${motionStyleFor(clip)}"><span id="${id}-text" data-hf-id="hf-${id}-text" style="display:block;color:${escapeHtml(clip.textColor ?? '#ffffff')};font-size:${clip.fontSize ?? 32}px;font-weight:${escapeHtml(String(clip.fontWeight ?? 700))};text-align:${align};white-space:pre-wrap;">${content}</span></div></section>`,
            ];
        }
    }
};

interface TweenPlan {
    atSeconds: number;
    statement: string;
}

/** Ambient layer behind every clip plus its slow finite drift tween. */
const backgroundLayerFor = (
    background: IndiiBackground,
    durationSeconds: number,
): { html: string; tween: string; canvas: string } => {
    const accent = escapeHtml(background.accent ?? DEFAULT_ACCENT);
    const canvas = background.color ?? DEFAULT_CANVAS;
    const glowOpacity = Math.min(0.5, Math.max(0.05, background.glowOpacity ?? 0.16));
    const position = background.glowPosition ?? 'bottom-left';
    const anchor: Record<string, string> = {
        'bottom-left': 'left:-30%;bottom:-40%',
        'bottom-right': 'right:-30%;bottom:-40%',
        'top-left': 'left:-30%;top:-40%',
        'top-right': 'right:-30%;top:-40%',
        'center': 'left:50%;top:50%;margin-left:-40%;margin-top:-40%',
    };
    const glowCss = `radial-gradient(circle, ${accent.replace('#', '%23')}${Math.round(glowOpacity * 100)} 0%, rgba(0,0,0,0) 62%)`;

    switch (background.kind) {
        case 'solid':
            return { html: '', tween: '', canvas };
        case 'radial-glow':
            return {
                html: `<div id="bg-glow" data-hf-id="hf-bg-glow" data-name="background glow" style="position:absolute;${anchor[position] ?? anchor['bottom-left']};width:80%;height:80%;border-radius:50%;background:${glowCss};" data-layout-allow-overflow></div>`,
                tween: `tl.to("#bg-glow", { scale: 1.1, duration: ${secondsString(durationSeconds)}, ease: "none" }, 0);`,
                canvas,
            };
        case 'grid':
            return {
                html: `<div id="bg-grid" data-hf-id="hf-bg-grid" data-name="background grid" style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.5) 2px, transparent 2px),linear-gradient(90deg, rgba(255,255,255,0.5) 2px, transparent 2px);background-size:140px 140px;opacity:0.07;"></div>`,
                tween: `tl.fromTo("#bg-grid", { opacity: 0.06 }, { opacity: 0.1, duration: ${secondsString(Math.min(5, durationSeconds))}, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);`,
                canvas,
            };
        case 'ghost-text': {
            const ghost = escapeHtml(background.ghostText ?? '');
            return {
                html: `<div id="bg-ghost" data-hf-id="hf-bg-ghost" data-name="ghost text" style="position:absolute;top:14%;right:-6%;font-family:'Archivo Black',sans-serif;font-weight:400;font-size:380px;line-height:1;letter-spacing:-0.03em;color:${accent};opacity:0.08;white-space:nowrap;" data-layout-allow-overflow>${ghost}</div>`,
                tween: `tl.to("#bg-ghost", { x: -120, y: -40, duration: ${secondsString(durationSeconds)}, ease: "none" }, 0);`,
                canvas,
            };
        }
        default:
            return { html: '', tween: '', canvas };
    }
};

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
    if (clip.type === 'audio' && clip.entrance) {
        throw new Error(`compiler: audio clip ${clip.id} cannot use a visual entrance`);
    }
    if (clip.entrance?.type === 'waterfall' && clip.countUp) {
        throw new Error(`compiler: clip ${clip.id} cannot combine a waterfall entrance with a count-up`);
    }
    if (clip.entrance?.type === 'inverse-zoom' && clip.countUp) {
        throw new Error(`compiler: clip ${clip.id} cannot combine an inverse-zoom entrance with a count-up`);
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

    // ── Cinematic entrance (waterfall words / inverse-zoom arrival)
    if (clip.entrance?.type === 'waterfall') {
        const words = (clip.text ?? '').trim().split(/\s+/).filter(Boolean);
        const stagger = Math.max(0.02, clip.entrance.staggerSeconds ?? 0.05);
        words.forEach((_word, index) => {
            const at = startS + index * stagger;
            plan.push({ atSeconds: at, statement: `tl.set("#${id}-w${index}", { y: 70, autoAlpha: 0 }, ${secondsString(startS)});` });
            plan.push({ atSeconds: at, statement: `tl.set("#${id}-w${index}", { autoAlpha: 1 }, ${secondsString(at)});` });
            plan.push({ atSeconds: at, statement: `tl.to("#${id}-w${index}", { y: 0, duration: 0.2, ease: "power4.out" }, ${secondsString(at)});` });
        });
    }
    if (clip.entrance?.type === 'inverse-zoom') {
        const boxId = clip.type === 'video' ? `${id}-box` : `${id}-clip`;
        plan.push({
            atSeconds: startS,
            statement: `tl.fromTo("#${boxId}", { autoAlpha: 0.15, scale: 1.25, filter: "blur(10px)" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out", immediateRender: false }, ${secondsString(startS)});`,
        });
    }

    // ── Seek-safe counter (text clips only)
    if (clip.countUp) {
        const to = clip.countUp.to;
        if (!Number.isFinite(to) || to < 0) throw new Error(`compiler: clip ${clip.id} count-up target must be a non-negative number`);
        const durS = (clip.countUp.durationInFrames ?? fps) / fps;
        plan.push({
            atSeconds: startS,
            statement: `tl.to(__counter_${id}, { v: ${to}, duration: ${secondsString(durS)}, ease: "power2.out", snap: { v: 1 }, onUpdate: function() { var el = document.getElementById("${id}-text"); if (el) { el.textContent = ${JSON.stringify(clip.countUp.prefix ?? '')} + Math.round(__counter_${id}.v) + ${JSON.stringify(clip.countUp.suffix ?? '')}; } } }, ${secondsString(startS)});`,
        });
    }

    // ── Audio fade automation (absolute-gain volume tweens)
    if (clip.audioFade && (clip.type === 'audio' || clip.hasAudio === true)) {
        const audioId = clip.type === 'video' ? `${id}-audio` : id;
        const gain = clip.volume ?? 1;
        const fades = clip.audioFade;
        if (fades.inSeconds !== undefined && fades.inSeconds > 0) {
            plan.push({
                atSeconds: startS,
                statement: `tl.fromTo("#${audioId}", { volume: 0 }, { volume: ${gain}, duration: ${secondsString(fades.inSeconds)}, ease: "none" }, ${secondsString(startS)});`,
            });
        }
        if (fades.outSeconds !== undefined && fades.outSeconds > 0) {
            const endS = startS + clipDurationSeconds(clip, fps);
            const outStart = Math.max(startS, endS - fades.outSeconds);
            plan.push({
                atSeconds: outStart,
                statement: `tl.to("#${audioId}", { volume: 0, duration: ${secondsString(endS - outStart)}, ease: "none" }, ${secondsString(outStart)});`,
            });
        }
    }
    return plan;
};

/** Box/wrapper target for seam tweens: video clips move the outer box, image/text move their section. */
const seamTargetFor = (clip: IndiiVideoClip): string => {
    const id = safeId(clip.id);
    return clip.type === 'video' ? `#${id}-box` : `#${id}-clip`;
};

/**
 * Velocity-matched cut-the-curve tweens at every adjacent clip boundary.
 * The outgoing clip accelerates in `seam.direction` and the incoming clip
 * continues the same vector from mid-flight — one continuous camera move.
 */
const seamPlansFor = (
    clips: IndiiVideoClip[],
    fps: number,
    seam: IndiiSeam,
): TweenPlan[] => {
    if (seam.type !== 'cut-the-curve') return [];
    const dir = seam.direction === 'RIGHT' ? 1 : seam.direction === 'UP' || seam.direction === 'DOWN' ? (seam.direction === 'UP' ? -1 : 1) : -1;
    const prop = seam.direction === 'UP' || seam.direction === 'DOWN' ? 'yPercent' : 'xPercent';
    const visual = (clip: IndiiVideoClip): boolean => clip.type !== 'audio';
    const ordered = [...clips].filter(visual).sort((a, b) => a.startFrame - b.startFrame);
    const plan: TweenPlan[] = [];
    for (let i = 0; i < ordered.length - 1; i += 1) {
        const out = ordered[i]!;
        const next = ordered[i + 1]!;
        const outEndFrame = out.startFrame + out.durationInFrames;
        const epsilon = 0.51;
        if (Math.abs(next.startFrame - outEndFrame) > epsilon) continue;
        const cut = next.startFrame / fps;
        const exitDur = 0.34;
        const entryDur = 0.42;
        plan.push({
            atSeconds: cut - exitDur,
            statement: `tl.to("${seamTargetFor(out)}", { ${prop}: ${12 * dir}, autoAlpha: 0, duration: ${exitDur}, ease: "power3.in" }, ${secondsString(cut - exitDur)});`,
        });
        plan.push({
            atSeconds: cut,
            statement: `tl.set("${seamTargetFor(out)}", { autoAlpha: 0 }, ${secondsString(cut)});`,
        });
        plan.push({
            atSeconds: cut,
            statement: `tl.fromTo("${seamTargetFor(next)}", { ${prop}: ${-10 * dir}, autoAlpha: 0.35 }, { ${prop}: 0, autoAlpha: 1, duration: ${entryDur}, ease: "power4.out", immediateRender: false }, ${secondsString(cut)});`,
        });
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
    project: Pick<IndiiVideoProject, 'id' | 'name' | 'fps' | 'durationInFrames' | 'width' | 'height' | 'tracks' | 'clips' | 'background' | 'seam'>,
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

    // Scene treatment: background layer + its ambient tween render behind all clips.
    let backgroundHtml = '';
    let canvas = DEFAULT_CANVAS;
    if (project.background) {
        const layer = backgroundLayerFor(project.background, durationSeconds);
        backgroundHtml = layer.html;
        canvas = layer.canvas;
        if (layer.tween) tweenPlans.push({ atSeconds: 0, statement: layer.tween });
    }

    // Velocity-matched seams at every adjacent visual-clip boundary.
    if (project.seam) {
        tweenPlans.push(...seamPlansFor(project.clips, fps, project.seam));
    }

    // Seek-safe counter objects for count-up clips.
    const counters = project.clips
        .filter(clip => clip.countUp)
        .map(clip => `      const __counter_${safeId(clip.id)} = { v: 0 };`)
        .join('\n');

    tweenPlans.sort((a, b) => a.atSeconds - b.atSeconds);
    const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=${project.width}, height=${project.height}" />
<title>${escapeHtml(project.name)}</title>
<script src="./gsap.min.js"></script>
<style>
  html, body { margin:0; width:100%; height:100%; background:#000; }
  #root { position:relative; width:${project.width}px; height:${project.height}px; overflow:hidden; background:${escapeHtml(canvas)}; }
  .clip { position:absolute; }
</style></head>
<body>
    <div id="root" data-hf-root data-composition-id="${compositionId}" data-start="0"
      data-width="${project.width}" data-height="${project.height}" data-duration="${secondsString(durationSeconds)}" data-fps="${fps}">
${backgroundHtml}
${bodyClips.join('\n')}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${counters}
${tweenPlans.map(tween => `      ${tween.statement}`).join('\n') || '      // no tweens — static timeline'}
      window.__timelines["${compositionId}"] = tl;
    </script>
</body></html>`;

    return { html, compositionId, durationSeconds };
};
