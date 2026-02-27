# Agent Module

The Agent module is the core orchestration hub for indiiOS. It provides the interface for interacting with various AI agents (hub-and-spoke architecture) and managing complex creative workflows.

## Key Components
- `AgentInterface`: The main chat/command interface.
- `SpecialistSelector`: UI for choosing between specialized agents (Legal, Brand, etc.).
- `TaskTracker`: Visual representation of ongoing agent tasks and sub-tasks.

## Architecture
This module interfaces with `AgentService` and `HybridOrchestrator` to coordinate between local execution and cloud AI models.
