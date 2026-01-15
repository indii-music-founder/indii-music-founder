import { useState, useCallback, useEffect, useRef } from 'react';
import * as fabric from 'fabric';

interface CanvasHistoryState {
  json: string;
  timestamp: number;
}

interface UseCanvasHistoryReturn {
  undo: () => void;
  redo: () => void;
  saveState: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

/**
 * Custom hook for managing canvas history with undo/redo functionality
 *
 * @param canvas - Fabric.js canvas instance
 * @param maxHistorySize - Maximum number of history states to keep (default: 50)
 * @param debounceMs - Debounce delay for auto-saving states (default: 300ms)
 * @returns History management functions and state
 */
export const useCanvasHistory = (
  canvas: fabric.Canvas | null,
  maxHistorySize: number = 50,
  debounceMs: number = 300
): UseCanvasHistoryReturn => {
  const [history, setHistory] = useState<CanvasHistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isPerformingAction = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save current canvas state to history
  const saveState = useCallback(() => {
    if (!canvas || isPerformingAction.current) return;

    try {
      const json = JSON.stringify(canvas.toObject(['name'])); // Include custom properties
      const timestamp = Date.now();

      setHistory((prevHistory) => {
        // Remove any "future" states if we're not at the end
        const newHistory = prevHistory.slice(0, historyIndex + 1);

        // Add new state
        newHistory.push({ json, timestamp });

        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
          return newHistory;
        }

        return newHistory;
      });

      setHistoryIndex((prevIndex) => {
        const newHistory = history.slice(0, prevIndex + 1);
        if (newHistory.length >= maxHistorySize) {
          return maxHistorySize - 1;
        }
        return prevIndex + 1;
      });
    } catch (error) {
      console.error('Failed to save canvas state:', error);
    }
  }, [canvas, history, historyIndex, maxHistorySize]);

  // Debounced save state
  const debouncedSaveState = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveState();
    }, debounceMs);
  }, [saveState, debounceMs]);

  // Undo to previous state
  const undo = useCallback(async () => {
    if (!canvas || historyIndex <= 0) return;

    isPerformingAction.current = true;

    try {
      const prevState = history[historyIndex - 1];
      const parsedJson = JSON.parse(prevState.json);

      await canvas.loadFromJSON(parsedJson);
      canvas.renderAll();
      setHistoryIndex(historyIndex - 1);
      isPerformingAction.current = false;
    } catch (error) {
      console.error('Failed to undo:', error);
      isPerformingAction.current = false;
    }
  }, [canvas, history, historyIndex]);

  // Redo to next state
  const redo = useCallback(async () => {
    if (!canvas || historyIndex >= history.length - 1) return;

    isPerformingAction.current = true;

    try {
      const nextState = history[historyIndex + 1];
      const parsedJson = JSON.parse(nextState.json);

      await canvas.loadFromJSON(parsedJson);
      canvas.renderAll();
      setHistoryIndex(historyIndex + 1);
      isPerformingAction.current = false;
    } catch (error) {
      console.error('Failed to redo:', error);
      isPerformingAction.current = false;
    }
  }, [canvas, history, historyIndex]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  // Auto-save on canvas modifications
  useEffect(() => {
    if (!canvas) return;

    const handleModified = () => {
      if (!isPerformingAction.current) {
        debouncedSaveState();
      }
    };

    const handleObjectAdded = () => {
      if (!isPerformingAction.current) {
        debouncedSaveState();
      }
    };

    const handleObjectRemoved = () => {
      if (!isPerformingAction.current) {
        debouncedSaveState();
      }
    };

    canvas.on('object:modified', handleModified);
    canvas.on('object:added', handleObjectAdded);
    canvas.on('object:removed', handleObjectRemoved);

    // Save initial state if history is empty
    if (history.length === 0) {
      // Use setTimeout to avoid synchronous state update in effect
      setTimeout(() => {
        saveState();
      }, 0);
    }

    return () => {
      canvas.off('object:modified', handleModified);
      canvas.off('object:added', handleObjectAdded);
      canvas.off('object:removed', handleObjectRemoved);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [canvas, debouncedSaveState, saveState, history.length]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) ||
        ((e.metaKey || e.ctrlKey) && e.key === 'y')
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canvas, undo, redo]);

  return {
    undo,
    redo,
    saveState,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    clearHistory
  };
};
