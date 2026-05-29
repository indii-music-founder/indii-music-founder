# File Search RAG Implementation Flowchart

This flowchart maps the Knowledge Retrieval Layer using Google's Gemini File Search API. It illustrates how user queries are routed through the RAG Agent, synthesized with live Web Search data, and formatted with citations for the specialized Swarm Agents.

```mermaid
graph TD
    %% User Input
    UserQuery["User Query / Prompt"]

    %% Core Orchestration
    subgraph Orchestration ["Agent Zero / Router"]
        Router["Determines specialized agent and intent"]
        Dispatch["Dispatches to Knowledge Retrieval Layer"]
    end

    %% RAG System
    subgraph KnowledgeRetrieval ["Knowledge Retrieval Layer (RAG Agent)"]
        Options["Determine Required Corpora & Web Need"]
        
        %% Corpora
        subgraph FileSearch ["Gemini File Search API ($0.15/M tokens index only)"]
            Corpus1["indii-royalties-v1"]
            Corpus2["indii-deals-v1"]
            Corpus3["indii-touring-v1"]
            CorpusN["... (58 files total)"]
            
            Options -->|"Tools: `file_search`"| Corpus1 & Corpus2 & Corpus3 & CorpusN
        end
        
        %% Fallback / Hybrid
        WebSearch["Live Web Search Tool"]
        
        %% Synthesis
        Eval["Evaluate KB Response (Is current info needed?)"]
        SynthesisEngine["Synthesis Engine (Gemini 2.5 Flash)"]
    end

    %% Specialized Output
    subgraph OutputLayer ["Specialized Agent Processing"]
        Specialist["e.g. Publishing Agent / Legal Agent"]
        FinalResponse["Final Grounded Response"]
    end

    %% Transitions
    UserQuery --> Router
    Router --> Dispatch
    Dispatch --> Options
    
    Corpus1 & Corpus2 & Corpus3 & CorpusN -->|"Retrieves grounded facts & best practices"| Eval
    
    Eval -.->|"Detects 'prices may have changed', etc."| WebSearch
    WebSearch -.->|"Fetches live rates/trends"| SynthesisEngine
    
    Eval -->|"Passes KB Data"| SynthesisEngine
    
    SynthesisEngine -->|"Combines KB + Web, Adds Citations"| Specialist
    
    Specialist -->|"Applies Domain Logic & Next Actions"| FinalResponse

    %% Strict Rules
    subgraph Rules ["Synthesis Rules"]
        R1["Priority: File Search (grounded) > Web Search (current)"]
        R2["Conflict Resolution: Flag for human review"]
        R3["Citations: Always include source references"]
    end
    SynthesisEngine -.-> Rules

    %% Styling
    style Router fill:#00D4FF,color:#000
    style Dispatch fill:#00D4FF,color:#000
    
    style FileSearch fill:#8A2BE2,color:#FFF
    style WebSearch fill:#FF8C00,color:#000
    style SynthesisEngine fill:#FF00FF,color:#FFF
    
    style Specialist fill:#39FF14,color:#000
    style FinalResponse fill:#39FF14,color:#000
    style Rules fill:#FF3333,color:#FFF,stroke-dasharray: 5 5
```

## Transition Breakdown

1. **Routing:** `Agent Zero` receives the user query and determines which specialized agent is needed (e.g., the Publishing Agent). Before the agent acts, it dispatches the query to the Knowledge Retrieval Layer.
2. **Corpora Selection:** The RAG Agent determines which of the 12 knowledge bases (Corpora) to query (e.g., `indii-royalties-v1` and `indii-deals-v1`) by dynamically adding them as `file_search` tools.
3. **Grounded Retrieval:** The system queries the Gemini File Search API, retrieving grounded facts, templates, and best practices directly from the indexed markdown files.
4. **Currency Evaluation:** The system evaluates the response. If it detects phrases indicating missing current information (e.g., "as of my last update" or "check current rates"), it triggers the **Live Web Search Tool**.
5. **Synthesis:** The Synthesis Engine (Gemini 2.5 Flash) takes the grounded KB response and the live Web Search results and merges them. It strictly prioritizes the internal knowledge base for facts but uses the web for real-time data (like current royalty percentages).
6. **Final Processing:** The fully synthesized, highly factual context—complete with hard citations—is passed to the specialized agent (e.g., the Publishing Agent), which then outputs the final response to the user along with suggested next actions.
