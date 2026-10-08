import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Keep the viewport-sized editor outside the app shell's stacking contexts. */
export function CanvasEditorPortal({ children }: { children: ReactNode }) {
    return createPortal(children, document.body);
}
