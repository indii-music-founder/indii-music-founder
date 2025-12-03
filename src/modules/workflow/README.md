# Workflow Module

## Purpose

The Workflow Module (also known as "Workflow Lab") is the brain of indiiOS for complex, multi-step tasks. It handles Research Augmented Generation (RAG), knowledge base management, and custom node-based workflows.

## Key Components

### `WorkflowLab`

The main interface for building and executing workflows. It allows users to:

- Create and connect nodes representing different tasks (e.g., "Research", "Summarize", "Generate").
- Visualize the flow of data and execution.

### `CustomNodes`

Defines the specific node types available in the workflow editor, such as:

- **Research Node:** For web search and data gathering.
- **LLM Node:** For text processing and generation.
- **Input/Output Nodes:** For data entry and result display.

## Services

- `FileSearchService`: Powers the RAG functionality, allowing the system to search and retrieve information from uploaded documents.
