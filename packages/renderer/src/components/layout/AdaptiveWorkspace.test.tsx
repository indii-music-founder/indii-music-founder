import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

        setWidth(900);

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
});
