/**
 * useAgentStream Hook
 *
 * React hook for consuming agent streaming responses.
 * Manages streaming state, error handling, and token accumulation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getAgentStreamingService } from '@/services/agent/AgentStreamingService';

interface UseAgentStreamOptions {
  autoStart?: boolean;
  onToken?: (token: string, index: number) => void;
  onComplete?: (metadata: { totalTokens: number; duration: number; latency: number; completedAt: number }) => void;
  onError?: (error: Error) => void;
}

interface UseAgentStreamReturn {
  isStreaming: boolean;
  tokens: string[];
  fullText: string;
  error: Error | null;
  stream: (input: string, agentId: string, context?: Record<string, unknown>) => Promise<void>;
  stop: () => void;
  reset: () => void;
  tokenCount: number;
}

export function useAgentStream(
  userId: string,
  options: UseAgentStreamOptions = {}
): UseAgentStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokens, setTokens] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const tokensRef = useRef<string[]>([]);
  const serviceRef = useRef(getAgentStreamingService());

  const fullText = tokens.join('');

  const handleToken = useCallback(
    (token: string, index: number) => {
      tokensRef.current.push(token);
      setTokens([...tokensRef.current]);
      options.onToken?.(token, index);
    },
    [options]
  );

  const handleComplete = useCallback(
    (metadata: { totalTokens: number; duration: number; latency: number; completedAt: number }) => {
      setIsStreaming(false);
      options.onComplete?.(metadata);
    },
    [options]
  );

  const handleError = useCallback(
    (err: Error) => {
      setError(err);
      setIsStreaming(false);
      options.onError?.(err);
    },
    [options]
  );

  const stream = useCallback(
    async (input: string, agentId: string, context?: Record<string, unknown>) => {
      try {
        setIsStreaming(true);
        setError(null);
        tokensRef.current = [];
        setTokens([]);

        const service = serviceRef.current;
        await service.stream(input, agentId, userId, context, {
          onToken: handleToken,
          onComplete: handleComplete,
          onError: handleError
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsStreaming(false);
        options.onError?.(error);
      }
    },
    [userId, handleToken, handleComplete, handleError, options]
  );

  const stop = useCallback(() => {
    serviceRef.current.stop();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    serviceRef.current.reset();
    setIsStreaming(false);
    setError(null);
    tokensRef.current = [];
    setTokens([]);
  }, []);

  useEffect(() => {
    return () => {
      if (isStreaming) {
        serviceRef.current.stop();
      }
    };
  }, [isStreaming]);

  return {
    isStreaming,
    tokens,
    fullText,
    error,
    stream,
    stop,
    reset,
    tokenCount: tokens.length
  };
}
