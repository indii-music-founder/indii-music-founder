import { describe, expect, it } from 'vitest';
import { avatarGenerationService } from './AvatarGenerationService';

describe('AvatarGenerationService', () => {
    it('fails honestly because avatar generation is not deployed', async () => {
        await expect(
            avatarGenerationService.generateLipSync('gs://bucket/image.png', 'gs://bucket/audio.wav')
        ).rejects.toThrow('Avatar generation is unavailable until the backend worker is deployed.');

        await expect(
            avatarGenerationService.checkJobStatus('job-123')
        ).rejects.toThrow('Avatar job status is unavailable until the backend worker is deployed.');
    });
});
