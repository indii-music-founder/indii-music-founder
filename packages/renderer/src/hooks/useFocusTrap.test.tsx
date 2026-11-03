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

function StackedFocusHarness() {
    const lowerRef = useFocusTrap(true);
    const upperRef = useFocusTrap(true);
    return (
        <>
            <div ref={lowerRef}><button>Lower first</button><button>Lower last</button></div>
            <div ref={upperRef}><button>Upper first</button><button>Upper middle</button><button>Upper last</button></div>
        </>
    );
}

function EmptyFocusHarness() {
    const ref = useFocusTrap(true);
    return <div ref={ref} data-testid="empty-dialog">Loading</div>;
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

    it('lets only the top trap handle Tab in stacked dialogs', () => {
        render(<StackedFocusHarness />);
        const upperFirst = screen.getByRole('button', { name: 'Upper first' });
        const upperMiddle = screen.getByRole('button', { name: 'Upper middle' });
        const upperLast = screen.getByRole('button', { name: 'Upper last' });

        upperMiddle.focus();
        const middleTab = fireEvent.keyDown(upperMiddle, { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
        expect(middleTab).toBe(true);
        expect(upperMiddle).toHaveFocus();

        upperLast.focus();
        const wrapped = fireEvent.keyDown(upperLast, { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
        expect(wrapped).toBe(false);
        expect(upperFirst).toHaveFocus();
    });

    it('keeps focus on a dialog with no focusable descendants', () => {
        render(<EmptyFocusHarness />);
        const dialog = screen.getByTestId('empty-dialog');
        expect(dialog).toHaveFocus();

        const tab = fireEvent.keyDown(dialog, { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
        expect(tab).toBe(false);
        expect(dialog).toHaveFocus();
    });
});
