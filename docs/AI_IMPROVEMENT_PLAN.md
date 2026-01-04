# AI System Improvement Plan

This document outlines a comprehensive plan to improve the AI capabilities across the indiiOS codebase.

---

## Executive Summary

The current AI system has a solid foundation with a Hub-and-Spoke agent architecture, semantic memory, and RAG capabilities. However, there are significant opportunities for improvement in reliability, performance, observability, and developer experience.

**Priority Levels:**

- 🔴 **Critical** - Security, reliability, or major UX issues
- 🟠 **High** - Significant improvements with clear ROI
- 🟡 **Medium** - Nice-to-have improvements
- 🟢 **Low** - Future considerations

---

## 1. Error Handling & Reliability 🔴

### 1.1 Standardize Error Handling Across Agent Tools (✅ DONE)

**Current State:** Error handling is inconsistent across tools. Some return strings like `"Failed to..."`, others return JSON with `{ error: "..." }`, and some throw exceptions.

**Improvement:**

```typescript
// Create a standardized ToolResult type
interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

// Wrapper function for all tools
async function withToolErrorHandling<T>(
  toolName: string,
  fn: () => Promise<T>
): Promise<ToolResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        code: `TOOL_${toolName.toUpperCase()}_ERROR`,
        message: error instanceof Error ? error.message : 'Unknown error',
        recoverable: isRecoverableError(error)
      }
    };
  }
}
```

**Files Updated:**

- `src/services/agent/tools/*.ts` (all tool files)
- `src/services/agent/types.ts` (added ToolResult type)

### 1.2 Add Circuit Breaker for AI Services (✅ DONE)

**Current State:** AI service calls can fail repeatedly, wasting tokens and causing poor UX.

**Improvement:**

```typescript
class AICircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private readonly threshold = 3;
  private readonly resetTimeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open - AI service temporarily unavailable');
    }
    try {
      const result = await fn();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}
```

**Files Created/Updated:**

- `src/services/ai/CircuitBreaker.ts` (new)
- `src/services/ai/FirebaseAIService.ts` (integrated circuit breaker)

### 1.3 Add Request Timeout and Cancellation

**Current State:** Long-running AI requests can't be cancelled by users.

**Improvement:**

- Add AbortController support to all AI service methods
- Implement request timeout with configurable limits
- Add UI feedback for long-running operations

---

## 2. Agent System Improvements 🟠

### 2.1 Implement Agent Execution Tracing (✅ DONE)

**Current State:** Difficult to debug agent execution flow. Logs are scattered and inconsistent.

**Improvement:**

```typescript
interface AgentTrace {
  traceId: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  steps: AgentTraceStep[];
  tokenUsage: { input: number; output: number };
  result?: AgentResponse;
  error?: string;
}

interface AgentTraceStep {
  type: 'routing' | 'context' | 'inference' | 'tool_call' | 'response';
  timestamp: number;
  duration: number;
  details: Record<string, unknown>;
}
```

**Files Created:**

- `src/services/agent/observability/TraceService.ts`

### 2.2 Improve Agent Orchestrator Routing (✅ DONE)

**Current State:** Routing prompt is embedded in code and can't be easily updated. No learning from routing mistakes.

**Improvement:**

- Extract routing rules to configurable file
- Add routing confidence scores
- Implement fallback chain when primary agent fails
- Log routing decisions for analysis

```typescript
interface RoutingDecision {
  selectedAgent: string;
  confidence: number;
  alternatives: Array<{ agentId: string; score: number }>;
  reasoning: string;
}
```

### 2.3 Add Agent Capability Discovery

**Current State:** Tool availability is static and doesn't adapt to context.

**Improvement:**

- Dynamic tool filtering based on user permissions
- Context-aware tool recommendations
- Tool usage analytics for optimization

### 2.4 Implement Multi-Turn Tool Execution

**Current State:** GeneralistAgent has manual JSON parsing loop. Other agents only execute one tool per turn.

**Improvement:**

- Standardize multi-turn execution in BaseAgent
- Add tool chaining support
- Implement automatic retry with different tools on failure

---

## 3. Memory & RAG Improvements 🟠

### 3.1 Enhance Memory Service with Importance Scoring

**Current State:** All memories are treated equally. No decay or importance ranking.

**Improvement:**

```typescript
interface EnhancedMemory {
  id: string;
  content: string;
  type: 'fact' | 'summary' | 'rule' | 'preference';
  importance: number; // 0-1 score
  accessCount: number;
  lastAccessed: number;
  decay: number; // Time-based decay factor
  source: 'user' | 'agent' | 'system';
  tags: string[];
}
```

### 3.2 Implement Memory Consolidation

**Current State:** Memories accumulate without summarization.

**Improvement:**

