import React from 'react';
import { onSnapshot } from 'firebase/firestore';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SwarmGraph } from '@/components/studio/observability/SwarmGraph';
import ChatOverlay from '@/core/components/ChatOverlay';
import { TraceService } from '@/services/agent/observability/TraceService';
import { useStore } from '@/core/store';
import { ReactFlowProvider } from 'reactflow';

// Mock dependencies
vi.mock('firebase/firestore', () => ({
    onSnapshot: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
}));

vi.mock('@/services/agent/observability/TraceService', () => ({
    TraceService: {
        getSwarmQuery: vi.fn(),
    },
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    auth: {},
    storage: {},
    functions: {},
    remoteConfig: {}, // Mock remoteConfig
    ai: {}
}));

vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({ isMuted: true }),
}));

// Mock ReactFlow to avoid canvas rendering issues
vi.mock('reactflow', async () => {
    const actual = await vi.importActual('reactflow');
    return {
        ...actual,
        __esModule: true,
        default: ({ nodes, edges }: any) => (
            <div data-testid="react-flow-mock">
                <div data-testid="nodes-count">{nodes.length}</div>
                <div data-testid="edges-count">{edges.length}</div>
            </div>
        ),
        useNodesState: (initial: any) => React.useState(initial),
        useEdgesState: (initial: any) => React.useState(initial),
    };
});

// Mock react-virtuoso to render items directly
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent }: any) => (
        <div data-testid="virtuoso-mock">
            {data.map((item: any, index: number) => (
                <div key={index}>{itemContent(index, item)}</div>
            ))}
        </div>
    ),
}));

describe('Visual Regression & Performance Verification', () => {

    describe('SwarmGraph Performance', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            global.ResizeObserver = class ResizeObserver {
                observe() { }
                unobserve() { }
                disconnect() { }
            };
        });

        it('should handle rendering 50+ nodes without crashing', async () => {
            // 1. Generate 50 mock traces
            const mockTraces = Array.from({ length: 50 }, (_, i) => ({
                id: `trace-${i}`,
                agentId: i % 2 === 0 ? 'orchestrator' : 'generalist',
                sessionId: 'session-1',
                swarmId: 'swarm-1',
                input: { goal: 'test' },
                startTime: Date.now(),
                status: 'completed',
                metadata: {
                    type: 'task',
                    parentTraceId: i > 0 ? `trace-${i - 1}` : undefined
                }
            }));

            // 2. Mock onSnapshot to return these traces
            const mockUnsubscribe = vi.fn();
            const mockOnSnapshot = vi.mocked(onSnapshot);

            mockOnSnapshot.mockImplementation((query: any, callback: any) => {
                const snapshot = {
                    docs: mockTraces.map(t => ({
                        id: t.id,
                        data: () => t
                    }))
                };
                callback(snapshot);
                return mockUnsubscribe;
            });

            // 3. Render SwarmGraph
            render(
                <ReactFlowProvider>
                    <SwarmGraph swarmId="swarm-1" />
                </ReactFlowProvider>
            );

            // 4. Verify Node Count
            // We expect 50 nodes
            const nodesCount = await screen.findByTestId('nodes-count');
            expect(nodesCount.textContent).toBe('50');

            // 5. Verify Edge Count
            // We expect 49 edges (linear chain)
            const edgesCount = await screen.findByTestId('edges-count');
            expect(edgesCount.textContent).toBe('49');
        });
    });

    describe('ChatOverlay Sync', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            // Mock Element.prototype.scrollTo
            Element.prototype.scrollTo = vi.fn();
            global.ResizeObserver = class ResizeObserver {
                observe() { }
                unobserve() { }
                disconnect() { }
            };
        });

        it('should update text content dynamically when store changes', async () => {
            // 1. Setup initial store state
            const mockMessages = [
                { id: '1', role: 'user', text: 'Hello' },
                { id: '2', role: 'model', text: 'Thinking...' } // Partial
            ];

            const mockStoreState = {
                agentHistory: mockMessages,
                isAgentOpen: true,
                userProfile: { brandKit: { referenceImages: [] } },
                messages: mockMessages,
                isProcessing: true,
                error: null,
                metrics: {},
                generatedHistory: [],
                currentProjectId: 'test-project',
                loadSessions: vi.fn(),
                activeSessionId: null,
                sessions: {},
                createSession: vi.fn(),
                toggleAgentWindow: vi.fn()
            };

            const mockUseStore = vi.mocked(useStore);
            mockUseStore.mockImplementation((selector: any) => selector ? selector(mockStoreState) : mockStoreState);

            const { rerender } = render(<ChatOverlay />);

            // Verify initial content
            expect(await screen.findByText('Thinking...')).toBeDefined();

            // 2. Simulate streaming update
            const updatedMessages = [
                { id: '1', role: 'user', text: 'Hello' },
                { id: '2', role: 'model', text: 'Thinking... Done.' } // Updated
            ];

            const updatedStoreState = {
                ...mockStoreState,
                agentHistory: updatedMessages,
                messages: updatedMessages
            };

            mockUseStore.mockImplementation((selector: any) => selector ? selector(updatedStoreState) : updatedStoreState);

            // Re-render to simulate hook update
            rerender(<ChatOverlay />);

            // 3. Verify updated content
            expect(await screen.findByText('Thinking... Done.')).toBeDefined();
        });
    });
});
