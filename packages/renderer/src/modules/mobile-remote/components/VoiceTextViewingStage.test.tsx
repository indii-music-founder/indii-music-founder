import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceTextViewingStage from './VoiceTextViewingStage';

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

    it('expands the viewing stage and shows live waveform during speech dictation', () => {
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

        expect(screen.getByText('Live Dictation')).toBeInTheDocument();
        expect(screen.getByText('Creative Agent')).toBeInTheDocument();
        expect(screen.getAllByText(/Voice interim transcript/i).length).toBeGreaterThanOrEqual(1);
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
        fireEvent.click(sendButtons[0]);
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('clears text when Clear is clicked in viewing stage', () => {
        const onChange = vi.fn();
        const onSubmit = vi.fn();
        render(
            <VoiceTextViewingStage
                value={'This is a long piece of text that automatically triggers the viewing stage to open because it exceeds eighty characters in length.'}
                onChange={onChange}
                onSubmit={onSubmit}
            />
        );

        const clearBtn = screen.getByRole('button', { name: /clear text/i });
        fireEvent.click(clearBtn);
        expect(onChange).toHaveBeenCalledWith('');
    });
});
