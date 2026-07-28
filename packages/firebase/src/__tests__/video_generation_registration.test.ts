import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('video worker registration contract', () => {
    it('does not register the obsolete unadmitted single-video Inngest event', () => {
        const indexSource = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');

        expect(indexSource).not.toContain('generateVideoFn');
        expect(indexSource).not.toContain('video/generate.requested');
    });

    it('keeps every active Vertex video worker free of public Storage writes', () => {
        const activeSources = [
            readFileSync(resolve(__dirname, '../lib/video_generation_direct.ts'), 'utf8'),
            readFileSync(resolve(__dirname, '../lib/long_form_video.ts'), 'utf8'),
        ].join('\n');

        expect(activeSources).not.toContain('public: true');
        expect(activeSources).not.toContain('.publicUrl()');
        expect(activeSources).not.toContain('https://storage.googleapis.com/${bucketName}');
    });
});
