import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommandBar from './CommandBar';

// Use vi.hoisted for mocked functions accessed in mock factory
const { mockStartListening, mockStopListening } = vi.hoisted(() => ({
    mockStartListening: vi.fn(),
    mockStopListening: vi.fn(),
}));

// --- REACTIVE STORE MOCK ---
vi.mock('@/core/store', async () => {
    const { create } = await import('zustand');
    const store = create((set: any) => ({
        currentModule: 'dashboard',
        setModule: vi.fn((m) => set({ currentModule: m })),
        toggleAgentWindow: vi.fn(),
        isAgentOpen: false,
        chatChannel: 'agent',
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
        activeAgentProvider: 'native',
        setActiveAgentProvider: vi.fn((p) => set({ activeAgentProvider: p })),
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

vi.mock('zustand/react/shallow', async () => {
    const actual = await vi.importActual('zustand/react/shallow') as any;
    return actual;
});

vi.mock('@/core/context/ToastContext', () => {
    const mockToast = { success: vi.fn(), error: vi.fn() };
    return { useToast: () => mockToast, mockToast };
});

vi.mock('firebase/firestore', () => ({
    serverTimestamp: vi.fn(),
    Timestamp: {
        now: () => ({ serverTimestamp: vi.fn(), toMillis: () => Date.now() }),
        fromDate: (date: Date) => ({ toMillis: () => date.getTime() }),
    },
    getFirestore: vi.fn(),
    initializeFirestore: vi.fn(() => ({ serverTimestamp: vi.fn() })),
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
    agentService: { sendMessage: vi.fn() },
}));

vi.mock('@/services/ai/VoiceService', () => ({
    serverTimestamp: vi.fn(),
    voiceService: {
        isSupported: vi.fn(() => true),
        startListening: mockStartListening,
        stopListening: mockStopListening,
    }
}));

vi.mock('@/services/agent/registry', () => ({
    serverTimestamp: vi.fn(),
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
    getDepartmentCssVar: () => '--color-gray-700',
}));

vi.mock('motion/react', () => ({
    serverTimestamp: vi.fn(),
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('📱 Viewport: CommandBar Responsiveness', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        const { act } = await import('@testing-library/react');
        const storeModule = await import('@/core/store') as any;
        const store = storeModule.store;
        act(() => {
            store.setState({
                currentModule: 'dashboard',
                chatChannel: 'agent',
                isCommandBarDetached: true,
                isCommandBarCollapsed: false,
                commandBarInput: '',
                commandBarAttachments: [],
                isAgentProcessing: false,
                isAgentOpen: false,
            });
        });

        // Set Viewport to Mobile (iPhone SE: 375px)
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
        window.dispatchEvent(new Event('resize'));
    });

    it('adapts layout for mobile devices (JS-driven adaptation)', () => {
        render(<CommandBar />);

        // 1. Verify Input Field is visible (use actual placeholder or role)
        const input = screen.getByTestId('main-prompt-input') ?? screen.queryByPlaceholderText(/launch a campaign/i);
        expect(input).toBeInTheDocument();

        // 2. Verify "Send" (Run) button is visible
        const runButton = screen.getByRole('button', { name: /run command/i });
        expect(runButton).toBeVisible();

        // 3. The mode toggle is always present (indii/agent toggle replaced delegate menu)
        const modeToggle = screen.queryByRole('button', { name: /switch to indii mode/i })
            ?? screen.queryByRole('button', { name: /switch to agent mode/i });
        expect(modeToggle).toBeInTheDocument();

        // "Attach" button should be hidden on mobile
        const attachButton = screen.queryByText('Attach');
        expect(attachButton).not.toBeInTheDocument();

        // "Camera" button should be hidden on mobile
        const cameraButton = screen.queryByTitle('Take a picture');
        expect(cameraButton).not.toBeInTheDocument();
    });

    it('retains voice input capability on mobile and handles touch interaction', () => {
        render(<CommandBar />);

        // Find the voice button by the aria-label we just added
        const voiceButton = screen.getByLabelText(/voice input/i);
        expect(voiceButton).toBeInTheDocument();
        expect(voiceButton).toBeVisible();

        // Simulate touch/click interaction
        fireEvent.click(voiceButton);

        // Verify voice service was triggered
        expect(mockStartListening).toHaveBeenCalled();
    });
});
