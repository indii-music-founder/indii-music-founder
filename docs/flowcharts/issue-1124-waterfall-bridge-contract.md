# ISSUE-1124 Waterfall Bridge Contract

This diagram records the bounded local payout-simulation path and the stdout
contract that connects the Python engine to Electron. It does not represent a
live payout, payment-provider call, or movement of money.

```mermaid
flowchart TD
    User["User launches the waterfall simulation"] --> Bank["BankPanel builds gross and fractional splits"]
    Bank --> Service["DistributionService.executeWaterfall"]
    Service --> Preload["Electron preload invokes distribution:execute-waterfall"]
    Preload --> Handler["Distribution IPC handler serializes the payload"]
    Handler --> Supervisor["AgentSupervisor.execute validates timeout and schema"]
    Supervisor --> Bridge["PythonBridge.runScript starts the local subprocess"]
    Bridge --> Engine["waterfall_payout.py calculates fee and party amounts"]
    Engine --> Logs["Calculation logs go to stderr"]
    Engine --> Output["One compact JSON object goes to stdout"]
    Output --> Parse{"PythonBridge parses the final stdout line"}
    Parse -- "Parsed object" --> Validate["AgentSupervisor accepts the JSON report"]
    Validate --> Handler
    Handler --> Service
    Service --> Bank
    Bank --> Display["UI renders 425, 255, 170, 850 total, and processed_at"]
    Parse -- "Raw string" --> Reject["AgentSupervisor rejects the IPC schema"]

    classDef ui fill:#0F172A,stroke:#00D4FF,stroke-width:2px,color:#F8FAFC
    classDef main fill:#1E1B4B,stroke:#8B5CF6,stroke-width:2px,color:#F8FAFC
    classDef python fill:#1C1917,stroke:#FB923C,stroke-width:2px,color:#F8FAFC
    classDef gate fill:#2D0C0F,stroke:#F87171,stroke-width:2px,color:#F8FAFC

    class User,Bank,Service,Display ui
    class Preload,Handler,Supervisor,Bridge,Validate main
    class Engine,Logs,Output python
    class Parse,Reject gate
```

## Transition breakdown

1. `BankPanel` converts the visible 50/30/20 percentages to fractional splits
   and asks `DistributionService` to execute the local simulation.
2. The preload API sends the request to the main-process distribution handler,
   which serializes the data as the Python script's single payload argument.
3. `AgentSupervisor` applies the timeout and delegates execution to
   `PythonBridge`, which starts `execution/finance/waterfall_payout.py`.
4. The script deducts the 15% platform fee from $1,000 and divides the remaining
   $850 into $425, $255, and $170. Diagnostic logging uses stderr.
5. The final report is emitted as one compact JSON line on stdout because
   `PythonBridge` parses only the final stdout line.
6. `AgentSupervisor` accepts the parsed object, and the report returns through
   IPC to the renderer. A raw string is rejected instead of being treated as a
   valid payout report.
7. The UI renders the three numeric distributions, the $850 total, and the
   `processed_at` timestamp. This path is a local calculation only.
