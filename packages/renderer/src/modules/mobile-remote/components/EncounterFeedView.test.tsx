import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import EncounterFeedView from './EncounterFeedView';
import { EncounterService } from '@/services/encounters/EncounterService';

const fixtureState: { items: unknown[]; emit?: (items: unknown[]) => void } = { items: [] };

vi.mock('@/services/encounters/EncounterService', () => ({
    EncounterService: {
        subscribeRecentEncounters: vi.fn((cb) => {
            fixtureState.emit = cb;
            cb(fixtureState.items);
            return () => {};
        }),
        reviewContact: vi.fn(() => Promise.resolve()),
    }
}));

function setEncounters(items: unknown[]) {
    fixtureState.items = items;
    (fixtureState.emit as ((items: unknown[]) => void) | undefined)?.(items);
}

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const baseEncounter = {
    id: 'enc_1',
    userId: 'u1',
    status: 'completed',
    summary: 'Met Marcus Vance backstage.',
    assets: [
        { id: 'a1', type: 'photo', downloadUrl: 'https://cdn.example.com/photo.jpg', mimeType: 'image/jpeg', createdAt: '2026-09-17T12:00:00Z' },
        { id: 'a2', type: 'audio', downloadUrl: 'https://cdn.example.com/memo.m4a', mimeType: 'audio/mp4', createdAt: '2026-09-17T12:00:00Z' },
    ],
    extractedContact: {
        name: 'Marcus Vance',
        phone: '313-555-0199',
        organization: 'Live Nation',
        role: 'manager',
    },
    audioTranscript: 'Just met Marcus Vance at Live Nation...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

describe('EncounterFeedView Component', () => {
    it('renders the recent encounter and displays extracted contact info', () => {
        setEncounters([baseEncounter]);
        render(<EncounterFeedView />);

        expect(screen.getByText('Marcus Vance')).toBeDefined();
        expect(screen.getByText(/Live Nation/)).toBeDefined();
        expect(screen.getByText('313-555-0199')).toBeDefined();
        expect(screen.getByText('Voice Note')).toBeDefined();
    });

    it('withholds the iPhone export while the extracted contact needs review and offers the review path instead', () => {
        setEncounters([{ ...baseEncounter, contactReviewStatus: 'needs_review' }]);
        render(<EncounterFeedView />);

        expect(screen.queryByText('Add to iPhone')).toBeNull();
        expect(screen.getByText('Review / edit contact')).toBeDefined();
        expect(screen.getByText(/Review the extracted contact against the original media/)).toBeDefined();
    });

    it('offers the iPhone export once the contact review is confirmed', () => {
        setEncounters([{ ...baseEncounter, contactReviewStatus: 'confirmed' }]);
        render(<EncounterFeedView />);

        expect(screen.getByText('Add to iPhone')).toBeDefined();
    });

    it('surfaces an explicit failure state with the original capture preserved', () => {
        setEncounters([{ ...baseEncounter, status: 'failed', error: 'Media analysis failed. Your original capture is saved; contact extraction has not been completed.' }]);
        render(<EncounterFeedView />);

        expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
        expect(screen.getByText(/capture saved/)).toBeDefined();
    });
});
