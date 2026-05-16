# Autonomous Agent Capability Deployment & Registry

**Last Updated:** 2026-05-15
**Author:** Gemini 3 Pro (High Thinking)

## 1. Overview
This document outlines the transition of the indii agent ecosystem from a manual, chat-only model to a self-aware, technically-capable swarm. This is achieved through a centralized **Capability Registry** and the seeding of **Technical Core** tools across all 20 specialized agents.

## 2. The Capability Registry
The **Capability Registry** (`agents/capability_registry.json`) is the system's "Source of Truth" for agent discovery. It allows the Conductor (Orchestrator) to programmatically identify which specialists possess the specific technical tools required for a task.

### 2.1. Registry Schema
The registry tracks:
- **Agent ID**: Unique identifier for the specialist.
- **Path**: Filesystem path to the agent's directory.
- **Skills**: A map of functional tools, including descriptions and trigger labels.
- **Last Updated**: ISO timestamp of the last ecosystem audit.

## 3. Foundational Skills (The Bedrock)
Two core administrative utilities power the autonomous lifecycle of the swarm:

### 3.1. Audit Skill (`scan_directory.py`)
- **Function**: Recursively scans the `agents/` directory.
- **Output**: Generates/updates `agents/capability_registry.json`.
- **Trigger**: Run automatically after new tools are deployed or agent instructions are modified.

### 3.2. Memory Skill (`update_knowledge.py`)
- **Function**: Modifies agent instruction files (`prompt.md` or `instructions.md`) to persist procedural knowledge.
- **Usage**: "Brain surgery" for agents—informing them of new tools, user preferences, or compliance rules.
- **Persistence**: All changes are committed to Git with an audit trail.

## 4. Technical Core Seeding
Every agent in the swarm is seeded with a technical core to ensure they can perform verifiable work beyond chat.

### 4.1. Core Specialists (Seeded v1)
| Agent | Functional Tool | Description |
| :--- | :--- | :--- |
| **Music** | `calculate_splits.py` | Validates track share percentages and metadata. |
| **Merchandise** | `margin_calculator.py` | Calculates profit/margin for physical goods. |
| **Social** | `post_formatter.py` | Optimizes content for IG, TikTok, and X limits. |
| **Legal** | `nda_generator.py` | Scaffolds standard non-disclosure agreements. |
| **Finance** | `royalty_estimator.py` | Projects earnings from streaming play counts. |

### 4.2. Support Specialists
All other agents (Analytics, Distribution, Road, etc.) are seeded with a `domain_readiness.py` prototype to ensure a baseline technical capability across the 20-agent swarm.

## 5. Deployment Workflow
1. **Scaffold**: Create `skills/tools/` directory for the target agent.
2. **Deploy**: Drop the Python script and a `description.txt`.
3. **Audit**: Run `scan_directory.py` to index the new capability.
4. **Align**: Use `update_knowledge.py` to inform the agent of its new tool.
