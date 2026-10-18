import { extractCutout, type CutoutInput } from './GrabCut';
import license from './PHOTOCRAFT-LICENSE.txt?raw';

self.onmessage = (event: MessageEvent<CutoutInput | { kind: 'license' }>) => {
    // Keep the selected source license in the distributed worker bundle.
    if ('kind' in event.data) { self.postMessage({ kind: 'license', text: license }); return; }
    try {
        const mask = extractCutout(event.data, progress => self.postMessage({ kind: 'progress', progress }));
        self.postMessage({ kind: 'result', mask }, { transfer: [mask.buffer as ArrayBuffer] });
    } catch (failure) {
        self.postMessage({ kind: 'error', message: failure instanceof Error ? failure.message : 'Cutout processing failed' });
    }
};
