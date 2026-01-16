import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommandBar from './CommandBar';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';

// --- MOCKS ---

vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
vi.mock('firebase/firestore', () => ({
    Timestamp: {
        now: () => ({ toMillis: () => Date.now() }),
        fromDate: (date: Date) => ({ toMillis: () => date.getTime() }),
    },
    getFirestore: vi.fn(),
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
}));

vi.mock('@/services/agent/AgentService', () => ({
    agentService: {
        sendMessage: vi.fn(),
    },
}));

vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: {
        isSupported: vi.fn(() => false),
        startListening: vi.fn(),
        stopListening: vi.fn(),
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

describe('👁️ Pixel: CommandBar Interaction States', () => {
    const mockSetModule = vi.fn();
    const mockToggleAgentWindow = vi.fn();
    const mockToast = { success: vi.fn(), error: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'dashboard',
            setModule: mockSetModule,
            toggleAgentWindow: mockToggleAgentWindow,
            isAgentOpen: false,
        });
        (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockToast);
    });

    it('Scenario 1: Verifies "Processing" state disables input and shows loader', async () => {
        // Pixel Rule: "If it flickers, it fails" - Ensure smooth state transition

        // Mock slow agent response
        let resolveMessage: any;
        (agentService.sendMessage as any).mockImplementation(() => new Promise(resolve => {
            resolveMessage = resolve;
        }));

        render(<CommandBar />);

        const input = screen.getByPlaceholderText(/Describe your task/i);
        const submitBtn = screen.getByTestId('command-bar-run-btn');

        // 1. Enter text
        fireEvent.change(input, { target: { value: 'Analyze Q3 Data' } });
        expect(submitBtn).toBeEnabled();

        // 2. Submit
        fireEvent.click(submitBtn);

        // 3. Verify Loading State
        expect(screen.getByTestId('run-loader')).toBeInTheDocument();
        expect(input).toBeDisabled();
        expect(submitBtn).toBeDisabled();

        // 4. Resolve
        await act(async () => {
            resolveMessage();
        });

        // 5. Verify Reset
        expect(screen.queryByTestId('run-loader')).not.toBeInTheDocument();
        expect(input).not.toBeDisabled();
        expect(input).toHaveValue(''); // Optimistic clear check
    });

    it('Scenario 2: Handles Error Toast when submission fails', async () => {
        // Pixel Rule: "Missing error handling tests"

        (agentService.sendMessage as any).mockRejectedValue(new Error("Network Error"));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<CommandBar />);

        const input = screen.getByPlaceholderText(/Describe your task/i);
        const submitBtn = screen.getByTestId('command-bar-run-btn');

        fireEvent.change(input, { target: { value: 'Do something impossible' } });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith("Failed to send message.");
        });

        // Input should be restored on error!
        expect(input).toHaveValue('Do something impossible');

        consoleSpy.mockRestore();
    });

    it('Scenario 3: Optimistic UI - input clears immediately upon send', async () => {
        // Pixel Rule: "The user trusts what they see, not what the backend sends"

        // Mock slow response
        (agentService.sendMessage as any).mockImplementation(() => new Promise(r => setTimeout(r, 100)));

        render(<CommandBar />);
        const input = screen.getByPlaceholderText(/Describe your task/i);
        const submitBtn = screen.getByTestId('command-bar-run-btn');

        fireEvent.change(input, { target: { value: 'Quick Command' } });
        fireEvent.click(submitBtn);

        // Input should be empty *before* the promise resolves
        expect(input).toHaveValue('');
    });

    it('Scenario 4: Validates Attachment Interaction (Add/Remove)', () => {
        render(<CommandBar />);

        // Simulate adding a file
        const file = new File(['dummy content'], 'report.pdf', { type: 'application/pdf' });
        const inputContainer = screen.getByTestId('command-bar-input-container'); // We'll rely on drop for simplicity in test or mock input

        // We can simulate drop
        fireEvent.drop(inputContainer, {
            dataTransfer: { files: [file] }
        });

        expect(screen.getByText('report.pdf')).toBeInTheDocument();

        // Remove it
        const removeButton = screen.getByRole('button', { name: 'Remove report.pdf' });
        expect(removeButton).toBeTruthy();

        fireEvent.click(removeButton);

        expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
    });
});
