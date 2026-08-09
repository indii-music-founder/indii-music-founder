import { describe, expect, it } from 'vitest';
import { buildChunkRecoveryUrl } from './dynamicImport';

describe('buildChunkRecoveryUrl', () => {
    it('cache-busts the document while preserving the route and existing query', () => {
        expect(buildChunkRecoveryUrl(
            'https://indii.music/boardroom?session=abc#response-1',
            1723200000000
        )).toBe(
            'https://indii.music/boardroom?session=abc&_chunk_reload=1723200000000#response-1'
        );
    });

    it('replaces an earlier recovery identifier instead of growing the URL', () => {
        expect(buildChunkRecoveryUrl(
            'https://indii.music/?_chunk_reload=1',
            2
        )).toBe('https://indii.music/?_chunk_reload=2');
    });
});
