import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IndiiVideoProject } from '@indii/shared';
import { authorizeRenderInputs } from './render-input-access';

const project = (sources: string[]): IndiiVideoProject => ({
    id: 'p', name: 'Access boundary', fps: 30, width: 640, height: 360,
    durationInFrames: 30, tracks: [],
    clips: sources.map((src, i) => ({
        id: String(i), type: i === 0 ? 'video' : i === 1 ? 'audio' : 'image',
        src, name: 'Media', trackId: 't', startFrame: 0, durationInFrames: 30,
    })),
});

// Native temporary files and an explicit pure grant predicate; no service/auth mocks.
describe('render input filesystem boundary', () => {
    let root: string;
    let granted: string;
    let denied: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'indii-render-access-'));
        granted = path.join(root, 'granted media.mp4');
        denied = path.join(root, 'private.mp4');
        fs.writeFileSync(granted, 'authorized');
        fs.writeFileSync(denied, 'private');
        granted = fs.realpathSync(granted);
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
    const allow = (target: string) => target === granted;

    it('checks video, audio and image sources before returning a project', () => {
        for (const sources of [[denied], [granted, denied], [granted, granted, denied]]) {
            expect(() => authorizeRenderInputs(project(sources), allow)).toThrow('Access denied');
        }
    });
    it('canonicalizes approved paths and file URLs without mutating the editor project', () => {
        const input = project([granted, pathToFileURL(granted).href]);
        const result = authorizeRenderInputs(input, allow);
        expect(result.clips.map(c => c.src)).toEqual([pathToFileURL(granted).href, pathToFileURL(granted).href]);
        expect(input.clips[0].src).toBe(granted);
    });
    it('checks the symlink target rather than the apparent selected path', () => {
        const link = path.join(root, 'link.mp4');
        fs.symlinkSync(denied, link);
        expect(() => authorizeRenderInputs(project([link]), target => target === link)).toThrow('Access denied');
    });
    it('rejects directories, missing files, NUL and non-browser media protocols', () => {
        for (const source of [root, path.join(root, 'missing'), 'file\0.mp4', 'concat:file:/private', 'subfile:secret', 'ftp://example.com/a']) {
            expect(() => authorizeRenderInputs(project([source]), () => true)).toThrow();
        }
    });
    it('preserves web and embedded sources without granting local file access', () => {
        const input = project(['https://example.com/media.mp4', 'blob:https://example.com/id', 'data:image/png;base64,AA==']);
        expect(authorizeRenderInputs(input, () => false)).toEqual(input);
    });
});
