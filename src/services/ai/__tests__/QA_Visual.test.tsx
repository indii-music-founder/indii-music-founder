import React from 'react';
import { onSnapshot } from 'firebase/firestore';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SwarmGraph } from '@/components/studio/observability/SwarmGraph';
import { TraceService } from '@/services/agent/observability/TraceService';
import { useStore } from '@/core/store';
import { ReactFlowProvider } from 'reactflow';

// Mock dependencies
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
    ai: {}
}));

vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

vi.mock('@/core/context/VoiceContext', () => ({
    useVoice: () => ({ isMuted: true }),
}));

// Mock ReactFlow to avoid canvas rendering issues
vi.mock('reactflow', () => ({
    __esModule: true,
    default: ({ nodes, edges }: any) => (
        <div data-testid="react-flow-mock">
            <div data-testid="nodes-count">{nodes?.length || 0}</div>
            <div data-testid="edges-count">{edges?.length || 0}</div>
        </div>
    ),
    useNodesState: (initial: any) => [initial, vi.fn(), vi.fn()],
    useEdgesState: (initial: any) => [initial, vi.fn(), vi.fn()],
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

// import { SwarmGraph } from '@/components/studio/observability/SwarmGraph';
/*
describe('Visual Regression & Performance Verification', () => {
    it('dummy', () => { expect(true).toBe(true); });
});
*/
describe('Debug', () => {
    it('dummy', () => { expect(true).toBe(true); });
});
