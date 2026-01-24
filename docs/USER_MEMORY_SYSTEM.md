# User Memory System

## Overview

The User Memory System provides **persistent, long-term memory for individual users** across all sessions, projects, and interactions. Unlike project-scoped memory, user memory travels with the user and enables truly personalized AI experiences.

### Key Features

- **Cross-Session Persistence**: Memories survive across all sessions and projects
- **Semantic Search**: Vector embeddings enable intelligent memory retrieval
- **Memory Categories**: Organize memories by type (preferences, facts, goals, skills, etc.)
- **Importance Levels**: Prioritize memories by criticality
- **Context Building**: Automatic aggregation of user context for quick access
- **Memory Consolidation**: AI-powered memory deduplication and summarization
- **Analytics**: Track memory usage patterns and growth

## Architecture

### Database Structure

```
users/
  {userId}/
    memories/
      {memoryId} - Individual memory items
    context/
      {contextId} - Aggregated user context summaries
```

### Memory Schema

```typescript
interface UserMemory {
  id: string;
  userId: string;

  // Content
  content: string;
  category: MemoryCategory; // 'preference' | 'fact' | 'context' | 'goal' | 'skill' | 'interaction' | 'feedback' | 'relationship'
  importance: MemoryImportance; // 'critical' | 'high' | 'medium' | 'low'

  // Context
  sourceSessionId?: string;
  sourceProjectId?: string;
  tags: string[];

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessedAt: Timestamp;
  accessCount: number;

  // Lifecycle
  isActive: boolean;
  expiresAt?: Timestamp;

  // Relationships
  relatedMemoryIds: string[];
  supersedes?: string;

  // Vector search
  embedding?: number[];
  embeddingModel?: string;
}
```

### Memory Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `preference` | User preferences and settings | "prefers dark mode", "likes minimal UI" |
| `fact` | Facts about the user | "is a music producer", "uses FL Studio" |
| `context` | Working context | "working on album project", "learning mixing" |
| `goal` | User goals and objectives | "wants to release EP by June" |
| `skill` | User skills and expertise | "expert in sound design" |
| `interaction` | Interaction patterns | "asks detailed technical questions" |
| `feedback` | User feedback and corrections | "doesn't like auto-suggestions" |
| `relationship` | Social/professional relationships | "collaborates with @username" |

### Importance Levels

| Level | Usage | Retention |
|-------|-------|-----------|
| `critical` | Essential memories that define the user | Permanent |
| `high` | Important context and preferences | Long-term |
| `medium` | Useful facts and details | Medium-term |
| `low` | Temporary or less important info | Short-term |

## Usage Guide

### 1. Saving User Memories

**Agent Tool Usage:**

```typescript
// Save a user preference
await save_user_memory({
  content: "User prefers concise explanations with minimal preamble",
  category: "preference",
  importance: "high",
  tags: ["communication", "style"]
});

// Save a user fact
await save_user_memory({
  content: "User is a hip-hop producer working primarily with Logic Pro X",
  category: "fact",
  importance: "high",
  tags: ["profession", "tools"]
});

// Save a user goal
await save_user_memory({
  content: "User wants to master vocal mixing techniques by Q2 2026",
  category: "goal",
  importance: "medium",
  tags: ["learning", "skills", "vocals"]
});
```

**Direct Service Usage:**

```typescript
import { userMemoryService } from '@/services/agent/UserMemoryService';

const memoryId = await userMemoryService.saveMemory(
  userId,
  "User prefers detailed technical explanations",
  "preference",
  "high",
  {
    tags: ["communication", "technical"],
    sourceSessionId: currentSessionId,
    sourceProjectId: currentProjectId
  }
);
```

### 2. Searching User Memories

**Semantic Search:**

```typescript
// Search for relevant memories
const results = await search_user_memory({
  query: "What DAW does the user prefer?",
  categories: ["preference", "fact"],
  limit: 5
});

// Results include relevance scores
results.forEach(result => {
  console.log(`${result.content} (score: ${result.relevanceScore})`);
});
```

**Filtered Search:**

```typescript
// Find all active goals
const goals = await list_user_memories({
  categories: ["goal"],
  isActive: true,
  limit: 10
});

// Find high-priority preferences
const preferences = await search_user_memory({
  query: "user preferences",
  importance: ["critical", "high"],
  categories: ["preference"]
});
```

