/**
 * Structural tests for the contact review flow (#318): the human-review gate
 * that turns an AI-extracted FieldContact into a confirmed record. Firebase
 * is the centralized test mock — these prove the service contract, not the
 * live Firestore path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTransaction } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { EncounterService } from '@/services/encounters/EncounterService';

const reviewFields = {
    name: '  Marcus Vance  ',
    phone: ' 313-555-0199 ',
    email: 'marcus@example.com',
    organization: 'Live Nation',
    notes: 'Met backstage',
    role: 'manager' as const,
};

function completedEncounterData() {
    return {
        status: 'completed',
        extractedContact: { name: 'Marcus Vance', role: 'manager' },
        createdAt: new Date('2026-09-27T10:00:00Z'),
        assets: [
            { id: 'a1', type: 'photo', downloadUrl: 'https://cdn.example.com/photo.jpg' },
            { id: 'a2', type: 'audio', downloadUrl: 'https://cdn.example.com/memo.m4a' },
        ],
    };
}

function transactionWith(encounterData: Record<string, unknown> | null) {
    const transaction = {
        get: vi.fn(() => Promise.resolve({ exists: !!encounterData, data: () => encounterData })),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    };
    vi.mocked(runTransaction).mockImplementation(async (_db, callback: unknown) =>
        (callback as (tx: typeof transaction) => Promise<void>)(transaction));
    return transaction;
}

describe('EncounterService.reviewContact', () => {
    beforeEach(() => {
        vi.mocked(runTransaction).mockReset();
        (auth as { currentUser: unknown }).currentUser = { uid: 'test-uid' };
    });

    it('confirms the candidate contact and marks the encounter reviewed', async () => {
        const transaction = transactionWith(completedEncounterData());

        await EncounterService.reviewContact('enc_1', reviewFields);

        const [setDocRef, setData] = transaction.set.mock.calls[0];
        expect(setData).toEqual(expect.objectContaining({
            name: 'Marcus Vance',
            phone: '313-555-0199',
            organization: 'Live Nation',
            role: 'manager',
            reviewStatus: 'confirmed',
            encounterId: 'enc_1',
            source: 'encounter_ai',
            photoUrl: 'https://cdn.example.com/photo.jpg',
            audioMemoUrl: 'https://cdn.example.com/memo.m4a',
        }));
        expect(String(setDocRef)).not.toContain('undefined');
        const updateData = transaction.update.mock.calls[0][1];
        expect(updateData).toEqual(expect.objectContaining({
            contactReviewStatus: 'confirmed',
            contactId: 'contact_encounter_enc_1',
            extractedContact: expect.objectContaining({ name: 'Marcus Vance' }),
        }));
    });

    it('blocks the export-backed confirmed path when analysis never completed', async () => {
        const transaction = transactionWith({ status: 'failed' });
        await expect(EncounterService.reviewContact('enc_1', reviewFields))
            .rejects.toThrow('no completed contact analysis');
        expect(transaction.set).not.toHaveBeenCalled();
        expect(transaction.update).not.toHaveBeenCalled();
    });

    it('requires a signed-in user', async () => {
        (auth as { currentUser: unknown }).currentUser = null;
        await expect(EncounterService.reviewContact('enc_1', reviewFields))
            .rejects.toThrow('Sign in to review');
    });

    it('rejects an empty contact name', async () => {
        transactionWith(completedEncounterData());
        await expect(EncounterService.reviewContact('enc_1', { ...reviewFields, name: '   ' }))
            .rejects.toThrow('Enter a contact name');
    });
});
