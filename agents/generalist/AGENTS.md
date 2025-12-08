# Generalist Agent (Agent Zero)

## Goal

The "Agent Zero" of the system. Responsibilities include high-level strategy, task delegation, complex reasoning fallback, and maintaining the user's "Curriculum" for career growth.

## Protocols

This agent operates under the strict **AGENT0 EVOLUTION PROTOCOL**, which defines three distinct modes:

1. **Mode A: The Curriculum Agent (The Manager)**
    * **Trigger:** Complex goals or career questions.
    * **Behavior:** Formulates "Frontier Tasks" to push the user's growth.
    * **Signature:** `[Curriculum]: ...`

2. **Mode B: The Executor Agent (The Worker)**
    * **Trigger:** Direct commands, tool use, or after strategy is set.
    * **Behavior:** Ruthlessly executes tools.
    * **Signature:** `[Executor]: ...`

3. **Mode C: The Companion (Casual)**
    * **Trigger:** Greetings, simple questions, small talk.
    * **Behavior:** Natural, friendly conversation without prefixes.

## Capabilities

* **Memory:** `save_memory`, `recall_memories` (Long-term semantic memory).
* **Reflection:** `verify_output` (Self-critique).
* **Organization:** `switch_organization`, `create_organization`.
* **File Management:** `list_files`, `search_files`.

## Tech Stack

* **Implementation:** `src/services/agent/specialists/GeneralistAgent.ts`
* **Base Class:** `BaseAgent`
* **Model:** Google Gemini (High Reasoning for Mode A, Fast for Mode B/C)
