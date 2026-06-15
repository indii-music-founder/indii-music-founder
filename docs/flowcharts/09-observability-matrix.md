---
description: The Command Center Observability Matrix mapping the search querying, PromQL filtering, and Sentry hooks for comprehensive error and performance tracking.
---

# Observability Matrix

This diagram maps the Command Center's Observability dashboard, detailing how the user (or the DevOps agent) searches, filters, and investigates system metrics. Following the resolution of ISSUE-041, the matrix now includes advanced query routing via PromQL patterns and specific metric value matching.

```mermaid
graph LR
    %% ╔══════════════════════════════════════════╗
    %% ║        USER INTERFACE                    ║
    %% ╚══════════════════════════════════════════╝
    subgraph UI ["🖥️ Command Center UI"]
        SEARCH["Search & Filter Bar"]
        DASH["Performance Dashboards"]
        ERR_LOGS["Error & Warning Logs"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        QUERY PARSER LAYER                ║
    %% ╚══════════════════════════════════════════╝
    subgraph PARSER ["🔍 Query Parser"]
        direction TB
        MATCH_TIME{"Regex: Timestamp?"}
        MATCH_METRIC{"Regex: Metric (LCP, INP)?"}
        MATCH_PROMQL{"Regex: PromQL?"}
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        DATA SOURCES                      ║
    %% ╚══════════════════════════════════════════╝
    subgraph DATA ["☁️ Telemetry Sources"]
        FB_PERF["Firebase Performance Monitoring"]
        SENTRY["Sentry Integration<br/>(observability/sentry)"]
        LOG_SVC["Internal Logger Service"]
    end

    %% Connections
    SEARCH --> MATCH_TIME
    SEARCH --> MATCH_METRIC
    SEARCH --> MATCH_PROMQL
    
    MATCH_TIME -->|Filter Local Array| LOG_SVC
    MATCH_METRIC -->|Query API| FB_PERF
    MATCH_PROMQL -->|Query API| SENTRY
    
    FB_PERF --> DASH
    SENTRY --> ERR_LOGS
    LOG_SVC --> ERR_LOGS

    classDef ui fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef parser fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#FFFFFF
    classDef data fill:#FB923C,stroke:#C2410C,stroke-width:2px,color:#001018

    class SEARCH,DASH,ERR_LOGS ui
    class MATCH_TIME,MATCH_METRIC,MATCH_PROMQL parser
    class FB_PERF,SENTRY,LOG_SVC data
```

## Transition Breakdown

1. **Search Input**: The user inputs a query string into the newly added search bar in the Observability dashboard.
2. **Query Parsing**: The input is evaluated against several RegEx patterns to determine the user's intent:
    - *Timestamp Matching*: Standard ISO datetime formats.
    - *Metric Matching*: Keywords like `LCP`, `INP`, `CLS`, `FCP`, `TTFB`.
    - *PromQL*: Advanced queries using Prometheus-style syntax (supported via the Sentry/Firebase API proxies).
3. **Data Routing**:
    - Timestamps primarily filter the local/in-memory `LoggerService` outputs.
    - Core Web Vitals queries are routed to Firebase Performance Monitoring to fetch aggregated trace data.
    - Complex analytical queries or error hashes trigger the Sentry integration.
4. **Dashboard Re-render**: The returned telemetry data is piped back into the visual dashboards and error log components, allowing the user (or DevOps agent) to drill down into specific system degradation events.