- Periodic memory consolidation (merge similar memories)
- Automatic summarization of old memories
- Memory pruning based on importance and access patterns

### 3.3 Improve RAG Hybrid Search

**Current State:** Fixed 60/40 vector/keyword weighting. No query rewriting.

**Improvement:**

- Dynamic weighting based on query type
- Query expansion with synonyms
- Re-ranking with cross-encoder
- Add metadata filtering support

```typescript
interface EnhancedSearchOptions {
  query: string;
  filters?: {
    dateRange?: [Date, Date];
    tags?: string[];
    documentTypes?: string[];
  };
  boost?: {
    recency?: number;
    authority?: number;
  };
  rerank?: boolean;
}
```

### 3.4 Add Knowledge Graph Support

**Current State:** Documents are isolated. No relationship tracking.

**Improvement:**

- Extract entities and relationships from documents
- Build knowledge graph for navigation
- Enable graph-based queries ("Find all contracts with Artist X")

---

## 4. Performance Optimizations 🟡

### 4.1 Implement Response Caching

**Current State:** No caching of AI responses. Identical requests hit the API.

**Improvement:**

```typescript
class AIResponseCache {
  private cache: Map<string, CachedResponse> = new Map();
  
  getCacheKey(request: GenerateContentOptions): string {
    return hash({
      model: request.model,
      contents: request.contents,
      config: request.config
    });
  }
  
  async getOrGenerate(
    request: GenerateContentOptions,
    generator: () => Promise<WrappedResponse>
  ): Promise<WrappedResponse> {
    const key = this.getCacheKey(request);
    const cached = this.cache.get(key);
    if (cached && !this.isExpired(cached)) {
      return cached.response;
    }
    const response = await generator();
    this.cache.set(key, { response, timestamp: Date.now() });
    return response;
  }
}
```

### 4.2 Add Request Batching

**Current State:** Each request is sent individually.

**Improvement:**

- Batch similar requests (e.g., multiple embeddings)
- Implement request queue with debouncing
- Add priority levels for urgent vs. background requests

### 4.3 Optimize Context Window Usage

**Current State:** Full context is sent every time. No token counting.

**Improvement:**

- Implement token counting before sending
- Smart context truncation (keep important parts)
- Sliding window for conversation history

```typescript
class ContextManager {
  private readonly maxTokens: number;
  
  optimizeContext(context: PipelineContext): PipelineContext {
    const tokenCount = this.countTokens(context);
    if (tokenCount > this.maxTokens) {
      return this.truncateContext(context, this.maxTokens);
    }
    return context;
  }
  
  private truncateContext(context: PipelineContext, maxTokens: number): PipelineContext {
    // Priority: System prompt > Recent history > Memories > Old history
    // Implement intelligent truncation
  }
}
```

### 4.4 Lazy Load Agent Definitions

**Current State:** All agents are loaded at startup.

**Improvement:**

- Dynamic import of agent definitions
- Only load agents when needed
- Reduce initial bundle size

---

## 5. Observability & Monitoring 🟡

### 5.1 Add AI Usage Analytics

**Current State:** No tracking of AI usage, costs, or performance.

**Improvement:**

```typescript
interface AIUsageMetrics {
  timestamp: number;
  model: string;
  operation: 'text' | 'image' | 'video' | 'embedding';
  inputTokens: number;
  outputTokens: number;
  latency: number;
  success: boolean;
  errorCode?: string;
  userId?: string;
  agentId?: string;
}

class AIMetricsCollector {
  async record(metrics: AIUsageMetrics): Promise<void> {
    // Send to analytics backend (BigQuery, etc.)
  }
  
  async getUsageSummary(timeRange: [Date, Date]): Promise<UsageSummary> {
    // Aggregate metrics
  }
}
```

### 5.2 Implement Agent Performance Dashboard

**Current State:** No visibility into agent performance.

**Improvement:**

- Track success/failure rates per agent
- Monitor average response times
- Alert on degraded performance
- Show tool usage patterns

### 5.3 Add Prompt Version Control

**Current State:** Prompts are embedded in code or markdown files with no versioning.

**Improvement:**

- Create prompt registry with versioning
- A/B testing support for prompts
- Rollback capability for prompt changes

---

## 6. Security Enhancements 🔴

### 6.1 Implement Input Sanitization (✅ DONE)

**Current State:** User input goes directly to AI without sanitization.

**Improvement:**

```typescript
class InputSanitizer {
  sanitize(input: string): string {
    // Remove potential prompt injection patterns
    // Validate input length
    // Strip dangerous characters
  }
  
  detectInjection(input: string): boolean {
    // Check for common injection patterns
    // "Ignore previous instructions"
    // System prompt leakage attempts
  }
}
```

### 6.2 Add Output Validation

