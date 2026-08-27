/**
 * Composition preparation — the worker's share of the same translation layer
 * the desktop uses: compile the staged project and write the composition
 * directory (index.html + vendored gsap runtime) ready for the CLI.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { IndiiVideoProject } from '@indii/shared';
import { compileProjectToHyperFrames } from '@indii/video-compiler';

import { GSAP_SOURCE } from './gsapAsset.js';

export async function prepareComposition(project: IndiiVideoProject, compositionDir: string): Promise<void> {
    await mkdir(compositionDir, { recursive: true });
    const compiled = compileProjectToHyperFrames(project);
    await writeFile(path.join(compositionDir, 'index.html'), compiled.html, 'utf8');
    await writeFile(path.join(compositionDir, 'gsap.min.js'), GSAP_SOURCE, 'utf8');
}
