import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspaceBackground } from './WorkspaceBackground';

describe('WorkspaceBackground', () => {
    it('isolates the covered workspace and preserves the draft across mode changes', () => {
        const content = <input aria-label="Draft" defaultValue="" />;
        const view = render(<WorkspaceBackground inactive={false}>{content}</WorkspaceBackground>);
        const input = screen.getByRole('textbox', { name: 'Draft' });
        const workspace = input.parentElement!;
        fireEvent.change(input, { target: { value: 'Unsent draft' } });

        view.rerender(<WorkspaceBackground inactive>{content}</WorkspaceBackground>);
        expect(workspace.inert).toBe(true);
        expect(workspace).toHaveAttribute('aria-hidden', 'true');
        expect(screen.queryByRole('textbox', { name: 'Draft' })).not.toBeInTheDocument();
        expect(workspace.firstElementChild).toBe(input);

        view.rerender(<WorkspaceBackground inactive={false}>{content}</WorkspaceBackground>);
        expect(workspace.inert).toBe(false);
        expect(workspace).not.toHaveAttribute('aria-hidden');
        expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(input);
        expect(input).toHaveValue('Unsent draft');
    });
});
