import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveWorkspace } from './AdaptiveWorkspace';

let resizeCallback: ResizeObserverCallback | undefined;

class TestResizeObserver {
    constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
    }
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
}

describe('AdaptiveWorkspace', () => {
    beforeEach(() => {
        resizeCallback = undefined;
        vi.stubGlobal('ResizeObserver', TestResizeObserver);
    });

    function setWidth(width: number) {
        act(() => {
            resizeCallback?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
        });
    }

    it('moves the secondary rail into a drawer at standard width', () => {
        render(
            <AdaptiveWorkspace leftRail={<div>Left rail</div>} rightRail={<div>Right rail</div>}>
                <div>Center content</div>
            </AdaptiveWorkspace>,
        );

        setWidth(1000);

        expect(screen.getByTestId('adaptive-left-rail')).toBeInTheDocument();
        expect(screen.queryByTestId('adaptive-right-rail')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('adaptive-right-rail-trigger'));
        expect(screen.getByLabelText('Workspace details')).toHaveTextContent('Right rail');
    });

    it('moves both rails into drawers at focused width', () => {
        render(
            <AdaptiveWorkspace leftRail={<div>Left rail</div>} rightRail={<div>Right rail</div>}>
                <div>Center content</div>
            </AdaptiveWorkspace>,
        );

        setWidth(700);

        expect(screen.queryByTestId('adaptive-left-rail')).not.toBeInTheDocument();
        expect(screen.queryByTestId('adaptive-right-rail')).not.toBeInTheDocument();
        expect(screen.getByTestId('adaptive-left-rail-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('adaptive-right-rail-trigger')).toBeInTheDocument();
    });

    it('preserves workspace state while adjacent rails reflow', () => {
        render(
            <AdaptiveWorkspace leftRail={<button>Left action</button>} rightRail={<button>Right action</button>}>
                <label>
                    Prompt
                    <input aria-label="Prompt" defaultValue="Keep this draft" />
                </label>
            </AdaptiveWorkspace>,
        );

        setWidth(1400);
        expect(screen.getByTestId('adaptive-workspace')).toHaveAttribute('data-workspace-mode', 'wide');

        setWidth(1000);
        expect(screen.getByTestId('adaptive-workspace')).toHaveAttribute('data-workspace-mode', 'standard');

        setWidth(700);
        expect(screen.getByTestId('adaptive-workspace')).toHaveAttribute('data-workspace-mode', 'focused');
        expect(screen.getByLabelText('Prompt')).toHaveValue('Keep this draft');
    });

    it('closes a focused drawer with Escape and returns focus to its trigger', () => {
        render(
            <AdaptiveWorkspace rightRail={<button>Right action</button>}>
                <div>Center content</div>
            </AdaptiveWorkspace>,
        );
        setWidth(700);

        const trigger = screen.getByTestId('adaptive-right-rail-trigger');
        fireEvent.click(trigger);
        const drawer = screen.getByRole('dialog', { name: 'Workspace details' });
        expect(drawer).toBeInTheDocument();
        expect(drawer).toContainElement(document.activeElement as HTMLElement);

        fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
        expect(screen.getByRole('button', { name: 'Right action' })).toHaveFocus();
        fireEvent.keyDown(window, { key: 'Tab' });
        expect(within(drawer).getByRole('button', { name: 'Close Workspace details' })).toHaveFocus();

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'Workspace details' })).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('returns focus to the trigger when the drawer close control is clicked', () => {
        render(
            <AdaptiveWorkspace rightRail={<button>Right action</button>}>
                <div>Center content</div>
            </AdaptiveWorkspace>,
        );
        setWidth(700);

        const trigger = screen.getByTestId('adaptive-right-rail-trigger');
        fireEvent.click(trigger);
        const drawer = screen.getByRole('dialog', { name: 'Workspace details' });
        fireEvent.click(within(drawer).getByRole('button', { name: 'Close Workspace details' }));

        expect(screen.queryByRole('dialog', { name: 'Workspace details' })).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });
});
