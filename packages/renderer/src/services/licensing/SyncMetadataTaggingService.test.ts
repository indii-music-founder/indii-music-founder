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

        it('should return default fallback Chill if no matches are found', () => {
            const aiMoods = ['experimental industrial glitched noise'];
            const mapped = syncMetadataTaggingService.mapToSyncMoods(aiMoods);

            expect(mapped).toEqual(['Chill']);
        });

        it('should handle case insensitivity and trim spacing', () => {
            const aiMoods = ['  DARK  ', 'ROMANTIC '];
            const mapped = syncMetadataTaggingService.mapToSyncMoods(aiMoods);

            expect(mapped).toContain('Dark');
            expect(mapped).toContain('Romantic');
        });
    });
});
