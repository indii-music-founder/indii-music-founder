import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'signal-1' });
const mockCollection = vi.fn().mockReturnValue('collection-ref');

vi.mock('firebase/firestore', () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {
        currentUser: { uid: 'alice-uid' } as { uid: string } | null,
    },
}));

import { auth } from '@/services/firebase';
import {
    recordSignal,
    recordSignalWithResult,
    recordCopied,
    recordActedOn,
    recordReAsked,
    recordPersonaSwitched,
    recordThreadAbandoned,
    PersonaInteractionRecorderError,
} from './PersonaInteractionRecorder';

describe('PersonaInteractionRecorder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (auth as unknown as { currentUser: { uid: string } | null }).currentUser = { uid: 'alice-uid' };
    });

    it('writes a valid signal to the correct owner-scoped path', async () => {
        await recordSignal('manager', 'resp-1', 'copied');

        expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'alice-uid', 'personaInteractionSignals');
        expect(mockAddDoc).toHaveBeenCalledWith(
            'collection-ref',
            expect.objectContaining({ personaId: 'manager', responseId: 'resp-1', signalType: 'copied' })
        );
    });

    it('returns a persistence receipt only after the owner-scoped write resolves', async () => {
        await expect(recordSignalWithResult('manager', 'resp-receipt', 'copied')).resolves.toBe('recorded');

        expect(mockAddDoc).toHaveBeenCalledWith(
            'collection-ref',
            expect.objectContaining({ responseId: 'resp-receipt' }),
        );
    });

    it('is a silent no-op when no user is signed in (nothing to attribute the signal to)', async () => {
        (auth as unknown as { currentUser: { uid: string } | null }).currentUser = null;
        await expect(recordSignal('manager', 'resp-1', 'copied')).resolves.toBeUndefined();
        expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('reports an unauthenticated skip without changing the original no-op contract', async () => {
        (auth as unknown as { currentUser: { uid: string } | null }).currentUser = null;

        await expect(recordSignalWithResult('manager', 'resp-1', 'copied')).resolves.toBe(
            'skipped-unauthenticated',
        );
        expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('throws PersonaInteractionRecorderError on an empty personaId (programming error, not swallowed)', async () => {
        await expect(recordSignal('', 'resp-1', 'copied')).rejects.toThrow(PersonaInteractionRecorderError);
        expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('throws on an empty responseId', async () => {
        await expect(recordSignal('manager', '', 'copied')).rejects.toThrow(PersonaInteractionRecorderError);
    });

    describe('convenience wrappers', () => {
        it.each([
            ['copied', recordCopied],
            ['actedOn', recordActedOn],
            ['reAsked', recordReAsked],
            ['personaSwitched', recordPersonaSwitched],
            ['threadAbandoned', recordThreadAbandoned],
        ] as const)('records signalType "%s"', async (expectedType, fn) => {
            await fn('manager', 'resp-1');
            expect(mockAddDoc).toHaveBeenCalledWith(
                'collection-ref',
                expect.objectContaining({ signalType: expectedType })
            );
        });
    });

    // ── Style/substance isolation ───────────────────────────────────────
    // This module is write-only for observational events. There is no read
    // path here and no function that could feed a signal back into what a
    // response says — the only exported "content" fields are personaId,
    // responseId, and a signalType drawn from a closed enum.
    it('recordSignal has no parameter through which arbitrary content could be written', () => {
        expect(recordSignal.length).toBe(3); // (personaId, responseId, signalType) only
    });
});