### 3. Getting User Context

**Quick Context Access:**

```typescript
// Get aggregated user context
const context = await get_user_context();

console.log(context.context.summary);
// "Music producer specializing in hip-hop, uses Logic Pro X,
//  prefers detailed technical explanations, currently learning vocal mixing"

console.log(context.context.topPreferences);
// ["prefers concise explanations", "likes dark mode", "uses keyboard shortcuts"]

console.log(context.context.activeGoals);
// ["master vocal mixing by Q2 2026", "release first EP", "build YouTube following"]

console.log(context.context.keyFacts);
// ["is a hip-hop producer", "uses Logic Pro X", "has 5 years experience"]
```

### 4. Updating Memories

```typescript
// Update memory content
await update_user_memory({
  memoryId: "mem_123",
  content: "User prefers very concise explanations with zero preamble",
  importance: "critical"
});

// Deactivate outdated memory
await deactivate_user_memory({
  memoryId: "mem_456"
});

// Permanently delete sensitive memory
await delete_user_memory({
  memoryId: "mem_789"
});
```

### 5. Memory Analytics

```typescript
// Get 30-day analytics
const analytics = await get_user_memory_analytics({ days: 30 });

console.log(analytics.analytics.memoriesByCategory);
// { preference: 15, fact: 42, goal: 8, skill: 12, ... }

console.log(analytics.analytics.memoryGrowthRate);
// 2.5 memories per day

console.log(analytics.analytics.topTags);
// [{ tag: "music-production", count: 25 }, { tag: "daw", count: 18 }, ...]
```

### 6. Memory Consolidation

```typescript
// Consolidate redundant memories
const result = await consolidate_user_memories();

console.log(result.message);
// "Successfully consolidated 15 memories."
```

## Integration Patterns

### Pattern 1: Initial User Onboarding

```typescript
// Capture critical user info during onboarding
await save_user_memory({
  content: `User is a ${userRole} working in ${industry}`,
  category: "fact",
  importance: "critical",
  tags: ["onboarding", "profession"]
});

await save_user_memory({
  content: `User's primary goal: ${primaryGoal}`,
  category: "goal",
  importance: "high",
  tags: ["onboarding", "objective"]
});
```

### Pattern 2: Learning from Corrections

```typescript
// User corrects the agent
user: "Actually, I prefer using Ableton, not Logic Pro"

// Agent saves correction as feedback
await save_user_memory({
  content: "User corrected previous assumption: prefers Ableton over Logic Pro",
  category: "feedback",
  importance: "high",
  tags: ["correction", "daw", "tools"]
});

// Update the original fact
await update_user_memory({
  memoryId: originalFactId,
  content: "User is a hip-hop producer working primarily with Ableton Live",
  isActive: false
});
```

### Pattern 3: Contextual Memory Retrieval

```typescript
// Before responding, check for relevant context
const userContext = await get_user_context();

// Search for specific relevant memories
const relevantMemories = await search_user_memory({
  query: userMessage,
  categories: ["preference", "feedback"],
  limit: 3
});

// Use memories to personalize response
const response = generatePersonalizedResponse(
  userMessage,
  userContext,
  relevantMemories
);
```

### Pattern 4: Progressive Learning

```typescript
// Track user's evolving skills
if (userDemonstratesNewSkill) {
  await save_user_memory({
    content: `User demonstrated proficiency in ${skillName}`,
    category: "skill",
    importance: "medium",
    tags: ["skill-development", skillCategory]
  });
}

// Track interaction patterns
if (consistentPattern) {
  await save_user_memory({
    content: `User consistently ${patternDescription}`,
    category: "interaction",
    importance: "medium",
    tags: ["behavior-pattern"]
  });
}
```

## Best Practices

### 1. Memory Granularity

✅ **DO**: Create atomic, specific memories
```typescript
await save_user_memory({
  content: "User prefers concise explanations without preamble",
  category: "preference"
});
```

❌ **DON'T**: Create overly broad memories
```typescript
await save_user_memory({
  content: "User likes things to be done in a certain way with specific formatting...",
  category: "preference"
});
```

### 2. Use Appropriate Categories

✅ **DO**: Choose the right category
```typescript
// Facts about the user
await save_user_memory({
  content: "User is a professional sound engineer",
  category: "fact"
});

