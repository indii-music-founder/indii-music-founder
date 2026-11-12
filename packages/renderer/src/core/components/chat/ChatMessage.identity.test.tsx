import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
    it.each([
        ['aGVsbG8=', 'data:image/png;base64,aGVsbG8='],
        ['data:image/png;base64,aGVsbG8=', 'data:image/png;base64,aGVsbG8='],
    ])('renders an image attachment from its stored source format', (base64, source) => {
        render(<MessageItem msg={{ id: 'attachment', role: 'user', text: 'Reference', attachments: [{ mimeType: 'image/png', base64 }] } as never} />);
        expect(screen.getByAltText('attachment')).toHaveAttribute('src', source);
    });

    it('offers the original attachment for download when its message failed to save', () => {
        render(<MessageItem msg={{ id: 'unsaved-file', role: 'user', text: 'Reference', saveStatus: 'failed',
            attachments: [{ mimeType: 'image/png', base64: 'aGVsbG8=' }] } as never} />);
        expect(screen.getByRole('link', { name: 'Download attachment 1' }))
            .toHaveAttribute('href', 'data:image/png;base64,aGVsbG8=');
        expect(screen.getByRole('alert')).toHaveTextContent('download any attachments');
    });

    it('offers a saved non-image attachment for download', () => {
        render(<MessageItem msg={{ id: 'saved-file', role: 'user', text: 'Reference',
            attachments: [{ mimeType: 'application/pdf', base64: 'aGVsbG8=' }] } as never} />);
        expect(screen.getByRole('link', { name: 'Download attachment 1' }))
            .toHaveAttribute('href', 'data:application/pdf;base64,aGVsbG8=');
        expect(screen.getByRole('link', { name: 'Download attachment 1' })).toHaveAttribute('download', 'attachment-1.pdf');
    });

    it('preserves a safe original filename for a saved attachment', () => {
        render(<MessageItem msg={{ id: 'named-file', role: 'user', text: 'Reference',
            attachments: [{ mimeType: 'application/pdf', base64: 'aGVsbG8=', filename: 'folder/contract.pdf' }] } as never} />);
        expect(screen.getByRole('link', { name: 'Download attachment 1' })).toHaveAttribute('download', 'folder_contract.pdf');
    });

    it('shows a warning when a stored attachment is unavailable', () => {
        render(<MessageItem msg={{ id: 'missing-file', role: 'user', text: 'Reference',
            attachments: [{ mimeType: 'image/png', base64: '', loadFailed: true }] } as never} />);
        expect(screen.getByRole('alert')).toHaveTextContent('Attachment could not be loaded');
        expect(screen.queryByAltText('attachment')).not.toBeInTheDocument();
    });

    it('shows when a locally appended message could not be saved', () => {
        render(
            <MessageItem
                msg={{ id: 'unsaved', role: 'user', text: 'Keep this text', saveStatus: 'failed' } as never}
            />,
        );
        expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
    });

    it('copies an unsaved message and confirms the result', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        try {
            render(<MessageItem msg={{ id: 'unsaved-copy', role: 'user', text: 'Keep this', saveStatus: 'failed' } as never} />);
            fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
            expect(writeText).toHaveBeenCalledWith('Keep this');
            expect(await screen.findByRole('status')).toHaveTextContent('Message copied');
        } finally {
            if (original) Object.defineProperty(navigator, 'clipboard', original);
            else Reflect.deleteProperty(navigator, 'clipboard');
        }
    });

    it('tells the user when copying an unsaved message fails', async () => {
        const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
        try {
            render(<MessageItem msg={{ id: 'unsaved-copy-failure', role: 'user', text: 'Keep this', saveStatus: 'failed' } as never} />);
            fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
            expect(await screen.findByRole('status')).toHaveTextContent('Copy failed');
            expect(screen.getByText('Keep this')).toBeInTheDocument();
        } finally {
            if (original) Object.defineProperty(navigator, 'clipboard', original);
            else Reflect.deleteProperty(navigator, 'clipboard');
        }
    });

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
