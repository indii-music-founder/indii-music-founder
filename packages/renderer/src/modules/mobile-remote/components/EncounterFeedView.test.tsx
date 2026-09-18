import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import EncounterFeedView from './EncounterFeedView';
import { EncounterService } from '@/services/encounters/EncounterService';

vi.mock('@/services/encounters/EncounterService', () => ({
    EncounterService: {
        subscribeRecentEncounters: vi.fn((cb) => {
            cb([
                {
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
                }
            ]);
            return () => {};
        }),
    }
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

describe('EncounterFeedView Component', () => {
    it('renders the recent encounter and displays extracted contact info', () => {
        render(<EncounterFeedView />);

        expect(screen.getByText('Marcus Vance')).toBeDefined();
        expect(screen.getByText(/Live Nation/)).toBeDefined();
        expect(screen.getByText('313-555-0199')).toBeDefined();
        expect(screen.getByText('Add to iPhone')).toBeDefined();
        expect(screen.getByText('Voice Note')).toBeDefined();
    });
});
