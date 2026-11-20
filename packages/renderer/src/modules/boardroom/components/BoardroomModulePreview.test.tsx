import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ storeSelectorCalls: 0 }));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => {
        mocks.storeSelectorCalls += 1;
        return selector({
            boardroomPreviewModuleId: 'creative',
            setBoardroomPreviewModuleId: vi.fn(),
            activeAgents: [],
            setModule: vi.fn(),
            setConversationMode: vi.fn(),
        });
    },
}));
vi.mock('zustand/react/shallow', () => ({ useShallow: (selector: unknown) => selector }));
vi.mock('@/modules/creative/CreativeStudio', () => ({ default: () => null }));
vi.mock('@/core/components/LoadingFallbacks', () => ({ LoadingFallback: () => null }));
vi.mock('@/core/components/ModuleErrorBoundary', () => ({
    ModuleErrorBoundary: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

import { BoardroomModulePreview } from './BoardroomModulePreview';

describe('BoardroomModulePreview render isolation', () => {
    beforeEach(() => {
        mocks.storeSelectorCalls = 0;
    });

    it('skips its store selector when the parent rerenders for streamed messages', async () => {
        const view = render(<BoardroomModulePreview />);
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
        const initialSelectorCalls = mocks.storeSelectorCalls;

        await act(async () => { view.rerender(<BoardroomModulePreview />); });

        expect(initialSelectorCalls).toBe(1);
        expect(mocks.storeSelectorCalls).toBe(initialSelectorCalls);
    });
});
