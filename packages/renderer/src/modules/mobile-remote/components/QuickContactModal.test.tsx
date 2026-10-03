import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickContactModal from './QuickContactModal';
import { EncounterService } from '@/services/encounters/EncounterService';

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/services/firebase', () => ({
    auth: { currentUser: { uid: 'test-user-123' } },
}));

vi.mock('@/services/encounters/EncounterService', () => ({
    EncounterService: {
        createEncounter: vi.fn(() => Promise.resolve('enc_test_1')),
        reviewContact: vi.fn(() => Promise.resolve()),
    },
}));

describe('QuickContactModal Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render when isOpen is false', () => {
        const { container } = render(
            <QuickContactModal isOpen={false} onClose={vi.fn()} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders form elements when isOpen is true', () => {
        render(<QuickContactModal isOpen={true} onClose={vi.fn()} />);

        expect(screen.getByText('Quick Contact')).toBeDefined();
        expect(screen.getByPlaceholderText('Jane Doe / DJ Shadow')).toBeDefined();
        expect(screen.getByPlaceholderText('555-0199')).toBeDefined();
        expect(screen.getByPlaceholderText('jane@mgmt.com')).toBeDefined();
        expect(screen.getByText('Promoter')).toBeDefined();
        expect(screen.getByText('Artist')).toBeDefined();
        expect(screen.getByText('Save Contact')).toBeDefined();
    });

    it('submits contact details and saves via EncounterService', async () => {
        const onClose = vi.fn();
        const onSaved = vi.fn();

        render(
            <QuickContactModal isOpen={true} onClose={onClose} onSaved={onSaved} />
        );

        fireEvent.change(screen.getByPlaceholderText('Jane Doe / DJ Shadow'), {
            target: { value: 'Alex Morgan' },
        });
        fireEvent.change(screen.getByPlaceholderText('555-0199'), {
            target: { value: '313-555-1234' },
        });
        fireEvent.change(screen.getByPlaceholderText('jane@mgmt.com'), {
            target: { value: 'alex@detroitmusic.com' },
        });
        fireEvent.click(screen.getByText('Promoter'));

        fireEvent.click(screen.getByText('Save Contact'));

        await waitFor(() => {
            expect(EncounterService.createEncounter).toHaveBeenCalledWith(
                expect.objectContaining({
                    clientContext: expect.stringContaining('Alex Morgan'),
                })
            );
            expect(EncounterService.reviewContact).toHaveBeenCalledWith(
                'enc_test_1',
                expect.objectContaining({
                    name: 'Alex Morgan',
                    phone: '313-555-1234',
                    email: 'alex@detroitmusic.com',
                    role: 'promoter',
                })
            );
            expect(onSaved).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });
});
