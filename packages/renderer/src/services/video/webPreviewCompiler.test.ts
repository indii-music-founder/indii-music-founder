import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndiiVideoProject } from '@indii/shared';

import {
    GSAP_SIDECAR_SRC,
    HYPERFRAMES_RUNTIME_SRC,
    compileProjectForWebPreview,
    releaseWebPreviewResources,
    rewriteCompiledHtmlForWebPlayer,
} from './webPreviewCompiler';

const COMPILED_DOC = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<title>t</title>
<script src="./gsap.min.js"></script>
<style></style></head>
<body>
    <div id="root" data-composition-id="demo" data-duration="1"></div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["demo"] = tl;
    </script>
</body></html>`;

const baseProject = (): IndiiVideoProject => ({
    id: 'web-preview',
    name: 'Web preview fixture',
    fps: 30,
    width: 320,
    height: 180,
    durationInFrames: 30,
    tracks: [{ id: 't1', name: 'V1', type: 'video' }],
    clips: [{
        id: 'c1', type: 'video', src: 'input.mp4', name: 'src',
        startFrame: 0, durationInFrames: 30, trackId: 't1',
        sourceInUs: 0, sourceOutUs: 1_000_000,
    }],
});

describe('rewriteCompiledHtmlForWebPlayer', () => {
    const createScriptUrl = vi.fn((_source: string) => 'blob:mock-timeline');
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL = revokeObjectURL;
    });

    afterEach(() => {
        releaseWebPreviewResources();
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    });

    it('pins the gsap sidecar to the origin-root served copy', () => {
        const out = rewriteCompiledHtmlForWebPlayer(COMPILED_DOC, { createScriptUrl });
        expect(out).toContain(`<script src="${GSAP_SIDECAR_SRC}"></script>`);
        expect(out).not.toContain('<script src="./gsap.min.js"></script>');
    });

    it('pre-injects the pinned runtime so the player skips its CDN injection', () => {
        const out = rewriteCompiledHtmlForWebPlayer(COMPILED_DOC, { createScriptUrl });
        expect(out).toContain(`<script src="${HYPERFRAMES_RUNTIME_SRC}"></script>`);
        // Runtime must load after gsap exists.
        expect(out.indexOf(GSAP_SIDECAR_SRC)).toBeLessThan(out.indexOf(HYPERFRAMES_RUNTIME_SRC));
        // The player's dedupe matches this exact filename substring.
        expect(out).toContain('hyperframe.runtime.iife.js');
    });

    it('moves the inline GSAP plan into a blob script and keeps the plan byte-identical', () => {
        const out = rewriteCompiledHtmlForWebPlayer(COMPILED_DOC, { createScriptUrl });
        expect(createScriptUrl).toHaveBeenCalledTimes(1);
        const plan = createScriptUrl.mock.calls[0]![0]!;
        expect(plan).toContain('window.__timelines = window.__timelines || {};');
        expect(plan).toContain('gsap.timeline({ paused: true })');
        expect(plan).toContain('window.__timelines["demo"] = tl;');

        expect(out).toContain('<script src="blob:mock-timeline"></script>');
        expect(out).not.toContain('<script>\n      window.__timelines');
    });

    it('retains recent timeline blobs so concurrent players never lose theirs', () => {
        // Editor stage + pop-out viewer compile independently; a revoke on
        // replace would kill the blob the other live document still uses.
        createScriptUrl.mockReturnValueOnce('blob:mock-timeline-1')
            .mockReturnValueOnce('blob:mock-timeline-2');
        rewriteCompiledHtmlForWebPlayer(COMPILED_DOC, { createScriptUrl });
        rewriteCompiledHtmlForWebPlayer(COMPILED_DOC, { createScriptUrl });
        expect(revokeObjectURL).not.toHaveBeenCalled();
    });

    it('revokes only the oldest blob once the retention window overflows', () => {
        let n = 0;
        createScriptUrl.mockImplementation(() => `blob:mock-${++n}`);
        for (let i = 0; i < 9; i += 1) rewriteCompiledHtmlForWebPlayer(COMPILED_DOC, { createScriptUrl });
        expect(revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-1');
    });

    it('releases every retained blob on releaseWebPreviewResources', () => {
        createScriptUrl.mockReturnValueOnce('blob:mock-timeline-1')
            .mockReturnValueOnce('blob:mock-timeline-2');
        rewriteCompiledHtmlForWebPlayer(COMPILED_DOC, { createScriptUrl });
        rewriteCompiledHtmlForWebPlayer(COMPILED_DOC, { createScriptUrl });
        releaseWebPreviewResources();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-timeline-1');
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-timeline-2');
    });

    it('fails loud when the compiler output shape drifts', () => {
        expect(() => rewriteCompiledHtmlForWebPlayer('<html><body></body></html>', { createScriptUrl }))
            .toThrow(/missing the gsap\.min\.js sidecar/);
        expect(() => rewriteCompiledHtmlForWebPlayer(
            COMPILED_DOC.replace(/<script>\s*window\.__timelines[\s\S]*?<\/script>/, '<script>static</script>'),
            { createScriptUrl },
        )).toThrow(/missing the inline __timelines script/);
    });
});

describe('compileProjectForWebPreview', () => {
    // jsdom has no createObjectURL; stub it for the default factory path.
    const createObjectURL = vi.fn(() => 'blob:stub');
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (URL as unknown as { createObjectURL?: unknown }).createObjectURL = createObjectURL;
        (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL = revokeObjectURL;
    });

    afterEach(() => {
        releaseWebPreviewResources();
        delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
        delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    });

    it('compiles through the shared pure compiler and re-plumbs the document for the web player', () => {
        const out = compileProjectForWebPreview(baseProject());

        expect(out).toContain('<script src="/gsap.min.js"></script>');
        expect(out).toContain('<script src="/hyperframe.runtime.iife.js"></script>');
        expect(out).toContain('<script src="blob:stub"></script>');
        expect(out).toContain('data-composition-id="web-preview"');
        expect(out).not.toContain('<script src="./gsap.min.js"></script>');
    });

    it('surfaces compiler validation errors instead of emitting a broken document', () => {
        const broken = { ...baseProject(), durationInFrames: 0 };
        expect(() => compileProjectForWebPreview(broken)).toThrow(/invalid durationInFrames/);
    });
});
