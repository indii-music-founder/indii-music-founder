import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChatOverlay from './ChatOverlay';
import { useStore } from '@/core/store';

// --- MOCKS ---

// Mock Voice Context
vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({ isVoiceEnabled: false, setVoiceEnabled: vi.fn() })
}));

// Mock Voice Service
vi.mock('@/services/ai/VoiceService', () => ({
    voiceService: { speak: vi.fn(), stopSpeaking: vi.fn() }
}));

// Mock Toast Context
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({
        toast: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    })
}));

// Mock Virtuoso
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent }: any) => (
        <div data-testid="stream-list">
            {data.map((item: any, i: number) => (
                <div key={item.id} data-testid={`message-${item.role}-${i}`}>
                    {itemContent(i, item)}
                </div>
            ))}
        </div>
    ),
    VirtuosoHandle: {},
}));

// Mock Framer Motion
vi.mock('motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useDragControls: () => ({ start: vi.fn() }),
}));

// Mock TextEffect
vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: any) => <span>{children}</span>
}));

// Mock Lucide Icons
vi.mock('lucide-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('lucide-react')>()),
    Volume2: () => <span data-testid="icon-volume-2" />,
    VolumeX: () => <span data-testid="icon-volume-x" />,
    ChevronDown: () => <span data-testid="icon-chevron-down" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
    FileJson: () => <span data-testid="icon-file-json" />,
    X: () => <span data-testid="icon-x" />,
    Bot: () => <span data-testid="icon-bot" />,
    Sparkles: () => <span data-testid="icon-sparkles" />,
    History: () => <span data-testid="icon-history" />,
    Plus: () => <span data-testid="icon-plus" />,
    UserPlus: () => <span data-testid="icon-user-plus" />,
    GripHorizontal: () => <span data-testid="icon-grip-horizontal" />,
    Minimize2: () => <span data-testid="icon-minimize-2" />,
    RefreshCw: () => <span data-testid="icon-refresh-cw" />,
    Copy: () => <span data-testid="icon-copy" />,
    Check: () => <span data-testid="icon-check" />,
    ExternalLink: () => <span data-testid="icon-external-link" />,
    Maximize2: () => <span data-testid="icon-maximize-2" />,
    Paperclip: () => <span data-testid="icon-paperclip" />,
    ArrowRight: () => <span data-testid="icon-arrow-right" />,
    Loader2: () => <span data-testid="icon-loader-2" />,
    Camera: () => <span data-testid="icon-camera" />,
    Mic: () => <span data-testid="icon-mic" />,
    PanelTopClose: () => <span data-testid="icon-panel-top-close" />,
    PanelTopOpen: () => <span data-testid="icon-panel-top-open" />,
    ChevronUp: () => <span data-testid="icon-chevron-up" />,
}));

// Mock Child Renderers
vi.mock('./VisualScriptRenderer', () => ({
    default: ({ data }: any) => <div data-testid="visual-script-renderer">{data.title}</div>
}));
vi.mock('./ScreenplayRenderer', () => ({
    default: ({ data }: any) => <div data-testid="screenplay-renderer">Slug: {data.elements[0].content}</div>
}));
vi.mock('./CallSheetRenderer', () => ({
    default: ({ data }: any) => <div data-testid="call-sheet-renderer">Call Time: {data.callTime}</div>
}));
vi.mock('./ContractRenderer', () => ({
    default: ({ markdown }: any) => <div data-testid="contract-renderer">Legal Doc</div>
}));

// Mock Store - hoisted
const mockGetState = vi.fn();
const mockUseStore = vi.fn();
// Attach getState to the hook mock
(mockUseStore as any).getState = mockGetState;

vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        (selector: any) => mockUseStore(selector),
        { getState: () => mockGetState() }
    )
}));

// --- TEST DATA ---
const INITIAL_STATE = {
    isAgentOpen: true,
    agentHistory: [],
    activeSessionId: 'session-1',
    sessions: { 'session-1': { title: 'Test Session', participants: ['indii'] } },
    userProfile: { brandKit: { referenceImages: [] } },
    generatedHistory: [], // Important for image lookup
    loadSessions: vi.fn(),
    createSession: vi.fn(),
    toggleAgentWindow: vi.fn(),
    currentProjectId: 'p1',
    isAgentProcessing: false,
    chatChannel: 'agent',
    agentWindowSize: { width: 400, height: 600 },
    setAgentWindowSize: vi.fn(),
    isCommandBarDetached: false,
    setCommandBarDetached: vi.fn(),
    setChatChannel: vi.fn(),
    commandBarInput: '',
    setCommandBarInput: vi.fn(),
    commandBarAttachments: [],
    setCommandBarAttachments: vi.fn()
};

