# Test Console Sandbox Resolution Flowchart

This flowchart maps the execution context and console spying redirection mechanism implemented in `@/utils/logger` to resolve the test spy isolation mismatch between Node.js worker scopes and JSDOM environments.

```mermaid
graph TD
    %% Logger Invocation
    Caller["Caller Code (e.g., useAutoSave.ts)"] -->|Calls logger.warn() / logger.error()| Logger["Safe Logger (packages/renderer/src/utils/logger.ts)"]

    %% Environment Evaluation
    subgraph EnvCheck ["Environment & Context Evaluation"]
        Logger -->|Evaluates isDev| DevCheck{"isDev?"}
        DevCheck -->|false / prod| Ignore["Ignore (or sanitize error)"]
        DevCheck -->|true / test / dev| GetConsole["Call getConsole()"]
    end

    %% Sandbox Resolution Logic
    subgraph SandboxResolution ["Sandbox & Window Resolution"]
        GetConsole --> WindowCheck{"typeof window !== 'undefined'?"}
        WindowCheck -->|Yes: JSDOM / Browser| UseJSDOM["Return window.console"]
        WindowCheck -->|No: Node.js worker / CLI| UseNode["Return node global.console"]
    end

    %% Execution and Assertions
    subgraph Execution ["Spy Interception & Assertions"]
        UseJSDOM -->|Executes method| SpiedConsole["window.console.warn / error"]
        SpiedConsole -->|Intercepted by| VitestSpy["vi.spyOn(console, 'warn')"]
        VitestSpy -->|Result| TestSuccess["Assertion passes ✓"]
        
        UseNode -->|Executes method| NodeConsole["global.console.warn / error"]
        NodeConsole -->|Output| TermStdout["Terminal stdout / log"]
    end

    %% Styles
    style Caller fill:#00FFFF,color:#000
    style Logger fill:#ADFF2F,color:#000
    style GetConsole fill:#FF8C00,color:#000
    style WindowCheck fill:#FFD700,color:#000
    style VitestSpy fill:#FF00FF,color:#FFF
    style TestSuccess fill:#32CD32,color:#FFF
```

## Transition Breakdown

1. **Logger Invocation:**
   Application source code invokes safe logger wrapper methods (e.g., `logger.warn` or `logger.error`) rather than calling raw global console functions directly.

2. **Environment & Context Evaluation:**
   `logger.ts` determines if logging should proceed. Under Vitest, `process.env.NODE_ENV === 'test'` is captured as a test environment identifier, forcing `isDev = true`.

3. **Sandbox & Window Resolution:**
   - In JSDOM test suites (such as React components and custom React hooks), Vitest isolates execution within a JSDOM window mockup. Spies are bound to `window.console`.
   - `getConsole()` dynamically checks for `window.console`. If present (such as inside a React testing hook or component environment), it resolves to the JSDOM `window.console` reference rather than the Node module scope's global `console` closure.
   - If `window` is undefined (such as when running raw Node.js unit tests or during Server-Side Rendering), it safely falls back to standard `console`.

4. **Spy Interception:**
   By resolving to the sandboxed `window.console`, calls dynamically invoke the correct mock/spied function. The test assertion `expect(consoleWarnSpy).toHaveBeenCalledWith(...)` correctly registers the call, eliminating "Number of calls: 0" failures.
