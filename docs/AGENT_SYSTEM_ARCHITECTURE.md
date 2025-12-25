# Agent System Architecture & Expert Knowledge Base

**Last Updated:** 2024-12-24
**Author:** Lead Engineer (Antigravity/Gemini 3 Pro)

## 1. System Overview: The "Hub-and-Spoke" Model

The **indiiOS** agent system is built on a **Hub-and-Spoke** architecture designed for scalability and specialization, now powered exclusively by **Gemini 3** preview models.

* **The Hub (Orchestrator)**: `AgentService` ("indii"). It handles user interaction, context management, and high-level strategy. It leverages `gemini-3-pro-preview` with **High Thinking** for strategic planning.
* **The Spokes (Specialists)**: Specialized agents (Legal, Marketing, Music) that extend `BaseAgent`. These use `gemini-3-flash-preview` for specialized tasks or `gemini-3-pro-preview` for complex domain analysis.
* **The Memory/Context Layer**: Powered by the **Gemini File Search API**, providing native RAG capabilities with long-context awareness.
* **The Glue**: `AgentRegistry` and the `delegate_task` tool.

## 2. Core Components

### 2.1. AgentService (The Orchestrator)

* **Location**: `src/services/agent/AgentService.ts`
* **Responsibility**:
  * Maintains the chat loop and history (`useStore`).
  * Injects global context (Brand Kit, User Profile).
  * **Dynamic Persona Detection**: Automatically switches persona (Director, Musician, etc.) based on the active project type.
  * **Delegation**: Uses `delegate_task` to hand off sub-problems to specialists.
* **Key Implementation Detail**:
  * Uses `AI.generateContentStream` for responsive UI.
  * **Critical Fix**: Handles fallback to unary `AI.generateContent` safely (using `res.text()` method, not property).

### 2.2. BaseAgent (The Blueprint)

* **Location**: `src/services/agent/specialists/BaseAgent.ts`
* **Role**: Abstract base class for all specialists.
* **Features**:
  * **`execute(task, context)`**: Standard entry point.
  * **`tools`**: Abstract property for defining JSON schemas for AI function calling.
  * **`functions`**: Protected map of implementation logic matching tool names.
  * **Automatic Function Routing**: The `execute` method automatically detects `functionCalls` from the AI response, executes the matching function from `this.functions`, and returns the result.

### 2.3. AgentRegistry

* **Location**: `src/services/agent/registry.ts`
* **Role**: Singleton registry pattern.
* **Usage**:
  * Agents register themselves at startup (`AgentService` constructor).
  * Allows lookup by `id` (e.g., 'legal', 'marketing').
  * Provides `listCapabilities()` for the Orchestrator to know who is available.

## 3. Tooling & Function Calling Standard

We use the Google Generative AI SDK's function calling capability.

### 3.1. Defining a Tool

Tools are defined in the `tools` array of a specialist.

```typescript
tools = [{
    functionDeclarations: [{
        name: "tool_name",
        description: "What it does",
        parameters: {
            type: "OBJECT",
            properties: {
                arg1: { type: "STRING", description: "..." }
            },
            required: ["arg1"]
        }
    }]
}];
```

### 3.2. Implementing Logic

Logic is implemented in the `functions` map within the agent's constructor. **Crucially, for production, we do not mock these.** We use recursive AI calls, external APIs, or rigorous logic.

```typescript
constructor() {
    super();
    this.functions = {
        analyze_contract: async (args) => {
            // REAL IMPLEMENTATION: Call AI for analysis
            const response = await AI.generateContent({ ... });
            return AI.parseJSON(response.text());
        }
    };
}
```

## 4. RAG & Knowledge Management (File Search API)

We have migrated from the legacy Corpus/AQA system to the **Gemini File Search API**. This provides a more robust, "native" RAG experience.

### 4.1. GeminiRetrievalService

* **Location**: `src/services/rag/GeminiRetrievalService.ts`
* **Mechanism**:
    1. **Upload**: Files are uploaded to the Gemini Files API (`/upload/v1beta/files`).
    2. **Indexing**: Files are imported into a managed `FileSearchStore`.
    3. **Querying**: The agent uses the `fileSearch` tool in its `generateContent` payload to search the store.
* **Advantages**:
  * **Long Context**: Seamlessly handles documents that exceed standard token limits.
  * **Zero Management**: No manual vector database indexing required; Gemini handles retrieved context internally.

## 5. Critical Learnings & "Gotchas"

1. **Model Policy (CRITICAL)**: Only Gemini 3 models are allowed. Usage of Gemini 1.5, 2.0, or legacy pro models will trigger a runtime validation crash (see `src/core/config/ai-models.ts`).
2. **SDK Response Handling**: The Google AI SDK `GenerateContentResult` object exposes text via a **method** `response.text()`, not a property.
3. **Tool Hallucinations**: The Orchestrator can hallucinate agent names.
    * **Fix**: Strictly typed `agent_id` in `delegate_task` and listed valid IDs in the description.
4. **File States**: After uploading a file, you must poll the Files API until the state is `ACTIVE` before it can be used for generation or imported into a search store.

## 6. Future Roadmap

1. **Persistent Knowledge Ecosystem**: Deepening integration between Firestore-stored user data and the Gemini File Search stores.
2. **Multi-Store Management**: Moving from a single "default" store to project-specific search stores for tighter context isolation.
3. **Agentic Workflows (Mastra)**: Integrating `@mastra/core` for complex, multi-step agent graphs and state management.
4. **Unified Multimodal RAG**: Expanding retrieval to support image and video context natively.
