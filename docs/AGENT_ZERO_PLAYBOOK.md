# Agent Zero Sidecar: Architectural Playbook

**Version:** 1.0
**Context:** Integration Standards for IndiiOS Microservices Architecture

This document consolidates the architectural directives for extending Agent Zero as a programmatic sidecar service. It serves as the "Source of Truth" for all backend logical implementations.

---

## 1. Core Architecture: The Sidecar Pattern

**Objective:** Treat Agent Zero as an ephemeral task runner, isolated from the Main App (IndiiOS), communicating strictly via HTTP APIs over a distinct Docker Network.

- **Service Name:** `agent_zero_engine` (Docker)
- **Communication:** HTTP Request -> JSON Payload -> Python Handler -> Agent Execution.
- **Network:** Private `internal_agent_net`.
- **Data Exchange:** Shared Volume (`/a0/usr/` <-> `/mnt/agent_assets/`).

---

## 2. API Dispatch Protocol (External Triggers)

**Module:** `python/api/`
**Purpose:** How IndiiOS triggers Agent Zero tasks.

### 2.1 The Payload "Context Key"

Never use a global agent instance. Every request must be treated as a fresh session using the `project_id` as the isolation key.

```json
{
  "project_id": "UUID_OR_ARTIST_ID",
  "instruction": "Draft a contract...",
  "agent_profile": "legal_expert"  // Optional: Load specific persona
}
```

### 2.2 Ephemeral Instantiation Logic

1. **Receive:** API Endpoint receives JSON.
2. **Configure:** Load `AgentConfig`, inject `project_id` (loads specific `secrets.env` and `memory`).
3. **Spawn:** Create `temp_agent = Agent(config)`.
4. **Execute:** Run `process()`.
5. **Destroy:** Garbage collect `temp_agent` to prevent context bleed between tenants.

---

## 3. Extensibility: Tools vs. API Handlers

**Critical Distinction:** Do not conflate internal "hands" with external "ears".

| Feature | **Python Tool** | **API Handler** |
| :--- | :--- | :--- |
| **User** | The **LLM Agent** (Internal) | The **Indii App** (External) |
| **Location** | `python/tools/` | `python/api/` |
| **Base Class** | `Tool` | `ApiHandler` |
| **Trigger** | LLM thought ("I need to draw") | HTTP POST (`/api/task`) |
| **Discovery** | auto-discovered + System Prompt | auto-discovered by file existence |

### 3.1 Constructing an API Handler

- **Path:** `python/api/{endpoint_slug}.py`
- **Class:** Inherit `ApiHandler`
- **Method:** `async def process(self, input: dict, request):`
- **Return:** JSON Dictionary (automatically serialized).

### 3.2 Constructing a Python Tool

- **Path:** `python/tools/{tool_name}.py`
- **Class:** Inherit `Tool`
- **Method:** `async def execute(self, **kwargs):`
- **Return:** `Response(message="...", break_loop=False, additional={...})`
- **Requirement:** Must have a corresponding `prompts/agent.system.tool.{tool_name}.md` file.

---

## 4. Frontend Rendering: The `img://` Protocol

**Objective:** Allow the Web UI to render files generated inside the container.

### 4.1 The Persistence Rule

Images must be physically saved to the **isolated project volume** before they can be displayed.

- **Code:** `save_path = f"/a0/usr/projects/{project_id}/assets/{filename}.png"`

### 4.2 The Protocol Bridge

The tool must return a specific string format in the `Response` object to trigger the frontend renderer.

- **Format:** `img://{absolute_path_to_file}`
- **Cache Busting:** Append `&t={timestamp}` to force UI refresh.

```python
return Response(
    message="Image created.",
    additional={"visual_output": f"img:///path/to/file.png?t=12345"}
)
```

---

## 5. Tiered Memory & Knowledge (Federated Architecture)

**Objective:** Share global company knowledge (Tier A) while successfully isolating sensitive artist data (Tier B).

### 5.1 Storage Hierarchy

1. **Global (Tier A):** Read-Only for Agents.
    - *Path:* `/a0/knowledge` (Mounted from `./global_assets/knowledge`).
    - *Content:* Templates, Brand Guidelines, Legal Boilerplate.
    - **Config:** `docker-compose.yml` mounts host `./global_assets/knowledge` to `/a0/knowledge`.
2. **Project (Tier B):** Read-Write.
    - *Path:* `/a0/usr/projects/{id}/memory`.
    - *Content:* Private chats, specific contract drafts.

### 5.2 Implementation Logic

- **Provisioning:** When creating a new project (`provision_project.py`), inject a `settings.json` file.
- **Configuration:** Set `"include_global_knowledge": true`.
- **Flow:** Agent searches Tier B (Local) -> Then Tier A (Global).
- **Prohibition:** Agents **NEVER** write to Tier A. Promotion of data from Tier B to Tier A requires human approval (Curator Workflow).
