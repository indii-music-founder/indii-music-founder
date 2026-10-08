import React, { createContext, useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasEditorPortal } from './CanvasEditorPortal';

// DOM structure checks only; these do not claim live editor/service validation.
describe('CanvasEditorPortal', () => {
    it('escapes the shell stacking context, preserves context and events, and cleans up', () => {
        const EditorContext = createContext('missing');
        let clickCount = 0;
        function Controls() {
            return <button onClick={() => { clickCount += 1; }}>{useContext(EditorContext)}</button>;
        }
        const { container, unmount } = render(
            <EditorContext.Provider value="Editor controls">
                <main style={{ position: 'relative', zIndex: 0 }}>
                    <CanvasEditorPortal><Controls /></CanvasEditorPortal>
                </main>
            </EditorContext.Provider>
        );
        const controls = screen.getByRole('button', { name: 'Editor controls' });
        expect(controls.parentElement).toBe(document.body);
        expect(container.querySelector('main')?.contains(controls)).toBe(false);
        fireEvent.click(controls);
        expect(clickCount).toBe(1);
        unmount();
        expect(screen.queryByRole('button', { name: 'Editor controls' })).toBeNull();
    });
});
