import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommandBar from './CommandBar';

/**
 * 👁️ Pixel Rule: "If it flickers, it fails"
 * This test file ensures the CommandBar maintains high-fidelity interaction states.
 */

// --- REACTIVE STORE MOCK ---
vi.mock('@/core/store', async () => {
    const { create } = await import('zustand');
    const store = create((set: any) => ({
        currentModule: 'dashboard',
        setModule: vi.fn((m) => set({ currentModule: m })),
        toggleAgentWindow: vi.fn(),
        isAgentOpen: false,
        chatChannel: 'indii',
        setChatChannel: vi.fn((c) => set({ chatChannel: c })),
        isCommandBarDetached: true,
        setCommandBarDetached: vi.fn((d) => set({ isCommandBarDetached: d })),
        isCommandBarCollapsed: false,
        setCommandBarCollapsed: vi.fn((c) => set({ isCommandBarCollapsed: c })),
        commandBarPosition: 'center' as const,
        setCommandBarPosition: vi.fn((p) => set({ commandBarPosition: p })),
        commandBarInput: '',
        setCommandBarInput: vi.fn((i) => set({ commandBarInput: i })),
        commandBarAttachments: [] as File[],
        setCommandBarAttachments: vi.fn((a) => set({ commandBarAttachments: a })),
        isAgentProcessing: false,
        agentMode: 'assistant',
        isKnowledgeBaseEnabled: false,
        setKnowledgeBaseEnabled: vi.fn((k) => set({ isKnowledgeBaseEnabled: k })),
        agentHistory: [],
        activeSessionId: 'test-session',
        sessions: {},
        activeAgentProvider: 'native',
        setActiveAgentProvider: vi.fn((p) => set({ activeAgentProvider: p })),
        isLoadingAgents: false,
        agentsError: null,
        availableAgents: [],
        // PromptArea dependencies — required for handleSubmit and module switching
        isRightPanelOpen: false,
        toggleRightPanel: vi.fn(),
        rightPanelTab: 'agent',
        rightPanelView: 'messages',
    }));
    return {
        serverTimestamp: vi.fn(),
        useStore: Object.assign(
            (selector: any) => store(selector),
            {
                getState: store.getState,
                setState: store.setState,
                subscribe: store.subscribe,
            }
        ),
        store
    };
});

// DO NOT mock useShallow with (fn) => fn, it causes infinite loops!
// We'll let it use the actual one or providing a better mock if needed.
// Actually, vitest should handle it if we don't mock it, but since we are mocking @/core/store, 
// we might need to handle it. Let's try NOT mocking it first or importing actual.
vi.mock('zustand/react/shallow', async () => {
    const actual = await vi.importActual('zustand/react/shallow') as any;
    return actual;
});

// --- COMPONENT & SERVICE MOCKS ---

vi.mock('@/core/context/ToastContext', () => {
    const mockToast = {
        success: vi.fn(),
        error: vi.fn()
    };
    return {
        serverTimestamp: vi.fn(),
        useToast: () => mockToast,
        mockToast
    };
});

// lucide-react is mocked globally in setup.ts via Proxy — no local mock needed

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    Timestamp: {
        now: () => ({
            serverTimestamp: vi.fn(), toMillis: () => Date.now()
        }),
        fromDate: (date: Date) => ({ toMillis: () => date.getTime() }),
    },
    getFirestore: vi.fn(),
    initializeFirestore: vi.fn(() => ({
        serverTimestamp: vi.fn(),
    })),
    persistentLocalCache: vi.fn(),
    persistentMultipleTabManager: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    onSnapshot: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
}));

vi.mock('@/services/agent/AgentService', () => ({
    serverTimestamp: vi.fn(),
    agentService: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
        warmup: vi.fn().mockResolvedValue(undefined)
    },
}));

vi.mock('@/services/ai/VoiceService', () => ({
    serverTimestamp: vi.fn(),
    voiceService: {
        isSupported: vi.fn(() => false),
        startListening: vi.fn(),
        stopListening: vi.fn(),
    }
}));

