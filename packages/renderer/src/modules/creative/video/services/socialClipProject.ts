import type { IndiiVideoProject } from '@indii/shared';
export type SocialFormat = 'original' | '9:16' | '4:5';
export function createSocialClipProject(source: IndiiVideoProject, start: number, end: number, id: string, format: SocialFormat = 'original'): IndiiVideoProject {
    if (!id.trim() || id === source.id) throw new Error('A social copy needs its own project.');
    if (!Number.isFinite(source.fps) || source.fps <= 0 || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start < 0 || end <= start || end > source.durationInFrames) throw new Error('Choose a valid range inside the timeline.');
    const copy = structuredClone(source);
    copy.id = id; copy.name = `${source.name} — social clip`; copy.durationInFrames = end - start;
    const [width, height] = format === '9:16' ? [1080, 1920] : format === '4:5' ? [1080, 1350] : [source.width, source.height];
    if (![source.width, source.height, width, height].every(value => Number.isFinite(value) && value! > 0)) throw new Error('The project needs valid dimensions.');
    const fit = Math.min(width! / source.width, height! / source.height);
    const xScale = source.width * fit / width!; const yScale = source.height * fit / height!;
    const reframing = width !== source.width || height !== source.height;
    copy.width = width!; copy.height = height!;
    copy.clips = copy.clips.flatMap(clip => {
        const from = Math.max(start, clip.startFrame); const to = Math.min(end, clip.startFrame + clip.durationInFrames);
        if (to <= from) return [];
        if (clip.syncLock || clip.approvalReceiptId || clip.audioRecipeId) throw new Error('Render the approved synced video first, then make a social clip from that video.');
        const trimmed = from !== clip.startFrame || to !== clip.startFrame + clip.durationInFrames;
        const animated = Object.values(clip.keyframes ?? {}).some(keys => keys.length > 0) || clip.entrance || clip.countUp || clip.transitionIn || clip.transitionOut || clip.audioFade;
        if ((trimmed || reframing) && (animated || source.seam)) throw new Error('Render animated sections first, then clip the finished video to preserve their effects.');
        if (clip.type === 'video' || clip.type === 'audio') {
            const rate = clip.playbackRate ?? 1;
            if (!Number.isFinite(rate) || rate < 0.25 || rate > 4) throw new Error('Unsupported playback speed.');
            const originalIn = clip.sourceInUs ?? 0;
            const sourceIn = originalIn + Math.round((from - clip.startFrame) / source.fps * rate * 1_000_000);
            const sourceOut = originalIn + Math.round((to - clip.startFrame) / source.fps * rate * 1_000_000);
            if (!Number.isSafeInteger(sourceIn) || sourceIn < 0 || sourceOut <= sourceIn || (clip.sourceOutUs !== undefined && sourceOut > clip.sourceOutUs + 1)) throw new Error('Review this clip’s source range before copying.');
            clip.sourceInUs = sourceIn; clip.sourceOutUs = sourceOut;
        }
        if (reframing && clip.type !== 'audio') {
            clip.x = (1 - xScale) / 2 + (clip.x ?? 0) * xScale; clip.y = (1 - yScale) / 2 + (clip.y ?? 0) * yScale;
            clip.width = (clip.width ?? 1) * xScale; clip.height = (clip.height ?? 1) * yScale;
            if (clip.type === 'text') clip.fontSize = (clip.fontSize ?? 32) * fit;
            if (clip.borderRadius !== undefined) clip.borderRadius *= fit;
        }
        clip.startFrame = from - start; clip.durationInFrames = to - from;
        return [clip];
    });
    if (!copy.clips.length) throw new Error('This range contains no clips.');
    return copy;
}
