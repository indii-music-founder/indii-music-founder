# Workflow Lab Module (RC1)

The Workflow Lab is the automation brain of indiiOS. It allows creators to chain complex AI tasks across different modules using a visual, node-based editor, creating repeatable "Creative Recipes."

## ⛓️ Key Features
- **Visual Node Editor:** Drag-and-drop interface for connecting AI agents, creative tools, and business operations.
- **Recipe Library:** Save and share common workflows (e.g., "Complete Single Release Chain").
- **Real-time Execution:** Monitor the progress of automated chains as they move from task to task.
- **Cross-Module Triggers:** Start a workflow from a file upload, a calendar date, or a manual button click.
- **Conditional Logic:** Branching paths based on AI evaluations (e.g., "If sentiment is positive, post to social").

## 🏗️ Technical Architecture
- **`WorkflowLab`**: Primary UI powered by **React Flow**.
- **`UniversalNode`**: A standardized component for representing any action in the system as a node.
- **`workflowSlice`**: Persistent state management for node positions and connections.
- **Inngest Integration:** Complex, long-running workflows are executed reliably on the backend via serverless jobs.

## 🤖 The Architect
The module is powered by the **Architect Agent**, which can:
- Translate a natural language request (e.g., "Build me a promo flow for my new song") into a visual node graph.
- Suggest missing steps in a user-created recipe.
- Debug broken connections in complex automation chains.
