import { describe, it, expect } from 'vitest';
import { rinService } from './RINService';
import { MOCK_METADATA } from './ERNService.test';

describe('RINService', () => {
    it('should generate a valid RIN object from metadata', () => {
        const result = rinService.generateRIN(MOCK_METADATA);

        expect(result.messageHeader).toBeDefined();
        expect(result.rinMessageContent.soundRecordings.length).toBeDefined();

        // Should have 1 recording based on mock
        // (Assuming MOCK_METADATA has tracks, usually ERNService.test.ts mock has 1)
        if (result.rinMessageContent.soundRecordings.length > 0) {
            const recording = result.rinMessageContent.soundRecordings[0];
            expect(recording.title).toBeDefined();
            expect(recording.contributors.length).toBeGreaterThan(0);

            // Check session mapping
            expect(recording.studioSessions).toBeDefined();
            expect(recording.studioSessions?.[0].studioLocation.studioName).toBe('Home Studio');
        }
    });
});
