import { describe, it, expect } from 'vitest';
import {
    CampaignSchema,
    ContactSchema,
    PublicistStatsSchema
} from './schema';

describe('Publicist Schemas', () => {
    describe('CampaignSchema', () => {
        it('should validate valid campaign', () => {
            const data = {
                artist: 'The Band',
                title: 'New Album',
                type: 'Album',
                releaseDate: '2023-12-01',
            };
            const result = CampaignSchema.parse(data);
            expect(result.status).toBe('Draft');
            expect(result.progress).toBe(0);
        });

        it('should validate enums', () => {
            expect(CampaignSchema.parse({
                artist: 'A', title: 'T', type: 'Single', releaseDate: '2023-01-01', status: 'Live'
            }).status).toBe('Live');

            expect(() => CampaignSchema.parse({
                artist: 'A', title: 'T', type: 'Invalid', releaseDate: '2023-01-01'
            })).toThrow();
        });
    });

    describe('ContactSchema', () => {
        it('should validate valid contact', () => {
            const data = {
                name: 'Jane Doe',
                outlet: 'Music Daily',
                role: 'Journalist',
                tier: 'Top'
            };
            const result = ContactSchema.parse(data);
            expect(result.influenceScore).toBe(0);
            expect(result.relationshipStrength).toBe('Neutral');
        });

        it('should validate tier enum', () => {
             const base = { name: 'J', outlet: 'O', role: 'Journalist' };
             expect(() => ContactSchema.parse({ ...base, tier: 'Mega' })).toThrow();
        });
    });

    describe('PublicistStatsSchema', () => {
        it('should validate stats', () => {
            const data = {
                globalReach: '10k',
                avgOpenRate: '25%',
                placementValue: '$500'
            };
            const result = PublicistStatsSchema.parse(data);
            expect(result.globalReach).toBe('10k');
        });
    });
});