**Current State:** AI outputs are used without validation.

**Improvement:**

- Validate tool call arguments against schemas
- Sanitize AI-generated content before display
- Check for PII in responses

### 6.3 Implement Rate Limiting per User (✅ DONE)

**Current State:** No per-user rate limiting on AI operations.

**Improvement:**

- Token-based rate limiting
- Tiered limits based on user plan
- Graceful degradation when limits reached

---

## 7. Developer Experience 🟡

### 7.1 Create Agent Development SDK

**Current State:** Creating new agents requires understanding multiple files.

**Improvement:**

```typescript
// Simple agent creation API
const myAgent = createAgent({
  id: 'my-agent',
  name: 'My Agent',
  description: 'Does something useful',
  prompt: `You are a helpful assistant...`,
  tools: [
    tool('search', 'Search for information', searchSchema, searchHandler),
    tool('create', 'Create something', createSchema, createHandler)
  ]
});
```

### 7.2 Add Agent Testing Utilities

**Current State:** Testing agents requires extensive mocking.

**Improvement:**

```typescript
// Test utilities
const testHarness = createAgentTestHarness(myAgent);

// Easy conversation testing
await testHarness.send('Hello');
expect(testHarness.lastResponse).toContain('Hi');

// Tool call verification
await testHarness.send('Search for cats');
expect(testHarness.lastToolCall).toEqual({
  name: 'search',
  args: { query: 'cats' }
});
```

### 7.3 Improve Type Safety

**Current State:** Many `any` types in agent code. Tool args are untyped.

**Improvement:**

- Add strict typing to all tool functions
- Generate TypeScript types from tool schemas
- Use branded types for IDs

---

## 8. New Capabilities 🟢

### 8.1 Add Streaming Support for All Agents

**Current State:** Only GeneralistAgent supports streaming.

**Improvement:**

- Add streaming to BaseAgent
- Implement proper SSE/WebSocket transport
- Add progress indicators for long operations

### 8.2 Implement Agent Collaboration

**Current State:** Agents work independently.

**Improvement:**

- Enable agents to delegate to each other
- Implement consensus mechanisms for complex decisions
- Add agent discussion threads for transparency

### 8.3 Add Multimodal Input Support

**Current State:** Limited support for images in chat.

**Improvement:**

- Support audio input (voice commands)
- Support document uploads in chat
- Enable mixed media conversations

### 8.4 Implement Proactive Agents

**Current State:** Agents only respond to user input.

**Improvement:**

- Scheduled agent tasks (daily summaries)
- Event-triggered actions (new file uploaded)
- Smart notifications and suggestions

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2) 🔴

1. Standardize error handling across all tools (✅ DONE)
2. Add circuit breaker to AI services (✅ DONE)
3. Implement input sanitization (✅ DONE)
4. Add basic usage metrics (✅ DONE)

### Phase 2: Reliability (Weeks 3-4) 🟠

1. Implement agent execution tracing (✅ DONE)
2. Add request timeout and cancellation
3. Improve orchestrator routing (✅ DONE)
4. Add output validation

### Phase 3: Performance (Weeks 5-6) 🟡

1. Implement response caching
2. Optimize context window usage
3. Add request batching for embeddings
4. Lazy load agent definitions

### Phase 4: Memory & RAG (Weeks 7-8) 🟠

1. Enhance memory with importance scoring
2. Implement memory consolidation
3. Improve hybrid search weighting
4. Add metadata filtering

### Phase 5: Developer Experience (Weeks 9-10) 🟡

1. Create agent development SDK
2. Add testing utilities
3. Improve type safety
4. Add prompt version control

### Phase 6: Advanced Features (Weeks 11-12) 🟢

1. Add streaming to all agents
2. Implement agent collaboration
3. Add multimodal input support
4. Implement proactive agents

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Agent error rate | ~5% | <1% |
| Average response time | ~3s | <2s |
| Token efficiency | Unknown | Track baseline |
| Test coverage (AI code) | ~40% | >80% |
| Memory retrieval accuracy | Unknown | >85% |
| Routing accuracy | Unknown | >95% |

---

## Dependencies & Prerequisites

1. **Firebase Functions upgrade** - Need Gen 2 functions for better cold start
2. **BigQuery setup** - For usage analytics storage
3. **Redis/Memcached** - For response caching (optional, can use in-memory)
4. **Monitoring integration** - Cloud Monitoring or similar

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing agents | High | Comprehensive test suite, gradual rollout |
| Increased costs from caching | Medium | TTL-based eviction, size limits |
| Performance regression | High | Benchmark before/after each phase |
| Token limit exceeded | Medium | Smart truncation, user notification |

---

*Document Version: 1.1*
*Last Updated: 2026-01-04*
*Author: AI Assistant*
