---
description: The secure architecture of the automated bug reporting pipeline, emphasizing the shift of GitHub credentials to the backend and the new search-before-create idempotency logic.
---

# Bug Reporter Pipeline

This flowchart outlines the newly secured `BugReportTools` pipeline. Following the resolution of ISSUE-031, this architecture completely abstracts the GitHub API token away from the client bundle, shifts execution to a Firebase Cloud Function, and enforces idempotency via content hashing to prevent duplicate issue spam during rapid agent iterations.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        CLIENT / AGENT TIER               ║
    %% ╚══════════════════════════════════════════╝
    subgraph CLIENT ["🖥️ Client (Renderer)"]
        AGENT["Specialist Agent<br/>(e.g., QA / DevOps)"]
        TOOL["BugReportTools.report_bug()"]
        HASH["Generate Idempotency Hash<br/>(Title + Module)"]
        CALLABLE["httpsCallable('reportBug')"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        BACKEND CLOUD FUNCTION            ║
    %% ╚══════════════════════════════════════════╝
    subgraph CLOUD ["☁️ Firebase Cloud Functions"]
        CF_REPORT["reportBugFn"]
        AUTH_CHK{"Is User Auth'd?"}
        SECRET["Access Secret Manager<br/>(GITHUB_TOKEN)"]
        GH_SEARCH["GitHub API: GET /issues<br/>(Search exact title/module)"]
        DUP_CHK{"Match Found?"}
        
        GH_CREATE["GitHub API: POST /issues<br/>(Create new)"]
        GH_COMMENT["GitHub API: POST /issues/{id}/comments<br/>(Append metadata)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        PERSISTENCE & OUTCOME             ║
    %% ╚══════════════════════════════════════════╝
    subgraph DATA ["💾 Persistence & Response"]
        FIRESTORE["Firestore: bug_reports/{hash}"]
        RESULT["Detailed Result Object<br/>{firestore, github, issueUrl}"]
    end

    %% Connections
    AGENT -->|Calls Tool| TOOL
    TOOL --> HASH
    HASH --> CALLABLE
    CALLABLE -->|Secure HTTPS| CF_REPORT

    CF_REPORT --> AUTH_CHK
    AUTH_CHK -->|Fail| RESULT
    AUTH_CHK -->|Pass| SECRET
    
    SECRET --> GH_SEARCH
    GH_SEARCH --> DUP_CHK
    
    DUP_CHK -->|No| GH_CREATE
    DUP_CHK -->|Yes| GH_COMMENT
    
    GH_CREATE --> FIRESTORE
    GH_COMMENT --> FIRESTORE
    
    FIRESTORE --> RESULT
    RESULT -.->|Returns to Agent| AGENT

    classDef client fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef cloud fill:#FF8C00,stroke:#AA5500,stroke-width:2px,color:#001018
    classDef data fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018

    class AGENT,TOOL,HASH,CALLABLE client
    class CF_REPORT,AUTH_CHK,SECRET,GH_SEARCH,DUP_CHK,GH_CREATE,GH_COMMENT cloud
    class FIRESTORE,RESULT data
```

## Transition Breakdown

1. **Agent Tool Invocation**: An agent detects a bug or decides to file an issue and calls `report_bug()`.
2. **Idempotency Hashing**: The client generates a SHA256 content hash using the issue title, module, and error type. This hash becomes the primary key for idempotency.
3. **Secure Function Call**: The client invokes the `reportBug` Cloud Function via `httpsCallable`. The client bundle *never* contains the GitHub API token.
4. **Backend Authorization & Secrets**: The Cloud Function verifies the user's Firebase Auth token. Upon success, it pulls the sensitive `GITHUB_TOKEN` from Google Cloud Secret Manager.
5. **Search-Before-Create**: The function queries the GitHub Issues API (`GET /issues`) searching for an open issue with the exact same title and module label authored by the app.
6. **Deduplication Logic**: 
    - If a duplicate is found, the system *appends* a new comment with the latest error metadata rather than opening a redundant issue.
    - If no duplicate exists, it creates a pristine new issue.
7. **Firestore Persistence & Response**: The action is recorded in Firestore under `bug_reports/{hash}`. A detailed JSON object is returned to the agent explicitly defining the success/failure state of both the GitHub POST and the Firestore write, eliminating silent failure blind spots.
