
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OnboardingModal } from './OnboardingModal';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const keys: Record<string, string> = {
                'onboarding.closeLabel': 'Close onboarding',
                'onboarding.attachLabel': 'Attach files',
                'onboarding.sendLabel': 'Send message',
            };
            return keys[key] || key;
        },
    }),
}));


// Mock dependencies
vi.mock('../../core/store', () => ({
    useStore: vi.fn(() => ({
        userProfile: {
            brandKit: {},
        },
        setUserProfile: vi.fn(),
    })),
}));

vi.mock('@/services/onboarding/onboardingService', () => ({
    calculateProfileStatus: vi.fn(() => ({
        coreProgress: 50,
        releaseProgress: 30,
        coreMissing: [],
        releaseMissing: [],
    })),
    runOnboardingConversation: vi.fn(),
    processFunctionCalls: vi.fn(),
    generateEmptyResponseFallback: vi.fn(),
    generateNaturalFallback: vi.fn(),
    TopicKey: {},
}));

vi.mock('uuid', () => ({
    v4: () => 'test-uuid-123',
}));

// Mock motion
vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock motion primitives
vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/motion-primitives/animated-number', () => ({
    AnimatedNumber: ({ value }: any) => <span>{value}</span>,
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('OnboardingModal Accessibility', () => {
    it('renders with accessible buttons', () => {
        const onClose = vi.fn();
        render(<OnboardingModal isOpen={true} onClose={onClose} />);

        expect(screen.getByLabelText('Close onboarding')).toBeInTheDocument();
        expect(screen.getByLabelText('Attach files')).toBeInTheDocument();
        expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    });

    it('renders accessible file removal button after file selection', async () => {
        const onClose = vi.fn();
        const { container } = render(<OnboardingModal isOpen={true} onClose={onClose} />);

        const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
        // Mock text method which might be missing in jsdom/node environment
        Object.defineProperty(file, 'text', {
            value: () => Promise.resolve('hello'),
        });

        const input = container.querySelector('input[type="file"]');

        expect(input).toBeInTheDocument();

        // Simulate file selection
        fireEvent.change(input!, { target: { files: [file] } });

        // Wait for file to appear
        await waitFor(() => {
            expect(screen.getByLabelText('Remove hello.txt')).toBeInTheDocument();
        });

        const removeButton = screen.getByLabelText('Remove hello.txt');
        expect(removeButton).toHaveClass('focus:opacity-100');
    });
});
