# Execution Telemetry Analysis

Specifies metrics, structured telemetry formats, and diagnostic protocols for monitoring indiiOS custom agent execution health, tool fidelity, and performance bottlenecks.

## Telemetry Metrics

1. **Tool Success Rate (TSR):** Ratio of successful tool invocations to total attempts. Any agent with TSR < 95% triggers inspection.
2. **Context Growth Velocity (CGV):** Rate of token accumulation per interaction cycle. Rapid jumps indicate context bloat or repetitive history.
3. **Execution Latency (TTFT & TTFC):** Time to first tool call and time to complete execution.
4. **Error Taxonomy:**
   - `TIMEOUT_ERROR`: External API / network timeouts (Vertex AI, Cloud Functions, Firestore).
   - `SCHEMA_VIOLATION`: Invalid tool payload or return structure mismatch.
   - `HALLUCINATED_TOOL`: Agent attempting to invoke non-registered tools.
   - `RECURSIVE_LOOP`: Repeated identical tool calls with identical parameters failing consecutively.

## Diagnostic Protocol

- Ingest agent traces from `.agent/observations/`, `.agent/reports/`, and test run logs.
- Detect recurring root causes and categorize by prompt defect, missing skill, or broken execution script.
- Apply targeted remediation to agent YAML/Markdown definitions.
