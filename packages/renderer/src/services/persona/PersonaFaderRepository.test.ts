import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONA_FADER_DEFAULT } from '@indii/shared';

const testMocks = vi.hoisted(() => ({
    doc: vi.fn(() => 'fader-ref'),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    auth: { currentUser: { uid: 'user-123' } as { uid: string } | null },
}));

vi.mock('firebase/firestore', () => ({
    doc: testMocks.doc,
    getDoc: testMocks.getDoc,
    setDoc: testMocks.setDoc,
    deleteDoc: testMocks.deleteDoc,
}));
vi.mock('@/services/firebase', () => ({
    auth: testMocks.auth,
    db: { kind: 'firestore' },
}));

import {
    loadPersonaFaderValues,
    resolvePersonaFaderValues,
    savePersonaFaderValues,
    resetPersonaFaderValues,
} from './PersonaFaderRepository';

describe('PersonaFaderRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        testMocks.auth.currentUser = { uid: 'user-123' };
    });

    it('loads a valid owner-scoped persona document', async () => {
        const values = { ...PERSONA_FADER_DEFAULT, brevity: 75 };
        testMocks.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ personaId: 'manager', values, updatedAt: 1 }),
        });

        await expect(loadPersonaFaderValues('manager')).resolves.toEqual(values);
        expect(testMocks.doc).toHaveBeenCalledWith(
            { kind: 'firestore' },
            'users',
            'user-123',
            'personaFaders',
            'manager',
        );
    });

    it('uses population defaults only when the user has no saved document', async () => {
        testMocks.getDoc.mockResolvedValue({ exists: () => false });

        const resolution = await resolvePersonaFaderValues('manager');

        expect(resolution).toEqual({ values: PERSONA_FADER_DEFAULT, source: 'absent-default' });
        expect(resolution.values).not.toBe(PERSONA_FADER_DEFAULT);
    });

    it('uses validated population defaults for an invalid saved document', async () => {
        testMocks.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ personaId: 'manager', values: { brevity: 75 } }),
        });

        await expect(resolvePersonaFaderValues('manager')).resolves.toEqual({
            values: PERSONA_FADER_DEFAULT,
            source: 'invalid-default',
        });
    });

    it('rejects unauthenticated access before touching Firestore', async () => {
        testMocks.auth.currentUser = null;

        await expect(loadPersonaFaderValues('manager')).rejects.toThrow('authenticated user');
        expect(testMocks.getDoc).not.toHaveBeenCalled();
    });

    it('persists valid persona faders to Firestore', async () => {
        const values = { ...PERSONA_FADER_DEFAULT, directness: 80, formality: 20 };
        testMocks.setDoc.mockResolvedValue(undefined);

        await expect(savePersonaFaderValues('manager', values)).resolves.toBeUndefined();
        expect(testMocks.doc).toHaveBeenCalledWith(
            { kind: 'firestore' },
            'users',
            'user-123',
            'personaFaders',
            'manager',
        );
        expect(testMocks.setDoc).toHaveBeenCalledWith('fader-ref', expect.objectContaining({
            personaId: 'manager',
            values,
            updatedAt: expect.any(Number),
        }));
    });

    it('rejects saving invalid fader values', async () => {
        // @ts-expect-error - testing invalid shape
        await expect(savePersonaFaderValues('manager', { brevity: 150 })).rejects.toThrow('Invalid persona fader');
        expect(testMocks.setDoc).not.toHaveBeenCalled();
    });

    it('deletes saved persona faders on reset', async () => {
        testMocks.deleteDoc.mockResolvedValue(undefined);

        await expect(resetPersonaFaderValues('manager')).resolves.toBeUndefined();
        expect(testMocks.doc).toHaveBeenCalledWith(
            { kind: 'firestore' },
            'users',
            'user-123',
            'personaFaders',
            'manager',
        );
        expect(testMocks.deleteDoc).toHaveBeenCalledWith('fader-ref');
    });
});
