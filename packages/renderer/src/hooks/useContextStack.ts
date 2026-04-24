/**
 * useContextStack Hook
 *
 * React hook for managing multi-turn conversation context.
 * Exposes stack operations, context window building, and token budget tracking.
 */

import { useState, useCallback } from 'react';
import { getContextStackService } from '@/services/agent/ContextStackService';
import type { ContextFrame } from '@/services/agent/ContextStackService';

interface UseContextStackReturn {
  currentFrame: ContextFrame | null;
  depth: number;
  tokenBudgetStatus: {
    used: number;
    available: number;
    percentageUsed: number;
    isWarning: boolean;
    isExceeded: boolean;
  };
  push: (topic: string, content: Record<string, unknown>) => void;
  pop: () => void;
  clear: () => void;
  buildContextWindow: () => Record<string, unknown>;
}

export function useContextStack(): UseContextStackReturn {
  const service = getContextStackService();

  const getInitialState = () => {
    const state = service.getState();
    const status = service.getTokenBudgetStatus();
    return {
      currentFrame: service.peek(),
      depth: state.currentDepth,
      tokenStatus: status
    };
  };

  const initial = getInitialState();

  const [currentFrame, setCurrentFrame] = useState<ContextFrame | null>(initial.currentFrame);
  const [depth, setDepth] = useState(initial.depth);
  const [tokenStatus, setTokenStatus] = useState(initial.tokenStatus);

  const updateState = useCallback(() => {
    setCurrentFrame(service.peek());
    const state = service.getState();
    setDepth(state.currentDepth);
    const status = service.getTokenBudgetStatus();
    setTokenStatus(status);
  }, [service]);

  const push = useCallback(
    (topic: string, content: Record<string, unknown>) => {
      service.push(topic, content);
      updateState();
    },
    [service, updateState]
  );

  const pop = useCallback(() => {
    service.pop();
    updateState();
  }, [service, updateState]);

  const clear = useCallback(() => {
    service.clear();
    updateState();
  }, [service, updateState]);

  const buildContextWindow = useCallback(() => {
    return service.buildContextWindow();
  }, [service]);

  return {
    currentFrame,
    depth,
    tokenBudgetStatus: tokenStatus,
    push,
    pop,
    clear,
    buildContextWindow
  };
}
