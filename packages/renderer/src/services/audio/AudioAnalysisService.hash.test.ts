import { describe, expect, it } from 'vitest';
import { AudioAnalysisService } from './AudioAnalysisService';

describe('AudioAnalysisService full-file cache identity', () => {
    it('does not collide when files differ after the first megabyte', async () => {
        const prefix = new Uint8Array(1024 * 1024).fill(7);
        const a = new File([prefix, new Uint8Array([1])], 'master.wav', { type: 'audio/wav' });
        const b = new File([prefix, new Uint8Array([2])], 'master.wav', { type: 'audio/wav' });
        const service = new AudioAnalysisService();
        await expect(service.generateFileHash(a)).resolves.not.toBe(await service.generateFileHash(b));
    });
});
