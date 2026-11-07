import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrandPromptAdditivesMenu } from '../BrandPromptAdditivesMenu';
import { PromptAdditiveTracker } from '@/services/creative/PromptAdditiveTracker';
import { useStore } from '@/core/store';

describe('BrandPromptAdditivesMenu', () => {
    beforeEach(() => {
        PromptAdditiveTracker.resetForTesting();
        useStore.setState({
            userProfile: {
                id: 'test_user',
                uid: 'test_user',
                email: 'test@example.com',
                displayName: 'Artist',
                accountType: 'artist',
                membership: { tier: 'pro', expiresAt: null },
                createdAt: {} as any,
                updatedAt: {} as any,
                lastLoginAt: {} as any,
                emailVerified: true,
                preferences: { theme: 'dark', notifications: true },
                brandKit: {
                    colors: ['#00FFCC', '#9900FF'],
                    fonts: 'Syne, sans-serif',
                    brandDescription: 'Futuristic Neo-Cyber Wave',
                    negativePrompt: '',
                    socials: {},
                    brandAssets: [],
                    referenceImages: [],
                    releaseDetails: {
                        title: 'Genesis',
                        type: 'Single',
                        artists: 'Indii Artist',
                        genre: 'Synthwave',
                        mood: 'Cyberpunk Melancholy',
                        themes: 'Neon Lights & Rain',
                        lyrics: ''
                    }
                }
            }
        });
    });

    it('renders brand identity preferences and fires onSelectAdditive', async () => {
        const user = userEvent.setup();
        const handleSelect = vi.fn();

        render(<BrandPromptAdditivesMenu onSelectAdditive={handleSelect} />);

        const trigger = screen.getByTestId('modifiers-trigger');
        expect(trigger).toBeInTheDocument();
        await user.click(trigger);

        expect(screen.getByText('Brand Identity')).toBeInTheDocument();
        const brandItem = screen.getByText(/Brand Aesthetic: Futuristic Neo-Cyber Wave/i);
        expect(brandItem).toBeInTheDocument();

        await user.click(brandItem);
        expect(handleSelect).toHaveBeenCalledWith('Futuristic Neo-Cyber Wave', 'Aesthetic');
    });

    it('tracks frequent additives and surfaces them in Frequently Used submenu', async () => {
        PromptAdditiveTracker.recordUsage('Octane Render', 'Engine');
        PromptAdditiveTracker.recordUsage('Octane Render', 'Engine');
        PromptAdditiveTracker.recordUsage('Tokyo Neon', 'Environment');

        const user = userEvent.setup();
        const handleSelect = vi.fn();

        render(<BrandPromptAdditivesMenu onSelectAdditive={handleSelect} />);
        await user.click(screen.getByTestId('modifiers-trigger'));

        const frequentTrigger = screen.getByTestId('frequent-additives-subtrigger');
        expect(frequentTrigger).toBeInTheDocument();

        await user.hover(frequentTrigger);
        expect(await screen.findByText('Octane Render')).toBeInTheDocument();
        expect(screen.getByText('2×')).toBeInTheDocument();
        expect(screen.getByText('Tokyo Neon')).toBeInTheDocument();
    });
});
