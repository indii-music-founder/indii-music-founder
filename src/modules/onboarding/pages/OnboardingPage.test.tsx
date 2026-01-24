import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OnboardingPage from './OnboardingPage';
import * as OnboardingService from '@/services/onboarding/onboardingService';

// Mock Store
const mockSetUserProfile = vi.fn();
const mockSetModule = vi.fn();

vi.mock('@/core/store', () => ({
    useStore: () => ({
        userProfile: {
            brandKit: {
                releaseDetails: {},
                colors: [], // Added for accessibility test rendering
            },
            goals: [],
            analyzedTrackIds: []
        },
        setUserProfile: mockSetUserProfile,
        setModule: mockSetModule,
    }),
}));

// Mock useToast
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
        showToast: vi.fn()
    })
}));

// Mock Service
vi.mock('@/services/onboarding/onboardingService', () => ({
    runOnboardingConversation: vi.fn(),
    processFunctionCalls: vi.fn(() => ({ updatedProfile: {}, isFinished: false, updates: [] })),
    calculateProfileStatus: () => ({ coreProgress: 0, releaseProgress: 0, coreMissing: [], releaseMissing: [] }),
    generateNaturalFallback: vi.fn(() => 'Mock fallback response'),
    generateEmptyResponseFallback: vi.fn(() => 'Mock empty response'),
    generateSection: vi.fn(),
    OPTION_WHITELISTS: {}
}));

// Mock Framer Motion to avoid animation delays
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock distribute requirements
vi.mock('@/services/onboarding/distributorRequirements', () => ({
    getDistributorRequirements: vi.fn(),
}));

describe('OnboardingPage', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    describe('GenUI Verification', () => {
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
            const input = screen.getByPlaceholderText(/Tell me about your music/i);
            fireEvent.change(input, { target: { value: 'Hi' } });

            // Note: This relies on the aria-label being present (which we added/ensured)
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

    describe('Accessibility', () => {
        it('renders with accessible labels on interactive elements', () => {
            render(<OnboardingPage />);

            // Check for Attach file button
            expect(screen.getByLabelText('Attach file')).toBeInTheDocument();

            // Check for Send message button
            expect(screen.getByLabelText('Send message')).toBeInTheDocument();

            // Check for Input aria-label
            expect(screen.getByLabelText('Type your message')).toBeInTheDocument();

            // Mobile view button (hidden on desktop, but in DOM)
            expect(screen.getByLabelText('View profile progress')).toBeInTheDocument();
        });
    });

    it('Renders accessible labels on interactive elements', () => {
        render(<OnboardingPage />);

        // Existing label
        expect(screen.getByLabelText('Send message')).toBeInTheDocument();

        // New labels
        expect(screen.getByLabelText('Attach file')).toBeInTheDocument();
        expect(screen.getByLabelText('Type your message')).toBeInTheDocument();

        // Mobile view button - label includes progress
        expect(screen.getByLabelText('View profile progress, 0% complete')).toBeInTheDocument();
    });
});
