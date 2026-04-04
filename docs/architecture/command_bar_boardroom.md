# Command Bar: The "Boardroom" & "Office Hours" Feature

## Overview

The `CommandBar` component is currently disabled in the main interface (only rendering when `isCommandBarDetached` is strictly forced) because its primary function has been absorbed by the Right Panel's unified prompt area.

However, the `CommandBar` is reserved for a significant future feature: **The Boardroom / Office Hours**.

## Core Concept

This feature will provide a clean, distraction-free "ChatGPT-style" interface that takes over the main stage content area, allowing the user to engage in direct conversational AI sessions without the heavy visual chrome of the typical indiiOS modules.

### Key Capabilities

1. **Multi-Agent Conferencing ("Boardroom")**: The user can summon multiple specialized agents (e.g., the Legal Agent, the Finance Agent, and the Brand Agent) into a single conversational thread.
2. **Dynamic Entry**: Agents can be added or removed from the conversation at various times, allowing the user to consult different experts as the topic evolves.
3. **Office Hours (1-on-1 Focus)**: A dedicated mode for long-form, focused conversations with a single agent, free from the constraints of the Right Panel's smaller width.

## Architectural Considerations

- **Activation**: The `CommandBar` will act as the primary input mechanism for this view, sitting at the bottom of the screen (or centered, if no history exists yet), matching the familiar paradigm of modern LLM web interfaces.
- **State Management**: Needs to parse `AgentIds` in the query to route multi-agent responses via the `AgentDispatcher` or `indii Conductor`.
- **UI Treatment**: When activated, the standard layout components (Sidebar, Right Panel) will likely collapse or enter a zen mode to emphasize the conversation history.

*Note: Documented on April 4, 2026. This capability will be scheduled for a future sprint.*
