# ISSUE-1082 Vertex rollout flowchart

This map shows the exact production image-generation path and the evidence
needed to close ISSUE-1082 without treating an opaque successful response as
proof of postpaid Vertex usage.

```mermaid
flowchart TD
    User["Authenticated creator submits image request"] --> Callable["generateImageV3 callable"]
    Callable --> Validate["Validate request and reserve cost"]
    Validate --> Provider["gateway.ts resolves effective media provider"]
    Deploy["deploy.yml writes MEDIA_PROVIDER=vertex"] --> Provider
    Provider --> Vertex["Vertex client uses ADC and configured image location"]
    Provider --> ApiKey["Dev or QA API-key path"]
    ApiKey --> RetryGate{"API key invalid or prepaid billing exhausted?"}
    RetryGate -->|"Yes"| Vertex
    RetryGate -->|"No"| Studio["Google AI Studio client"]
    Vertex --> Generate["Generate image using selected model"]
    Studio --> Generate
    Generate --> ResultGate{"Provider returns decodable image?"}
    ResultGate -->|"Yes"| Persist["Write Storage result and creative_jobs evidence"]
    Persist --> Settle["Settle exactly one cost reservation"]
    Settle --> Owner["Owner-authorized result URI and completed job"]
    ResultGate -->|"No"| Release["Release or reconcile reservation and return error"]
    Vertex --> Logs["Structured provider-selection and request logs"]
    Logs --> Alert["Monitoring resource-exhausted alert policy"]
    Alert --> Recipient["Configured operations recipient"]

    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    classDef core fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    classDef cloud fill:#e8f5e9,stroke:#39a852,stroke-width:2px
    classDef data fill:#fff3e0,stroke:#ff8c00,stroke-width:2px
    classDef gate fill:#fce4ec,stroke:#ff00aa,stroke-width:2px
    class User ui
    class Callable,Validate,Provider,Generate,Settle core
    class Deploy,Vertex,Studio,Logs,Alert,Recipient cloud
    class Persist,Owner,Release data
    class RetryGate,ResultGate gate
```

## Transition Breakdown

1. The deployed workflow must explicitly supply `MEDIA_PROVIDER=vertex`; the
   gateway then selects the ADC-backed Vertex client for production requests.
2. A request is validated and its normal cost reservation is created before a
   provider call. The selected model is resolved in `gateway.ts` and is sent
   only to the chosen provider client.
3. The API-key route remains a development and QA path. Only a genuine invalid
   key or prepaid-billing failure may retry through Vertex; production must not
   silently drift to the prepaid provider.
4. A successful response is not acceptance evidence on its own. The callable
   must persist an owner-readable Storage result, a completed `creative_jobs`
   record with the effective provider, and exactly one settled reservation.
5. Vertex initialization and request logs provide the correlated provider
   evidence. Resource-exhausted signals travel through the existing Monitoring
   alert policy to its configured recipient; the acceptance test uses a
   non-production notification test rather than causing a real outage.
6. Any provider or output failure follows the error path: do not claim a
   completed image, and release or reconcile the reservation before returning
   the failure to the caller.