describe('👁️ Pixel: Chat Overlay Markdown & Visuals', () => {

    const updateStore = (overrides: any) => {
        const state = { ...INITIAL_STATE, ...overrides };

        // Mock hook behavior
        mockUseStore.mockImplementation((selector: any) => {
            if (typeof selector === 'function') return selector(state);
            return state;
        });

        // Mock getState behavior (crucial for ImageRenderer and Tool logic)
        mockGetState.mockReturnValue(state);

        return state;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(navigator, {
            clipboard: {
                writeText: vi.fn().mockImplementation(() => Promise.resolve()),
            },
        });
        updateStore({});
    });

    it('Scenario 1: Renders Markdown Tables correctly (wrapped for scroll)', async () => {
        const tableMarkdown = `
| Header 1 | Header 2 |
| --- | --- |
| Data 1 | Data 2 |
`;
        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: tableMarkdown, isStreaming: false }
            ]
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        const table = await screen.findByRole('table');
        expect(table).toBeInTheDocument();

        const wrapper = table.parentElement;
        expect(wrapper).toHaveClass('overflow-x-auto');
        expect(wrapper).toHaveClass('custom-scrollbar');
    });

    it('Scenario 2: Detects JSON code block and renders VisualScriptRenderer', async () => {
        const scriptJson = {
            title: "My Movie",
            synopsis: "A great story",
            beats: []
        };
        const text = "```json\n" + JSON.stringify(scriptJson) + "\n```";

        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: text, isStreaming: false }
            ]
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        const renderer = await screen.findByTestId('visual-script-renderer');
        expect(renderer).toHaveTextContent("My Movie");
        expect(screen.queryByRole('code')).not.toBeInTheDocument();
    });

    it('Scenario 3: Detects Legal Agreement and renders ContractRenderer', async () => {
        const text = "```markdown\n# LEGAL AGREEMENT\n\nThis is a contract...\n```";

        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: text, isStreaming: false }
            ]
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        const renderer = await screen.findByTestId('contract-renderer');
        expect(renderer).toBeInTheDocument();
    });

    it('Scenario 4: Handles "Thinking" state accessibility', () => {
        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: '', isStreaming: true }
            ]
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-label', 'AI is thinking');
    });

    it('Scenario 5: Renders Images from Tool Output (Chaos/Complex Format)', async () => {
        const toolOutput = `
[Tool: generate_image] Output: Success: {
    "urls": ["https://example.com/image1.png"]
}
`;
        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: toolOutput, isStreaming: false }
            ],
            generatedHistory: []
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        // The image should be rendered despite markdown auto-linking URLs
        const img = await screen.findByAltText('Generated Image 1');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/image1.png');
    });

    it('Scenario 6: Resilient to Malformed JSON during streaming', async () => {
        const partialJson = "```json\n{\"title\": \"Incomp"; // Missing brace

        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: partialJson, isStreaming: true }
            ]
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        expect(screen.getByText(/Incomp/)).toBeInTheDocument();
        expect(screen.queryByTestId('visual-script-renderer')).not.toBeInTheDocument();
    });

    it('Scenario 7: Renders Unordered and Ordered Lists correctly', async () => {
        const listMarkdown = `
- Item 1
- Item 2

1. First
2. Second
`;
        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: listMarkdown, isStreaming: false }
            ]
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        // Verify List Items exist
        const listItems = await screen.findAllByRole('listitem');
        // 2 items for UL + 2 items for OL = 4 items
        expect(listItems).toHaveLength(4);
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('First')).toBeInTheDocument();
    });

    it('Scenario 8: Verifies Code Block Copy Functionality', async () => {
        const code = "console.log('hello world');";
        const markdown = "```javascript\n" + code + "\n```";

        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: markdown, isStreaming: false }
            ]
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        // Verify Code Block Rendering
        const copyBtn = await screen.findByTestId('copy-code-btn');
        expect(copyBtn).toBeInTheDocument();
        expect(screen.getByTestId('icon-copy')).toBeInTheDocument();

        // Click Copy
        fireEvent.click(copyBtn);

        // Verify Clipboard Call
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("console.log('hello world');"));

        // Verify Feedback (Copied! state)
        await waitFor(() => {
            expect(screen.getByTestId('icon-check')).toBeInTheDocument();
            expect(screen.getByText('Copied!')).toBeInTheDocument();
        });
    });

    it('Scenario 9: Verifies Long Word Breaking (Layout Shift Prevention)', async () => {
        const longWord = "A".repeat(100);
        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: longWord, isStreaming: false }
            ]
        });

        render(<ChatOverlay onClose={vi.fn()} />);

        const messageContainer = screen.getByTestId('agent-message');
        // Check specifically for break-words class which handles this
        // Note: The class is on an inner div relative to the data-testid
        expect(messageContainer.querySelector('.break-words')).toBeInTheDocument();
        expect(screen.getByText(longWord)).toBeInTheDocument();
    });

});
