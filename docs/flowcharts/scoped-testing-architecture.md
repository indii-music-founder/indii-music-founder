# Scoped Testing Architecture Flowchart

This visual architecture map documents the scoped testing framework, illustrating how category-aware workspace testing (Tools, Departments, Managers, Projects) maps from execution parameters to unit tests, integration E2E tests, Python dependency checks, real fixtures, and manual browser acceptance points.

## Diagram

```mermaid
graph TD
    CLI["CLI Trigger (python3 execution/run_department_test.py [target] [options])"] --> RegistryLoad["Load Registry (departments_test_config.json)"]
    RegistryLoad --> MatchTarget["Match Target Key / Alias"]
    
    subgraph "Category Resolution"
        MatchTarget --> CatDept["Category: department"]
        MatchTarget --> CatTool["Category: tool"]
        MatchTarget --> CatManager["Category: manager"]
        MatchTarget --> CatProject["Category: project"]
    end

    CatDept & CatTool & CatManager & CatProject --> ParsePaths["Resolve Test Paths and Metadata on Disk"]
    ParsePaths --> FixtureAudit["Audit Fixture Paths and Manual Routes"]
    
    subgraph "Execution Pipeline"
        FixtureAudit --> UnitGate{"--e2e-only or --python-only set?"}
        UnitGate -- No --> RunUnit["Run Vitest (npm run test -- --run [paths])"]
        UnitGate -- Yes --> E2EGate
        
        RunUnit --> E2EGate{"--unit-only or --python-only set?"}
        E2EGate -- No --> RunE2E["Run Playwright Core E2E Specs"]
        E2EGate -- Yes --> PythonGate
        
        RunE2E --> RunConnE2E{"--no-connections set?"}
        RunConnE2E -- No --> RunConnected["Run Playwright Connected Specs"]
        RunConnE2E -- Yes --> PythonGate
        RunConnected --> PythonGate{"--unit-only or --e2e-only set?"}
        PythonGate -- No --> RunPython["Run Python Checks (python3 -m py_compile [paths])"]
        PythonGate -- Yes --> ReportGen
        RunPython --> ReportGen["Assemble Execution Report"]
    end
    
    ReportGen --> ConsoleOutput["Console Color Summary"]
    ReportGen --> ExitStatus["Exit Code (0 on PASS, 1 on FAIL)"]
    ExitStatus --> CI["CI/CD Gate Integration"]

    style CLI fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style RegistryLoad fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style MatchTarget fill:#efebe9,stroke:#6d4c41,stroke-width:2px
    style ParsePaths fill:#efebe9,stroke:#ff8f00,stroke-width:2px
    style FixtureAudit fill:#fff8e1,stroke:#ff8f00,stroke-width:2px
    style RunPython fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style ExitStatus fill:#efebe9,stroke:#ff8f00,stroke-width:2px
    style CI fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

## Transition Breakdown

1.  **CLI Trigger:** The process begins when a developer or agent runs the CLI command targeting a specific sidebar tab (e.g., `marketing`, `workflow`, `audio-analyzer`).
2.  **Registry Load:** The runner loads the central JSON mapping database (`departments_test_config.json`).
3.  **Category Resolution:** The script resolves the query against keys and aliases, finding the specific category type (e.g., `tool`, `department`, `manager`, `project`).
4.  **Path and Metadata Resolution:** The runner checks the filesystem to filter out non-existent unit/E2E/Python check paths and reports configured fixtures, browser routes, and coverage checklist items.
5.  **Execution Pipeline:** The script runs Vitest for unit/integration tests, Playwright for E2E and connected E2E tests, and Python syntax/dependency surface checks. Options (`--unit-only`, `--e2e-only`, `--python-only`, `--no-connections`) gate each layer.
6.  **Audio System Example:** The `audio-analyzer` target resolves aliases such as `audio`, `mega-test-audio`, and `MegaTestAudioLoop`, then covers Audio Analyzer UI, browser CSP safety, Firebase audio APIs, MusicLibrary persistence, agent audio tools, Distribution/DDEX metadata, main-process file security, Python audio forensic tools, and real WAV/MP3 fixtures.
7.  **Reporting & Exit:** The runner outputs a clear pass/fail summary and exits with the appropriate status code (`0` or `1`) to enforce quality gates in local workflows or CI/CD pipelines.
