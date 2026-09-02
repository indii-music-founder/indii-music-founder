import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAudioIntelligenceSlice, type AudioIntelligenceSlice } from '../audioIntelligenceSlice';
import type { AudioIntelligenceProfile } from '@/services/audio/types';

describe('audioIntelligenceSlice Cache Invalidation & Mutations', () => {
    let state: AudioIntelligenceSlice;
    const setState = vi.fn((updater: ((s: AudioIntelligenceSlice) => Partial<AudioIntelligenceSlice>) | Partial<AudioIntelligenceSlice>) => {
        if (typeof updater === 'function') {
            state = { ...state, ...updater(state) };
        } else {
            state = { ...state, ...updater };
        }
    });
    const getState = () => state;

    beforeEach(() => {
        state = createAudioIntelligenceSlice(setState as any, getState as any, {} as any);
    });

    it('stores and retrieves profiles from cache', () => {
        const mockProfile = {
            id: 'fingerprint-123',
            technical: { bpm: 120, key: 'C', scale: 'major', energy: 0.8 },
            semantic: { ddexGenre: 'Electronic' }
        } as unknown as AudioIntelligenceProfile;

        state.audioProfiles['fingerprint-123'] = mockProfile;
        expect(state.getAudioProfile('fingerprint-123')).toBe(mockProfile);
    });

    it('invalidates a specific audio profile on post-mastering data mutation', () => {
        const mockProfile = {
            id: 'fingerprint-123',
            technical: { bpm: 120 },
        } as unknown as AudioIntelligenceProfile;

        state.audioProfiles['fingerprint-123'] = mockProfile;
        expect(state.getAudioProfile('fingerprint-123')).toBeDefined();

        state.invalidateAudioProfile('fingerprint-123');
        expect(state.getAudioProfile('fingerprint-123')).toBeUndefined();
    });

    it('updates a specific audio profile in place without invalidating whole cache', () => {
        const mockProfile = {
            id: 'fingerprint-123',
            technical: { bpm: 120, energy: 0.7 },
        } as unknown as AudioIntelligenceProfile;

        state.audioProfiles['fingerprint-123'] = mockProfile;

        state.updateAudioProfile('fingerprint-123', {
            technical: { bpm: 124, energy: 0.85 } as any,
        });

        const updated = state.getAudioProfile('fingerprint-123');
        expect(updated?.technical.bpm).toBe(124);
        expect(updated?.technical.energy).toBe(0.85);
    });

    it('clears all audio profiles on demand', () => {
        state.audioProfiles = {
            'fp-1': { id: 'fp-1' } as any,
            'fp-2': { id: 'fp-2' } as any,
        };

        state.clearAudioProfiles();
        expect(Object.keys(state.audioProfiles).length).toBe(0);
    });
});
