import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PitchDraftingModal } from '../PitchDraftingModal';
import { AutonomousIntelligence as AI } from '@/services/intelligence/AutonomousIntelligence';
import type { Contact } from '../../types';

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateText: vi.fn().mockResolvedValue('Hi there, wanted to share our new single...'),
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

const baseContact: Omit<Contact, 'email'> = {
    id: 'c1',
    name: 'Jane Smith',
    outlet: 'Music Blog Weekly',
    role: 'Journalist',
    tier: 'Mid',
    influenceScore: 60,
    relationshipStrength: 'Neutral',
};

describe('PitchDraftingModal (ISSUE-912)', () => {
    it('never infers a mailto address — shows "No Verified Email" when contact has none', async () => {
        render(
            <PitchDraftingModal isOpen={true} onClose={() => {}} contact={baseContact as Contact} campaign={null} />
        );

        fireEvent.click(screen.getByText('Generate Pitch'));

        await waitFor(() => {
            expect(AI.generateText).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(screen.getByText('No Verified Email')).toBeDefined();
        });

        expect(screen.queryByText(/Open in Mail/)).toBeNull();
        expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    });

    it('uses the exact verified email — never a guessed address — when present', async () => {
        const contactWithEmail: Contact = { ...baseContact, email: 'jane@musicblogweekly.com' };
        render(
            <PitchDraftingModal isOpen={true} onClose={() => {}} contact={contactWithEmail} campaign={null} />
        );

        fireEvent.click(screen.getByText('Generate Pitch'));

        await waitFor(() => {
            expect(screen.getByText(/Open in Mail/)).toBeDefined();
        });

        const link = document.querySelector('a[href^="mailto:"]') as HTMLAnchorElement;
        expect(link).not.toBeNull();
        expect(link.href).toContain('mailto:jane@musicblogweekly.com');
        // Never the old guessed pattern (jane.smith@musicblogweekly.com or similar).
        expect(link.href).not.toContain('jane.smith');
    });
});
