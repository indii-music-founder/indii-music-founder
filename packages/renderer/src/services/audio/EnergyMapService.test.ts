import { describe, expect, it } from 'vitest';

import { EnergyMapService } from './EnergyMapService';

describe('EnergyMapService', () => {
    it('rejects raw browser masters instead of base64-encoding them for Gemini', async () => {
        const service = new EnergyMapService();
        const file = new File(['master bytes'], 'master.wav', { type: 'audio/wav' });

        await expect(service.mapEmotionalArc(file, {
            bpm: 120,
            key: 'C',
            scale: 'major',
            energy: 0.6,
            duration: 180,
            danceability: 0.5,
            loudness: -10,
        })).rejects.toThrow(/cannot be sent to Gemini/);
    });
});
