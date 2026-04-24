/**
 * Agent Memory Slice
 *
 * Zustand store integration for Phase 2 memory and orchestration services.
 * Manages memory state, reflection results, and streaming context globally.
 */

import { StateCreator } from 'zustand';
import type { Memory, MemoryLayer } from '@/services/memory/PersistentMemoryService';
import type { ReflectionIteration } from '@/services/agent/ReflectionLoop';
import type { ContextFrame } from '@/services/agent/ContextStackService';

export interface AgentMemoryState {
  // Persistent memory
  cachedMemories: Map<string, Memory>;
  selectedLayer: MemoryLayer;
  memorySearchQuery: string;
  isMemoryLoading: boolean;

  // Reflection results
  reflectionHistory: ReflectionIteration[];
  currentReflectionId: string | null;
  reflectionInProgress: boolean;

  // Context stack
  contextFrames: ContextFrame[];
  currentContextFrameId: string | null;
  contextTokenUsage: number;

  // Streaming state
  streamingTokens: string[];
  streamingComplete: boolean;
  streamingError: Error | null;

  // Actions
  setCachedMemories: (memories: Memory[]) => void;
  addCachedMemory: (memory: Memory) => void;
  clearCachedMemories: () => void;

  setSelectedLayer: (layer: MemoryLayer) => void;
  setMemorySearchQuery: (query: string) => void;
  setIsMemoryLoading: (loading: boolean) => void;

  setReflectionHistory: (iterations: ReflectionIteration[]) => void;
  addReflectionIteration: (iteration: ReflectionIteration) => void;
  setCurrentReflectionId: (id: string | null) => void;
  setReflectionInProgress: (inProgress: boolean) => void;

  setContextFrames: (frames: ContextFrame[]) => void;
  addContextFrame: (frame: ContextFrame) => void;
  setCurrentContextFrameId: (id: string | null) => void;
  setContextTokenUsage: (tokens: number) => void;

  setStreamingTokens: (tokens: string[]) => void;
  appendStreamingToken: (token: string) => void;
  setStreamingComplete: (complete: boolean) => void;
  setStreamingError: (error: Error | null) => void;

  resetStreamingState: () => void;
}

export const createAgentMemorySlice: StateCreator<
  AgentMemoryState,
  [],
  [],
  AgentMemoryState
> = (set) => ({
  // Initial state
  cachedMemories: new Map(),
  selectedLayer: 'session',
  memorySearchQuery: '',
  isMemoryLoading: false,

  reflectionHistory: [],
  currentReflectionId: null,
  reflectionInProgress: false,

  contextFrames: [],
  currentContextFrameId: null,
  contextTokenUsage: 0,

  streamingTokens: [],
  streamingComplete: false,
  streamingError: null,

  // Memory actions
  setCachedMemories: (memories) =>
    set(() => ({
      cachedMemories: new Map(memories.map((m) => [m.id, m]))
    })),

  addCachedMemory: (memory) =>
    set((state) => {
      const updated = new Map(state.cachedMemories);
      updated.set(memory.id, memory);
      return { cachedMemories: updated };
    }),

  clearCachedMemories: () =>
    set(() => ({
      cachedMemories: new Map(),
      memorySearchQuery: ''
    })),

  setSelectedLayer: (layer) =>
    set(() => ({
      selectedLayer: layer
    })),

  setMemorySearchQuery: (query) =>
    set(() => ({
      memorySearchQuery: query
    })),

  setIsMemoryLoading: (loading) =>
    set(() => ({
      isMemoryLoading: loading
    })),

  // Reflection actions
  setReflectionHistory: (iterations) =>
    set(() => ({
      reflectionHistory: iterations
    })),

  addReflectionIteration: (iteration) =>
    set((state) => ({
      reflectionHistory: [...state.reflectionHistory, iteration]
    })),

  setCurrentReflectionId: (id) =>
    set(() => ({
      currentReflectionId: id
    })),

  setReflectionInProgress: (inProgress) =>
    set(() => ({
      reflectionInProgress: inProgress
    })),

  // Context actions
  setContextFrames: (frames) =>
    set(() => ({
      contextFrames: frames
    })),

  addContextFrame: (frame) =>
    set((state) => ({
      contextFrames: [...state.contextFrames, frame]
    })),

  setCurrentContextFrameId: (id) =>
    set(() => ({
      currentContextFrameId: id
    })),

  setContextTokenUsage: (tokens) =>
    set(() => ({
      contextTokenUsage: tokens
    })),

  // Streaming actions
  setStreamingTokens: (tokens) =>
    set(() => ({
      streamingTokens: tokens
    })),

  appendStreamingToken: (token) =>
    set((state) => ({
      streamingTokens: [...state.streamingTokens, token]
    })),

  setStreamingComplete: (complete) =>
    set(() => ({
      streamingComplete: complete
    })),

  setStreamingError: (error) =>
    set(() => ({
      streamingError: error
    })),

  // Utilities
  resetStreamingState: () =>
    set(() => ({
      streamingTokens: [],
      streamingComplete: false,
      streamingError: null
    }))
});
