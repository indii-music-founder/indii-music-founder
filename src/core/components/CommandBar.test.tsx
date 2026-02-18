import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommandBar from './CommandBar';
// import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';
import { create } from 'zustand';

// Mock dependencies
// vi.mock('@/core/store'); // We will use a custom implementation for the store
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
        getAll: () => [
            { id: 'creative', name: 'Creative Director', category: 'manager', color: 'bg-pink-500' },
            { id: 'video', name: 'Video Producer', category: 'specialist', color: 'bg-purple-500' },
            { id: 'brand', name: 'Brand Manager', category: 'manager', color: 'bg-amber-500' },
            { id: 'road', name: 'Road Manager', category: 'manager', color: 'bg-yellow-500' },
            { id: 'campaign', name: 'Campaign Manager', category: 'manager', color: 'bg-orange-500' },
            { id: 'publicist', name: 'Publicist', category: 'manager', color: 'bg-orange-400' },
            { id: 'marketing', name: 'Marketing', category: 'department', color: 'bg-teal-500' },
        ],
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

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Define the store shape for testing
interface TestStoreState {
    currentModule: string;
    setModule: (mod: string) => void;
    toggleAgentWindow: () => void;
    isAgentOpen: boolean;
    chatChannel: string;
    setChatChannel: (channel: string) => void;
    commandBarInput: string;
    setCommandBarInput: (input: string) => void;
    commandBarAttachments: any[];
    setCommandBarAttachments: (attachments: any[]) => void;
    isCommandBarDetached: boolean;
    setCommandBarDetached: (detached: boolean) => void;
    setActiveAgentProvider: (agentId: string) => void;
}

// Create a real store for testing
const useTestStore = create<TestStoreState>((set) => ({
    currentModule: 'dashboard',
    setModule: (mod) => set({ currentModule: mod }),
    toggleAgentWindow: vi.fn(),
    isAgentOpen: false,
    chatChannel: 'indii',
    setChatChannel: (channel) => set({ chatChannel: channel }),
    commandBarInput: '',
    setCommandBarInput: (input) => set({ commandBarInput: input }),
    commandBarAttachments: [],
    setCommandBarAttachments: (attachments) => set({ commandBarAttachments: attachments }),
    isCommandBarDetached: false,
    setCommandBarDetached: (detached) => set({ isCommandBarDetached: detached }),
    setActiveAgentProvider: vi.fn(),
}));

// Mock the useStore hook to use our real test store
vi.mock('@/core/store', () => ({
    useStore: (selector?: (state: TestStoreState) => any) => {
        const state = useTestStore();
        return selector ? selector(state) : state;
    }
}));

