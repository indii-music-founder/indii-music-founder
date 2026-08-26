/**
 * Media staging — every clip source becomes a LOCAL relative filename before
 * compilation, so the composition renders offline in the worker container.
 * The framework-neutral project model is preserved; only `src` values are
 * rewritten. The fetcher is injected so tests never touch the network.
 */

import path from 'node:path';

import type { IndiiVideoClip, IndiiVideoProject } from '@indii/shared';

export interface MediaFetcher {
    (url: string, destination: string): Promise<void>;
}

const extensionFor = (url: string): string => {
    const raw = url.split('?')[0]!.split('#')[0]!;
    const base = raw.split('/').pop() ?? '';
    const match = /\.([a-z0-9]{1,6})$/i.exec(base);
    return match ? `.${match[1]!.toLowerCase()}` : '.bin';
};

/**
 * Downloads every media clip into `destinationDir` under a deterministic
 * local name and rewrites the project's `src` values to match. Text clips
 * are left untouched.
 */
export async function stageMedia(
    project: IndiiVideoProject,
    destinationDir: string,
    fetchToFile: MediaFetcher,
): Promise<IndiiVideoProject> {
    const clips: IndiiVideoClip[] = [];
    for (const clip of project.clips) {
        if (clip.type === 'text' || !clip.src) {
            clips.push(clip);
            continue;
        }
        const safeId = clip.id.replace(/[^a-zA-Z0-9_-]/g, '-');
        const localName = `${safeId}${extensionFor(clip.src)}`;
        await fetchToFile(clip.src, path.join(destinationDir, localName));
        clips.push({ ...clip, src: localName });
    }
    return { ...project, clips };
}
