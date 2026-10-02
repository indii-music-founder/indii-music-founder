# Saved workflow results

```mermaid
flowchart TD
    A["Signed-in owner and current project"] --> B["Read owner workflow history for project"]
    B --> C{"Schema and scope valid?"}
    C -->|No or read error| D["Clear results and show unavailable"]
    C -->|Yes| E{"Server confirmed snapshot?"}
    E -->|No| F["Label cached state and disable actions"]
    E -->|Yes| G["Display persisted status and draft outputs"]
    G --> H{"Eligible lifecycle action?"}
    H -->|Cancel active or resume failed| I["Authenticated backend callable"]
    I --> J["Backend validates owner and transition"]
    J --> B
```

## Transition Breakdown

History is bounded and explicitly partial above 50 records. Account or project changes remount the consumer. Neither a callable response nor a draft output manufactures completion or establishes live campaign launch.