describe('CommandBar', () => {
    const mockToast = { success: vi.fn(), error: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store state
        useTestStore.setState({
            currentModule: 'dashboard',
            isAgentOpen: false,
            chatChannel: 'indii',
            commandBarInput: '',
            commandBarAttachments: [],
            isCommandBarDetached: false,
        });

        // Spy on methods we want to assert
        vi.spyOn(useTestStore.getState(), 'setModule');
        vi.spyOn(useTestStore.getState(), 'setChatChannel');

        // Re-mock Toast
        (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockToast);
    });

    it('renders the delegate button correctly', () => {
        render(<CommandBar />);
        const button = document.querySelector('button[aria-label="Select active agent"]');
        expect(button).toBeInTheDocument();
        // The button only shows a dot, no text 'indii'
    });

    it('opens the dropdown when delegate button is clicked', () => {
        render(<CommandBar />);
        const button = document.querySelector('button[aria-label="Select active agent"]');
        fireEvent.click(button!);

        expect(screen.getByText("Manager's Office")).toBeInTheDocument();
        expect(screen.getByText('Creative Director')).toBeInTheDocument();
        expect(screen.getByText('Video Producer')).toBeInTheDocument();
        expect(screen.getByText('Brand Manager')).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('switches module and opens agent window when a manager is selected', () => {
        const toggleSpy = vi.spyOn(useTestStore.getState(), 'toggleAgentWindow');
        const setModuleSpy = vi.spyOn(useTestStore.getState(), 'setModule');

        render(<CommandBar />);
        const button = document.querySelector('button[aria-label="Select active agent"]');
        fireEvent.click(button!);

        const roadManagerOption = screen.getByText('Road Manager');
        fireEvent.click(roadManagerOption);

        expect(setModuleSpy).toHaveBeenCalledWith('road');
        expect(toggleSpy).toHaveBeenCalled(); // Note: toggleAgentWindow is just a spy function in initial state, but we spied on it
    });

    it('switches module and opens agent window when a department is selected', () => {
        const toggleSpy = vi.spyOn(useTestStore.getState(), 'toggleAgentWindow');
        const setModuleSpy = vi.spyOn(useTestStore.getState(), 'setModule');

        render(<CommandBar />);
        const button = document.querySelector('button[aria-label="Select active agent"]');
        fireEvent.click(button!);

        const marketingOption = screen.getByText('Marketing');
        fireEvent.click(marketingOption);

        expect(setModuleSpy).toHaveBeenCalledWith('marketing');
        expect(toggleSpy).toHaveBeenCalled();
    });

    // ... existing metadata tests ...

    it('calls setChatChannel("indii") when Indii is selected from menu', () => {
        // Start in agent mode
        useTestStore.setState({ currentModule: 'road', chatChannel: 'agent' });
        const setChatChannelSpy = vi.spyOn(useTestStore.getState(), 'setChatChannel');

        render(<CommandBar />);

        // Open menu
        const button = document.querySelector('button[aria-label="Select active agent"]');
        fireEvent.click(button!);

        // Select Indii
        const indiiOption = screen.getByText('indii');
        fireEvent.click(indiiOption);

        expect(setChatChannelSpy).toHaveBeenCalledWith('indii');
    });

    it('renders active Indii state and allows switching to agent via menu', async () => {
        // Start in Indii mode
        useTestStore.setState({ currentModule: 'dashboard', chatChannel: 'indii' });
        const setModuleSpy = vi.spyOn(useTestStore.getState(), 'setModule');

        render(<CommandBar />);

        const activeBtn = document.querySelector('button[aria-label="Select active agent"]');
        expect(activeBtn).toBeInTheDocument();

        // Verify placeholder
        expect(screen.getByPlaceholderText('Ask indii to orchestrate...')).toBeInTheDocument();

        // Test sending message in Indii mode
        const input = screen.getByPlaceholderText('Ask indii to orchestrate...');
        fireEvent.change(input, { target: { value: 'Hello Indii' } });
        const submitButton = screen.getByTestId('command-bar-run-btn');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(agentService.sendMessage).toHaveBeenCalledWith('Hello Indii', undefined, undefined);
        });

        // Test switch back to agent (e.g. Road)
        fireEvent.click(activeBtn!);
        const roadOption = screen.getByText('Road Manager');
        fireEvent.click(roadOption);

        expect(setModuleSpy).toHaveBeenCalledWith('road');
        // Side effect: setChatChannel('agent') happens in useEffect, which is hard to spy on directly in this render cycle without rerender check, 
        // but setModule is the trigger.
    });

    it('updates button text based on current module', () => {
        useTestStore.setState({ currentModule: 'road', chatChannel: 'agent' });

        render(<CommandBar />);
        expect(screen.getByPlaceholderText(/Message road/i)).toBeInTheDocument();
    });

    it('sends a message when form is submitted', async () => {
        render(<CommandBar />);

        const input = screen.getByPlaceholderText('Ask indii to orchestrate...');
        fireEvent.change(input, { target: { value: 'Hello agent' } });

        const submitButton = document.querySelector('button[aria-label="Run command"]');
        fireEvent.click(submitButton!);

        await waitFor(() => {
            expect(agentService.sendMessage).toHaveBeenCalledWith('Hello agent', undefined, undefined);
        });
    });
    it('handles drag and drop events', async () => {
        render(<CommandBar />);
        const dropZone = screen.getByTestId('command-bar-input-container');

        // Initial state
        expect(dropZone).not.toHaveClass('ring-4');

        // Drag over
        fireEvent.dragOver(dropZone!);
        expect(await screen.findByText('Drop to attach')).toBeInTheDocument();
        expect(dropZone).toHaveClass('ring-4');

        // Drag leave
        fireEvent.dragLeave(dropZone!);
        // expect(screen.getByPlaceholderText('Describe your task, drop files, or take a picture...')).toBeInTheDocument();
        // Animation might take time to exit or re-render, but our mock removes it immediately if logic is correct
        await waitFor(() => {
            expect(screen.queryByText('Drop to attach')).not.toBeInTheDocument();
        });
        expect(dropZone).not.toHaveClass('ring-4');

        // Drop
        fireEvent.dragOver(dropZone!);
        const file = new File(['hello'], 'hello.png', { type: 'image/png' });
        fireEvent.drop(dropZone!, {
            dataTransfer: {
                files: [file],
            },
        });

        expect(dropZone).not.toHaveClass('ring-2');
        // Check if attachment is added (rendered in preview)
        expect(screen.getByText('hello.png')).toBeInTheDocument();
    });

    // Camera button is currently removed from PromptArea
    // it('triggers camera input when camera button is clicked', () => {
    //     render(<CommandBar />);
    //     const cameraButton = screen.getByTitle('Take a picture');
    //     const cameraInput = document.querySelector('input[capture="environment"]');

    //     // Mock click on input
    //     const clickSpy = vi.spyOn(cameraInput as HTMLInputElement, 'click');

    //     fireEvent.click(cameraButton);
    //     expect(clickSpy).toHaveBeenCalled();
    // });
});
