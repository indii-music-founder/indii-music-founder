import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveAgentVisualIdentity } from '@/services/agent/AgentVisualIdentity';

const storeState = {
    userProfile: { preferences: { showCognitiveLogicByDefault: false } },
    currentProjectId: null,
    updateAgentMessage: vi.fn(),
    generatedHistory: [],
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
}));

vi.mock('react-markdown', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('remark-gfm', () => ({ default: vi.fn() }));
vi.mock('../VisualScriptRenderer', () => ({ default: () => null }));
vi.mock('../ScreenplayRenderer', () => ({ default: () => null }));
vi.mock('../CallSheetRenderer', () => ({ default: () => null }));
vi.mock('../ContractRenderer', () => ({ default: () => null }));
vi.mock('./ThoughtChain', () => ({ ThoughtChain: () => null }));
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

describe('shared ChatMessage canonical identity', () => {
    it('renders the same Social identity used by Boardroom seats and discussion', () => {
        const identity = resolveAgentVisualIdentity('social');
        const { container } = render(
            <MessageItem
                msg={{
                    id: 'social-direct',
                    role: 'model',
                    text: 'Direct social response',
                    agentId: 'social',
                    isStreaming: true,
                } as never}
                variant="compact"
            />,
        );

        const message = container.querySelector('[data-agent-id="social"]');
        expect(message).toHaveAttribute('data-agent-accent', identity.accent);
        expect(message).toHaveAttribute('data-agent-icon', 'share-2');
        expect(screen.getByText('Social Media Director')).toBeInTheDocument();
        expect(screen.getByText('SM')).toBeInTheDocument();
        expect(screen.getByLabelText(identity.ariaLabel)).toBeInTheDocument();
        expect(message?.querySelector('svg')).toBeInTheDocument();
    });

    it('keeps unknown agents visibly neutral instead of deriving provider or runtime colors', () => {
        const identity = resolveAgentVisualIdentity('unregistered-runtime-model');
        const { container } = render(
            <MessageItem
                msg={{
                    id: 'unknown-direct',
                    role: 'model',
                    text: 'Fallback response',
                    agentId: 'unregistered-runtime-model',
                    isStreaming: true,
                } as never}
            />,
        );

        const message = container.querySelector('[data-agent-id="unregistered-runtime-model"]');
        expect(message).toHaveAttribute('data-agent-accent', identity.accent);
        expect(message).toHaveAttribute('data-agent-icon', 'bot');
        expect(screen.getByText('Unknown Agent')).toBeInTheDocument();
        expect(screen.getByText('UA')).toBeInTheDocument();
    });
});
