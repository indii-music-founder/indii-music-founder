# Flowchart Workflow Execution Logic Flowchart

This technical flowchart details the internal logical process of the `/flowchart` command. It documents how the active context (git tree, open files, active tasks) is scanned, how the classification layer selects the diagram detail level (macro vs. micro), and the subsequent compiling, formatting, and rendering pipeline.

---

## Mermaid Diagram

```mermaid
graph TD
    %% Define Nodes
    CommandInput["User Invokes /flowchart Command"] --> ContextScan["Scan Workspace Context"]
    
    %% Context Inputs
    ContextScan --> GitStatus["git status & active branch"]
    ContextScan --> OpenFiles["Open files & cursor locations"]
    ContextScan --> TaskMD["Read task.md & active task queue"]
    
    %% Logic Processing
    GitStatus & OpenFiles & TaskMD --> ScopeClassifier{"Scope Classifier"}
    
    %% Classifier Routes
    ScopeClassifier -->|New chat / Broad strategic topic| MacroRoute["Macro-Strategy Pathway"]
    ScopeClassifier -->|Modified files / Deep code logic| MicroRoute["Micro-Technical Pathway"]
    
    %% Blueprinting and Compiling
    MacroRoute & MicroRoute --> LayerMapping["Map Functional Layers (UI, State, Services, APIs)"]
    LayerMapping --> MermaidCompiler["Compile Mermaid Code (Syntax QC)"]
    
    %% Syntax QC Gates
    MermaidCompiler --> QuoteLabels["Quote Labels containing special chars"]
    MermaidCompiler --> BlockHTML["Filter out crash-prone HTML tags"]
    QuoteLabels & BlockHTML --> ClassStyling["Inject Harmonious HSL Tailored Styles"]
    
    %% Output
    ClassStyling --> OutputMD["Output Executable Flowchart to User Chat / Living File"]
    
    %% Styling Blocks
    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px;
    classDef logic fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px;
    classDef data fill:#fff3e0,stroke:#ffb74d,stroke-width:2px;
    classDef qc fill:#fce4ec,stroke:#f06292,stroke-width:2px;
    
    class CommandInput ui;
    class ContextScan,ScopeClassifier,MacroRoute,MicroRoute,LayerMapping,MermaidCompiler logic;
    class GitStatus,OpenFiles,TaskMD data;
    class QuoteLabels,BlockHTML,ClassStyling qc;
    class OutputMD ui;
```

---

## Step-by-Step Transition Breakdown

1. **Trigger Input:** The user invokes the `/flowchart` slash command in the chat interface, requesting a visual blueprint of the architecture, workflow, or system flows.
2. **Ecosystem Inspection:** The agent scans the current active workspace. It reads:
   - **Repository State:** Branch info, uncommitted code blocks, and files with local diffs using `git status`.
   - **User Interface State:** The active open tabs, files, and where the developer's cursor is currently located.
   - **Task Context:** The active milestone in `task.md` or active blockages in the `task-queue.json` queue.
3. **Scope Classification:** The classifier dynamically determines the context depth:
   - **Macro Pathway:** Chosen if the workspace is clean, the session is fresh, or the user asks a broad architectural or strategic question.
   - **Micro Pathway:** Chosen if the developer has modified specific technical files, or is actively debugging or implementing complex code layers.
4. **Functional Layer Mapping:** The agent maps the system entities across functional layers (UI components, global stores, logic services, cloud databases, external integrations) to ensure complete alignment with the project directory structure.
5. **Mermaid Compiling & Verification:** The text is compiled into Mermaid syntax. To prevent syntax errors and parser crashes, it runs through two automatic verification filters:
   - **Quotes Enforcement:** Node labels containing special characters, brackets, or parentheses are encapsulated in quotes.
   - **HTML Prevention:** The compiler strips out crash-prone HTML tags (such as `<br>` or `<b>`).
6. **HSL Style Injection:** The compiler applies premium, Harmonious HSL styled colors to classes corresponding to each layer (UI, Services, DBs, Cloud APIs, error gates).
7. **Final Delivery:** The resulting markdown file containing the formatted flowchart and this detailed breakdown is output in the chat interface or saved directly to `docs/flowcharts/` for engineering and strategic review.
