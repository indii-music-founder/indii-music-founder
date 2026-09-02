import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, Record<string, unknown>>();

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'user_test' } },
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    collection: (_db: unknown, ...segs: string[]) => ({ __path: segs.join('/') }),
    doc: (_db: unknown, ...segs: string[]) => ({ __path: segs.join('/') }),
    setDoc: vi.fn((ref: { __path: string }, data: Record<string, unknown>) => { store.set(ref.__path, data); }),
    getDoc: vi.fn(async (ref: { __path: string }) => ({ exists: () => store.has(ref.__path), data: () => store.get(ref.__path) }))
}));

import { validateRights, AssetRightsService } from '../AssetRightsService';

describe('validateRights (H2.1)', () => {
    it('accepts a valid ai-generated rights record', () => {
        expect(validateRights({ usageRights: 'ai-generated', disclosureRequired: true })).toEqual([]);
    });
    it('rejects a missing or invalid usageRights', () => {
        expect(validateRights({})).toContain('usageRights is required');
        expect(validateRights({ usageRights: 'royalty-free' as never }).join(' ')).toContain('invalid usageRights');
    });
    it('licensed-third-party requires licenseNotes', () => {
        expect(validateRights({ usageRights: 'licensed-third-party', disclosureRequired: true })).toContain('licensed-third-party requires licenseNotes');
        expect(validateRights({ usageRights: 'licensed-third-party', licenseNotes: 'via BMG', disclosureRequired: true })).toEqual([]);
    });
});

describe('AssetRightsService (H2.1 persistence)', () => {
    beforeEach(() => { store.clear(); vi.clearAllMocks(); });

    it('persists valid rights and rejects invalid ones', async () => {
        await AssetRightsService.setRights('asset_1', { usageRights: 'owned-licensed', disclosureRequired: false });
        expect(store.size).toBe(1);

        const err = (await AssetRightsService.setRights('asset_2', { usageRights: 'licensed-third-party', disclosureRequired: true }).catch(e => e)) as Error & { validationErrors?: string[] };
        expect(err.message).toContain('Invalid asset rights');
        expect(err.validationErrors).toContain('licensed-third-party requires licenseNotes');
    });

    it('reads back a rights record', async () => {
        await AssetRightsService.setRights('asset_3', { usageRights: 'ai-assisted', disclosureRequired: true });
        const got = await AssetRightsService.getRights('asset_3');
        expect(got).toEqual(expect.objectContaining({ usageRights: 'ai-assisted', disclosureRequired: true }));
        expect(await AssetRightsService.getRights('missing')).toBeNull();
    });
});
