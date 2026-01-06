import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PostGenerator from './PostGenerator';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: {
            brandKit: {
                targetAudience: 'Gen Z',
                visualIdentity: 'Edgy',
                brandDescription: 'Indie Pop Artist'
            },
            displayName: 'Test Artist'
        }
    })
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn()
    })
}));

vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateStructuredData: vi.fn(),
        generateImage: vi.fn()
    }
}));

vi.mock('@/services/social/SocialService', () => ({
    SocialService: {
        schedulePost: vi.fn()
    }
}));

// Mock PostGenerator to avoid complex state/context issues if any,
// but we want to test the actual component rendering.
// Since PostGenerator uses simple hooks and mocked services, it should render fine.

describe('PostGenerator Accessibility', () => {
    it('renders with correct accessibility attributes', () => {
        render(<PostGenerator />);

        // Check Platform Group
        const platformGroup = screen.getByRole('group', { name: /select platform/i });
        expect(platformGroup).toBeInTheDocument();

        // Check Platform Buttons
        const instagramButton = screen.getByRole('button', { name: /instagram/i });
        expect(instagramButton).toHaveAttribute('aria-pressed');

        // Check Vibe Group
        const vibeGroup = screen.getByRole('group', { name: /select vibe/i });
        expect(vibeGroup).toBeInTheDocument();

        // Check Vibe Buttons
        const professionalButton = screen.getByRole('button', { name: /professional/i });
        expect(professionalButton).toHaveAttribute('aria-pressed');

        // Check Topic Input Label Association
        const topicLabel = screen.getByText(/concept \/ topic/i);
        const topicInput = screen.getByPlaceholderText(/announcing my new single/i);

        // Verify label is associated (either by id or nesting, here by id)
        expect(topicLabel).toHaveAttribute('for', 'post-topic');
        expect(topicInput).toHaveAttribute('id', 'post-topic');

        // Check Generate Button (should be disabled initially)
        const generateButton = screen.getByRole('button', { name: /generate post/i });
        expect(generateButton).toBeDisabled();
    });
});
