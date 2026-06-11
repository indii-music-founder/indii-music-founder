# Git Monitor Sync Architecture Flowchart

Below is the flowchart representing the Git Monitor & Sync loop system, showing how uncommitted changes are stashed, remote rebases are handled, pre-push validation (typecheck + vitest) is executed, and dynamic cron backoffs are updated.

```mermaid
graph TD
    A["Cron Triggered /get-git"] --> B["Fetch origin status"]
    B --> C{"Uncommitted Changes?"}
    C -- Yes --> D["Stash Changes"]
    C -- No --> E{"Behind origin?"}
    D --> E
    E -- Yes --> F["Pull --rebase origin"]
    E -- No --> G{"Ahead of origin?"}
    F --> H{"Stash existed?"}
    H -- Yes --> I["Pop Stash"]
    H -- No --> G
    I --> G
    G -- Yes --> J["Run npm run typecheck"]
    G -- No --> K["Dynamic Backoff Check"]
    J --> L["Run npm test"]
    L --> M{"Validation Passed?"}
    M -- Yes --> N["Git push origin"]
    M -- No --> O["Log Error & Abort Push"]
    N --> P["Reset Backoff to 15m"]
    O --> K
    K --> Q{"Interval Changed?"}
    Q -- Yes --> R["Kill old Cron & Schedule New Cron"]
    Q -- No --> S["End Cycle"]
    R --> S
    P --> S
```

## Transition Breakdown

1. **Change Detection:** Automatically performs a `git fetch` to evaluate the current branch relationship with the remote tracker.
2. **Rebase Sync:** Integrates remote changes cleanly. If uncommitted changes exist, they are stashed and then popped after rebase pull.
3. **Pre-Push Validation:** Runs all local typechecks and vitest unit tests before triggering a push. Any failure blocks the push to prevent breaking the remote branch.
4. **Dynamic Backoff Scheduling:** Automatically halves or resets the polling sequence, cancelling stale cron tasks and rescheduling updated intervals under the `schedule` API.
