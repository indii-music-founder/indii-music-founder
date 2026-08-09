import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERSONA_FADER_DEFAULT } from '@indii/shared';

const testMocks = vi.hoisted(() => ({
    doc: vi.fn(() => 'fader-ref'),
    getDoc: vi.fn(),
    auth: { currentUser: { uid: 'user-123' } as { uid: string } | null },
}));

vi.mock('firebase/firestore', () => ({ doc: testMocks.doc, getDoc: testMocks.getDoc }));
vi.mock('@/services/firebase', () => ({
    auth: testMocks.auth,
    db: { kind: 'firestore' },
}));

import {
    loadPersonaFaderValues,
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

        const result = await loadPersonaFaderValues('manager');

        expect(result).toEqual(PERSONA_FADER_DEFAULT);
        expect(result).not.toBe(PERSONA_FADER_DEFAULT);
    });

    it('uses validated population defaults for an invalid saved document', async () => {
        testMocks.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({ personaId: 'manager', values: { brevity: 75 } }),
        });

        await expect(loadPersonaFaderValues('manager')).resolves.toEqual(PERSONA_FADER_DEFAULT);
    });

    it('rejects unauthenticated access before touching Firestore', async () => {
        testMocks.auth.currentUser = null;

        await expect(loadPersonaFaderValues('manager')).rejects.toThrow('authenticated user');
        expect(testMocks.getDoc).not.toHaveBeenCalled();
    });
});
