import { describe, it, expect } from 'vitest';
import { syncMetadataTaggingService } from './SyncMetadataTaggingService';

describe('SyncMetadataTaggingService', () => {
    describe('mapToSyncMoods', () => {
        it('should map standard AI moods to sync moods', () => {
            const aiMoods = ['epic orchestral', 'somber sad piano', 'driving synthwave'];
            const mapped = syncMetadataTaggingService.mapToSyncMoods(aiMoods);

            expect(mapped).toContain('Cinematic');
            expect(mapped).toContain('Melancholic');
            expect(mapped).toContain('Energetic');
        });

        it('returns no fabricated mood when nothing matches (ISSUE-1443)', () => {
            // The old behavior wrote a wrong 'Chill' to Firestore for unrecognized
            // moods, poisoning the sync matcher's input.
            const aiMoods = ['experimental industrial glitched noise'];
            const mapped = syncMetadataTaggingService.mapToSyncMoods(aiMoods);

            expect(mapped).toEqual([]);
        });

        it('does not substring-map negation-like words (ISSUE-1443)', () => {
            // 'unhappy' contains 'happy' but is not Upbeat.
            const mapped = syncMetadataTaggingService.mapToSyncMoods(['unhappy', 'lovelorn']);
            expect(mapped).toEqual([]);
        });

        it('still matches compound tags by whole word', () => {
            const mapped = syncMetadataTaggingService.mapToSyncMoods(['dark-pop', 'epic orchestral']);
            expect(mapped).toContain('Dark');
            expect(mapped).toContain('Cinematic');
        });

        it('should handle case insensitivity and trim spacing', () => {
            const aiMoods = ['  DARK  ', 'ROMANTIC '];
            const mapped = syncMetadataTaggingService.mapToSyncMoods(aiMoods);

            expect(mapped).toContain('Dark');
            expect(mapped).toContain('Romantic');
        });
    });
});
