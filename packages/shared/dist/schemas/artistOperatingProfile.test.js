import { describe, expect, it } from 'vitest';
import { ArtistOperatingProfileSchema, DEFAULT_ARTIST_OPERATING_PROFILE, hasAutonomousComputerControl, } from './artistOperatingProfile';
describe('ArtistOperatingProfileSchema', () => {
    it('accepts the default profile', () => {
        expect(ArtistOperatingProfileSchema.parse(DEFAULT_ARTIST_OPERATING_PROFILE)).toEqual(DEFAULT_ARTIST_OPERATING_PROFILE);
    });
    it('applies field defaults when arrays/permissions are omitted', () => {
        const parsed = ArtistOperatingProfileSchema.parse({ schemaVersion: 'artist-operating-profile.v1' });
        expect(parsed.businessGoals).toEqual([]);
        expect(parsed.permissions.autonomousComputerControl).toBe(false);
        expect(parsed.permissions.allowDestructiveTools).toBe(false);
    });
    it('accepts a fully populated profile', () => {
        const profile = {
            schemaVersion: 'artist-operating-profile.v1',
            businessGoals: ['Grow email list before next release'],
            creativeBoundaries: ['Never post without review', 'No AI voice cloning'],
            installedSoftware: ['Ableton Live 12', 'Final Cut Pro'],
            connectedServiceIds: ['spotify-for-artists'],
            permissions: {
                autonomousComputerControl: true,
                allowDestructiveTools: false,
                preApprovedToolNames: ['computer_click'],
            },
            updatedAt: '2026-07-23T12:00:00.000Z',
        };
        expect(ArtistOperatingProfileSchema.parse(profile)).toEqual(profile);
    });
    it('rejects unknown top-level fields (strict schema)', () => {
        expect(() => ArtistOperatingProfileSchema.parse({
            schemaVersion: 'artist-operating-profile.v1',
            notARealField: true,
        })).toThrow();
    });
    it('rejects the wrong schemaVersion literal', () => {
        expect(() => ArtistOperatingProfileSchema.parse({ schemaVersion: 'v2', businessGoals: [] })).toThrow();
    });
    it('caps businessGoals at 20 entries', () => {
        expect(() => ArtistOperatingProfileSchema.parse({
            schemaVersion: 'artist-operating-profile.v1',
            businessGoals: Array.from({ length: 21 }, (_, i) => `goal-${i}`),
        })).toThrow();
    });
    it('rejects blank/whitespace-only free-text lines', () => {
        expect(() => ArtistOperatingProfileSchema.parse({
            schemaVersion: 'artist-operating-profile.v1',
            businessGoals: ['   '],
        })).toThrow();
    });
});
describe('hasAutonomousComputerControl', () => {
    it('is fail-closed for a null/undefined profile', () => {
        expect(hasAutonomousComputerControl(null)).toBe(false);
        expect(hasAutonomousComputerControl(undefined)).toBe(false);
    });
    it('is fail-closed for the default profile', () => {
        expect(hasAutonomousComputerControl(DEFAULT_ARTIST_OPERATING_PROFILE)).toBe(false);
    });
    it('is true only when explicitly opted in', () => {
        const opted = {
            ...DEFAULT_ARTIST_OPERATING_PROFILE,
            permissions: { ...DEFAULT_ARTIST_OPERATING_PROFILE.permissions, autonomousComputerControl: true },
        };
        expect(hasAutonomousComputerControl(opted)).toBe(true);
    });
});
