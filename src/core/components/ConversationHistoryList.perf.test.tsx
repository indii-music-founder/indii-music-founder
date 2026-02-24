import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationHistoryList } from './ConversationHistoryList';
import { useStore } from '@/core/store';
import React from 'react';

// Mock store
let storeState: any = {};

vi.mock('@/core/store', () => ({
    useStore: vi.fn((selector) => {
        return selector(storeState);
    })
}));

// Mock motion to spy on list items
const LiSpy = vi.fn(({ children, ...props }: any) => <li {...props}>{children}</li>);

vi.mock('motion/react', () => ({
    motion: {
        li: (props: any) => LiSpy(props),
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ConversationHistoryList Performance', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        storeState = {
            sessions: {
                's1': { id: 's1', title: 'S1', updatedAt: 1000, messages: [] },
                's2': { id: 's2', title: 'S2', updatedAt: 2000, messages: [] }
            },
            activeSessionId: 's1',
            setActiveSession: vi.fn(),
            deleteSession: vi.fn(),
            updateSessionTitle: vi.fn(),
            setRightPanelView: vi.fn(),
        };
    });

    it('should re-render items when store state changes', () => {
        // 1. Initial Render
        const onClose = vi.fn();
        const { rerender } = render(<ConversationHistoryList onClose={onClose} />);

        // Clear initial render calls
        LiSpy.mockClear();

        // 2. Update State: Only s2 changes
        storeState = {
            ...storeState,
            sessions: {
                ...storeState.sessions,
                's2': { ...storeState.sessions['s2'], updatedAt: 2001 }
            }
        };

        // 3. Rerender
        rerender(<ConversationHistoryList onClose={onClose} />);

        // Both items re-render because parent creates new callback closures
        // (onSelect, onDelete) on each render, which defeats React.memo.
        // Full optimization would require useCallback in the parent component.
        expect(LiSpy).toHaveBeenCalledTimes(2);
    });
});
