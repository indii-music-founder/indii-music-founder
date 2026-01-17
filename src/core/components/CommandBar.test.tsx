import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommandBar from './CommandBar';
import { useStore } from '@/core/store';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';

// Mock dependencies
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

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('CommandBar', () => {
    const mockSetModule = vi.fn();
    const mockToggleAgentWindow = vi.fn();
    const mockSetChatChannel = vi.fn();
    const mockToast = { success: vi.fn(), error: vi.fn() };

    beforeEach(() => {
        vi.clearAllMocks();
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'dashboard',
            setModule: mockSetModule,
            toggleAgentWindow: mockToggleAgentWindow,
            isAgentOpen: false,
            chatChannel: 'indii',
            setChatChannel: mockSetChatChannel,
        });
        (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockToast);
    });

    it('renders the delegate button correctly', () => {
        render(<CommandBar />);
        expect(screen.getByText('Delegate to indii')).toBeInTheDocument();
    });

    it('opens the dropdown when delegate button is clicked', () => {
        render(<CommandBar />);
        const button = screen.getByText('Delegate to indii').closest('button');
        fireEvent.click(button!);

        expect(screen.getByText("Manager's Office")).toBeInTheDocument();
        expect(screen.getByText('Creative Director')).toBeInTheDocument();
        expect(screen.getByText('Video Producer')).toBeInTheDocument();
        expect(screen.getByText('Brand Manager')).toBeInTheDocument();
        expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('switches module and opens agent window when a manager is selected', () => {
        render(<CommandBar />);
        const button = screen.getByText('Delegate to indii').closest('button');
        fireEvent.click(button!);

        const roadManagerOption = screen.getByText('Road Manager');
        fireEvent.click(roadManagerOption);

        expect(mockSetModule).toHaveBeenCalledWith('road');
        expect(mockToggleAgentWindow).toHaveBeenCalled();
    });

    it('switches module and opens agent window when a department is selected', () => {
        render(<CommandBar />);
        const button = screen.getByText('Delegate to indii').closest('button');
        fireEvent.click(button!);

        const marketingOption = screen.getByText('Marketing');
        fireEvent.click(marketingOption);

        expect(mockSetModule).toHaveBeenCalledWith('marketing');
        expect(mockToggleAgentWindow).toHaveBeenCalled();
    });

    // Test for 'does not switch module but toggles agent window when indii is selected' removed as Indii option is removed from DelegateMenu

    it('calls setChatChannel("indii") when Indii button is clicked', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'road',
            setModule: mockSetModule,
            toggleAgentWindow: mockToggleAgentWindow,
            isAgentOpen: false,
            chatChannel: 'agent',
            setChatChannel: mockSetChatChannel,
        });

        render(<CommandBar />);
        const indiiButton = screen.getByTitle('Switch to indii');
        fireEvent.click(indiiButton);
        expect(mockSetChatChannel).toHaveBeenCalledWith('indii');
    });

    it('renders active Indii state and calls "agent" toggle when clicked', async () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'road',
            setModule: mockSetModule,
            toggleAgentWindow: mockToggleAgentWindow,
            isAgentOpen: false,
            chatChannel: 'indii',
            setChatChannel: mockSetChatChannel,
        });

        render(<CommandBar />);

        const activeBtn = screen.getByTitle('active: indii (Orchestrator)');
        expect(activeBtn).toBeInTheDocument();
        expect(activeBtn).toHaveAttribute('aria-pressed', 'true');

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

        // Test toggle off
        fireEvent.click(activeBtn);
        expect(mockSetChatChannel).toHaveBeenCalledWith('agent');
    });

    it('updates button text based on current module', () => {
        (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
            currentModule: 'road',
            setModule: mockSetModule,
            toggleAgentWindow: mockToggleAgentWindow,
            isAgentOpen: false,
            chatChannel: 'agent',
            setChatChannel: mockSetChatChannel,
        });

        render(<CommandBar />);
        expect(screen.getByText('Delegate to Road')).toBeInTheDocument();
    });

    it('sends a message when form is submitted', async () => {
        render(<CommandBar />);

        const input = screen.getByPlaceholderText('Ask indii to orchestrate...');
        fireEvent.change(input, { target: { value: 'Hello agent' } });

        const submitButton = screen.getByText('Run').closest('button');
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
        expect(await screen.findByText('Drop files to attach')).toBeInTheDocument();
        expect(dropZone).toHaveClass('ring-4');

        // Drag leave
        fireEvent.dragLeave(dropZone!);
        // expect(screen.getByPlaceholderText('Describe your task, drop files, or take a picture...')).toBeInTheDocument();
        // Animation might take time to exit or re-render, but our mock removes it immediately if logic is correct
        await waitFor(() => {
            expect(screen.queryByText('Drop files to attach')).not.toBeInTheDocument();
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

    it('triggers camera input when camera button is clicked', () => {
        render(<CommandBar />);
        const cameraButton = screen.getByTitle('Take a picture');
        const cameraInput = document.querySelector('input[capture="environment"]');

        // Mock click on input
        const clickSpy = vi.spyOn(cameraInput as HTMLInputElement, 'click');

        fireEvent.click(cameraButton);
        expect(clickSpy).toHaveBeenCalled();
    });
});
