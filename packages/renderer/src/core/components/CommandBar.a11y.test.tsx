import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import CommandBar from './CommandBar';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';

// Extend expect with jest-axe
expect.extend(toHaveNoViolations);

// --- MOCKS ---

vi.mock('@/core/store');
vi.mock('@/core/context/ToastContext');
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
}));

vi.mock('@/services/agent/AgentService', () => ({
    serverTimestamp: vi.fn(),
    agentService: {
        sendMessage: vi.fn(),
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
        getAll: () => [
            { id: 'manager1', name: 'Manager One', category: 'manager', color: 'bg-red-500', description: 'Desc 1' },
            { id: 'dept1', name: 'Dept One', category: 'department', color: 'bg-blue-500', description: 'Desc 2' },
        ],
        register: vi.fn(),
        get: vi.fn(),
    }
}));

vi.mock('../theme/moduleColors', () => ({
    serverTimestamp: vi.fn(),
    getColorForModule: () => ({
        serverTimestamp: vi.fn(),
        border: 'border-gray-700',
        ring: 'ring-gray-700',
        bg: 'bg-gray-800',
        text: 'text-white'
    }),
    getDepartmentCssVar: () => '--color-gray-700',
}));

vi.mock('motion/react', () => ({
    serverTimestamp: vi.fn(),
    motion: {
        div: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
            <div ref={ref} className={className} {...props}>{children}</div>
        ))
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

// --- REACTIVE STORE MOCK ---
vi.mock('@/core/store', async () => {
    const { create } = await import('zustand');
    const store = create((set: any) => ({
        currentModule: 'dashboard',
        setModule: vi.fn((m) => set({ currentModule: m })),
        toggleAgentWindow: vi.fn(),
        isAgentOpen: false,
        chatChannel: 'agent', // Ensure delegate menu is visible
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
    const mockToast = {
        success: vi.fn(),
        error: vi.fn()
    };
    return {
        useToast: () => mockToast,
        mockToast
    };
});

describe('CommandBar Accessibility', () => {
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
    });

    it('should have no accessibility violations in default state', async () => {
        const { container } = render(<CommandBar />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations when Delegate Menu is open', async () => {
        const { container } = render(<CommandBar />);

        const delegateBtn = screen.getByRole('button', { name: /select active agent/i });
        fireEvent.click(delegateBtn);

        expect(screen.getByRole('menu')).toBeInTheDocument();

        const results = await axe(container);
        expect(results).toHaveNoViolations();
    });

    it('should close Delegate Menu when Escape key is pressed', async () => {
        render(<CommandBar />);

        const delegateBtn = screen.getByRole('button', { name: /select active agent/i });
        fireEvent.click(delegateBtn);

        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    it('should return focus to the trigger button when Delegate Menu is closed', async () => {
        render(<CommandBar />);

        const delegateBtn = screen.getByRole('button', { name: /select active agent/i });
        delegateBtn.focus();
        fireEvent.click(delegateBtn);

        expect(screen.getByRole('menu')).toBeInTheDocument();

        // Close by clicking backdrop (simulated) or Escape if implemented
        // Here we simulate Escape as tested above
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        // We expect focus to return to the trigger
        expect(document.activeElement).toBe(delegateBtn!);
    });
});
