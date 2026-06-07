# Project Pinocchio Media Test Rotator Flowchart

Purpose: Map the execution, state transition, and feedback loops of the media-focused E2E test rotator cron.

```mermaid
graph TD
    CronTrigger["Cron Job Trigger<br>(*/30 * * * *)"] --> PromptAgent["Agent receives high-priority notification"]
    PromptAgent --> ExecRotator["Run 'node scratch/test-rotator.js'"]
    
    ExecRotator --> ReadState["Read current index from scratch/test-state.json"]
    ReadState --> MapSpec["Map index to E2E spec in SPECS array<br>(0 to 6)"]
    
    MapSpec --> RunPlaywright["Execute 'npx playwright test {spec} --project=chromium'"]
    
    RunPlaywright --> TestExecution{"E2E Test Execution"}
    TestExecution -->|"Local Mock Auth"| AuthPage["Log in programmatically via authedPage fixture"]
    TestExecution -->|"Vite Dev Server"| DevServer["Target local port 4242"]
    TestExecution -->|"Off-Line / Mock AI"| MockAI["Intercept AI calls (Vertex/Gemini)"]
    
    AuthPage --> TestResult{"Test Result"}
    DevServer --> TestResult
    MockAI --> TestResult
    
    TestResult -->|"Success"| LogPass["Log ✅ Test passed"]
    TestResult -->|"Failure"| LogFail["Log ❌ Test failed"]
    
    LogPass --> AdvanceState["Advance index: (currentIndex + 1) % 7"]
    LogFail --> AdvanceState
    
    AdvanceState --> WriteState["Write nextIndex back to scratch/test-state.json"]
    WriteState --> ReadyNext["Rotator ready for next cron iteration"]

    style CronTrigger fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style PromptAgent fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style ExecRotator fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style ReadState fill:#efebe9,stroke:#ff8f00,stroke-width:2px
    style RunPlaywright fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style TestResult fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style LogPass fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style LogFail fill:#ffebee,stroke:#d81b60,stroke-width:2px
    style WriteState fill:#efebe9,stroke:#ff8f00,stroke-width:2px
```

## Transition Breakdown

1. **Trigger Interval**: The background cron scheduler triggers every 30 minutes, outputting a high-priority system message containing instructions to run the rotator script.
2. **State Retrieval**: `scratch/test-rotator.js` initializes and reads `scratch/test-state.json`. If the file is missing or corrupt, it defaults to index `0`.
3. **Spec Selection**: The script maps the index to one of 7 media/boardroom-focused E2E tests:
   - `0: e2e/creative-studio.spec.ts`
   - `1: e2e/creative-prompt-builder.spec.ts`
   - `2: e2e/boardroom-generate-media.spec.ts`
   - `3: e2e/video-producer-ux.spec.ts`
   - `4: e2e/creative-character.spec.ts`
   - `5: e2e/creative-persistence.spec.ts`
   - `6: e2e/video-studio.spec.ts`
4. **Isolated Test Execution**: The selected E2E spec runs under Playwright on the `chromium` project, targeting `http://localhost:4242`. The `authedPage` fixture bypasses real login paths to maintain speed and offline isolation.
5. **State Progression**: Regardless of whether the test passes or fails, the index is incremented (`currentIndex + 1`) and wrapped around the length of the array (`% 7`), then saved to `scratch/test-state.json` to prevent execution loops from getting stuck on a single failing spec.
