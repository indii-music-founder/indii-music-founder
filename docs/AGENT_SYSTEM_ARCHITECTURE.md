# Agent System Architecture & Expert Knowledge Base

**Last Updated:** 2025-12-01
**Author:** Lead Engineer (Antigravity)

## 1. System Overview: The "Hub-and-Spoke" Model

The `Rndr-AI` agent system is built on a **Hub-and-Spoke** architecture designed for scalability and specialization.

* **The Hub (Orchestrator)**: `AgentService` ("indii"). It handles user interaction, context management, and high-level strategy. It uses the **Agent Zero Protocol** (Mode A: Strategy, Mode B: Execution).
* **The Spokes (Specialists)**: Specialized agents (Legal, Marketing, Music) that extend `BaseAgent`. They are domain experts with specific system prompts and toolsets.
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

## 4. Critical Learnings & "Gotchas"

1. **SDK Response Handling**: The Google AI SDK `GenerateContentResult` object exposes text via a **method** `response.text()`, not a property. Accessing it as a property returns `undefined` and causes silent failures in fallback logic.
2. **Tool Hallucinations**: The Orchestrator can hallucinate agent names.
    * **Fix**: We strictly typed `agent_id` in the `delegate_task` definition and listed valid IDs in the description to ground the model.
3. **Abstract Class Contracts**: TypeScript abstract classes are powerful for enforcing the `tools` contract. All agents *must* define a `tools` array, even if empty, to ensure the `BaseAgent` logic works safely.

## 5. Future Roadmap

1. **Inter-Agent Communication**: Currently, communication is Star (Hub <-> Spoke). Future: Mesh (Spoke <-> Spoke) via a shared bus.
2. **Stateful Specialists**: Currently, specialists are stateless (per request). We might need them to retain context of a long-running task.
3. **Mastra Integration**: We are primed to swap our custom `BaseAgent` for `@mastra/core` agents if we need more advanced workflow features, as the interface is similar.
