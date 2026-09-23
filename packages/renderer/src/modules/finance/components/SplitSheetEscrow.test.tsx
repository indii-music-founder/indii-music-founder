/**
 * SplitSheetEscrow — sign-off wiring tests (ISSUE-1442).
 *
 * Before ISSUE-1442 nothing in any client could record a collaborator
 * signature, so an escrow could never reach FULLY_SIGNED and releaseEscrow
 * was permanently dead-locked. These tests pin the fix: the current user's
 * unsigned row exposes a live sign-off control that invokes the signEscrow
 * callable with the active escrow document id.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    onSnapshot: vi.fn(),
    httpsCallable: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: mocks.onSnapshot,
}));

vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: mocks.httpsCallable,
}));

// Stable identity: SplitSheetEscrow's effect depends on [user], so a fresh
// object per selector call would re-subscribe on every render (infinite loop).
const MOCK_USER = { uid: 'user-1' };

vi.mock('@/core/store', () => ({
    useStore: (selector: (s: { user: unknown }) => unknown) => selector({ user: MOCK_USER }),
}));

import { SplitSheetEscrow } from './SplitSheetEscrow';

const ESCROW_DOC = {
    id: 'escrow-1',
    data: () => ({
        parties: ['user-1', 'user-2'],
        splits: { 'user-1': 60, 'user-2': 40 },
        signoffs: { 'user-2': true },
        holdAmountCents: 10000,
        status: 'PENDING_SIGNATURES',
        trackId: 'track-9',
    }),
};

describe('SplitSheetEscrow sign-off wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.onSnapshot.mockImplementation((_q, cb) => {
            cb({ empty: false, docs: [ESCROW_DOC] });
            return vi.fn();
        });
    });

    it('offers a live sign-off control for the current user and invokes signEscrow with the escrow doc id', async () => {
        const signFn = vi.fn().mockResolvedValue({ data: { success: true, message: 'Signoff recorded.' } });
        mocks.httpsCallable.mockImplementation((_functions: unknown, name: string) => {
            if (name === 'signEscrow') return signFn;
            return vi.fn();
        });

        render(<SplitSheetEscrow />);

        // The current user (user-1) is unsigned → their row must expose the live control.
        const signButton = screen.getByTestId('sign-escrow-button');
        expect(signButton).not.toBeDisabled();
        expect(signButton.textContent).toContain('Sign Your Split');

        fireEvent.click(signButton);

        await waitFor(() => {
            expect(signFn).toHaveBeenCalledWith({ escrowDocId: 'escrow-1' });
        });
        expect(mocks.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'signEscrow');
    });

    it('keeps other collaborators unsigned rows as waiting state, not signable', () => {
        mocks.onSnapshot.mockImplementation((_q, cb) => {
            cb({ empty: false, docs: [{ ...ESCROW_DOC, data: () => ({ ...ESCROW_DOC.data(), signoffs: {} }) }] });
            return vi.fn();
        });
        mocks.httpsCallable.mockReturnValue(vi.fn());

        render(<SplitSheetEscrow />);

        // user-1 (current user) gets the live control; user-2 can only wait.
        expect(screen.getByTestId('sign-escrow-button')).toBeInTheDocument();
        expect(screen.getByText('Awaiting Signature')).toBeInTheDocument();
        expect(screen.queryByText('Signed')).not.toBeInTheDocument();
    });

    it('records no signature when no escrow document is live', () => {
        mocks.onSnapshot.mockImplementation((_q, cb) => {
            cb({ empty: true, docs: [] });
            return vi.fn();
        });
        mocks.httpsCallable.mockReturnValue(vi.fn());

        render(<SplitSheetEscrow />);

        expect(screen.queryByTestId('sign-escrow-button')).not.toBeInTheDocument();
        expect(mocks.httpsCallable).not.toHaveBeenCalled();
    });
});
