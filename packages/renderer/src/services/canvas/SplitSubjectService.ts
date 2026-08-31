/**
 * SplitSubjectService.ts
 *
 * Workstream C2.3 — "split subject from background" layer op, powered by
 * `@imgly/background-removal` (on-device, in-browser).
 *
 * License (recorded in FOUNDER_BLOCKERS + public/models/background-removal/LICENSES.md):
 *  - code: AGPL-3.0 (used unmodified via npm)
 *  - model weights: IMG.LY-proprietary, self-hosted under
 *    `public/models/background-removal/` — vendored with
 *    `scripts/vendor-imgly-weights.mjs`, never fetched from the CDN at runtime
 *    (Ground Rule 8).
 */

import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

const WEIGHTS_PUBLIC_PATH = '/models/background-removal/';

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('splitSubject: failed to read result blob'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Cut the subject out of `src` and return the transparent-background foreground
 * (subject) as a PNG data URL. The caller keeps the original layer as the
 * background, so the two-layer split needs only this single matting call.
 */
export async function splitSubjectToForeground(src: string): Promise<string> {
    const url = await resolveStorageUrl(src);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`splitSubject: failed to fetch layer source (HTTP ${response.status})`);
    }
    const blob = await response.blob();

    // Lazy-load the heavy onnxruntime/imgly runtime only when this op runs, so
    // it code-splits out of the main bundle (onnxruntime-web is ~MB of JS+WASM).
    const { removeBackground } = await import('@imgly/background-removal');
    const subjectBlob = await removeBackground(blob, {
        publicPath: WEIGHTS_PUBLIC_PATH,
        model: 'isnet_quint8',
        device: 'cpu',
        output: { format: 'image/png', quality: 0.8 },
    });

    return blobToDataUrl(subjectBlob);
}
