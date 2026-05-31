# Workflow Lab & Automation Flowchart

This flowchart maps the technical structure of the Workflow Lab in indii. It shows how the node-based visual editor (React Flow) constructs automation graphs, how those graphs are stored in Zustand and Firestore, and how the Execution Engine traverses the graph to run sequential AI and utility tasks.

```mermaid
graph TD
    %% UI Components
    subgraph Frontend ["Workflow Lab UI (React Flow)"]
        CanvasUI["Node Canvas / Grid"]
        NodeLibrary["Tool & Agent Library Palette"]
        PropertiesPanel["Node Properties Editor"]
    end

    %% State Management
    subgraph State ["State Management"]
        WorkflowSlice["Zustand `workflowSlice`"]
        ReactFlowState["React Flow Nodes & Edges State"]
    end

    %% Execution Engine
    subgraph Engine ["Workflow Execution Engine"]
        Runner["Graph Traversal Runner"]
        TaskQueue["Local Task Queue"]
        AgentGateway["indii Conductor (AgentGraphService)"]
    end

    %% External & Cloud
    subgraph Backend ["Persistence & Tools"]
        Firestore["Firestore (`workflows` collection)"]
        ExternalAPIs["External APIs (Stripe, Spotify, etc.)"]
        CloudFunc["Firebase Functions (Heavy tasks)"]
    end

    %% Transitions - Design Phase
    NodeLibrary -->|"Drag & Drop"| CanvasUI
    CanvasUI -->|"Connect Edges"| ReactFlowState
    PropertiesPanel -->|"Configure Prompts/Params"| ReactFlowState
    ReactFlowState <-->|"Syncs continuously"| WorkflowSlice
    
    WorkflowSlice -->|"Saves on Demand"| Firestore

    %% Transitions - Execution Phase
    CanvasUI -->|"Click Run Workflow"| Runner
    Runner -->|"Parses Edges (Topological Sort)"| TaskQueue
    
    TaskQueue -->|"Pops Task 1 (e.g. Prompt)"| AgentGateway
    AgentGateway -->|"Executes via Agent Swarm"| CloudFunc
    CloudFunc -->|"Returns Result"| AgentGateway
    
    AgentGateway -->|"Passes Result to Task 2"| TaskQueue
    TaskQueue -->|"Executes Task 2 (e.g. API Call)"| ExternalAPIs
    ExternalAPIs -->|"Returns Data"| TaskQueue
    
    TaskQueue -->|"Updates Node Status (Done/Error)"| WorkflowSlice
    WorkflowSlice -->|"Visualizes Progress on Node"| CanvasUI

    %% Styling
    style CanvasUI fill:#00D4FF,color:#000
    style NodeLibrary fill:#00D4FF,color:#000
    style PropertiesPanel fill:#00D4FF,color:#000

    style WorkflowSlice fill:#8A2BE2,color:#FFF
    style ReactFlowState fill:#8A2BE2,color:#FFF

    style Runner fill:#FF00FF,color:#FFF
    style TaskQueue fill:#FF00FF,color:#FFF
    style AgentGateway fill:#FF00FF,color:#FFF

    style Firestore fill:#39FF14,color:#000
    style ExternalAPIs fill:#39FF14,color:#000
    style CloudFunc fill:#FF8C00,color:#000
```

## Transition Breakdown

1. **Graph Construction:** The user drags nodes from the **Tool & Agent Library Palette** onto the **Node Canvas**. They use the **Properties Panel** to configure specific prompts, input variables, or API keys.
2. **State Syncing:** Every interaction with the canvas (moving nodes, connecting edges) modifies the **React Flow State**, which is deeply integrated with the global **Zustand `workflowSlice`**. This ensures the visual graph maps exactly to the logical data structure.
3. **Persistence:** The user can save their automation recipe. The `workflowSlice` serializes the nodes and edges and saves them to the **Firestore** `workflows` collection for later retrieval.
4. **Execution Trigger:** When the user clicks "Run", the **Graph Traversal Runner** takes over. It performs a topological sort on the edges to determine the exact order of execution, ensuring dependencies (e.g., Node B needs Node A's output) are respected.
5. **Queue Processing:** The nodes are loaded into the **Local Task Queue**.
6. **Agent Handoff:** For AI tasks (like "Analyze Contract"), the runner sends the payload to the **indii Conductor**, which routes it to the appropriate specialist agent (or backend **Cloud Function** if it's heavy compute).
7. **Data Pipelining:** When the agent returns a result, the runner injects that output into the input parameters of the *next* node in the queue. 
8. **Live Feedback:** As each node finishes, the task queue updates the `workflowSlice`, which visually highlights the node on the **Canvas UI** (e.g., turning it green or showing an error icon) so the user can track the automation in real-time.
