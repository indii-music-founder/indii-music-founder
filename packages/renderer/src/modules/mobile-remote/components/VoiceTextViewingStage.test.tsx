import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceTextViewingStage from '@/modules/mobile-remote/components/VoiceTextViewingStage';

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
    const invalid = ['whileTap', 'initial', 'animate', 'exit', 'transition', 'layoutId', 'layout'];
    return Object.fromEntries(Object.entries(props).filter(([key]) => !invalid.includes(key)));
}

vi.mock('motion/react', () => {
    const motion = new Proxy({}, {
        get: (_target, prop: string) => {
            return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
                const Tag = prop as unknown as React.ElementType;
                return <Tag {...filterDomProps(props)}>{children}</Tag>;
            };
        },
    });
    return {
        motion,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

describe('VoiceTextViewingStage', () => {
    it('renders the docked input with custom placeholder and target label', () => {
        const onChange = vi.fn();
        const onSubmit = vi.fn();
        render(
            <VoiceTextViewingStage
                value=""
                onChange={onChange}
                onSubmit={onSubmit}
                placeholder="Broadcast to Boardroom…"
                targetLabel="Boardroom"
            />
        );

        expect(screen.getByPlaceholderText('Broadcast to Boardroom…')).toBeInTheDocument();
    });

    it('triggers onChange when typing into the input', () => {
        const onChange = vi.fn();
        const onSubmit = vi.fn();
        render(
            <VoiceTextViewingStage
                value=""
                onChange={onChange}
                onSubmit={onSubmit}
                placeholder="Broadcast to Boardroom…"
            />
        );

        const textarea = screen.getByPlaceholderText('Broadcast to Boardroom…');
        fireEvent.change(textarea, { target: { value: 'Hello Boardroom' } });
        expect(onChange).toHaveBeenCalledWith('Hello Boardroom');
    });

    it('shows inline dictation status without stacking a second popup overlay or fake waveguide', () => {
        const onChange = vi.fn();
        const onSubmit = vi.fn();
        render(
            <VoiceTextViewingStage
                value="Voice interim transcript..."
                onChange={onChange}
                onSubmit={onSubmit}
                isListening={true}
                targetLabel="Creative Agent"
            />
        );

        expect(screen.getByTestId('composer-inline-status')).toHaveTextContent('Dictating');
        expect(screen.getByTestId('composer-inline-status')).toHaveTextContent('Creative Agent');
        expect(screen.queryByText(/Live Dictation/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Edit Text/i)).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('Voice interim transcript...')).toBeInTheDocument();
    });

    it('submits on send button click', () => {
        const onChange = vi.fn();
        const onSubmit = vi.fn();
        render(
            <VoiceTextViewingStage
                value="Deploy release to Spotify"
                onChange={onChange}
                onSubmit={onSubmit}
                isPaired={true}
            />
        );

        const sendButtons = screen.getAllByRole('button', { name: /send/i });
        expect(sendButtons).toHaveLength(1);
        fireEvent.click(sendButtons[0]);
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('clears text when Clear is clicked in the inline status strip', () => {
        const onChange = vi.fn();
        const onSubmit = vi.fn();
        render(
            <VoiceTextViewingStage
                value={'This is a long piece of text that surfaces the inline clear control in the unified composer.'}
                onChange={onChange}
                onSubmit={onSubmit}
            />
        );

        const clearBtn = screen.getByRole('button', { name: /clear text/i });
        fireEvent.click(clearBtn);
        expect(onChange).toHaveBeenCalledWith('');
    });
});
