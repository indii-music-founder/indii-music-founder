import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

describe('ChatMessage companion mode cognitive logic', () => {
    it('keeps Cognitive Logic collapsed by default while allowing users to expand diagnostics manually', () => {
        const thoughts = [
            {
                id: 'thought-1',
                text: 'Mode C: Artist asked how to stay consistent. Crafting warm and encouraging guidance.',
                timestamp: Date.now(),
                type: 'logic' as const,
            },
        ];

        render(
            <MessageItem
                msg={{
                    id: 'msg-companion-1',
                    role: 'model',
                    text: "Consistency comes down to sustainable rituals. Let's build a weekly rhythm that protects your creative headspace.",
                    agentId: 'conductor',
                    thoughts,
                    timestamp: Date.now(),
                } as never}
            />,
        );

        // Assistant response text is rendered
        expect(screen.getByText(/Consistency comes down to sustainable rituals/i)).toBeInTheDocument();

        // Cognitive Logic toggle button is rendered and collapsed by default
        const toggle = screen.getByRole('button', { name: /cognitive logic/i });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        // Detailed reasoning trace is hidden initially
        expect(screen.queryByText(/Mode C: Artist asked how to stay consistent/i)).not.toBeInTheDocument();

        // Expanding diagnostics manually
        fireEvent.click(toggle);

        // Cognitive Logic is now expanded and thought trace is visible
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText(/Mode C: Artist asked how to stay consistent/i)).toBeInTheDocument();
    });
});
