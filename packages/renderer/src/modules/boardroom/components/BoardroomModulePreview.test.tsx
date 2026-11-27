import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    storeSelectorCalls: 0,
    moduleId: 'creative',
    crash: false,
    boardroomControl: { surface: 'studio', holder: 'artist', grantId: null, revision: 0 } as {
        surface: string;
        holder: string;
        grantId: string | null;
        revision: number;
    },
    takeBoardroomControl: vi.fn(),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: (state: Record<string, unknown>) => unknown) => {
        mocks.storeSelectorCalls += 1;
        return selector({
            boardroomPreviewModuleId: mocks.moduleId,
            setBoardroomPreviewModuleId: (id: string) => { mocks.moduleId = id; },
            activeAgents: [],
            setModule: vi.fn(),
            setConversationMode: vi.fn(),
            boardroomControl: mocks.boardroomControl,
            takeBoardroomControl: mocks.takeBoardroomControl,
        });
    },
}));
vi.mock('zustand/react/shallow', () => ({ useShallow: (selector: unknown) => selector }));
vi.mock('@/modules/creative/CreativeStudio', () => ({
    default: () => {
        if (mocks.crash) throw new Error('Preview regression fixture');
        return <div>Creative preview loaded</div>;
    },
}));
vi.mock('@/modules/finance/FinanceDashboard', () => ({
    default: () => <div>Finance preview loaded</div>,
}));
vi.mock('@/core/components/LoadingFallbacks', () => ({ LoadingFallback: () => null }));
vi.mock('@/config/typesafeJudgments', () => ({ judgeCrashTriage: async () => null }));

import { BoardroomModulePreview } from '@/modules/boardroom/components/BoardroomModulePreview';

describe('BoardroomModulePreview render isolation', () => {
    beforeEach(() => {
        mocks.storeSelectorCalls = 0;
        mocks.moduleId = 'creative';
        mocks.crash = false;
        mocks.boardroomControl = { surface: 'studio', holder: 'artist', grantId: null, revision: 0 };
        mocks.takeBoardroomControl.mockClear();
    });

    it('skips its store selector when the parent rerenders for streamed messages', async () => {
        const view = render(<BoardroomModulePreview />);
        await screen.findByText('Creative preview loaded');
        const initialSelectorCalls = mocks.storeSelectorCalls;

        view.rerender(<BoardroomModulePreview />);

        expect(initialSelectorCalls).toBe(1);
        expect(mocks.storeSelectorCalls).toBe(initialSelectorCalls);
    });

    it('opens a healthy department after the previous preview crashes', async () => {
        mocks.crash = true;
        render(<BoardroomModulePreview />);
        expect(await screen.findByRole('heading', { name: 'creative paused' })).toBeVisible();

        fireEvent.click(screen.getByTestId('boardroom-module-picker-btn'));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Finance' }));

        expect(await screen.findByText('Finance preview loaded')).toBeVisible();
        expect(screen.queryByRole('heading', { name: 'finance paused' })).not.toBeInTheDocument();
    });

    it('shows single controller status and Take control button when a specialist holds Studio (Spec D2)', async () => {
        mocks.boardroomControl = { surface: 'studio', holder: 'creative', grantId: 'g-1', revision: 1 };
        render(<BoardroomModulePreview />);
        await screen.findByText('Creative preview loaded');

        expect(screen.getByText(/Creative Director has control/i)).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Take control' }));
        expect(mocks.takeBoardroomControl).toHaveBeenCalledWith('studio');
    });
});
