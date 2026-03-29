import { useState, useCallback, useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { logger } from '@/utils/logger';

interface CanvasHistoryState {
  json: string;
  timestamp: number;
}

interface HistoryData {
  states: CanvasHistoryState[];
  index: number;
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
  const [history, setHistory] = useState<HistoryData>({
    states: [],
    index: -1,
  });
  
  const isPerformingAction = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedJson = useRef<string | null>(null);

  // Save current canvas state to history
  const saveState = useCallback(() => {
    if (!canvas || isPerformingAction.current) return;

    try {
      // We use toObject with custom properties we care about
      // 'name' and 'id' are critical for our layer management
      const obj = canvas.toObject(['name', 'id', 'selectable', 'locked']);
      const json = JSON.stringify(obj);

      // Optimization: Don't save if nothing changed
      if (json === lastSavedJson.current) return;
      lastSavedJson.current = json;

      const timestamp = Date.now();

      setHistory((prev) => {
        // Remove any "future" states if we're not at the end
        const newStates = prev.states.slice(0, prev.index + 1);

        // Add new state
        newStates.push({ json, timestamp });

        // Limit history size
        if (newStates.length > maxHistorySize) {
          newStates.shift();
          return {
            states: newStates,
            index: newStates.length - 1,
          };
        }

        return {
          states: newStates,
          index: newStates.length - 1,
        };
      });
    } catch (error: unknown) {
      logger.error('[useCanvasHistory] Failed to save canvas state:', error);
    }
  }, [canvas, maxHistorySize]);

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
    if (!canvas || history.index <= 0) return;

    isPerformingAction.current = true;

    try {
      const prevIndex = history.index - 1;
      const prevState = history.states[prevIndex]!;
      const parsedJson = JSON.parse(prevState.json);

      lastSavedJson.current = prevState.json;
      
      await canvas.loadFromJSON(parsedJson);
      canvas.renderAll();
      
      setHistory(prev => ({ ...prev, index: prevIndex }));
      
      // Small delay to ensure Fabric events triggered by loadFromJSON are ignored
      setTimeout(() => {
        isPerformingAction.current = false;
      }, 100);
    } catch (error: unknown) {
      logger.error('[useCanvasHistory] Failed to undo:', error);
      isPerformingAction.current = false;
    }
  }, [canvas, history]);

  // Redo to next state
  const redo = useCallback(async () => {
    if (!canvas || history.index >= history.states.length - 1) return;

    isPerformingAction.current = true;

    try {
      const nextIndex = history.index + 1;
      const nextState = history.states[nextIndex]!;
      const parsedJson = JSON.parse(nextState.json);

      lastSavedJson.current = nextState.json;

      await canvas.loadFromJSON(parsedJson);
      canvas.renderAll();
      
      setHistory(prev => ({ ...prev, index: nextIndex }));
      
      setTimeout(() => {
        isPerformingAction.current = false;
      }, 100);
    } catch (error: unknown) {
      logger.error('[useCanvasHistory] Failed to redo:', error);
      isPerformingAction.current = false;
    }
  }, [canvas, history]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory({ states: [], index: -1 });
    lastSavedJson.current = null;
  }, []);

  // Auto-save on canvas modifications
  useEffect(() => {
    if (!canvas) return;

    const handleUpdate = () => {
      if (!isPerformingAction.current) {
        debouncedSaveState();
      }
    };

    // Fabric v6 events
    canvas.on('object:modified', handleUpdate);
    canvas.on('object:added', handleUpdate);
    canvas.on('object:removed', handleUpdate);
    canvas.on('path:created', handleUpdate);

    // Initial state save - handled by object:added or manual trigger if needed
    // Removed synchronous saveState() from here to prevent cascading renders

    return () => {
      canvas.off('object:modified', handleUpdate);
      canvas.off('object:added', handleUpdate);
      canvas.off('object:removed', handleUpdate);
      canvas.off('path:created', handleUpdate);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [canvas, debouncedSaveState, saveState, history.states.length]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd/Ctrl + Z
      if (ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
      if (
        (ctrlKey && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        (ctrlKey && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvas, undo, redo]);

  return {
    undo,
    redo,
    saveState,
    canUndo: history.index > 0,
    canRedo: history.index < history.states.length - 1,
    clearHistory
  };
};