// User preferences
await save_user_memory({
  content: "User prefers dark mode UI",
  category: "preference"
});
```

❌ **DON'T**: Mix categories
```typescript
await save_user_memory({
  content: "User is a sound engineer who prefers dark mode",
  category: "fact" // This mixes fact and preference
});
```

### 3. Set Importance Correctly

| When to Use | Importance Level |
|-------------|------------------|
| Core identity, critical preferences | `critical` |
| Important context, main goals | `high` |
| Useful details, secondary info | `medium` |
| Temporary notes, transient context | `low` |

### 4. Tag Consistently

Use consistent, lowercase, hyphenated tags:
```typescript
✅ ["music-production", "daw", "vocals"]
❌ ["Music Production", "DAW", "Vocals", "Music_Production"]
```

### 5. Leverage Semantic Search

Instead of exact keyword matching, use natural language queries:
```typescript
✅ "What are the user's communication preferences?"
❌ "preference communication"
```

### 6. Update, Don't Duplicate

When information changes, update or supersede existing memories:
```typescript
// Option 1: Update existing memory
await update_user_memory({
  memoryId: existingMemoryId,
  content: updatedContent
});

// Option 2: Create superseding memory
await save_user_memory({
  content: newContent,
  category: "fact",
  importance: "high"
});

await deactivate_user_memory({ memoryId: oldMemoryId });
```

### 7. Respect Privacy

- Use `importance: "critical"` sparingly
- Set expiration dates for sensitive temporary information
- Provide clear user controls for viewing/deleting memories
- Never store passwords, API keys, or payment information

## Performance Considerations

### Embedding Generation

- Embeddings are generated asynchronously using batching
- Maximum batch size: 20 memories
- Batch wait time: 50ms
- Model: `text-embedding-004`

### Query Optimization

- Use category filters to reduce search space
- Set reasonable `limit` values (default: 10)
- Leverage Firestore indexes for common query patterns
- Consider caching frequently accessed context

### Memory Consolidation

- Run consolidation during off-peak hours
- Consolidates memories older than 7 days
- Minimum 5 memories required for consolidation
- Uses fast model (`gemini-3-flash-preview`) for efficiency

## Firestore Security

User memories are protected by Firestore security rules:

```javascript
match /users/{userId}/memories/{memoryId} {
  allow read: if isOwner(userId);
  allow create: if isOwner(userId) && request.resource.data.userId == userId;
  allow update, delete: if isOwner(userId) && resource.data.userId == userId;
}
```

Users can **only** access their own memories.

## Migration and Maintenance

### Regenerate Embeddings

If you update the embedding model:

```typescript
import { userMemoryService } from '@/services/agent/UserMemoryService';

const updatedCount = await userMemoryService.regenerateEmbeddings(userId);
console.log(`Regenerated ${updatedCount} embeddings`);
```

### Export User Memories

```typescript
const memories = await userMemoryService.exportMemories(userId);
// Download as backup
const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
```

### Import User Memories

```typescript
const result = await userMemoryService.importMemories(userId, memories);
console.log(`Imported ${result.processedCount} memories`);
```

## Troubleshooting

### Memory Not Being Saved

1. Check user authentication: `userId` must be valid
2. Verify Firestore rules are deployed
3. Check for duplicate content (automatically skipped)
4. Review console for error messages

### Search Returning No Results

1. Verify embeddings are generated (check `embedding` field)
2. Lower `minRelevanceScore` threshold
3. Try broader search query
4. Check category and importance filters

### Context Not Updating

- Context is cached for 24 hours
- Manually refresh: `await userMemoryService.updateUserContext(userId)`
- Check if new memories are being saved

### Performance Issues

1. Review query complexity (reduce filters)
2. Limit result count appropriately
3. Check Firestore index creation status
4. Monitor embedding batch performance

## Future Enhancements

Potential future improvements:

- [ ] Multi-modal memories (images, audio)
- [ ] Memory threading (conversation chains)
- [ ] Automatic memory extraction from conversations
- [ ] Cross-user memory patterns (privacy-preserving)
- [ ] Memory importance decay over time
- [ ] Federated memory search across organizations
- [ ] Memory versioning and history
- [ ] Real-time memory streaming

---

**Version**: 1.0.0
**Last Updated**: 2026-01-23
**Maintained By**: Engineering Team
