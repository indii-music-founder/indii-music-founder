import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { IndiiVideoProject } from '@indii/shared';

/** Resolve local media before either preview compilation or an executor can read it. */
export function authorizeRenderInputs(
    project: IndiiVideoProject,
    verifyAccess: (canonicalPath: string) => boolean,
): IndiiVideoProject {
    if (!project || !Array.isArray(project.clips) || !Array.isArray(project.tracks)) {
        throw new Error('Rendering requires an IndiiVideoProject.');
    }
    return {
        ...project,
        clips: project.clips.map(clip => {
            if (clip.src === undefined || clip.src === '') return clip;
            if (typeof clip.src !== 'string' || clip.src.includes('\0')) {
                throw new Error('Invalid render media source.');
            }
            const source = clip.src;
            // A Windows drive is a path, not an FFmpeg protocol. All other
            // non-browser protocols are denied (concat:, subfile:, crypto:, etc.).
            const isPath = path.isAbsolute(source) || /^[a-z]:[\\/]/i.test(source);
            const scheme = isPath ? undefined : /^([a-z][a-z\d+.-]*):/i.exec(source)?.[1].toLowerCase();
            if (scheme && ['https', 'http', 'blob', 'data'].includes(scheme)) return clip;
            if (scheme && scheme !== 'file') throw new Error('Unsupported render media protocol.');
            const localPath = scheme === 'file' ? fileURLToPath(source) : path.resolve(source);
            const canonicalPath = fs.realpathSync(localPath);
            if (!verifyAccess(canonicalPath)) throw new Error('Access denied to render media source.');
            if (!fs.statSync(canonicalPath).isFile()) throw new Error('Render media source must be a file.');
            // Pin the name passed downstream to the authorized canonical file;
            // never pass the original symlink/relative path to an executor.
            return { ...clip, src: pathToFileURL(canonicalPath).href };
        }),
    };
}
