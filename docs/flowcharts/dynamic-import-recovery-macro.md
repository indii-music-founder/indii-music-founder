# Dynamic Import Chunk Error Recovery Macro

This flowchart illustrates the unified recovery flow for dynamically imported modules and agent tools, preventing dead-ends on stale-chunk 404 errors post-deployment.

```mermaid
flowchart TD
    Start["User/System Requests Agent Tool or Chunk"] --> ImportRequest("utils/dynamicImport: importWithRetry")
    
    ImportRequest --> TryFetch{"Attempt to fetch\nDynamic Chunk"}
    
    TryFetch -->|Success| ClearFlag["Clear sessionStorage\nreload flag"]
    ClearFlag --> ReturnModule(("Return Module"))
    
    TryFetch -->|Error| CheckError{"Is ChunkLoadError\nor Failed to fetch?"}
    
    CheckError -->|No| OtherRetry{"Are retries\nremaining?"}
    OtherRetry -->|Yes| DelayWait["Exponential Backoff Delay"]
    DelayWait --> TryFetch
    OtherRetry -->|No| ThrowErr(("Throw Normal Error"))
    
    CheckError -->|Yes| Decrement["Decrement Retries"]
    Decrement --> RetryCheck{"Retries == 0?"}
    
    RetryCheck -->|No| DelayWait
    RetryCheck -->|Yes| FlagCheck{"sessionStorage\nflag set?"}
    
    FlagCheck -->|No| SetFlag["Set sessionStorage flag"]
    SetFlag --> HardReload(("Force Hard window.location.reload"))
    
    FlagCheck -->|Yes| AbortLoop(("Throw Permanent Error\nto avoid infinite loop"))
```

## Step-by-Step Transition Breakdown

- **Start to ImportRequest**: An agent or tool is lazy-loaded, passing through the unified `importWithRetry` helper.
- **ImportRequest to TryFetch**: Transient network errors are retried with exponential backoff.
- **TryFetch to CheckError**: If the error is a systemic `ChunkLoadError` (meaning a new deployment has wiped the old chunk hash from the server), we evaluate the retries.
- **CheckError to Decrement**: If retries run out, the utility checks a `sessionStorage` guard.
- **FlagCheck to HardReload**: If no reload has occurred yet, it performs a hard page reload to fetch the new `index.html` and the updated chunk hashes.
- **FlagCheck to AbortLoop**: If a reload already occurred but the chunk still fails, it breaks the loop and throws a permanent error so the application does not get stuck in an infinite reload cycle.