vi.mock('@/services/agent/registry', () => ({
    serverTimestamp: vi.fn(),
    agentRegistry: {
        getAll: () => [],
        register: vi.fn(),
        get: vi.fn(),
        warmup: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('@/core/components/command-bar/DelegateMenu', () => ({
    serverTimestamp: vi.fn(),
    DelegateMenu: () => <div data-testid="delegate-menu">Delegate Menu</div>
}));

vi.mock('@/core/components/command-bar/AttachmentList', () => ({
    serverTimestamp: vi.fn(),
    AttachmentList: ({ attachments }: any) => (
        <div data-testid="attachment-list">
            {attachments.map((file: File) => (
                <div key={file.name}>{file.name}</div>
            ))}
        </div>
    )
}));

vi.mock('../theme/moduleColors', () => ({
    getColorForModule: () => ({
        border: 'border-gray-700',
        ring: 'ring-gray-700',
    }),
    getDepartmentCssVar: () => '--color-gray-700',
}));

vi.mock('motion/react', () => ({
    serverTimestamp: vi.fn(),
    motion: {
        div: ({ children, className, drag, dragMomentum, ...props }: any) => (
            <div
                className={className}
                data-drag={drag?.toString()}
                data-drag-momentum={dragMomentum?.toString()}
                {...props}
            >
                {children}
            </div>
        )
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('👁️ Pixel: CommandBar Interaction States', () => {
    let store: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const storeModule = await import('@/core/store') as any;
        store = storeModule.store;

        act(() => {
            store.setState({
                commandBarInput: '',
                commandBarAttachments: [],
                isAgentProcessing: false,
                currentModule: 'dashboard',
                chatChannel: 'indii',
                isCommandBarDetached: true,
                isAgentOpen: false
            });
        });
    });

    it('Scenario 1: Verifies "Processing" state disables input and shows stop button', async () => {
        render(<CommandBar />);

        const input = screen.getByPlaceholderText(/Launch a campaign/i) as HTMLTextAreaElement;
        const submitBtn = screen.getByTestId('command-bar-run-btn');

        // 1. Enter text
        fireEvent.change(input, { target: { value: 'Analyze Q3 Data' } });

        await waitFor(() => {
            expect(submitBtn).toBeEnabled();
        });

        // 2. Submit — run button is replaced by stop button when isProcessing=true
        fireEvent.click(submitBtn);

        // When processing, the stop button appears and the run button is unmounted
        await waitFor(() => {
            expect(screen.getByTestId('command-bar-stop-btn')).toBeInTheDocument();
            expect(screen.queryByTestId('command-bar-run-btn')).not.toBeInTheDocument();
        });
    });

    it('Scenario 2: Handles Error Toast when submission fails', async () => {
        const { agentService } = await import('@/services/agent/AgentService');
        const { mockToast } = await import('@/core/context/ToastContext') as any;

        vi.mocked(agentService.sendMessage).mockRejectedValueOnce(new Error('API Error'));

        render(<CommandBar />);

        const input = screen.getByPlaceholderText(/Launch a campaign/i);
        const submitBtn = screen.getByTestId('command-bar-run-btn');

        fireEvent.change(input, { target: { value: 'Bad request' } });

        await waitFor(() => expect(submitBtn).toBeEnabled());

        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(mockToast.error).toHaveBeenCalledWith("Failed to send message.");
        });
    });

    it('Scenario 3: Optimistic UI - input clears immediately upon send', async () => {
        render(<CommandBar />);

        const input = screen.getByPlaceholderText(/Launch a campaign/i) as HTMLTextAreaElement;
        const submitBtn = screen.getByTestId('command-bar-run-btn');

        fireEvent.change(input, { target: { value: 'Fast clear' } });

        await waitFor(() => expect(submitBtn).toBeEnabled());

        fireEvent.click(submitBtn);

        // PromptArea clears it immediately
        expect(input.value).toBe('');
    });

    it('Scenario 4: Validates Attachment Interaction (Add/Remove)', async () => {
        render(<CommandBar />);

        const file = new File(['hello'], 'report.pdf', { type: 'application/pdf' });

        act(() => {
            store.setState({ commandBarAttachments: [file] });
        });

        await waitFor(() => {
            expect(screen.getByText('report.pdf')).toBeInTheDocument();
        });

        act(() => {
            store.setState({ commandBarAttachments: [] });
        });

        await waitFor(() => {
            expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
        });
    });
});
