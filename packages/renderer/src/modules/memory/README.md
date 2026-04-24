# Memory Module

The Memory module manages user context, conversation history, and persistent agent memory across sessions. It provides the cognitive continuity layer for the indii Conductor orchestration system.

## 🧠 Key Features

- **Always-On Memory Engine:** Maintains user context across sessions and conversations.
- **Conversation History:** Stores and retrieves previous interactions with agents.
- **Context Window Optimization:** Intelligently compresses or prioritizes memory for token efficiency.
- **User Knowledge Graph:** Builds understanding of user preferences, project history, and workflow patterns.

## 🏗️ Technical Architecture

- **`AlwaysOnMemoryEngine.ts`**: Core service managing persistent user memory and context retrieval.
- **Firestore Integration:** Stores memory snapshots and conversation transcripts.
- **Vector Embeddings:** Optional semantic search for contextual memory retrieval.
- **Memory UI (`MemoryPanel.tsx`)**: Visual interface for viewing and managing memory state.

## 🔗 Integrations

- **Agent** module (indii Conductor) uses memory for context-aware agent routing.
- **Chat** interface relies on memory for conversation continuity.
- **Observability** module logs memory access for debugging.

## 🚀 Future Expansion

- Semantic memory indexing for faster context retrieval.
- User-controlled memory management dashboard.
- Privacy-first memory encryption at rest.
- Memory pruning and archival for inactive sessions.
