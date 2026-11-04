import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalKeyboardOrchestrator } from '@/services/keyboard/GlobalKeyboardOrchestrator';
import { Modal } from './Modal';

afterEach(() => globalKeyboardOrchestrator.dispose());

describe('Modal Escape handling', () => {
    it('closes only the top dialog when a lower dialog re-registers its shortcut', () => {
        const lowerClose = vi.fn();
        const upperClose = vi.fn();
        const dialogs = (onLowerClose: () => void) => <>
            <Modal isOpen onClose={onLowerClose} titleId="lower-title">
                <h2 id="lower-title">Lower</h2>
                <button>Lower action</button>
            </Modal>
            <Modal isOpen onClose={upperClose} titleId="upper-title">
                <h2 id="upper-title">Upper</h2>
                <input aria-label="Upper input" />
            </Modal>
        </>;
        const { rerender } = render(dialogs(lowerClose));

        // Re-registering the lower callback places it ahead of the upper one
        // in the shortcut orchestrator even though the upper dialog stays on top.
        rerender(dialogs(() => lowerClose()));
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Upper input' }), {
            key: 'Escape', code: 'Escape', bubbles: true, cancelable: true,
        });

        expect(upperClose).toHaveBeenCalledTimes(1);
        expect(lowerClose).not.toHaveBeenCalled();
    });
});
