import { useState, useCallback } from 'react';
import { DesignState, HistoryState } from '../types';

const MAX_HISTORY = 20;

export function useDesignHistory(initialState: DesignState) {
    const [history, setHistory] = useState<HistoryState<DesignState>>({
        past: [],
        present: initialState,
        future: []
    });

    const canUndo = history.past.length > 0;
    const canRedo = history.future.length > 0;

    const updateState = useCallback((newState: Partial<DesignState>) => {
        setHistory(curr => {
            const newPresent = { ...curr.present, ...newState };
            // Don't record if nothing changed
            if (JSON.stringify(curr.present) === JSON.stringify(newPresent)) {
                return curr;
            }

            return {
                past: [...curr.past, curr.present].slice(-MAX_HISTORY),
                present: newPresent,
                future: []
            };
        });
    }, []);

    const undo = useCallback(() => {
        setHistory(curr => {
            if (curr.past.length === 0) return curr;

            const previous = curr.past[curr.past.length - 1];
            const newPast = curr.past.slice(0, curr.past.length - 1);

            return {
                past: newPast,
                present: previous,
                future: [curr.present, ...curr.future]
            };
        });
    }, []);

    const redo = useCallback(() => {
        setHistory(curr => {
            if (curr.future.length === 0) return curr;

            const next = curr.future[0];
            const newFuture = curr.future.slice(1);

            return {
                past: [...curr.past, curr.present],
                present: next,
                future: newFuture
            };
        });
    }, []);

    return {
        state: history.present,
        updateState,
        undo,
        redo,
        canUndo,
        canRedo
    };
}
