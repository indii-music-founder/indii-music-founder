import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const toggleCanvas = vi.fn();
const storeState = {
    userProfile: { preferences: { showCognitiveLogicByDefault: false } },
    currentProjectId: null,
    updateAgentMessage: vi.fn(),
    generatedHistory: [],
    isCanvasOpen: false,
    toggleCanvas,
};

vi.mock('@/core/store', () => {
    const useStore = (selector: (state: typeof storeState) => unknown) => selector(storeState);
    useStore.getState = () => storeState;
    return { useStore };
});

vi.mock('motion/react', () => ({
    motion: {
        div: ({ children, initial: _initial, animate: _animate, transition: _transition, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
            <div {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/components/motion-primitives/text-effect', () => ({
    TextEffect: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('react-markdown', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('remark-gfm', () => ({ default: vi.fn() }));
vi.mock('../VisualScriptRenderer', () => ({ default: () => null }));
vi.mock('../ScreenplayRenderer', () => ({ default: () => null }));
vi.mock('../CallSheetRenderer', () => ({ default: () => null }));
vi.mock('../ContractRenderer', () => ({ default: () => null }));
vi.mock('./JsonViewer', () => ({ JsonViewer: () => null }));
vi.mock('./ToolOutputRenderer', () => ({
    ImageRenderer: () => null,
    ToolImageOutput: () => null,
    ToolDocumentOutput: () => null,
    ToolFeedbackOutput: () => null,
}));
vi.mock('./CodeBlock', () => ({ CodeBlock: () => null }));
vi.mock('./PlanCard', () => ({ PlanCard: () => null }));
vi.mock('@/services/agent/LivingPlanService', () => ({
    livingPlanService: {},
}));
vi.mock('@/services/agent/AgentService', () => ({
    agentService: {},
}));
vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { MessageItem } from './ChatMessage';

describe('ChatMessage canvas_push tool result rendering', () => {
    it('renders an interactive Agent Canvas card when a canvas_push tool_result is present in thoughts', () => {
        const msg: any = {
            id: 'msg-canvas-push-1',
            role: 'model',
            agentId: 'creative',
            text: "I've pushed the master technical specification to the Agent Canvas for your review.",
            thoughts: [
                {
                    type: 'tool_result',
                    toolName: 'canvas_push',
                    text: JSON.stringify({
                        panelId: 'panel-spec-123',
                        type: 'markdown',
                        title: 'Master Technical Specification: All Departments',
                    }),
                },
            ],
        };

        render(<MessageItem msg={msg} />);

        expect(screen.getByTestId('canvas-push-output')).toBeInTheDocument();
        expect(screen.getByText('Master Technical Specification: All Departments')).toBeInTheDocument();
        expect(screen.getByText(/markdown/i)).toBeInTheDocument();

        const viewBtn = screen.getByTestId('view-in-canvas-btn');
        expect(viewBtn).toBeInTheDocument();
        expect(viewBtn).toHaveTextContent('View in Canvas');

        fireEvent.click(viewBtn);
        expect(toggleCanvas).toHaveBeenCalledTimes(1);
    });
});
