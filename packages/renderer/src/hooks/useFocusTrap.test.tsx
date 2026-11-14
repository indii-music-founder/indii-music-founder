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

function PersistentAutoFocusHarness({ active }: { active: boolean }) {
    const ref = useFocusTrap(active);
    return <>
        <button>Open editor</button>
        <button>Open from toolbar</button>
        {active && <div ref={ref}><input aria-label="Dialog editor" autoFocus /></div>}
    </>;
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

function EditorFocusHarness() {
    const ref = useFocusTrap(true);
    return <div ref={ref}>
        <div contentEditable tabIndex={-1} aria-label="Excluded editor" />
        <div contentEditable role="textbox" aria-label="Draft editor" />
        <button>Save draft</button>
    </div>;
}

function LoadingFocusHarness({ loaded }: { loaded: boolean }) {
    const ref = useFocusTrap(true);
    return <div ref={ref} data-testid="loading-dialog">
        {loaded ? <><button>Loaded first</button><button>Loaded last</button></> : 'Loading'}
    </div>;
}

function HiddenFocusHarness() {
    const ref = useFocusTrap(true);
    return <div ref={ref}>
        <button tabIndex={-1}>Excluded</button>
        <div hidden><button>Hidden</button></div>
        <div style={{ display: 'none' }}><button>CSS hidden</button></div>
        <fieldset disabled><button>Disabled by fieldset</button></fieldset>
        <button>Available first</button>
        <button>Available last</button>
    </div>;
}

function RestoredStackHarness({ upper, hideLower }: { upper: boolean; hideLower: boolean }) {
    const lowerRef = useFocusTrap(true);
    const upperRef = useFocusTrap(upper);
    return <>
        <div ref={lowerRef} data-testid="lower-dialog">
            <button hidden={hideLower}>Lower trigger</button>
        </div>
        {upper && <div ref={upperRef}><button>Upper control</button></div>}
    </>;
}

function RemovableLowerHarness({ lower }: { lower: boolean }) {
    const lowerRef = useFocusTrap(lower);
    const upperRef = useFocusTrap(true);
    return <>
        {lower && <div ref={lowerRef}><button>Background control</button></div>}
        <div ref={upperRef}><button>Top first</button><button>Top last</button></div>
    </>;
}

describe('useFocusTrap', () => {
    afterEach(() => globalKeyboardOrchestrator.dispose());

    it.each([true, false])('wraps from the actual radio-group stop (checked: %s)', checked => {
        function RadioDialog() {
            const ref = useFocusTrap();
            return <div ref={ref}>
                <button>First</button>
                <label><input type="radio" name="format" defaultChecked={checked} />Audio</label>
                <label><input type="radio" name="format" />Video</label>
            </div>;
        }
        render(<RadioDialog />);
        const first = screen.getByRole('button', { name: 'First' });
        const audio = screen.getByRole('radio', { name: 'Audio' });
        audio.focus();
        fireEvent.keyDown(audio, { key: 'Tab' });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
        expect(screen.getByRole('radio', { name: checked ? 'Audio' : 'Video' })).toHaveFocus();
    });

    it('keeps same-name radio groups in separate forms independent', () => {
        function RadioFormsDialog() {
            const ref = useFocusTrap();
            return <div ref={ref}>
                <form><input aria-label="First form" type="radio" name="format" defaultChecked /></form>
                <form><input aria-label="Second form" type="radio" name="format" defaultChecked /></form>
            </div>;
        }
        render(<RadioFormsDialog />);
        const first = screen.getByRole('radio', { name: 'First form' });
        const last = screen.getByRole('radio', { name: 'Second form' });
        last.focus();
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
        expect(last).toHaveFocus();
    });

    it('wraps according to browser tab order when controls have positive tabindex', () => {
        function OrderedDialog() {
            const ref = useFocusTrap();
            return <div ref={ref}>
                <button>Default order</button>
                <button tabIndex={2}>Second priority</button>
                <button tabIndex={1}>First priority</button>
            </div>;
        }
        render(<OrderedDialog />);
        const first = screen.getByRole('button', { name: 'First priority' });
        const last = screen.getByRole('button', { name: 'Default order' });
        expect(first).toHaveFocus();
        fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
        expect(last).toHaveFocus();
        fireEvent.keyDown(last, { key: 'Tab' });
        expect(first).toHaveFocus();
    });

    it('restores the opening trigger after a persistent dialog autofocuses its editor', () => {
        const view = render(<PersistentAutoFocusHarness active={false} />);
        const trigger = screen.getByRole('button', { name: 'Open editor' });
        trigger.focus();
        view.rerender(<PersistentAutoFocusHarness active />);
        expect(screen.getByRole('textbox', { name: 'Dialog editor' })).toHaveFocus();
        view.rerender(<PersistentAutoFocusHarness active={false} />);
        expect(trigger).toHaveFocus();
        const secondTrigger = screen.getByRole('button', { name: 'Open from toolbar' });
        secondTrigger.focus();
        view.rerender(<PersistentAutoFocusHarness active />);
        expect(screen.getByRole('textbox', { name: 'Dialog editor' })).toHaveFocus();
        view.rerender(<PersistentAutoFocusHarness active={false} />);
        expect(secondTrigger).toHaveFocus();
    });

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
    it('includes editable regions without overriding explicit negative tabindex', () => {
        render(<EditorFocusHarness />);
        const editor = screen.getByRole('textbox', { name: 'Draft editor' });
        expect(editor).toHaveFocus();
        screen.getByRole('button', { name: 'Save draft' }).focus();
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
        expect(editor).toHaveFocus();
    });
    it('enters the current tab order after an empty dialog finishes loading', () => {
        const view = render(<LoadingFocusHarness loaded={false} />);
        const dialog = screen.getByTestId('loading-dialog');
        expect(dialog).toHaveFocus();
        view.rerender(<LoadingFocusHarness loaded />);
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
        expect(screen.getByRole('button', { name: 'Loaded last' })).toHaveFocus();
        dialog.focus();
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
        expect(screen.getByRole('button', { name: 'Loaded first' })).toHaveFocus();
    });
    it('skips excluded controls when opening and wrapping focus', () => {
        render(<HiddenFocusHarness />);
        const first = screen.getByRole('button', { name: 'Available first' });
        const last = screen.getByRole('button', { name: 'Available last' });
        expect(first).toHaveFocus();
        last.focus();
        fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
        expect(first).toHaveFocus();
    });
    it('restores focus to the remaining container when its trigger became hidden', () => {
        const view = render(<RestoredStackHarness upper={false} hideLower={false} />);
        expect(screen.getByRole('button', { name: 'Lower trigger' })).toHaveFocus();
        view.rerender(<RestoredStackHarness upper hideLower={false} />);
        expect(screen.getByRole('button', { name: 'Upper control' })).toHaveFocus();
        view.rerender(<RestoredStackHarness upper hideLower />);
        view.rerender(<RestoredStackHarness upper={false} hideLower />);
        expect(screen.getByTestId('lower-dialog')).toHaveFocus();
    });
    it('keeps focus in place when a lower dialog closes', () => {
        const view = render(<RemovableLowerHarness lower />);
        const last = screen.getByRole('button', { name: 'Top last' });
        last.focus();
        view.rerender(<RemovableLowerHarness lower={false} />);
        expect(last).toHaveFocus();
    });
});
