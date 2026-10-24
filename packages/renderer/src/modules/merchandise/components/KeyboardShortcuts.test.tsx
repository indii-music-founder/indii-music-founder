import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KeyboardShortcuts } from './KeyboardShortcuts';

describe('Merchandise keyboard shortcuts dialog', () => {
    it('announces the dialog, focuses its close control, and restores trigger focus', () => {
        const trigger = document.createElement('button');
        trigger.textContent = 'Show shortcuts';
        document.body.appendChild(trigger);
        trigger.focus();

        try {
            const onClose = vi.fn();
            const { rerender } = render(<KeyboardShortcuts isOpen onClose={onClose} />);
            expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toHaveAttribute('aria-modal', 'true');
            const close = screen.getByRole('button', { name: 'Close keyboard shortcuts' });
            expect(close).toHaveFocus();

            rerender(<KeyboardShortcuts isOpen={false} onClose={onClose} />);
            expect(trigger).toHaveFocus();
        } finally {
            trigger.remove();
        }
    });
});
