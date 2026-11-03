import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalKeyboardOrchestrator } from '@/services/keyboard/GlobalKeyboardOrchestrator';
import { useModalAccessibility } from './useModalAccessibility';

function TestDialog({ name, onClose }: { name: string; onClose: () => void }) {
    const ref = useModalAccessibility(true, onClose);
    return <div role="dialog" aria-label={name} ref={ref}><input aria-label={`${name} input`} /></div>;
}

describe('useModalAccessibility', () => {
    afterEach(() => globalKeyboardOrchestrator.dispose());

    it('sends Escape from an input only to the latest active dialog', () => {
        const closeFirst = vi.fn();
        const closeSecond = vi.fn();
        render(<>
            <TestDialog name="First" onClose={closeFirst} />
            <TestDialog name="Second" onClose={closeSecond} />
        </>);

        const input = screen.getByRole('textbox', { name: 'Second input' });
        input.focus();
        fireEvent.keyDown(input, { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });

        expect(closeSecond).toHaveBeenCalledOnce();
        expect(closeFirst).not.toHaveBeenCalled();
    });
});
