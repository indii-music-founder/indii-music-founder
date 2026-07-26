import type { VideoProject } from '../../store/videoEditorStore';

/**
 * Prevents the editor from sending preview-only media to the protected cloud
 * renderer. The callable repeats these checks because browser state is never
 * an authorization boundary.
 */
export function cloudRenderEligibilityError(project: VideoProject): string | undefined {
    const videoClips = project.clips.filter(clip => clip.type === 'video');
    if (videoClips.length === 0) return 'Add at least one server-owned video clip before exporting.';
    if (videoClips.some(clip => !clip.canonicalSourceUri)) {
        return 'Cloud export requires video clips from your secure media library. Preview-only URLs cannot be rendered.';
    }

    const audioClips = project.clips.filter(clip => clip.type === 'audio');
    if (audioClips.length > 1) return 'Cloud export supports one canonical master audio clip.';
    if (audioClips.length === 1 && !audioClips[0]?.canonicalMaster) {
        return 'Cloud export requires a verified WAV or FLAC canonical master. Preview-only audio cannot be rendered.';
    }
    return undefined;
}
