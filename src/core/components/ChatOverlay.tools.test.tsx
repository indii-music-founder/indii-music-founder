import { render, screen, within } from '@testing-library/react';
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
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock TextEffect
vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: any) => <span>{children}</span>
}));

// Mock Lucide Icons
vi.mock('lucide-react', () => ({
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
}));

// Mock Child Renderers (Keep these simple)
vi.mock('./VisualScriptRenderer', () => ({ default: () => <div /> }));
vi.mock('./ScreenplayRenderer', () => ({ default: () => <div /> }));
vi.mock('./CallSheetRenderer', () => ({ default: () => <div /> }));
vi.mock('./ContractRenderer', () => ({ default: () => <div /> }));

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
    generatedHistory: [],
    loadSessions: vi.fn(),
    createSession: vi.fn(),
    toggleAgentWindow: vi.fn(),
    currentProjectId: 'p1',
    setModule: vi.fn(),
    setGenerationMode: vi.fn(),
    setViewMode: vi.fn(),
    setSelectedItem: vi.fn(),
};

describe('👁️ Pixel: Chat Tool Output Verification', () => {

    const updateStore = (overrides: any) => {
        const state = { ...INITIAL_STATE, ...overrides };
        mockUseStore.mockImplementation((selector: any) => {
            if (typeof selector === 'function') return selector(state);
            return state;
        });
        mockGetState.mockReturnValue(state);
        return state;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        updateStore({});
    });

    it('Scenario 1: Renders "Brand Analysis Report" from nested Delegate Task output', async () => {
        // Construct nested JSON structure
        const analysisReport = "## Brand Analysis\n\nConsistency: 95%\n\nNo violations found.";
        const innerJson = JSON.stringify({ analysis: analysisReport });

        // The text field inside delegate_task contains the inner tool output
        const innerToolOutput = `[Tool: analyze_brand_consistency] Output: Success: ${innerJson}`;

        const outerJson = JSON.stringify({
            text: innerToolOutput,
            assignedTo: "marketing"
        });

        // PIXEL LEARNING: Markdown consumes one level of backslashes.
        // We must double-escape the JSON string so that `react-markdown` renders it
        // with single escapes preserved, allowing `JSON.parse` to succeed in the component.
        const escapedOuterJson = outerJson.replace(/\\/g, '\\\\');

        const fullText = `[Tool: delegate_task] Output: Success: ${escapedOuterJson}`;

        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: fullText, isStreaming: false }
            ]
        });

        render(<ChatOverlay />);

        // 1. Verify Header exists
        expect(await screen.findByText('Brand Analysis Report')).toBeInTheDocument();

        // 2. Verify Content is rendered (and markdown parsed)
        expect(screen.getByText('Consistency: 95%')).toBeInTheDocument();

        // 3. Verify it is wrapped in the correct style container (purple border)
        const reportContainer = screen.getByText('Brand Analysis Report').closest('div')?.parentElement;
        expect(reportContainer).toHaveClass('bg-purple-900/10');
    });

    it('Scenario 2: Renders "CINEMATIC GRID" for render_cinematic_grid tool', async () => {
        // Mock generated history so the ID resolves
        const mockGridItem = {
            id: 'grid-123',
            url: 'https://example.com/grid.png',
            prompt: 'A cinematic scene',
            type: 'image'
        };

        updateStore({
            agentHistory: [
                {
                    id: 'ai1',
                    role: 'model',
                    text: `[Tool: render_cinematic_grid] Output: { "grid_id": "grid-123" }`,
                    isStreaming: false
                }
            ],
            generatedHistory: [mockGridItem]
        });

        render(<ChatOverlay />);

        // 1. Verify Label
        expect(await screen.findByText(/CINEMATIC GRID 1/)).toBeInTheDocument();

        // 2. Verify Image
        const img = screen.getByAltText('A cinematic scene');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/grid.png');
    });

    it('Scenario 3: Renders "EXTRACTED FRAME" for extract_grid_frame tool', async () => {
        const mockFrameItem = {
            id: 'frame-456',
            url: 'https://example.com/frame.png',
            prompt: 'Extracted Frame',
            type: 'image'
        };

        updateStore({
            agentHistory: [
                {
                    id: 'ai1',
                    role: 'model',
                    text: `[Tool: extract_grid_frame] Output: { "frame_id": "frame-456" }`,
                    isStreaming: false
                }
            ],
            generatedHistory: [mockFrameItem]
        });

        render(<ChatOverlay />);

        expect(await screen.findByText(/EXTRACTED FRAME 1/)).toBeInTheDocument();
    });

    it('Scenario 4: Gracefully handles malformed Tool JSON (Resilience)', async () => {
        // Missing closing brace
        const badText = `[Tool: delegate_task] Output: { "text": "oops"`;

        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: badText, isStreaming: false }
            ]
        });

        render(<ChatOverlay />);

        // Should NOT crash and should render the raw text
        expect(screen.getByText(badText)).toBeInTheDocument();

        // Should NOT see any special headers
        expect(screen.queryByText('Brand Analysis Report')).not.toBeInTheDocument();
    });

    it('Scenario 5: Handles nested tool with no specialized renderer (Generic Fallback)', async () => {
        // A tool that isn't 'analyze_brand_consistency'
        const genericInnerJson = JSON.stringify({ someKey: "someValue" });
        const innerToolOutput = `[Tool: some_random_tool] Output: ${genericInnerJson}`;
        const outerJson = JSON.stringify({ text: innerToolOutput });

        // Double-escape for Markdown
        const escapedOuterJson = outerJson.replace(/\\/g, '\\\\');

        const fullText = `[Tool: delegate_task] Output: ${escapedOuterJson}`;

        updateStore({
            agentHistory: [
                { id: 'ai1', role: 'model', text: fullText, isStreaming: false }
            ]
        });

        render(<ChatOverlay />);

        // Should use the generic fallback rendering
        expect(await screen.findByText(/Tool Result: some_random_tool/)).toBeInTheDocument();
        // Should verify content presence
        // Note: The UI renders `JSON.stringify(innerJson, null, 2)` inside a div.
        // This will have spaces and newlines.
        // We look for a unique string "someKey"
        expect(screen.getByText(/"someKey"/)).toBeInTheDocument();
    });

});
