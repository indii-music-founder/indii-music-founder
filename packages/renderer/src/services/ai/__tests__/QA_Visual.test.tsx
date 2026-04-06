import React from 'react';
import { onSnapshot } from 'firebase/firestore';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwarmGraph } from '@/components/studio/observability/SwarmGraph';
import { TraceService } from '@/services/agent/observability/TraceService';
import { ReactFlowProvider } from 'reactflow';

// Mock dependencies
// Rely on global setup.ts for firebase/firestore mocks

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
    ai: {},
    functionsWest1: { region: vi.fn(() => ({ httpsCallable: vi.fn() })) },
    getFirebaseAI: vi.fn(() => ({})),
    app: { options: {} },
    appCheck: { getToken: vi.fn(() => Promise.resolve({ token: 'mock-token' })) },
    messaging: { getToken: vi.fn() }
}));

// vi.mock('@/core/store', () => ({
//     useStore: vi.fn(),
//     useVoice: () => ({ isMuted: true }), // Mock useVoice from store/context if needed
// }));

// vi.mock('@/core/context/VoiceContext', () => ({
//     useVoice: () => ({ isMuted: true }),
// }));

// Mock ReactFlow (Synchronous)
vi.mock('reactflow', () => ({
    __esModule: true,
    default: ({ nodes, edges }: any) => (
        <div data-testid="react-flow-mock">
            <div data-testid="nodes-count">{nodes?.length || 0}</div>
            <div data-testid="edges-count">{edges?.length || 0}</div>
        </div>
    ),
    useNodesState: (initial: any) => React.useState(initial),
    useEdgesState: (initial: any) => React.useState(initial),
    Background: () => null,
    Controls: () => null,
    MarkerType: { ArrowClosed: 'arrowclosed' },
    ConnectionMode: { Loose: 'loose' },
    ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
}));

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

            // Note: We avoid running the callback synchronously to prevent loops if any
            mockOnSnapshot.mockImplementation((query: any, callback: any) => {
                const snapshot = {
                    docs: mockTraces.map(t => ({
                        id: t.id,
                        data: () => t
                    }))
                };
                // Simulate async callback to avoid render loops in tests
                setTimeout(() => callback(snapshot), 0);
                return mockUnsubscribe;
            });

            render(
                <ReactFlowProvider>
                    <SwarmGraph swarmId="swarm-1" />
                </ReactFlowProvider>
            );

            // Wait for nodes to update (async snapshot)
            await waitFor(() => {
                const nodesCount = screen.getByTestId('nodes-count');
                expect(nodesCount.textContent).toBe('50');
            });

            // 5. Verify Edge Count
            await waitFor(() => {
                const edgesCount = screen.getByTestId('edges-count');
                expect(edgesCount.textContent).toBe('49');
            });
        });
    });

});
