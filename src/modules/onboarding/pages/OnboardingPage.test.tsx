import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from './OnboardingPage';
import * as OnboardingService from '@/services/onboarding/onboardingService';

// Mock Store
const mockSetUserProfile = vi.fn();
const mockSetModule = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: { brandKit: { releaseDetails: {} } },
        setUserProfile: mockSetUserProfile,
        setModule: mockSetModule,
    }),
}));

// Mock Service
vi.mock('@/services/onboarding/onboardingService', () => ({
    runOnboardingConversation: vi.fn(),
    processFunctionCalls: vi.fn(() => ({ updatedProfile: {}, isFinished: false, updates: [] })),
    calculateProfileStatus: () => ({ coreProgress: 0, releaseProgress: 0, coreMissing: [], releaseMissing: [] }),
    generateNaturalFallback: vi.fn(() => 'Mock fallback response'),
    generateEmptyResponseFallback: vi.fn(() => 'Mock empty response')
}));

// Mock Framer Motion to avoid animation delays
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className }: any) => <div className={className}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('OnboardingPage GenUI Verification', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('Renders Multiple Choice buttons when Agent calls askMultipleChoice tool', async () => {
        // Setup: Agent returns a tool call
        (OnboardingService.runOnboardingConversation as any).mockResolvedValue({
            text: "Please select a genre:",
            functionCalls: [{
                name: 'askMultipleChoice',
                args: {
                    question: "What is your genre?",
                    options: ['Techno', 'House', 'DNB']
                }
            }]
        });

        render(<OnboardingPage />);

        // 1. Send user message to trigger response
        const input = screen.getByPlaceholderText(/Tell me about your brand/i);
        fireEvent.change(input, { target: { value: 'Hi' } });

        const sendButton = screen.getByLabelText('Send message');
        fireEvent.click(sendButton);

        // 2. Wait for buttons to appear
        await waitFor(() => {
            expect(screen.getByText('Techno')).toBeInTheDocument();
            expect(screen.getByText('House')).toBeInTheDocument();
            expect(screen.getByText('DNB')).toBeInTheDocument();
        });

        // 3. Verify interaction
        fireEvent.click(screen.getByText('Techno'));

        // Should trigger another send with "Techno"
        await waitFor(() => {
            expect(OnboardingService.runOnboardingConversation).toHaveBeenCalledTimes(2);
            // Verify call args contained "Techno"
            const calls = (OnboardingService.runOnboardingConversation as any).mock.calls;
            const lastCallHistory = calls[1][0];
            const lastMessage = lastCallHistory[lastCallHistory.length - 1];
            expect(lastMessage.parts[0].text).toBe('Techno');
        });
    });
});
