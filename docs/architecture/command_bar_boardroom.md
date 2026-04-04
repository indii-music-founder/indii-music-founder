# Command Bar: The "Boardroom" & "Office Hours" Feature

## Overview

The `CommandBar` component is currently disabled in the main interface (only rendering when `isCommandBarDetached` is strictly forced) because its primary function has been absorbed by the Right Panel's unified prompt area.

However, the `CommandBar` is reserved for a significant future feature: **The Boardroom / Office Hours**.

## Core Concept: The Oval Table

This feature will provide a clean, distraction-free "ChatGPT-style" interface that takes over the main stage content area, allowing the user to engage in direct conversational AI sessions without the heavy visual chrome of the typical indiiOS modules. At its heart is **The Virtual Boardroom Table**.

### Key Capabilities

1. **Multi-Agent Conferencing ("Boardroom")**: The user can summon multiple specialized agents (e.g., the Legal Agent, the Finance Agent, and the Brand Agent) into a single conversational thread.
2. **Spatial UI (The Glowing Oval)**: The primary interface is a large, glassmorphic oval. Agent avatars sit around the perimeter of this oval. Toggling an agent (clicking their avatar) illuminates them, visually confirming they are participating in the conversation.
3. **Internal Dialogue Rendering**: Inside the oval is where the agents' responses and comments stream in, clearly indicated by the responding agent's signature.
4. **Overlay Prompting & Asset Injection**: While the agents "sit" at the table, the user interacts via their text input overlay (the Command Bar). Users can pull external resources or internal database assets into the prompt via `@` or `#` mechanics.
5. **Actionable Task Handoff**: Most importantly, the conversation is not just text. Agents extract actionable items from high-level briefs (e.g., tracking costs, finding reference imagery) and execute them as background workflows.
6. **Voice Synthesis (Conversational Audio)**: The boardroom acts as a literal meeting. Each active agent will respond not just with text, but with their own distinct synthesized voice (e.g., mapped via `gemini-2.5-pro-tts`). The initial implementation uses hardcoded voice profiles per department, allowing the user to recognize who is speaking effortlessly. (Customization of these voices is a future roadmap item).

## Architectural Considerations

- **Activation**: The `CommandBar` will act as the primary input mechanism for this view, sitting at the bottom of the screen (or centered, if no history exists yet), matching the familiar paradigm of modern LLM web interfaces.
- **State Management**: Needs to parse `AgentIds` in the query to route multi-agent responses via the `AgentDispatcher` or `indii Conductor`.
- **UI Treatment**: When activated, the standard layout components (Sidebar, Right Panel) will likely collapse or enter a zen mode to emphasize the conversation history.

*Note: Documented on April 4, 2026. This capability will be scheduled for a future sprint.*
