import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { globalKeyboardOrchestrator } from '@/services/keyboard/GlobalKeyboardOrchestrator';
import { useFocusTrap } from './useFocusTrap';

function FocusHarness({ active = true }: { active?: boolean }) {
    const ref = useFocusTrap(active);
    return (
        <>
            <button>Outside</button>
            <div ref={ref}>
                <button>First</button>
                <button>Last</button>
            </div>
        </>
    );
}

describe('useFocusTrap', () => {
    afterEach(() => globalKeyboardOrchestrator.dispose());

    it('returns Tab and Shift+Tab to the active trap when focus moved outside', () => {
        render(<FocusHarness />);
        const outside = screen.getByRole('button', { name: 'Outside' });
        const first = screen.getByRole('button', { name: 'First' });
        const last = screen.getByRole('button', { name: 'Last' });

        outside.focus();
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
        expect(first).toHaveFocus();

        outside.focus();
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        expect(last).toHaveFocus();
    });

    it('does not try to restore focus to a removed trigger', () => {
        const trigger = document.createElement('button');
        document.body.append(trigger);
        trigger.focus();
        const { unmount } = render(<FocusHarness />);
        trigger.remove();

        unmount();

        expect(document.activeElement).toBe(document.body);
    });
});
