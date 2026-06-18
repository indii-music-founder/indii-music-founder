import { describe, it, expect } from 'vitest';
import { MapsTools } from '../MapsTools';

describe('MapsTools', () => {
    it('search_places fails closed when no backend proxy exists', async () => {
        const result = await MapsTools.search_places({ query: 'pizza' });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('MAPS_BROWSER_DISABLED');
    });

    it('get_place_details fails closed when no backend proxy exists', async () => {
        const result = await MapsTools.get_place_details({ place_id: 'p1' });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('MAPS_BROWSER_DISABLED');
    });

    it('get_distance_matrix fails closed when no backend proxy exists', async () => {
        const result = await MapsTools.get_distance_matrix({ origins: ['A'], destinations: ['B'] });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('MAPS_BROWSER_DISABLED');
    });
});
