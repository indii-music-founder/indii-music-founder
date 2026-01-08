import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommandBar from './CommandBar';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

// Mock dependencies
vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
vi.mock('@/services/agent/AgentService', () => ({
    agentService: {
        sendMessage: vi.fn(),
    },
}));

// Use vi.hoisted for mocked functions accessed in mock factory
const { mockStartListening, mockStopListening } = vi.hoisted(() => ({
    mockStartListening: vi.fn(),
    mockStopListening: vi.fn(),
}));

vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: {
        isSupported: vi.fn(() => true), // Enable voice support for test
        startListening: mockStartListening,
        stopListening: mockStopListening,
    }
}));

vi.mock('@/services/agent/registry', () => ({
    agentRegistry: {
        getAll: () => [],
        register: vi.fn(),
        get: vi.fn(),
    }
}));

vi.mock('../theme/moduleColors', () => ({
    getColorForModule: () => ({
        border: 'border-gray-700',
        ring: 'ring-gray-700',
    }),
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('📱 Viewport: CommandBar Responsiveness', () => {
    const mockSetModule = vi.fn();
    const mockToggleAgentWindow = vi.fn();
    const mockToast = { success: vi.fn(), error: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock useStore
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'dashboard',
            setModule: mockSetModule,
            toggleAgentWindow: mockToggleAgentWindow,
            isAgentOpen: false,
        });

        // Mock useToast
        (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockToast);

        // Set Viewport to Mobile (iPhone SE: 375px)
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        window.dispatchEvent(new Event('resize'));
    });

    it('adapts layout for mobile devices (JS-driven adaptation)', () => {
        render(<CommandBar />);

        // 1. Verify Input Field is visible (Core Feature)
        const input = screen.getByPlaceholderText(/describe your task/i);
        expect(input).toBeInTheDocument();

        // 2. Verify "Send" (Run) button is visible
        const runButton = screen.getByText('Run').closest('button');
        expect(runButton).toBeVisible();

        // 3. Verify Desktop-only features are hidden via JS logic
        // "Delegate to..." button should be hidden
        const delegateButton = screen.queryByText(/Delegate to/i);
        expect(delegateButton).not.toBeInTheDocument();

        // "Attach" button should be hidden
        const attachButton = screen.queryByText('Attach');
        expect(attachButton).not.toBeInTheDocument();

        // "Camera" button should be hidden
        const cameraButton = screen.queryByTitle('Take a picture');
        expect(cameraButton).not.toBeInTheDocument();
    });

    it('retains voice input capability on mobile and handles touch interaction', () => {
        render(<CommandBar />);

        // Find the voice button by the aria-label we just added
        const voiceButton = screen.getByLabelText('Voice input');
        expect(voiceButton).toBeInTheDocument();
        expect(voiceButton).toBeVisible();

        // Simulate touch/click interaction
        fireEvent.click(voiceButton);

        // Verify voice service was triggered
        expect(mockStartListening).toHaveBeenCalled();
    });
});
