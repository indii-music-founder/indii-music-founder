# Observability & Debug Module (RC1)

The Observability module provides real-time insights into the health, performance, and behavior of the indiiOS ecosystem. It is designed for engineers and power users to monitor AI execution, track costs, and debug complex agent interactions.

## 🔍 Key Features
- **Trace Explorer:** Deep-dive into every AI agent interaction, showing prompts, reasoning steps, and tool calls.
- **Cost Tracker:** Real-time monitoring of AI API spend (Gemini, Vertex AI) across the entire organization.
- **System Health:** Status indicators for critical services like Firestore, Inngest, and the Agent Zero sidecar.
- **Agent Logs:** Dedicated console for viewing raw output from the hub-and-spoke system.
- **Error Ledger:** Institutional memory of system crashes and resolved bugs.

## 🏗️ Technical Architecture
- **`TraceService`**: Captures and persists granular "traces" of agent workflows to Firestore.
- **`APIHealthService`**: Periodically pings backend endpoints to ensure uptime.
- **`CircuitBreaker`**: Monitoring UI for the system's safety triggers.
- **Sentry Integration:** Real-time error reporting and stack trace capturing.

## 🛠️ Usage
1. Open the **Command Bar** and type `/debug` to access the hidden observability panel.
2. Filter traces by `traceId` to follow a specific user request through multiple agents.
3. Review the **Cost Predictor** before initiating massive batch generation tasks.
