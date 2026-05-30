---
description: Conversational context review and agent specialization workflow. Use to onboard the agent into a specific role or review mid-session progress to realign focus.
---

# /review — The Specialization & Context Alignment Workflow

**Activates a conversational Q&A loop to review the current state of work, clarify ambiguity, and specialize the agent's persona for the task.**

Use this command when starting a complex new feature where the agent needs to act as a specialist, or midway through a session when the context feels drifted and you need to review what has been accomplished.

## 1. Context Ingestion & Summarization
- **If invoked mid-session:** Pause all coding and execution. Read through the conversation history and summarize what has been accomplished so far.
- **If invoked in a new chat:** Read the provided handoff, PRD, or initial prompt to understand the macro objective.

## 2. The Specialization Interview
Ask the user 1-2 highly targeted questions to specialize the agent for the upcoming work.
*Example questions:*
- "What specific persona or role do you need me to adopt for this task? (e.g. Backend Architecture, UI/UX Designer, Performance Optimizer)"
- "Are there any hard boundaries or specific technologies I should focus exclusively on for this sprint?"

## 3. Persona Lock & Alignment
- Once the user answers, explicitly confirm the new specialized persona and constraints.
- Output a brief `[Alignment Summary]` confirming the scope, the specialized role the agent will take, and the next immediate action.

## 4. Proceed to Execution
- Do not begin execution until the user confirms the `[Alignment Summary]`.
- Once confirmed, seamlessly transition into `/start` (if this is a new feature) or `/middle` (if this is mid-session continuation).
