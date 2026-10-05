# Directive: Blender MCP 3D Procedural Video & Visualizer Engine

## 1. Objective
Define the operational Standard Operating Procedure (SOP) for the **indii Blender MCP (Model Context Protocol) Integration**. This directive enables autonomous indii specialist agents (Video Agent, Creative Agent, Generalist Agent / Conductor) and human operators to discover, query, control, and execute 3D music video and visualizer renders using local Blender installations via MCP.

---

## 2. Architectural Boundaries & 3-Layer Separation

### Layer 1: Directive (This File)
- Defines high-level procedural rules, template selection, input validation boundaries, cancellation policies, and asset persistence requirements.

### Layer 2: Orchestration (Agent Swarm & Conductor)
- Conductor delegates 3D video requests to `VideoAgent` or `CreativeAgent`.
- Agents use certified tool definitions exposed via `BlenderTools`:
  - `blender_get_status`
  - `blender_list_templates`
  - `blender_render_music_video`
  - `blender_live_command`

### Layer 3: Execution (Native Electron IPC & Local MCP Server)
- Native desktop service: `packages/main/src/services/blender/BlenderService.ts` communicating with `packages/mcp-server-local/src/blender/executor.ts`.
- Python runner: `packages/mcp-server-local/src/blender/python/runner.py` executed within the user's installed Blender binary (Blender 4.x/5.x LTS).
- Renderer UI: `packages/renderer/src/modules/creative/video/components/BlenderVideoPanel.tsx`.

---

## 3. Tool Registry Declarations

| Tool Name | Scope | Risk Tier | Description |
|-----------|-------|-----------|-------------|
| `blender_get_status` | Direct / Specialist | `read` | Check Blender connection status, active version, scene information, and render engine. |
| `blender_list_templates` | Direct / Specialist | `read` | Retrieve available procedural 3D templates (e.g., Cyberpunk Tunnel, Vinyl Showcase, Frequency Ribbons, Wireframe Sphere). |
| `blender_render_music_video` | Direct / Specialist | `write` | Launch a background procedural render job for a given audio file, template, duration, and resolution. |
| `blender_live_command` | Direct / Specialist | `write` | Send live viewport commands (camera adjust, lighting shift, material update) to active Blender session. |

---

## 4. Operational Protocols

### 4.1 Environment Check & Web Fallback
1. In desktop Electron mode, query `blender_get_status` to verify Blender executable availability.
2. In browser-only mode (`VITE_RENDERER_ONLY=true`), the system must **never** falsely report that Blender is missing or uninstalled. It must honestly inform the user that local hardware processes require the indii Desktop application.

### 4.2 Input Validation Boundary
Before executing any render job:
- **Audio Path Required:** An existing, readable audio file path (`.wav`, `.mp3`, `.flac`) must be explicitly provided. Tool calls with empty or invalid paths fail immediately with error `audioPath must point to a readable file`.
- **Output Reservation:** Output MP4 paths are generated with unique UUIDs in managed app storage. Overwriting existing files is strictly forbidden.

### 4.3 Progress & Timeout Safety
- The Python runner emits real-time frame completion notifications over MCP stderr/stdout.
- IPC forwards genuine progress percentages to the renderer. Timer-based fake progress is strictly prohibited.
- Active progress resets the timeout window; long renders are bounded by a strict two-hour deadline.

### 4.4 Cancellation & Process Cleanup
- User-initiated cancellation or window teardown triggers SIGTERM to the specific Blender child PID.
- Incomplete or aborted render files are deleted immediately to prevent storage leaks.
- Successful outputs are retained in managed storage and committed to project assets with Firestore ledger records.

---

## 5. Failure Modes & Recovery
- **Blender Missing from PATH:** Suggest configuring custom binary path in Settings.
- **Python Execution Failure:** Runner logs process exit code and stderr; agent bubbles up clear diagnostic message.
- **Audio Strip Creation Failure:** Abort render immediately, clean up reserved output path, and alert user to audio file format incompatibility.
