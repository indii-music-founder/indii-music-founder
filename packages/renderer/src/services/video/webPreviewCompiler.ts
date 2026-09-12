/**
 * Web preview compilation (ISSUE-1433 "browser live compiled preview").
 *
 * `compileProjectToHyperFrames` is pure TS and runs anywhere, but its output
 * is a standalone HyperFrames document written for executors that sit beside a
 * `gsap.min.js` sidecar file (desktop render temp dir, cloud worker). The web
 * player (`@hyperframes-player` fed via `srcdoc`) needs the document re-plumbed
 * before it can run inside the Studio origin:
 *
 *  1. Sidecar script: `<script src="./gsap.min.js">` resolves relative to the
 *     srcdoc base URL — the *parent SPA route* (e.g. `/creative/gsap.min.js`),
 *     which 404s. We pin it to the origin-root copy in `public/gsap.min.js`,
 *     served same-origin by Vite dev and the Firebase `app` hosting target.
 *     `script-src 'self'` already allows it.
 *  2. Runtime pre-inject: the player injects its runtime from jsDelivr when a
 *     document has timelines but no runtime bridge. Production CSP does not
 *     allow that origin for scripts, and the runtime is what orchestrates
 *     `<video>`/`<audio>` elements against the timeline (data-start,
 *     data-media-start, data-playback-rate). We pre-inject the exact pinned
 *     runtime (`public/hyperframe.runtime.iife.js`, byte-identical to the
 *     `@hyperframes/core` dist the installed player pins to). The player's own
 *     dedupe check (`/hyperframe\.runtime\.iife\.js|__hyperframes\s*=/`) then
 *     skips its CDN injection entirely — same-origin, offline-capable.
 *  3. Timeline extraction: the GSAP plan is an inline `<script>`, and srcdoc
 *     documents inherit the embedding page's CSP. Production has no
 *     `unsafe-inline`, so the inline plan would be silently blocked. We move
 *     the byte-identical plan into a same-origin blob and load it via
 *     `<script src="blob:…">`; `firebase.json` adds `blob:` to `script-src`
 *     for `/creative/**` only — the rest of the app stays strict.
 *
 * The Electron path is untouched: desktop keeps compiling through the IPC
 * bridge (`ElectronRenderService`), which writes the sidecar next to the
 * document so preview and final render stay byte-identical.
 */

import { compileProjectToHyperFrames } from '@indii/video-compiler';
import type { IndiiVideoProject } from '@indii/shared';

/** Origin-root sidecar served from `packages/renderer/public/`. */
export const GSAP_SIDECAR_SRC = '/gsap.min.js';
/** Pinned HyperFrames runtime served from `packages/renderer/public/`. */
export const HYPERFRAMES_RUNTIME_SRC = '/hyperframe.runtime.iife.js';

const DESKTOP_SIDECAR_TAG = '<script src="./gsap.min.js"></script>';
const TIMELINE_SCRIPT_PATTERN = /<script>(\s*window\.__timelines[\s\S]*?)<\/script>/;

export interface WebPreviewRewriteOptions {
    /**
     * Turns timeline script source into a loadable URL. Defaults to a
     * same-origin `blob:` URL; tests inject a stub because jsdom lacks
     * `URL.createObjectURL`.
     */
    createScriptUrl?: (scriptSource: string) => string;
}

const defaultCreateScriptUrl = (scriptSource: string): string => {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        throw new Error('webPreviewCompiler: URL.createObjectURL is unavailable in this environment');
    }
    return URL.createObjectURL(new Blob([scriptSource], { type: 'text/javascript' }));
};

/**
 * Blob URLs must outlive the synchronous rewrite (the player fetches them when
 * it parses the srcdoc), but holding one per compile leaks. Multiple players
 * can be alive at once (editor stage + pop-out viewer), so URLs are never
 * revoked on replace — a revoke would kill the blob another live document is
 * still using. Keep a bounded window of the most recent URLs and revoke only
 * the oldest overflow; each retained blob is a few KB of timeline source.
 */
const MAX_RETAINED_TIMELINE_URLS = 8;
const retainedTimelineUrls: string[] = [];

const acquireTimelineUrl = (createScriptUrl: (source: string) => string, scriptSource: string): string => {
    const url = createScriptUrl(scriptSource);
    retainedTimelineUrls.push(url);
    while (retainedTimelineUrls.length > MAX_RETAINED_TIMELINE_URLS) {
        const oldest = retainedTimelineUrls.shift();
        if (oldest && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(oldest);
        }
    }
    return url;
};

/** Test seam: drop every retained blob URL without compiling. */
export const releaseWebPreviewResources = (): void => {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        for (const url of retainedTimelineUrls) URL.revokeObjectURL(url);
    }
    retainedTimelineUrls.length = 0;
};

/**
 * Re-plumb one compiled HyperFrames document for the in-browser player.
 * Throws when the compiler output no longer matches the documented shape so
 * problems surface in the preview error state instead of a silently static
 * document.
 */
export const rewriteCompiledHtmlForWebPlayer = (html: string, options: WebPreviewRewriteOptions = {}): string => {
    const createScriptUrl = options.createScriptUrl ?? defaultCreateScriptUrl;

    if (!html.includes(DESKTOP_SIDECAR_TAG)) {
        throw new Error('webPreviewCompiler: compiled document is missing the gsap.min.js sidecar script tag');
    }

    // 1. Sidecar → origin root.
    let rewritten = html.replace(DESKTOP_SIDECAR_TAG, `<script src="${GSAP_SIDECAR_SRC}"></script>`);

    // 2. Pinned runtime right after the sidecar (loads after window.gsap exists).
    rewritten = rewritten.replace(
        `<script src="${GSAP_SIDECAR_SRC}"></script>`,
        `<script src="${GSAP_SIDECAR_SRC}"></script>\n<script src="${HYPERFRAMES_RUNTIME_SRC}"></script>`,
    );

    // 3. Inline GSAP plan → same-origin blob script. (Replacer function, so a
    // blob URL containing `$` can never be read as a replace pattern.)
    const timelineMatch = rewritten.match(TIMELINE_SCRIPT_PATTERN);
    if (!timelineMatch) {
        throw new Error('webPreviewCompiler: compiled document is missing the inline __timelines script block');
    }
    const timelineUrl = acquireTimelineUrl(createScriptUrl, timelineMatch[1]!);
    rewritten = rewritten.replace(TIMELINE_SCRIPT_PATTERN, () => `<script src="${timelineUrl}"></script>`);

    return rewritten;
};

/** Compile a canonical project and re-plumb it for the web player in one step. */
export const compileProjectForWebPreview = (project: IndiiVideoProject): string =>
    rewriteCompiledHtmlForWebPlayer(compileProjectToHyperFrames(project).html);
