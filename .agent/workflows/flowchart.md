---
description: Evidence-based Mermaid visualization workflow for state, ownership, hierarchy, dependencies, and multi-step execution paths. Use when a diagram materially improves understanding; save a repository artifact only when the user or active task calls for durable documentation.
---

# /flowchart — Architecture and Flow Visualizer

## 1. Decide whether a diagram helps

Use a visualization for relationships that are difficult to understand linearly: three or more dependent steps, branching state, cross-component ownership, hierarchy, or one source affecting several consumers. For a simple fact, one-step edit, or short sequence, answer in prose and do not create a file.

## 2. Establish evidence and scope

- identify the audience and question the diagram must answer;
- inspect real files, callers, schemas, services, and external boundaries;
- label planned, implemented, simulated, and externally verified nodes honestly;
- preserve uncertainty rather than inventing connections;
- use the project's domain vocabulary and current paths.

## 3. Choose the smallest useful form

- table for exact mappings/comparisons;
- flowchart for sequence or branching;
- sequence diagram for cross-boundary calls;
- state diagram for transitions and terminal states;
- tree for hierarchy/ownership.

For Mermaid:

- quote labels containing punctuation, parentheses, brackets, or special characters;
- use unique short node identifiers;
- avoid HTML in labels;
- show validation, error, retry, approval, and terminal-state gates when relevant;
- keep styling secondary to semantic clarity.

## 4. Verify

1. Trace each path from trigger to success/failure terminal state.
2. Check for orphan nodes, missing ownership, impossible transitions, and false external claims.
3. Verify every referenced repository path exists.
4. Run `node scripts/validate-flowcharts.js` when saving under `docs/flowcharts/`.

## 5. Save only when durable

If the task requires a repository artifact, update the relevant existing map when practical or create a descriptive kebab-case Markdown file under `docs/flowcharts/`. Include an H1, purpose, Mermaid block, and transition/ownership explanation.

If a conversational diagram is sufficient, return it without writing the repository.

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
